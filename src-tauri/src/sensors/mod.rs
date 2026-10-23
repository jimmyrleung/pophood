//! The sensor supervisor: owns the helper processes and the pipe connections, runs the pure state machine in
//! [`machine`], and forwards status and frames to the UI over a Tauri `Channel`.
//!
//! One tokio task owns all state. Everything else (verify, launch, connect, the readers, timers) runs as a small task
//! that reports back through the same mpsc channel, tagged with the generation of the link it belongs to, so a result
//! that arrives after its link was torn down is dropped.

pub mod events;
pub mod helper;
pub mod machine;
pub mod pipe;
pub mod protocol;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc as std_mpsc;
use std::time::{Duration, Instant};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use self::events::{Notice, NoticeCode, SensorEvent, SensorStatus, UiFrame};
use self::helper::{ElevateError, HelperImage, HelperProcess, ImageError, launch_elevated, launch_unprivileged, wait_all};
use self::machine::{
    CONNECT_TIMEOUT, ELEVATED_TIMEOUT, Effect, Event, Source, State, Terminate, Timer, transition,
};
use self::pipe::{HelperConnection, PipeError, connect_verified, new_pipe_name};
use self::protocol::HelperMessage;

const HELPER_FILE_NAME: &str = "pophood-sensors.exe";
/// A retired unprivileged helper has this long to exit by itself (it exits when its pipe closes).
const RETIRE_GRACE: Duration = Duration::from_secs(3);
/// One shared deadline for every helper at app exit.
const EXIT_GRACE: Duration = Duration::from_secs(3);

type Sink = Box<dyn Fn(SensorEvent) -> bool + Send>;

pub struct Config {
    pub helper_path: PathBuf,
    pub client_path: PathBuf,
    pub expected_sha256: String,
    /// The HWND of the main window, so the UAC prompt opens in the foreground (0 if there is none).
    /// It waits on the main thread, so call it from a blocking thread, never on the runtime.
    pub owner_hwnd: Arc<dyn Fn() -> isize + Send + Sync>,
}

impl Config {
    pub fn for_app(app: &AppHandle) -> Self {
        let exe = std::env::current_exe().expect("the app knows its own path");
        let dir = exe.parent().expect("the exe has a folder").to_path_buf();
        let app = app.clone();
        Self {
            helper_path: dir.join(HELPER_FILE_NAME),
            client_path: exe,
            expected_sha256: env!("POPHOOD_HELPER_SHA256").to_string(),
            owner_hwnd: Arc::new(move || {
                app.get_webview_window("main").and_then(|window| window.hwnd().ok()).map_or(0, |hwnd| hwnd.0 as isize)
            }),
        }
    }
}

enum Io {
    Verified(HelperImage),
    VerifyFailed(Notice),
    Launched(HelperProcess),
    LaunchFailed(String),
    Cancelled,
    Connected(HelperConnection),
    ConnectFailed(PipeError),
    Message(HelperMessage),
    ReadFailed(PipeError),
}

enum Msg {
    Begin,
    Subscribe(Sink),
    EnableFull,
    Retry,
    Shutdown(std_mpsc::Sender<()>),
    Io { source: Source, generation: u64, io: Io },
    Timer { timer: Timer, id: u64 },
}

/// The public handle: cheap to clone through Tauri's state, every method just sends a message.
pub struct SensorService {
    tx: mpsc::UnboundedSender<Msg>,
}

impl SensorService {
    /// Must be called from Tauri's `setup` (no tokio context there), hence `tauri::async_runtime::spawn`.
    pub fn start(app: AppHandle) -> Self {
        Self::start_with(Config::for_app(&app))
    }

    pub fn start_with(config: Config) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let runtime = Runtime::new(config, tx.clone());
        tauri::async_runtime::spawn(runtime.run(rx));
        let _ = tx.send(Msg::Begin);
        Self { tx }
    }

    /// Registers the UI's Channel, replacing any earlier one (a webview reload does that). The UI immediately gets the
    /// current status, then the latest frame if there is one.
    pub fn subscribe(&self, channel: Channel<SensorEvent>) {
        let sink: Sink = Box::new(move |event| channel.send(event).is_ok());
        let _ = self.tx.send(Msg::Subscribe(sink));
    }

    pub fn enable_full(&self) {
        let _ = self.tx.send(Msg::EnableFull);
    }

    pub fn retry(&self) {
        let _ = self.tx.send(Msg::Retry);
    }

    /// Drops the pipes, waits for every helper against one 3 s deadline, terminates the rest. Blocks for that long at most.
    pub fn shutdown_blocking(&self) {
        let (reply, done) = std_mpsc::channel();
        if self.tx.send(Msg::Shutdown(reply)).is_ok() {
            let _ = done.recv_timeout(EXIT_GRACE + Duration::from_secs(3));
        }
    }
}

