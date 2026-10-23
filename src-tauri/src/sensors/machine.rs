//! The supervisor's state machine as a pure function: `transition(&State, Event) -> (State, Vec<Effect>)`.
//! No I/O and no clocks here. The async runner in `mod.rs` executes the effects and feeds the results back as events;
//! timers are effects. Every row of the techspec's "Supervisor state machine" table is a case in the tests below.
//!
//! Vocabulary: the *unprivileged* helper is the one started with the app and restarted after a failure; the *elevated*
//! one is started on request through UAC and, once it delivers a frame, replaces the unprivileged one as the source.

use std::time::Duration;

use super::events::{Elevation, Notice, NoticeCode, Phase, SensorStatus};
use super::protocol::{Frame, Hello, PawnIo};

/// Delays before restart attempts 1, 2 and 3.
pub const RESTART_DELAYS: [Duration; 3] =
    [Duration::from_secs(1), Duration::from_secs(5), Duration::from_secs(15)];
pub const MAX_RESTARTS: u32 = 3;
/// Unprivileged helper: from `hello` to the first frame.
pub const FIRST_FRAME_TIMEOUT: Duration = Duration::from_secs(10);
/// Unprivileged helper: from launch to the pipe connecting.
pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// Elevated helper: from `ShellExecuteExW` returning to the first frame.
pub const ELEVATED_TIMEOUT: Duration = Duration::from_secs(20);
/// A connection that stays live this long resets the restart count.
pub const LIVE_RESET: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Source {
    Unprivileged,
    Elevated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Timer {
    Restart,
    FirstFrame(Source),
    LiveFor60s,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Terminate {
    Source(Source),
    All,
}

/// How far the unprivileged helper has come.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkStage {
    /// No process or connection.
    Idle,
    /// Verifying, launching, connecting, or waiting for the first frame.
    Starting,
    /// Delivered a frame.
    Streaming,
}

#[derive(Debug, Clone, PartialEq)]
pub struct State {
    pub phase: Phase,
    /// The source of the frames the UI is shown.
    pub active: Option<Source>,
    pub elevated: Option<bool>,
    pub pawn_io: Option<PawnIo>,
    pub elevation: Elevation,
    pub notice: Option<Notice>,
    /// Restart attempts used in the current series (0..=3). A live period of 60 s resets it.
    pub attempts: u32,
    pub unpriv: LinkStage,
    /// The elevated helper's `hello` while it hasn't delivered a frame yet.
    pub elevated_hello: Option<PawnIo>,
    /// The unprivileged helper failed while elevation was in flight: the restart waits for the elevation outcome.
    pub restart_deferred: bool,
    /// The elevated source died, so `full_sensors_lost` is shown once reduced mode is live again.
    pub lost_elevated: bool,
    pub last_forwarded_t: Option<i64>,
    pub exiting: bool,
}

impl State {
    pub fn new() -> Self {
        Self {
            phase: Phase::Starting,
            active: None,
            elevated: None,
            pawn_io: None,
            elevation: Elevation::Idle,
            notice: None,
            attempts: 0,
            unpriv: LinkStage::Idle,
            elevated_hello: None,
            restart_deferred: false,
            lost_elevated: false,
            last_forwarded_t: None,
            exiting: false,
        }
    }

    pub fn status(&self, helper_sha256: &str) -> SensorStatus {
        SensorStatus {
            phase: self.phase,
            elevated: self.elevated,
            pawn_io: self.pawn_io.clone(),
            elevation: self.elevation,
            notice: self.notice.clone(),
            restart_attempt: (self.phase == Phase::Reconnecting).then_some(self.attempts),
            helper_sha256: helper_sha256.to_string(),
        }
    }
}

impl Default for State {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    /// Setup finished: start the unprivileged helper.
    Begin,
    /// The image matched the compiled-in hash and is locked.
    Verified(Source),
    /// A verify failed. The notice is `helper_missing` or `helper_hash_mismatch`.
    VerifyFailed(Source, Notice),
    /// The process started (unprivileged spawn, or `ShellExecuteExW` returned a handle).
    Launched(Source),
    /// The spawn, or an elevation error other than a cancel.
    LaunchFailed(Source, String),
    /// The user declined the UAC prompt.
    Cancelled,
    /// Another process holds the pipe (see `PipeError::Squatter`). The string is the notice detail.
    Squatter(Source, String),
    ConnectTimeout(Source),
    /// The child exited before the pipe connected.
    ChildExited(Source, u32),
    Hello(Source, Hello),
    Frame(Source, Frame),
    /// A malformed line, a line over the size limit.
    LineError(Source, String),
    /// A line with `v != 1`.
    SchemaMismatch(Source, u32),
    /// The helper sent `error{lhm_failed}`.
    HelperFatal(Source, String),
    /// Any other `error` code: a reply to a control message, not a failure.
    OtherHelperError(Source),
    /// Pipe EOF or an I/O error with no error message.
    Eof(Source),
    /// `no first frame in time`: 10 s after hello (unprivileged) or 20 s after launch (elevated).
    FirstFrameTimeout(Source),
    EnableFull,
    Retry,
    RestartTimer,
    LiveFor60s,
    Exit,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
    /// Open the image with `FILE_SHARE_READ`, hash it, hold the lock.
    Verify(Source),
    /// Spawn (unprivileged) or `ShellExecuteExW("runas")` (elevated), then release the lock.
    Launch(Source),
    Connect(Source),
    /// The elevated connection becomes the frame source: close the old pipe, terminate the old helper if it lingers.
    SwitchSource,
    Terminate(Terminate),
    StartTimer(Timer, Duration),
    CancelTimer(Timer),
    /// Send a frame to the UI. The flag is whether its source was elevated.
    Forward(Frame, bool),
    /// Drop the pipes, wait for every helper against one 3 s deadline, terminate what is left.
    Shutdown,
}

fn is_elevation_notice(code: NoticeCode) -> bool {
    matches!(
        code,
        NoticeCode::UacCancelled | NoticeCode::ElevationFailed | NoticeCode::ElevationTimeout | NoticeCode::FullSensorsLost
    )
}

fn cancel_all_timers(fx: &mut Vec<Effect>) {
    for timer in [
        Timer::Restart,
        Timer::FirstFrame(Source::Unprivileged),
        Timer::FirstFrame(Source::Elevated),
        Timer::LiveFor60s,
    ] {
        fx.push(Effect::CancelTimer(timer));
    }
}

/// Integrity and security problems always stop everything, wherever they're detected. Never downgraded to a warning.
fn block(s: &mut State, fx: &mut Vec<Effect>, notice: Notice) {
    s.phase = Phase::Stopped;
    s.active = None;
    s.elevated = None;
    s.pawn_io = None;
    s.elevation = Elevation::Idle;
    s.notice = Some(notice);
    s.unpriv = LinkStage::Idle;
    s.elevated_hello = None;
    s.restart_deferred = false;
    cancel_all_timers(fx);
    fx.push(Effect::Terminate(Terminate::All));
}

/// A failure that counts against the restart policy. Up to three restarts (after 1, 5 and 15 s); the next failure stops.
/// When `defer` is set (elevation in flight) the restart timer isn't started: the elevation outcome decides.
fn fail_into_restart(s: &mut State, fx: &mut Vec<Effect>, notice: Notice, defer: bool) {
    fx.push(Effect::CancelTimer(Timer::LiveFor60s));
    fx.push(Effect::CancelTimer(Timer::FirstFrame(Source::Unprivileged)));
    if s.attempts >= MAX_RESTARTS {
        // The notice stays (helper_error / helper_exited), everything is torn down.
        s.phase = Phase::Stopped;
        s.active = None;
        s.elevated = None;
        s.pawn_io = None;
        s.elevation = Elevation::Idle;
        s.notice = Some(notice);
        s.unpriv = LinkStage::Idle;
        s.elevated_hello = None;
        s.restart_deferred = false;
        cancel_all_timers(fx);
        fx.push(Effect::Terminate(Terminate::All));
        return;
    }
    s.attempts += 1;
    s.phase = Phase::Reconnecting;
    s.active = None;
    s.elevated = None;
    s.notice = Some(notice);
    if defer {
        s.restart_deferred = true;
    } else {
        fx.push(Effect::StartTimer(Timer::Restart, RESTART_DELAYS[(s.attempts - 1) as usize]));
    }
}

/// The unprivileged helper failed (any stage).
fn unprivileged_failure(s: &mut State, fx: &mut Vec<Effect>, notice: Notice) {
    if s.unpriv == LinkStage::Idle {
        return; // a late event from a link that is already closed
    }
    s.unpriv = LinkStage::Idle;
    fx.push(Effect::Terminate(Terminate::Source(Source::Unprivileged)));
    let elevation_in_flight = s.elevation != Elevation::Idle;
    fail_into_restart(s, fx, notice, elevation_in_flight);
}

/// The elevated attempt is over without success. Reduced mode (or the restart in waiting) carries on.
fn elevation_ends(s: &mut State, fx: &mut Vec<Effect>, notice: Notice) {
    s.elevation = Elevation::Idle;
    s.elevated_hello = None;
    s.notice = Some(notice);
    fx.push(Effect::CancelTimer(Timer::FirstFrame(Source::Elevated)));
    fx.push(Effect::Terminate(Terminate::Source(Source::Elevated)));
    if s.restart_deferred {
        s.restart_deferred = false;
        fx.push(Effect::StartTimer(Timer::Restart, RESTART_DELAYS[(s.attempts.max(1) - 1) as usize]));
    }
}

fn forward(s: &mut State, fx: &mut Vec<Effect>, frame: Frame, elevated: bool) {
    // The switch to the elevated source can reorder frames: only a newer `t` goes to the UI.
    if s.last_forwarded_t.is_none_or(|last| frame.t > last) {
        s.last_forwarded_t = Some(frame.t);
        fx.push(Effect::Forward(frame, elevated));
    }
}

fn unprivileged_failure_notice(code: NoticeCode, detail: impl Into<String>) -> Notice {
    Notice::new(code, Some(detail.into()))
}

pub fn transition(state: &State, event: Event) -> (State, Vec<Effect>) {
    let mut s = state.clone();
    let mut fx = Vec::new();
    if s.exiting {
        return (s, fx);
    }

    match event {
        Event::Begin => {
            s.phase = Phase::Starting;
            s.unpriv = LinkStage::Starting;
            fx.push(Effect::Verify(Source::Unprivileged));
        }

        Event::Verified(Source::Unprivileged) => {
            if s.unpriv == LinkStage::Starting {
                fx.push(Effect::Launch(Source::Unprivileged));
            }
        }
        Event::Verified(Source::Elevated) => {
            if s.elevation == Elevation::Prompting {
                fx.push(Effect::Launch(Source::Elevated));
            }
        }

        // Every verify failure blocks: at start, on a restart, and at "Enable full sensors" (no UAC prompt is shown).
        Event::VerifyFailed(_, notice) => block(&mut s, &mut fx, notice),
        Event::Squatter(_, detail) => block(&mut s, &mut fx, Notice::new(NoticeCode::PipeSquatter, Some(detail))),
        Event::SchemaMismatch(_, version) => block(
            &mut s,
            &mut fx,
            Notice::new(NoticeCode::SchemaMismatch, Some(format!("v{version}"))),
        ),

        Event::Launched(Source::Unprivileged) => {
            if s.unpriv == LinkStage::Starting {
                fx.push(Effect::Connect(Source::Unprivileged));
            }
        }
        Event::Launched(Source::Elevated) => {
            if s.elevation == Elevation::Prompting {
                s.elevation = Elevation::Connecting;
                fx.push(Effect::Connect(Source::Elevated));
                fx.push(Effect::StartTimer(Timer::FirstFrame(Source::Elevated), ELEVATED_TIMEOUT));
            }
        }

        Event::LaunchFailed(Source::Unprivileged, why) => {
            unprivileged_failure(&mut s, &mut fx, unprivileged_failure_notice(NoticeCode::HelperError, why));
        }
        Event::LaunchFailed(Source::Elevated, why) => {
            if s.elevation == Elevation::Prompting {
                elevation_ends(&mut s, &mut fx, Notice::new(NoticeCode::ElevationFailed, Some(why)));
            }
        }
        Event::Cancelled => {
            if s.elevation == Elevation::Prompting {
                elevation_ends(&mut s, &mut fx, Notice::new(NoticeCode::UacCancelled, None));
            }
        }

        Event::Hello(Source::Unprivileged, hello) => {
            if s.unpriv == LinkStage::Starting {
                s.pawn_io = Some(hello.pawn_io);
                s.elevated = Some(hello.elevated);
                fx.push(Effect::StartTimer(Timer::FirstFrame(Source::Unprivileged), FIRST_FRAME_TIMEOUT));
            }
        }
        Event::Hello(Source::Elevated, hello) => {
            if s.elevation == Elevation::Connecting {
                if hello.elevated {
                    s.elevated_hello = Some(hello.pawn_io);
                } else {
                    elevation_ends(
                        &mut s,
                        &mut fx,
                        Notice::new(NoticeCode::ElevationFailed, Some("the helper did not start elevated".to_string())),
                    );
                }
            }
        }

        Event::Frame(Source::Unprivileged, frame) => match (s.phase, s.unpriv) {
            (_, LinkStage::Idle) => {}
            (Phase::Starting | Phase::Reconnecting, LinkStage::Starting) => {
                s.phase = Phase::Live;
                s.active = Some(Source::Unprivileged);
                s.unpriv = LinkStage::Streaming;
                s.elevated = Some(false);
                // The notice clears on success, but an elevation outcome or the lost elevated helper is still news.
                if s.lost_elevated {
                    s.lost_elevated = false;
                    s.notice = Some(Notice::new(NoticeCode::FullSensorsLost, None));
                } else if s.notice.as_ref().is_some_and(|n| !is_elevation_notice(n.code)) {
                    s.notice = None;
                }
                fx.push(Effect::CancelTimer(Timer::FirstFrame(Source::Unprivileged)));
                fx.push(Effect::StartTimer(Timer::LiveFor60s, LIVE_RESET));
                forward(&mut s, &mut fx, frame, false);
            }
            (Phase::Live, LinkStage::Streaming) if s.active == Some(Source::Unprivileged) => {
                forward(&mut s, &mut fx, frame, false);
            }
            _ => {}
        },
        Event::Frame(Source::Elevated, frame) => {
            if s.elevation == Elevation::Connecting && s.elevated_hello.is_some() {
                // The elevated helper delivered: it becomes the source and the unprivileged helper is retired.
                s.phase = Phase::Live;
                s.active = Some(Source::Elevated);
                s.elevated = Some(true);
                s.pawn_io = s.elevated_hello.take();
                s.elevation = Elevation::Idle;
                s.notice = None;
                s.unpriv = LinkStage::Idle;
                s.restart_deferred = false;
                s.lost_elevated = false;
                fx.push(Effect::CancelTimer(Timer::FirstFrame(Source::Elevated)));
                fx.push(Effect::CancelTimer(Timer::Restart));
                fx.push(Effect::SwitchSource);
                fx.push(Effect::StartTimer(Timer::LiveFor60s, LIVE_RESET));
                forward(&mut s, &mut fx, frame, true);
            } else if s.phase == Phase::Live && s.active == Some(Source::Elevated) {
                forward(&mut s, &mut fx, frame, true);
            }
        }

        // Failures of the unprivileged helper.
        Event::Eof(Source::Unprivileged) => {
            unprivileged_failure(
                &mut s,
                &mut fx,
                unprivileged_failure_notice(NoticeCode::HelperExited, "the helper closed the connection"),
            );
        }
        Event::ChildExited(Source::Unprivileged, code) => {
            unprivileged_failure(
                &mut s,
                &mut fx,
                unprivileged_failure_notice(NoticeCode::HelperExited, format!("exit code {code}")),
            );
        }
        Event::LineError(Source::Unprivileged, why) | Event::HelperFatal(Source::Unprivileged, why) => {
            unprivileged_failure(&mut s, &mut fx, unprivileged_failure_notice(NoticeCode::HelperError, why));
        }
        Event::ConnectTimeout(Source::Unprivileged) => {
            unprivileged_failure(
                &mut s,
                &mut fx,
                unprivileged_failure_notice(NoticeCode::HelperError, "the helper did not connect in time"),
            );
        }
        Event::FirstFrameTimeout(Source::Unprivileged) => {
            if s.unpriv == LinkStage::Starting {
                unprivileged_failure(
                    &mut s,
                    &mut fx,
                    unprivileged_failure_notice(NoticeCode::HelperError, "no first frame in time"),
                );
            }
        }

        // Failures of the elevated helper: before its first frame they end the attempt; after it they end full sensors.
        Event::Eof(Source::Elevated) => elevated_failure(
            &mut s,
            &mut fx,
            NoticeCode::HelperExited,
            Some("the helper closed the connection".to_string()),
        ),
        Event::ChildExited(Source::Elevated, code) => {
            elevated_failure(&mut s, &mut fx, NoticeCode::HelperExited, Some(format!("exit code {code}")));
        }
        Event::LineError(Source::Elevated, why) | Event::HelperFatal(Source::Elevated, why) => {
            elevated_failure(&mut s, &mut fx, NoticeCode::HelperError, Some(why));
        }
        Event::ConnectTimeout(Source::Elevated) | Event::FirstFrameTimeout(Source::Elevated) => {
            if s.elevation == Elevation::Connecting {
                elevation_ends(&mut s, &mut fx, Notice::new(NoticeCode::ElevationTimeout, None));
            }
        }

        // Replies to control messages: logged in debug builds by the runner, no state change.
        Event::OtherHelperError(_) => {}

        Event::EnableFull => {
            if s.phase == Phase::Live
                && s.active == Some(Source::Unprivileged)
                && s.elevated == Some(false)
                && s.elevation == Elevation::Idle
            {
                s.elevation = Elevation::Prompting;
                s.notice = None;
                fx.push(Effect::Verify(Source::Elevated));
            }
        }
        Event::Retry => {
            if s.phase == Phase::Stopped {
                s.phase = Phase::Starting;
                s.notice = None;
                s.attempts = 0;
                s.lost_elevated = false;
                s.unpriv = LinkStage::Starting;
                fx.push(Effect::Verify(Source::Unprivileged));
            }
        }
        Event::RestartTimer => {
            if s.phase == Phase::Reconnecting && s.unpriv == LinkStage::Idle && !s.restart_deferred {
                s.unpriv = LinkStage::Starting;
                fx.push(Effect::Verify(Source::Unprivileged));
            }
        }
        Event::LiveFor60s => {
            if s.phase == Phase::Live {
                s.attempts = 0;
            }
        }
        Event::Exit => {
            s.exiting = true;
            fx.push(Effect::Shutdown);
        }
    }
    (s, fx)
}

fn elevated_failure(s: &mut State, fx: &mut Vec<Effect>, code: NoticeCode, detail: Option<String>) {
    if s.elevation == Elevation::Connecting {
        // Before its first frame: an early exit, a malformed line or lhm_failed all read as "didn't start".
        elevation_ends(s, fx, Notice::new(NoticeCode::ElevationFailed, detail));
    } else if s.phase == Phase::Live && s.active == Some(Source::Elevated) {
        // The elevated source died: restart in reduced mode, and say so once it is live again. UAC isn't prompted.
        s.lost_elevated = true;
        fx.push(Effect::Terminate(Terminate::Source(Source::Elevated)));
        fail_into_restart(s, fx, Notice::new(code, detail), false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sensors::protocol::{ErrorMessage, PawnIo};

    // ---- helpers ----

    const U: Source = Source::Unprivileged;
    const E: Source = Source::Elevated;

    fn hello(elevated: bool, installed: bool) -> Hello {
        Hello {
            v: 1,
            elevated,
            pawn_io: PawnIo {
                installed,
                version: installed.then(|| "2.2.0.0".to_string()),
                loaded: elevated.then_some(installed),
            },
        }
    }

    fn frame(t: i64) -> Frame {
        Frame { v: 1, seq: 1, t, period_ms: 1000, memory: vec![], hardware: vec![], sensors: vec![] }
    }

    fn missing() -> Notice {
        Notice::new(NoticeCode::HelperMissing, Some("C:\\app\\pophood-sensors.exe".to_string()))
    }

    fn mismatch() -> Notice {
        Notice::new(NoticeCode::HelperHashMismatch, Some("expected a, got b".to_string()))
    }

    /// Feeds events in order and returns the state plus the effects of the last one.
    fn run(start: State, events: Vec<Event>) -> (State, Vec<Effect>) {
        let mut state = start;
        let mut last = Vec::new();
        for event in events {
            let (next, fx) = transition(&state, event);
            state = next;
            last = fx;
        }
        (state, last)
    }

    /// Setup through the first unprivileged frame.
    fn live() -> State {
        run(
            State::new(),
            vec![
                Event::Begin,
                Event::Verified(U),
                Event::Launched(U),
                Event::Hello(U, hello(false, true)),
                Event::Frame(U, frame(1000)),
            ],
        )
        .0
    }

    fn live_elevated() -> State {
        run(
            live(),
            vec![
                Event::EnableFull,
                Event::Verified(E),
                Event::Launched(E),
                Event::Hello(E, hello(true, true)),
                Event::Frame(E, frame(2000)),
            ],
        )
        .0
    }

    fn prompting() -> State {
        run(live(), vec![Event::EnableFull]).0
    }

    fn connecting() -> State {
        run(prompting(), vec![Event::Verified(E), Event::Launched(E)]).0
    }

    fn notice_code(s: &State) -> Option<NoticeCode> {
        s.notice.as_ref().map(|n| n.code)
    }

    fn has(fx: &[Effect], wanted: &Effect) -> bool {
        fx.contains(wanted)
    }

    fn restart_delay(fx: &[Effect]) -> Option<Duration> {
        fx.iter().find_map(|e| match e {
            Effect::StartTimer(Timer::Restart, d) => Some(*d),
            _ => None,
        })
    }

    fn forwards(fx: &[Effect]) -> usize {
        fx.iter().filter(|e| matches!(e, Effect::Forward(..))).count()
    }

    // ---- row: setup → starting ----

    #[test]
    fn row_setup_starts_by_verifying_the_unprivileged_helper() {
        let (s, fx) = run(State::new(), vec![Event::Begin]);
        assert_eq!(s.phase, Phase::Starting);
        assert_eq!(fx, vec![Effect::Verify(U)]);
    }

    #[test]
    fn row_setup_verify_then_launch_then_connect_then_hello_arms_the_first_frame_timer() {
        let (s, fx) = run(State::new(), vec![Event::Begin, Event::Verified(U)]);
        assert_eq!(fx, vec![Effect::Launch(U)]);
        let (s, fx) = run(s, vec![Event::Launched(U)]);
        assert_eq!(fx, vec![Effect::Connect(U)]);
        let (s, fx) = run(s, vec![Event::Hello(U, hello(false, true))]);
        assert_eq!(s.phase, Phase::Starting);
        assert_eq!(s.pawn_io.as_ref().map(|p| p.installed), Some(true));
        assert!(has(&fx, &Effect::StartTimer(Timer::FirstFrame(U), FIRST_FRAME_TIMEOUT)));
    }

    // ---- row: first frame → live ----

    #[test]
    fn row_first_frame_goes_live_unprivileged_and_forwards_it() {
        let (s, fx) = run(
            State::new(),
            vec![Event::Begin, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(1000))],
        );
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(false));
        assert_eq!(s.active, Some(U));
        assert!(has(&fx, &Effect::StartTimer(Timer::LiveFor60s, LIVE_RESET)));
        assert!(has(&fx, &Effect::CancelTimer(Timer::FirstFrame(U))));
        assert_eq!(forwards(&fx), 1);
    }

    #[test]
    fn row_first_frame_after_a_restart_clears_a_helper_notice() {
        let (s, _) = run(live(), vec![Event::Eof(U)]);
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperExited));
        let (s, _) = run(s, vec![Event::RestartTimer, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(5000))]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.notice, None);
        assert_eq!(s.restart_attempt_for_status(), None);
    }

    // ---- row: failures while starting / reconnecting ----

    #[test]
    fn row_failures_while_starting_go_to_reconnecting_with_the_right_notice() {
        let starting = || run(State::new(), vec![Event::Begin, Event::Verified(U), Event::Launched(U)]).0;
        let cases: Vec<(Event, NoticeCode)> = vec![
            (Event::ConnectTimeout(U), NoticeCode::HelperError),
            (Event::ChildExited(U, 70), NoticeCode::HelperExited),
            (Event::Eof(U), NoticeCode::HelperExited),
            (Event::LineError(U, "bad line".into()), NoticeCode::HelperError),
            (Event::HelperFatal(U, "LhmFailed".into()), NoticeCode::HelperError),
            (Event::FirstFrameTimeout(U), NoticeCode::HelperError),
            (Event::LaunchFailed(U, "access denied".into()), NoticeCode::HelperError),
        ];
        for (event, code) in cases {
            let (s, fx) = run(starting(), vec![event.clone()]);
            assert_eq!(s.phase, Phase::Reconnecting, "{event:?}");
            assert_eq!(notice_code(&s), Some(code), "{event:?}");
            assert_eq!(s.attempts, 1);
            assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)), "{event:?}");
            assert!(has(&fx, &Effect::Terminate(Terminate::Source(U))));
        }
    }

    #[test]
    fn row_child_exit_before_connect_reports_the_exit_code() {
        let (s, _) = run(State::new(), vec![Event::Begin, Event::Verified(U), Event::Launched(U), Event::ChildExited(U, 70)]);
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::HelperExited, Some("exit code 70".to_string()))));
    }

    #[test]
    fn a_first_frame_timeout_after_the_helper_went_live_is_ignored() {
        let (s, fx) = run(live(), vec![Event::FirstFrameTimeout(U)]);
        assert_eq!(s.phase, Phase::Live);
        assert!(fx.is_empty());
    }

    // ---- rows: integrity codes always block ----

    #[test]
    fn row_verify_failure_at_start_blocks_with_no_launch() {
        for notice in [missing(), mismatch()] {
            let (s, fx) = run(State::new(), vec![Event::Begin, Event::VerifyFailed(U, notice.clone())]);
            assert_eq!(s.phase, Phase::Stopped);
            assert_eq!(s.notice, Some(notice));
            assert!(has(&fx, &Effect::Terminate(Terminate::All)));
            assert!(!fx.iter().any(|e| matches!(e, Effect::Launch(_))));
        }
    }

    #[test]
    fn row_verify_failure_at_restart_blocks() {
        let (s, _) = run(live(), vec![Event::Eof(U), Event::RestartTimer]);
        let (s, fx) = run(s, vec![Event::VerifyFailed(U, mismatch())]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperHashMismatch));
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
    }

    #[test]
    fn row_verify_failure_at_enable_full_blocks_without_a_uac_prompt() {
        let (s, fx) = run(prompting(), vec![Event::VerifyFailed(E, missing())]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperMissing));
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
        assert!(!fx.iter().any(|e| matches!(e, Effect::Launch(E))));
    }

    #[test]
    fn row_squatter_on_the_unprivileged_pipe_blocks() {
        let (s, fx) = run(State::new(), vec![Event::Begin, Event::Verified(U), Event::Launched(U), Event::Squatter(U, "process 4242".into())]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::PipeSquatter, Some("process 4242".to_string()))));
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
    }

    #[test]
    fn row_squatter_on_the_elevated_pipe_blocks_and_terminates_everything() {
        let (s, fx) = run(connecting(), vec![Event::Squatter(E, "the helper found its pipe name taken".into())]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(notice_code(&s), Some(NoticeCode::PipeSquatter));
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
    }

    #[test]
    fn row_schema_mismatch_from_any_helper_blocks() {
        let (s, fx) = run(live(), vec![Event::SchemaMismatch(U, 2)]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::SchemaMismatch, Some("v2".to_string()))));
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));

        let (s, _) = run(connecting(), vec![Event::SchemaMismatch(E, 3)]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.elevation, Elevation::Idle);
    }

    // ---- rows: elevation ----

    #[test]
    fn row_enable_full_starts_prompting_with_a_verify() {
        let (s, fx) = run(live(), vec![Event::EnableFull]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevation, Elevation::Prompting);
        assert_eq!(fx, vec![Effect::Verify(E)]);
    }

    #[test]
    fn row_enable_full_clears_an_old_notice() {
        let mut s = live();
        s.notice = Some(Notice::new(NoticeCode::FullSensorsLost, None));
        let (s, _) = run(s, vec![Event::EnableFull]);
        assert_eq!(s.notice, None);
    }

    #[test]
    fn row_prompting_cancelled() {
        let (s, fx) = run(prompting(), vec![Event::Cancelled]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(notice_code(&s), Some(NoticeCode::UacCancelled));
        assert_eq!(s.elevated, Some(false));
        assert!(restart_delay(&fx).is_none());
    }

    #[test]
    fn row_prompting_failed() {
        let (s, _) = run(prompting(), vec![Event::LaunchFailed(E, "access denied".into())]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::ElevationFailed, Some("access denied".to_string()))));
    }

    #[test]
    fn row_prompting_launched_moves_to_connecting_with_a_20_second_window() {
        let (s, fx) = run(prompting(), vec![Event::Verified(E)]);
        assert_eq!(fx, vec![Effect::Launch(E)]);
        let (s, fx) = run(s, vec![Event::Launched(E)]);
        assert_eq!(s.elevation, Elevation::Connecting);
        assert_eq!(s.phase, Phase::Live);
        assert!(has(&fx, &Effect::Connect(E)));
        assert!(has(&fx, &Effect::StartTimer(Timer::FirstFrame(E), ELEVATED_TIMEOUT)));
    }

    #[test]
    fn row_connecting_first_elevated_frame_switches_the_source() {
        let (s, fx) = run(connecting(), vec![Event::Hello(E, hello(true, true)), Event::Frame(E, frame(2000))]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(true));
        assert_eq!(s.active, Some(E));
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(s.notice, None);
        assert_eq!(s.unpriv, LinkStage::Idle);
        assert_eq!(s.pawn_io.as_ref().and_then(|p| p.loaded), Some(true));
        assert!(has(&fx, &Effect::SwitchSource));
        assert!(has(&fx, &Effect::CancelTimer(Timer::FirstFrame(E))));
        assert_eq!(forwards(&fx), 1);
    }

    #[test]
    fn row_connecting_elevated_eof_before_a_frame_is_elevation_failed() {
        let (s, fx) = run(connecting(), vec![Event::Eof(E)]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(s.elevated, Some(false));
        assert_eq!(notice_code(&s), Some(NoticeCode::ElevationFailed));
        assert!(has(&fx, &Effect::Terminate(Terminate::Source(E))));
    }

    #[test]
    fn row_connecting_hello_not_elevated_is_elevation_failed() {
        let (s, fx) = run(connecting(), vec![Event::Hello(E, hello(false, true))]);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(notice_code(&s), Some(NoticeCode::ElevationFailed));
        assert!(has(&fx, &Effect::Terminate(Terminate::Source(E))));
    }

    #[test]
    fn row_connecting_deadline_is_elevation_timeout_with_no_detail() {
        for event in [Event::FirstFrameTimeout(E), Event::ConnectTimeout(E)] {
            let (s, fx) = run(connecting(), vec![event]);
            assert_eq!(s.phase, Phase::Live);
            assert_eq!(s.elevation, Elevation::Idle);
            assert_eq!(s.notice, Some(Notice::new(NoticeCode::ElevationTimeout, None)));
            assert!(has(&fx, &Effect::Terminate(Terminate::Source(E))));
        }
    }

    #[test]
    fn row_connecting_malformed_line_or_lhm_failed_before_the_frame_is_elevation_failed() {
        for event in [Event::LineError(E, "bad".into()), Event::HelperFatal(E, "LhmFailed".into())] {
            let (s, _) = run(connecting(), vec![event]);
            assert_eq!(notice_code(&s), Some(NoticeCode::ElevationFailed));
            assert_eq!(s.elevation, Elevation::Idle);
        }
    }

    #[test]
    fn row_connecting_child_exit_reports_the_code() {
        let (s, _) = run(connecting(), vec![Event::ChildExited(E, 70)]);
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::ElevationFailed, Some("exit code 70".to_string()))));
    }

    #[test]
    fn a_late_elevation_timer_after_success_is_ignored() {
        let (s, fx) = run(live_elevated(), vec![Event::FirstFrameTimeout(E)]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(true));
        assert!(fx.is_empty());
    }

    // ---- rows: unprivileged death during elevation ----

    #[test]
    fn row_unprivileged_death_while_prompting_goes_reconnecting_and_defers_the_restart() {
        let (s, fx) = run(prompting(), vec![Event::Eof(U)]);
        assert_eq!(s.phase, Phase::Reconnecting);
        assert_eq!(s.elevation, Elevation::Prompting, "elevation keeps its state");
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperExited));
        assert_eq!(s.attempts, 1);
        assert!(restart_delay(&fx).is_none(), "no restart while the prompt is up");
        assert!(s.restart_deferred);
    }

    #[test]
    fn row_unprivileged_death_while_connecting_also_defers_the_restart() {
        let (s, fx) = run(connecting(), vec![Event::LineError(U, "bad".into())]);
        assert_eq!(s.phase, Phase::Reconnecting);
        assert_eq!(s.elevation, Elevation::Connecting);
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperError));
        assert!(restart_delay(&fx).is_none());
    }

    #[test]
    fn row_reconnecting_then_elevated_first_frame_goes_live_elevated_with_the_count_unchanged() {
        let (s, _) = run(prompting(), vec![Event::Eof(U), Event::Verified(E), Event::Launched(E), Event::Hello(E, hello(true, true))]);
        let (s, fx) = run(s, vec![Event::Frame(E, frame(2000))]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(true));
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(s.notice, None);
        assert_eq!(s.attempts, 1, "the 60 s rule resets it, not the switch");
        assert!(!s.restart_deferred);
        assert!(has(&fx, &Effect::SwitchSource));
    }

    #[test]
    fn row_reconnecting_then_cancel_restarts_unprivileged_after_the_attempt_delay() {
        let (s, _) = run(prompting(), vec![Event::Eof(U)]);
        let (s, fx) = run(s, vec![Event::Cancelled]);
        assert_eq!(s.phase, Phase::Reconnecting);
        assert_eq!(s.elevation, Elevation::Idle);
        assert_eq!(notice_code(&s), Some(NoticeCode::UacCancelled));
        assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)));
        assert!(!s.restart_deferred);

        let (s, fx) = run(s, vec![Event::RestartTimer]);
        assert_eq!(fx, vec![Effect::Verify(U)]);
        let (s, _) = run(s, vec![Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(5000))]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(false));
        // The elevation outcome wasn't visible while reconnecting, so it is still there.
        assert_eq!(notice_code(&s), Some(NoticeCode::UacCancelled));
    }

    #[test]
    fn row_reconnecting_then_elevation_failed_or_timed_out_also_restarts() {
        let cases: Vec<(State, Event)> = vec![
            (prompting(), Event::LaunchFailed(E, "x".into())),
            (connecting(), Event::FirstFrameTimeout(E)),
            (connecting(), Event::ConnectTimeout(E)),
            (connecting(), Event::Eof(E)),
        ];
        for (base, event) in cases {
            let (s, _) = run(base, vec![Event::Eof(U)]);
            let (s, fx) = run(s, vec![event.clone()]);
            assert_eq!(s.phase, Phase::Reconnecting, "{event:?}");
            assert_eq!(s.elevation, Elevation::Idle, "{event:?}");
            assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)), "{event:?}");
            assert!(has(&fx, &Effect::Terminate(Terminate::Source(E))), "{event:?}");
        }
    }

    #[test]
    fn row_unprivileged_death_during_elevation_after_three_attempts_stops_everything() {
        let mut s = prompting();
        s.attempts = 3;
        let (s, fx) = run(s, vec![Event::Eof(U)]);
        assert_eq!(s.phase, Phase::Stopped);
        assert_eq!(s.elevation, Elevation::Idle);
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
    }

    // ---- rows: death of a live helper ----

    #[test]
    fn row_live_unprivileged_failure_restarts_after_1_second() {
        for event in [
            Event::Eof(U),
            Event::LineError(U, "bad".into()),
            Event::HelperFatal(U, "LhmFailed".into()),
        ] {
            let (s, fx) = run(live(), vec![event.clone()]);
            assert_eq!(s.phase, Phase::Reconnecting, "{event:?}");
            assert_eq!(s.restart_attempt_for_status(), Some(1));
            assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)));
            assert!(has(&fx, &Effect::CancelTimer(Timer::LiveFor60s)));
            assert_eq!(s.active, None);
        }
    }

    #[test]
    fn row_live_elevated_source_dying_restarts_unprivileged_and_reports_full_sensors_lost_once_live() {
        let (s, fx) = run(live_elevated(), vec![Event::Eof(E)]);
        assert_eq!(s.phase, Phase::Reconnecting);
        assert_eq!(notice_code(&s), Some(NoticeCode::HelperExited));
        assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)));
        assert!(s.lost_elevated);
        assert!(has(&fx, &Effect::Terminate(Terminate::Source(E))));
        assert!(!fx.iter().any(|e| matches!(e, Effect::Verify(E))), "UAC is never prompted automatically");

        let (s, _) = run(s, vec![Event::RestartTimer, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true))]);
        let (s, _) = run(s, vec![Event::Frame(U, frame(9000))]);
        assert_eq!(s.phase, Phase::Live);
        assert_eq!(s.elevated, Some(false));
        assert_eq!(s.notice, Some(Notice::new(NoticeCode::FullSensorsLost, None)));
        assert_eq!(s.elevation, Elevation::Idle);
    }

    #[test]
    fn full_sensors_lost_stays_through_later_frames_and_clears_on_the_next_enable() {
        let mut s = live();
        s.notice = Some(Notice::new(NoticeCode::FullSensorsLost, None));
        let (s, _) = run(s, vec![Event::Frame(U, frame(3000))]);
        assert_eq!(notice_code(&s), Some(NoticeCode::FullSensorsLost));
        let (s, _) = run(s, vec![Event::EnableFull]);
        assert_eq!(s.notice, None);
    }

    // ---- rows: restart policy ----

    #[test]
    fn ut10_the_restart_policy_worked_example() {
        // The helper dies → attempt 1 after 1 s → live; dies within 60 s → attempt 2 after 5 s → live;
        // again → attempt 3 after 15 s → live; again within 60 s → stopped.
        let mut s = live();
        let mut delays = Vec::new();
        for n in 0..3u32 {
            let (next, fx) = run(s, vec![Event::Eof(U)]);
            assert_eq!(next.phase, Phase::Reconnecting);
            assert_eq!(next.restart_attempt_for_status(), Some(n + 1));
            delays.push(restart_delay(&fx).expect("a restart is scheduled"));
            let (next, _) = run(
                next,
                vec![Event::RestartTimer, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(10_000 + i64::from(n)))],
            );
            assert_eq!(next.phase, Phase::Live);
            s = next;
        }
        assert_eq!(delays, vec![Duration::from_secs(1), Duration::from_secs(5), Duration::from_secs(15)]);

        let (stopped, fx) = run(s, vec![Event::Eof(U)]);
        assert_eq!(stopped.phase, Phase::Stopped);
        assert_eq!(notice_code(&stopped), Some(NoticeCode::HelperExited), "the notice is kept");
        assert!(has(&fx, &Effect::Terminate(Terminate::All)));
        assert_eq!(stopped.restart_attempt_for_status(), None);
    }

    #[test]
    fn ut10_a_60_second_live_period_resets_the_count() {
        let (s, _) = run(live(), vec![Event::Eof(U)]);
        assert_eq!(s.attempts, 1);
        let (s, _) = run(
            s,
            vec![Event::RestartTimer, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(5000)), Event::LiveFor60s],
        );
        assert_eq!(s.attempts, 0);
        let (s, fx) = run(s, vec![Event::Eof(U)]);
        assert_eq!(s.restart_attempt_for_status(), Some(1));
        assert_eq!(restart_delay(&fx), Some(Duration::from_secs(1)), "back to attempt 1");
    }

    #[test]
    fn a_live_for_60s_event_outside_live_changes_nothing() {
        let (s, _) = run(live(), vec![Event::Eof(U)]);
        let (after, _) = run(s.clone(), vec![Event::LiveFor60s]);
        assert_eq!(after, s);
    }

    #[test]
    fn a_failure_during_a_restart_attempt_counts_as_the_next_attempt() {
        let (s, _) = run(live(), vec![Event::Eof(U), Event::RestartTimer, Event::Verified(U), Event::Launched(U)]);
        let (s, fx) = run(s, vec![Event::ConnectTimeout(U)]);
        assert_eq!(s.phase, Phase::Reconnecting);
        assert_eq!(s.restart_attempt_for_status(), Some(2));
        assert_eq!(restart_delay(&fx), Some(Duration::from_secs(5)));
    }

    // ---- rows: other errors, frame ordering, guards ----

    #[test]
    fn row_a_non_fatal_error_code_changes_nothing() {
        let before = live();
        let (after, fx) = run(before.clone(), vec![Event::OtherHelperError(U)]);
        assert_eq!(after, before);
        assert!(fx.is_empty());
        let _ = ErrorMessage { v: 1, code: "out_of_range".into(), detail: String::new() };
    }

    #[test]
    fn row_a_frame_not_newer_than_the_last_forwarded_one_is_dropped() {
        let (s, fx) = run(live(), vec![Event::Frame(U, frame(1000))]);
        assert_eq!(forwards(&fx), 0);
        let (s, fx) = run(s, vec![Event::Frame(U, frame(999))]);
        assert_eq!(forwards(&fx), 0);
        let (s, fx) = run(s, vec![Event::Frame(U, frame(2000))]);
        assert_eq!(forwards(&fx), 1);
        assert_eq!(s.last_forwarded_t, Some(2000));
    }

    #[test]
    fn row_the_elevated_switch_still_happens_when_its_first_frame_is_stale() {
        let (s, fx) = run(connecting(), vec![Event::Hello(E, hello(true, true)), Event::Frame(E, frame(500))]);
        assert_eq!(s.active, Some(E));
        assert!(has(&fx, &Effect::SwitchSource));
        assert_eq!(forwards(&fx), 0);
    }

    #[test]
    fn frames_from_a_closed_unprivileged_link_are_ignored_after_the_switch() {
        let (s, fx) = run(live_elevated(), vec![Event::Frame(U, frame(99_000))]);
        assert!(fx.is_empty());
        assert_eq!(s.active, Some(E));
        let (s, fx) = run(s, vec![Event::Eof(U)]);
        assert_eq!(s.phase, Phase::Live, "the retired helper's EOF is not a failure");
        assert!(fx.is_empty());
    }

    #[test]
    fn guard_enable_full_is_a_no_op_unless_live_unprivileged_and_idle() {
        for before in [State::new(), prompting(), connecting(), live_elevated(), run(live(), vec![Event::Eof(U)]).0] {
            let (after, fx) = run(before.clone(), vec![Event::EnableFull]);
            assert_eq!(after, before);
            assert!(fx.is_empty());
        }
        let stopped = run(State::new(), vec![Event::Begin, Event::VerifyFailed(U, missing())]).0;
        let (after, fx) = run(stopped.clone(), vec![Event::EnableFull]);
        assert_eq!(after, stopped);
        assert!(fx.is_empty());
    }

    #[test]
    fn guard_retry_is_a_no_op_unless_stopped() {
        for before in [State::new(), live(), prompting(), run(live(), vec![Event::Eof(U)]).0] {
            let (after, fx) = run(before.clone(), vec![Event::Retry]);
            assert_eq!(after, before);
            assert!(fx.is_empty());
        }
    }

    #[test]
    fn row_retry_from_stopped_starts_again_with_a_clean_slate() {
        let mut stopped = run(State::new(), vec![Event::Begin, Event::VerifyFailed(U, mismatch())]).0;
        stopped.attempts = 3;
        let (s, fx) = run(stopped, vec![Event::Retry]);
        assert_eq!(s.phase, Phase::Starting);
        assert_eq!(s.notice, None);
        assert_eq!(s.attempts, 0);
        assert_eq!(fx, vec![Effect::Verify(U)]);
    }

    #[test]
    fn guard_the_restart_timer_only_acts_while_reconnecting() {
        let before = live();
        let (after, fx) = run(before.clone(), vec![Event::RestartTimer]);
        assert_eq!(after, before);
        assert!(fx.is_empty());
    }

    #[test]
    fn guard_restart_attempt_is_only_reported_while_reconnecting() {
        assert_eq!(State::new().status("x").restart_attempt, None);
        assert_eq!(live().status("x").restart_attempt, None);
        let (s, _) = run(live(), vec![Event::Eof(U)]);
        assert_eq!(s.status("x").restart_attempt, Some(1));
        assert_eq!(s.status("x").helper_sha256, "x");
    }

    #[test]
    fn row_exit_asks_for_one_shutdown_and_then_ignores_everything() {
        let (s, fx) = run(live_elevated(), vec![Event::Exit]);
        assert_eq!(fx, vec![Effect::Shutdown]);
        assert!(s.exiting);
        let (after, fx) = run(s.clone(), vec![Event::Eof(E), Event::Retry, Event::RestartTimer]);
        assert_eq!(after, s);
        assert!(fx.is_empty());
    }

    // ---- notice codes ----

    #[test]
    fn every_notice_code_has_a_producer() {
        // blocking: missing, hash mismatch, squatter, schema mismatch — see the `row_*_blocks` cases above.
        // after three attempts: helper_error and helper_exited — `ut10_the_restart_policy_worked_example`.
        // non-blocking: full_sensors_lost, uac_cancelled, elevation_failed, elevation_timeout — the elevation rows.
        let produced = [
            run(State::new(), vec![Event::Begin, Event::VerifyFailed(U, missing())]).0.notice,
            run(State::new(), vec![Event::Begin, Event::VerifyFailed(U, mismatch())]).0.notice,
            run(live(), vec![Event::Squatter(U, "process 1".into())]).0.notice,
            run(live(), vec![Event::SchemaMismatch(U, 2)]).0.notice,
            run(live(), vec![Event::LineError(U, "x".into())]).0.notice,
            run(live(), vec![Event::Eof(U)]).0.notice,
            run(live_elevated(), vec![Event::Eof(E), Event::RestartTimer, Event::Verified(U), Event::Launched(U), Event::Hello(U, hello(false, true)), Event::Frame(U, frame(9000))]).0.notice,
            run(prompting(), vec![Event::Cancelled]).0.notice,
            run(connecting(), vec![Event::Eof(E)]).0.notice,
            run(connecting(), vec![Event::FirstFrameTimeout(E)]).0.notice,
        ];
        let codes: Vec<NoticeCode> = produced.iter().map(|n| n.as_ref().expect("a notice").code).collect();
        assert_eq!(
            codes,
            vec![
                NoticeCode::HelperMissing,
                NoticeCode::HelperHashMismatch,
                NoticeCode::PipeSquatter,
                NoticeCode::SchemaMismatch,
                NoticeCode::HelperError,
                NoticeCode::HelperExited,
                NoticeCode::FullSensorsLost,
                NoticeCode::UacCancelled,
                NoticeCode::ElevationFailed,
                NoticeCode::ElevationTimeout,
            ]
        );
    }

    impl State {
        fn restart_attempt_for_status(&self) -> Option<u32> {
            self.status("").restart_attempt
        }
    }
}