#[derive(Default)]
struct Link {
    /// Bumped whenever the link is torn down or restarted; results tagged with an older value are dropped.
    generation: u64,
    pipe: String,
    image: Option<HelperImage>,
    process: Option<Arc<HelperProcess>>,
    reader: Option<JoinHandle<()>>,
}

struct Runtime {
    cfg: Config,
    tx: mpsc::UnboundedSender<Msg>,
    state: State,
    sink: Option<Sink>,
    last_status: Option<SensorStatus>,
    last_frame: Option<UiFrame>,
    links: [Link; 2],
    retiring: Vec<Arc<HelperProcess>>,
    timers: HashMap<Timer, (u64, JoinHandle<()>)>,
    timer_seq: u64,
    shutdown_reply: Option<std_mpsc::Sender<()>>,
    finished: bool,
}

fn index(source: Source) -> usize {
    match source {
        Source::Unprivileged => 0,
        Source::Elevated => 1,
    }
}

fn debug_log(text: impl FnOnce() -> String) {
    if cfg!(debug_assertions) {
        eprintln!("[sensors] {}", text());
    }
}

impl Runtime {
    fn new(cfg: Config, tx: mpsc::UnboundedSender<Msg>) -> Self {
        Self {
            cfg,
            tx,
            state: State::new(),
            sink: None,
            last_status: None,
            last_frame: None,
            links: [Link::default(), Link::default()],
            retiring: Vec::new(),
            timers: HashMap::new(),
            timer_seq: 0,
            shutdown_reply: None,
            finished: false,
        }
    }

    async fn run(mut self, mut rx: mpsc::UnboundedReceiver<Msg>) {
        while let Some(msg) = rx.recv().await {
            self.handle(msg).await;
            if self.finished {
                break;
            }
        }
    }

    async fn handle(&mut self, msg: Msg) {
        match msg {
            Msg::Begin => self.feed(Event::Begin).await,
            Msg::Subscribe(sink) => {
                self.sink = Some(sink);
                let status = self.status();
                self.send(SensorEvent::Status { status });
                if let Some(frame) = self.last_frame.clone() {
                    self.send(SensorEvent::Frame { frame });
                }
            }
            Msg::EnableFull => self.feed(Event::EnableFull).await,
            Msg::Retry => self.feed(Event::Retry).await,
            Msg::Shutdown(reply) => {
                if self.state.exiting {
                    let _ = reply.send(());
                } else {
                    self.shutdown_reply = Some(reply);
                    self.feed(Event::Exit).await;
                }
            }
            Msg::Timer { timer, id } => {
                if self.timers.get(&timer).is_some_and(|(current, _)| *current == id) {
                    self.timers.remove(&timer);
                    let event = match timer {
                        Timer::Restart => Event::RestartTimer,
                        Timer::LiveFor60s => Event::LiveFor60s,
                        Timer::FirstFrame(source) => Event::FirstFrameTimeout(source),
                    };
                    self.feed(event).await;
                }
            }
            Msg::Io { source, generation, io } => self.handle_io(source, generation, io).await,
        }
    }

    async fn handle_io(&mut self, source: Source, generation: u64, io: Io) {
        if self.links[index(source)].generation != generation {
            // The link was torn down while this was in flight. A process that started anyway must not be orphaned.
            if let Io::Launched(process) = io {
                process.terminate();
            }
            return;
        }
        let event = match io {
            Io::Verified(image) => {
                self.links[index(source)].image = Some(image);
                Event::Verified(source)
            }
            Io::VerifyFailed(notice) => Event::VerifyFailed(source, notice),
            Io::Launched(process) => {
                self.links[index(source)].process = Some(Arc::new(process));
                Event::Launched(source)
            }
            Io::LaunchFailed(why) => Event::LaunchFailed(source, why),
            Io::Cancelled => Event::Cancelled,
            Io::Connected(connection) => {
                let reader = spawn_reader(self.tx.clone(), source, generation, connection);
                self.links[index(source)].reader = Some(reader);
                return;
            }
            Io::ConnectFailed(error) => match error {
                PipeError::Timeout => Event::ConnectTimeout(source),
                PipeError::ChildExited(code) => Event::ChildExited(source, code),
                PipeError::Squatter { detail } => Event::Squatter(source, detail),
                other => Event::LineError(source, other.to_string()),
            },
            Io::Message(message) => match message {
                HelperMessage::Hello(hello) => Event::Hello(source, hello),
                HelperMessage::Frame(frame) => Event::Frame(source, frame),
                HelperMessage::Ack(_) => return,
                HelperMessage::Error(error) if error.code == "lhm_failed" => Event::HelperFatal(source, error.detail),
                HelperMessage::Error(error) => {
                    debug_log(|| format!("{source:?} helper replied {}: {}", error.code, error.detail));
                    Event::OtherHelperError(source)
                }
            },
            Io::ReadFailed(error) => match error {
                PipeError::Closed | PipeError::Io(_) => Event::Eof(source),
                PipeError::Protocol(protocol::ProtocolError::SchemaMismatch(version)) => {
                    Event::SchemaMismatch(source, version)
                }
                other => Event::LineError(source, other.to_string()),
            },
        };
        self.feed(event).await;
    }

    async fn feed(&mut self, event: Event) {
        let (next, effects) = transition(&self.state, event.clone());
        // Frames arrive every second and carry ~30 KB: log them only when they change something.
        let routine_frame = matches!(event, Event::Frame(..)) && next.phase == self.state.phase && next.elevation == self.state.elevation;
        if !routine_frame {
            debug_log(|| {
                format!(
                    "{}: {:?}/{:?} -> {:?}/{:?} {}",
                    describe(&event),
                    self.state.phase,
                    self.state.elevation,
                    next.phase,
                    next.elevation,
                    describe_effects(&effects)
                )
            });
        }
        self.state = next;
        self.emit_status();
        for effect in effects {
            self.run_effect(effect).await;
        }
    }

    fn status(&self) -> SensorStatus {
        self.state.status(&self.cfg.expected_sha256)
    }

    fn emit_status(&mut self) {
        let status = self.status();
        if self.last_status.as_ref() == Some(&status) {
            return;
        }
        self.last_status = Some(status.clone());
        if status.phase == events::Phase::Stopped {
            self.last_frame = None;
        }
        self.send(SensorEvent::Status { status });
    }

    fn send(&mut self, event: SensorEvent) {
        if let Some(sink) = &self.sink {
            if !sink(event) {
                self.sink = None;
            }
        }
    }

    fn report(&self, source: Source, generation: u64, io: Io) {
        let _ = self.tx.send(Msg::Io { source, generation, io });
    }

    /// Tears a link down: stops its reader (which closes the pipe), terminates its process, and invalidates in-flight results.
    fn reset_link(&mut self, source: Source) {
        let link = &mut self.links[index(source)];
        link.generation += 1;
        link.image = None;
        if let Some(reader) = link.reader.take() {
            reader.abort();
        }
        if let Some(process) = link.process.take() {
            process.terminate();
        }
    }

    async fn run_effect(&mut self, effect: Effect) {
        match effect {
            Effect::Verify(source) => {
                self.reset_link(source);
                let generation = self.links[index(source)].generation;
                let tx = self.tx.clone();
                let path = self.cfg.helper_path.clone();
                let expected = self.cfg.expected_sha256.clone();
                // The lock is held from here until the launch has finished.
                tokio::task::spawn_blocking(move || {
                    let io = match HelperImage::open_verified(&path, &expected) {
                        Ok(image) => Io::Verified(image),
                        Err(error) => Io::VerifyFailed(notice_for(&error, &expected)),
                    };
                    let _ = tx.send(Msg::Io { source, generation, io });
                });
            }

            Effect::Launch(source) => {
                let pipe = new_pipe_name();
                let link = &mut self.links[index(source)];
                link.pipe = pipe.clone();
                let generation = link.generation;
                let Some(image) = link.image.take() else {
                    self.report(source, generation, Io::LaunchFailed("the verified helper image was lost".into()));
                    return;
                };
                let tx = self.tx.clone();
                let client = self.cfg.client_path.clone();
                let owner_hwnd = self.cfg.owner_hwnd.clone();
                tokio::task::spawn_blocking(move || {
                    let io = match source {
                        Source::Unprivileged => match launch_unprivileged(&image, &pipe, &client) {
                            Ok(process) => Io::Launched(process),
                            Err(error) => Io::LaunchFailed(error.to_string()),
                        },
                        // Blocks until the UAC prompt is answered, with the image still locked.
                        Source::Elevated => match launch_elevated(&image, &pipe, &client, owner_hwnd()) {
                            Ok(process) => Io::Launched(process),
                            Err(ElevateError::Cancelled) => Io::Cancelled,
                            Err(ElevateError::Failed(why)) => Io::LaunchFailed(why),
                        },
                    };
                    drop(image);
                    let _ = tx.send(Msg::Io { source, generation, io });
                });
            }

            Effect::Connect(source) => {
                let link = &self.links[index(source)];
                let (generation, pipe) = (link.generation, link.pipe.clone());
                let Some(process) = link.process.clone() else {
                    self.report(source, generation, Io::ConnectFailed(PipeError::Closed));
                    return;
                };
                let window = if source == Source::Elevated { ELEVATED_TIMEOUT } else { CONNECT_TIMEOUT };
                let tx = self.tx.clone();
                tokio::spawn(async move {
                    let io = match connect_verified(&pipe, &process, Instant::now() + window).await {
                        Ok(connection) => Io::Connected(connection),
                        Err(error) => Io::ConnectFailed(error),
                    };
                    let _ = tx.send(Msg::Io { source, generation, io });
                });
            }

            Effect::SwitchSource => {
                // Closing the pipe makes the unprivileged helper exit; if it lingers it is terminated after a grace.
                let link = &mut self.links[index(Source::Unprivileged)];
                link.generation += 1;
                link.image = None;
                if let Some(reader) = link.reader.take() {
                    reader.abort();
                }
                if let Some(process) = link.process.take() {
                    self.retiring.push(process.clone());
                    tokio::spawn(async move {
                        tokio::time::sleep(RETIRE_GRACE).await;
                        if process.exit_code().is_none() {
                            process.terminate();
                        }
                    });
                }
            }

            Effect::Terminate(Terminate::Source(source)) => self.reset_link(source),
            Effect::Terminate(Terminate::All) => {
                self.reset_link(Source::Unprivileged);
                self.reset_link(Source::Elevated);
                for process in self.retiring.drain(..) {
                    process.terminate();
                }
            }

            Effect::StartTimer(timer, delay) => {
                self.timer_seq += 1;
                let id = self.timer_seq;
                let tx = self.tx.clone();
                let handle = tokio::spawn(async move {
                    tokio::time::sleep(delay).await;
                    let _ = tx.send(Msg::Timer { timer, id });
                });
                if let Some((_, old)) = self.timers.insert(timer, (id, handle)) {
                    old.abort();
                }
            }
            Effect::CancelTimer(timer) => {
                if let Some((_, handle)) = self.timers.remove(&timer) {
                    handle.abort();
                }
            }

            Effect::Forward(frame, elevated) => {
                let frame = UiFrame::from_frame(frame, elevated);
                self.last_frame = Some(frame.clone());
                self.send(SensorEvent::Frame { frame });
            }

            Effect::Shutdown => {
                // Dropping the readers closes the pipes, so the helpers run computer.Close() and exit 0.
                let mut processes: Vec<Arc<HelperProcess>> = std::mem::take(&mut self.retiring);
                for link in &mut self.links {
                    link.generation += 1;
                    link.image = None;
                    if let Some(reader) = link.reader.take() {
                        reader.abort();
                    }
                    processes.extend(link.process.take());
                }
                let waiting = processes.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    let refs: Vec<&HelperProcess> = waiting.iter().map(|p| p.as_ref()).collect();
                    wait_all(&refs, EXIT_GRACE)
                })
                .await;
                for process in &processes {
                    if process.exit_code().is_none() {
                        process.terminate();
                    }
                }
                if let Some(reply) = self.shutdown_reply.take() {
                    let _ = reply.send(());
                }
                self.finished = true;
            }
        }
    }
}

fn describe(event: &Event) -> String {
    match event {
        Event::Frame(source, frame) => format!("Frame({source:?}, seq {}, t {})", frame.seq, frame.t),
        Event::Hello(source, hello) => {
            format!("Hello({source:?}, elevated {}, pawnIo installed {})", hello.elevated, hello.pawn_io.installed)
        }
        other => format!("{other:?}"),
    }
}

fn describe_effects(effects: &[Effect]) -> String {
    let parts: Vec<String> = effects
        .iter()
        .map(|effect| match effect {
            Effect::Forward(frame, elevated) => format!("Forward(seq {}, elevated {elevated})", frame.seq),
            other => format!("{other:?}"),
        })
        .collect();
    format!("[{}]", parts.join(", "))
}

fn notice_for(error: &ImageError, expected: &str) -> Notice {
    match error {
        ImageError::Missing(path) => Notice::new(NoticeCode::HelperMissing, Some(path.display().to_string())),
        ImageError::HashMismatch { actual } => {
            Notice::new(NoticeCode::HelperHashMismatch, Some(format!("expected {expected}, got {actual}")))
        }
        // A file we can't even open is as unusable as a missing one; Retry tries again.
        ImageError::Io(e) => Notice::new(NoticeCode::HelperMissing, Some(e.to_string())),
    }
}

fn spawn_reader(
    tx: mpsc::UnboundedSender<Msg>,
    source: Source,
    generation: u64,
    mut connection: HelperConnection,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            match connection.next_message().await {
                Ok(message) => {
                    if tx.send(Msg::Io { source, generation, io: Io::Message(message) }).is_err() {
                        return;
                    }
                }
                Err(error) => {
                    let _ = tx.send(Msg::Io { source, generation, io: Io::ReadFailed(error) });
                    return;
                }
            }
        }
    })
}
