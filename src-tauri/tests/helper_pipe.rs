//! IT-01…IT-17: the real published helper (`binaries/pophood-sensors-x86_64-pc-windows-msvc.exe`, unprivileged) and the
//! app's own pipe client, driven through `pophood_lib::sensors::{helper, pipe, protocol}`.
//!
//! Build the helper first (`npm run build:helper`). Hardware-specific assertions need `POPHOOD_OWNER_PC=1`.
//! The 30 s test (IT-10) is `#[ignore]`: run it with `cargo test -- --ignored`.
//! Tests are serialised: every helper runs LHM, and the cadence checks need an otherwise quiet machine.

use std::collections::HashSet;
use std::os::windows::io::AsRawHandle;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use pophood_lib::sensors::helper::{HelperImage, HelperProcess, launch_unprivileged};
use pophood_lib::sensors::pipe::{HelperConnection, MAX_LINE, PipeError, connect_verified, new_pipe_name};
use pophood_lib::sensors::protocol::{ControlMessage, ErrorMessage, Frame, HelperMessage, Hello, sensor_key};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::{ClientOptions, ServerOptions};

static SERIAL: Mutex<()> = Mutex::new(());

fn serial() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(|e| e.into_inner())
}

fn owner_pc() -> bool {
    std::env::var("POPHOOD_OWNER_PC").as_deref() == Ok("1")
}

fn helper_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join("pophood-sensors-x86_64-pc-windows-msvc.exe")
}

fn this_exe() -> PathBuf {
    std::env::current_exe().expect("current_exe")
}

/// A launched helper that is terminated when the test ends, whatever the outcome.
struct Helper {
    _image: HelperImage,
    process: HelperProcess,
    name: String,
}

impl Drop for Helper {
    fn drop(&mut self) {
        self.process.terminate();
    }
}

fn start_on(name: String, client: &Path) -> Helper {
    let image = HelperImage::open_verified(&helper_path(), env!("POPHOOD_HELPER_SHA256"))
        .expect("the staged helper matches the compiled-in hash (run `npm run build:helper`, then rebuild)");
    let process = launch_unprivileged(&image, &name, client).expect("launch the helper");
    Helper { _image: image, process, name }
}

fn start(client: &Path) -> Helper {
    start_on(new_pipe_name(), client)
}

async fn connect(helper: &Helper) -> HelperConnection {
    connect_verified(&helper.name, &helper.process, Instant::now() + Duration::from_secs(10))
        .await
        .expect("connect to the helper")
}

async fn message(conn: &mut HelperConnection, secs: u64) -> HelperMessage {
    tokio::time::timeout(Duration::from_secs(secs), conn.next_message())
        .await
        .unwrap_or_else(|_| panic!("no message within {secs} s"))
        .expect("a valid message")
}

async fn hello(conn: &mut HelperConnection) -> Hello {
    match message(conn, 10).await {
        HelperMessage::Hello(hello) => hello,
        other => panic!("expected hello, got {other:?}"),
    }
}

async fn next_frame(conn: &mut HelperConnection) -> Frame {
    loop {
        if let HelperMessage::Frame(frame) = message(conn, 10).await {
            return frame;
        }
    }
}

/// The next ack or error, skipping frames.
async fn next_reply(conn: &mut HelperConnection) -> HelperMessage {
    loop {
        match message(conn, 10).await {
            HelperMessage::Frame(_) => continue,
            other => return other,
        }
    }
}

async fn wait_exit(process: &HelperProcess, within: Duration) -> Option<u32> {
    let end = Instant::now() + within;
    loop {
        if let Some(code) = process.exit_code() {
            return Some(code);
        }
        if Instant::now() >= end {
            return None;
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
}

fn pawnio_installed_in_registry() -> bool {
    ["/reg:64", "/reg:32"].iter().any(|view| {
        Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\PawnIO", view])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    })
}

fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}

async fn frame_deltas(conn: &mut HelperConnection, count: usize, expected_period: u32) -> Vec<f64> {
    let mut previous = next_frame(conn).await;
    assert_eq!(previous.period_ms, expected_period);
    let mut deltas = Vec::new();
    for _ in 0..count {
        let frame = next_frame(conn).await;
        assert_eq!(frame.period_ms, expected_period);
        deltas.push((frame.t - previous.t) as f64);
        previous = frame;
    }
    deltas
}

// IT-01
#[tokio::test]
async fn it01_launch_verify_hello_first_frame() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;

    let hello = hello(&mut conn).await;
    assert_eq!(hello.v, 1);
    let helper_is_elevated = hello.elevated;
    if owner_pc() {
        assert!(!hello.elevated, "run the integration tests from an unelevated shell");
        assert_eq!(hello.pawn_io.installed, pawnio_installed_in_registry());
    }

    let asked = Instant::now();
    let frame = next_frame(&mut conn).await;
    let first_frame_after = asked.elapsed();
    println!(
        "IT-01: elevated={helper_is_elevated} pawnIo={:?} first frame {first_frame_after:?} after hello, {} sensors, {} hardware, {} memory modules",
        hello.pawn_io,
        frame.sensors.len(),
        frame.hardware.len(),
        frame.memory.len()
    );
    assert!(first_frame_after < Duration::from_secs(3), "first frame took {first_frame_after:?}");
    assert_eq!(frame.v, 1);
    assert_eq!(frame.seq, 1);
    if owner_pc() {
        assert!(frame.sensors.len() >= 150, "only {} sensors", frame.sensors.len());
    }

    let keys: HashSet<String> = frame.sensors.iter().map(|s| sensor_key(&s.id, &s.name)).collect();
    assert_eq!(keys.len(), frame.sensors.len(), "sensor keys are not unique");
    assert!(frame.sensors.iter().all(|s| frame.hardware.iter().any(|h| h.id == s.hw)), "a sensor names unknown hardware");
}

// IT-02
#[tokio::test]
async fn it02_rf3_in_a_real_unprivileged_frame() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    let hello = hello(&mut conn).await;
    let frame = next_frame(&mut conn).await;

    if hello.elevated {
        println!("IT-02: the helper is elevated (the test shell is), so the unprivileged rules don't apply");
        return;
    }
    let cpus: Vec<&str> = frame.hardware.iter().filter(|h| h.kind == "Cpu").map(|h| h.id.as_str()).collect();
    assert!(!cpus.is_empty(), "no Cpu hardware");
    let mut with_value = 0;
    for sensor in frame.sensors.iter().filter(|s| cpus.contains(&s.hw.as_str())) {
        if sensor.kind != "Load" {
            assert_eq!(sensor.value, None, "{} ({}) must be null unprivileged", sensor.name, sensor.kind);
        } else if sensor.value.is_some() {
            with_value += 1;
        }
    }
    assert!(with_value > 0, "no Cpu load has a value");
    assert!(frame.hardware.iter().all(|h| !matches!(h.kind.as_str(), "SuperIO" | "Storage")), "SuperIO or Storage listed");
    println!("IT-02: {} cpu(s), {with_value} load values, no SuperIO or Storage", cpus.len());
}

// IT-03
#[tokio::test]
async fn it03_cadence_at_1000_ms() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;

    let deltas = frame_deltas(&mut conn, 10, 1000).await;
    let average = mean(&deltas);
    let drift: f64 = deltas.iter().sum::<f64>() - 10_000.0;
    println!("IT-03: deltas {deltas:?} mean {average:.1} ms, cumulative drift {drift:+.1} ms");
    assert!((average - 1000.0).abs() <= 20.0, "mean {average}");
    assert!(drift.abs() < 50.0, "drift {drift}");
}

// IT-04
#[tokio::test]
async fn it04_set_period_250_then_1000() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;
    next_frame(&mut conn).await;

    for (period, tolerance) in [(250u32, 10.0), (1000, 20.0)] {
        conn.send(&ControlMessage::set_period(period)).await.expect("send set_period");
        match next_reply(&mut conn).await {
            HelperMessage::Ack(ack) => assert_eq!(ack.period_ms, period),
            other => panic!("expected an ack, got {other:?}"),
        }
        // Frames already in flight carry the old period; wait for the first one that carries the new one.
        let first = loop {
            let frame = next_frame(&mut conn).await;
            if frame.period_ms == period {
                break frame;
            }
        };
        let mut previous = first;
        let mut deltas = Vec::new();
        for _ in 0..10 {
            let frame = next_frame(&mut conn).await;
            assert_eq!(frame.period_ms, period);
            deltas.push((frame.t - previous.t) as f64);
            previous = frame;
        }
        let average = mean(&deltas);
        println!("IT-04: {period} ms: mean {average:.1} ms over {} deltas", deltas.len());
        assert!((average - f64::from(period)).abs() <= tolerance, "mean {average} at {period} ms");
    }
}

fn fuzz_cases() -> Vec<(&'static str, Vec<u8>, &'static str)> {
    vec![
        ("empty line", b"".to_vec(), "bad_json"),
        ("plain text", b"hello".to_vec(), "bad_json"),
        ("truncated json", b"{".to_vec(), "bad_json"),
        ("array", b"[1,2,3]".to_vec(), "not_object"),
        ("string", br#""str""#.to_vec(), "not_object"),
        ("wrong version", br#"{"v":2,"type":"set_period","ms":250}"#.to_vec(), "bad_version"),
        ("missing version", br#"{"type":"set_period","ms":250}"#.to_vec(), "bad_version"),
        ("unknown type", br#"{"v":1,"type":"reboot"}"#.to_vec(), "unknown_type"),
        ("ms as string", br#"{"v":1,"type":"set_period","ms":"250"}"#.to_vec(), "bad_field"),
        ("ms negative", br#"{"v":1,"type":"set_period","ms":-5}"#.to_vec(), "out_of_range"),
        ("ms too fast", br#"{"v":1,"type":"set_period","ms":10}"#.to_vec(), "out_of_range"),
        ("ms 1e30", br#"{"v":1,"type":"set_period","ms":1e30}"#.to_vec(), "bad_field"),
        ("ms fractional", br#"{"v":1,"type":"set_period","ms":250.5}"#.to_vec(), "bad_field"),
        ("extra field", br#"{"v":1,"type":"set_period","ms":250,"x":1}"#.to_vec(), "unknown_field"),
        ("duplicate field", br#"{"v":1,"type":"set_period","ms":250,"ms":10}"#.to_vec(), "bad_json"),
        ("deep nesting", br#"{"v":1,"type":"set_period","ms":{"a":{"b":[[[1]]]}}}"#.to_vec(), "bad_json"),
        ("invalid utf-8", b"{\"v\":1,\"type\":\"\xff\xfe\"}".to_vec(), "bad_encoding"),
        ("bad utf-8 name", b"{\"v\":1,\"\xc3\x28\":1}".to_vec(), "bad_encoding"),
        ("lone surrogate", br#"{"v":1,"type":"\ud800"}"#.to_vec(), "internal_error"),
        ("CRLF + BOM", b"\xef\xbb\xbf{\"v\":1,\"type\":\"set_period\",\"ms\":5}\r".to_vec(), "bad_json"),
        ("NUL bytes", b"\0\0\0\0".to_vec(), "bad_json"),
        ("1 MiB line", vec![b'A'; 1024 * 1024], "too_long"),
    ]
}

// IT-05
#[tokio::test]
async fn it05_fuzz_over_the_pipe() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;

    let cases = fuzz_cases();
    assert_eq!(cases.len(), 22);
    for (name, bytes, expected_code) in &cases {
        conn.send_raw(bytes).await.unwrap_or_else(|e| panic!("send {name}: {e}"));
        match next_reply(&mut conn).await {
            HelperMessage::Error(ErrorMessage { code, detail, .. }) => {
                println!("IT-05: {name:<16} -> {code} {detail:.60}");
                assert_eq!(&code, expected_code, "{name}");
            }
            other => panic!("{name}: expected an error reply, got {other:?}"),
        }
    }

    assert_eq!(helper.process.exit_code(), None, "the helper died during the fuzz run");
    conn.send(&ControlMessage::set_period(250)).await.expect("send set_period");
    match next_reply(&mut conn).await {
        HelperMessage::Ack(ack) => assert_eq!(ack.period_ms, 250),
        other => panic!("expected an ack after the fuzz run, got {other:?}"),
    }
    assert_eq!(helper.process.exit_code(), None);
}

// IT-06
#[tokio::test]
async fn it06_disconnect_makes_the_helper_exit() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;
    next_frame(&mut conn).await;

    let dropped = Instant::now();
    drop(conn);
    let code = wait_exit(&helper.process, Duration::from_secs(5)).await;
    println!("IT-06: exited with {code:?} {:?} after the client dropped", dropped.elapsed());
    assert_eq!(code, Some(0));
}

// IT-07
#[tokio::test]
async fn it07_foreign_client_is_disconnected_and_the_helper_keeps_listening() {
    let _guard = serial();
    let helper = start(Path::new(r"C:\Windows\notepad.exe"));
    let mut conn = connect(&helper).await;

    match tokio::time::timeout(Duration::from_secs(5), conn.next_message()).await.expect("the read ended") {
        Err(PipeError::Closed) => {}
        Err(PipeError::Io(e)) if matches!(e.raw_os_error(), Some(233 | 109)) => {}
        other => panic!("expected EOF or OS error 233/109, got {other:?}"),
    }
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert_eq!(helper.process.exit_code(), None, "the helper must keep listening");
}

// IT-08
#[tokio::test]
async fn it08_squatter_before_the_helper_makes_it_exit_3() {
    let _guard = serial();
    let name = new_pipe_name();
    let _squatter = ServerOptions::new()
        .first_pipe_instance(true)
        .create(format!(r"\\.\pipe\{name}"))
        .expect("create the squatting pipe");
    let helper = start_on(name, &this_exe());
    assert_eq!(wait_exit(&helper.process, Duration::from_secs(5)).await, Some(3));
}

// IT-09
#[tokio::test]
async fn it09_a_squatter_answering_the_app_is_refused_without_a_write() {
    let _guard = serial();
    let helper = start(&this_exe()); // a real child, on its own pipe, never connected
    let fake_name = new_pipe_name();
    let fake = ServerOptions::new()
        .first_pipe_instance(true)
        .create(format!(r"\\.\pipe\{fake_name}"))
        .expect("create the fake server");
    let received = tokio::spawn(async move {
        fake.connect().await.expect("a client connected");
        let mut fake = fake;
        let mut buffer = [0u8; 64];
        tokio::time::timeout(Duration::from_secs(2), fake.read(&mut buffer)).await
    });

    let result = connect_verified(&fake_name, &helper.process, Instant::now() + Duration::from_secs(5)).await;
    match result {
        Err(PipeError::Squatter { detail }) => assert_eq!(detail, format!("process {}", std::process::id())),
        other => panic!("expected Squatter, got {:?}", other.map(|_| "a connection")),
    }
    match received.await.expect("the fake server task") {
        Ok(Ok(0)) | Ok(Err(_)) => {} // EOF or a broken pipe: no bytes arrived
        other => panic!("the fake server received data: {other:?}"),
    }
}

// IT-10
#[tokio::test]
#[ignore = "takes 30 s: run with `cargo test -- --ignored`"]
async fn it10_no_client_exits_4_after_30_seconds() {
    let _guard = serial();
    let started = Instant::now();
    let helper = start(&this_exe());
    let code = wait_exit(&helper.process, Duration::from_secs(40)).await;
    let elapsed = started.elapsed();
    println!("IT-10: exit {code:?} after {elapsed:?}");
    assert_eq!(code, Some(4));
    assert!(elapsed >= Duration::from_millis(29_900) && elapsed <= Duration::from_millis(31_500), "{elapsed:?}");
}

fn wmi_memory() -> Vec<(u64, u64)> {
    let output = Command::new("pwsh")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity, ConfiguredClockSpeed)",
        ])
        .output()
        .expect("run pwsh");
    assert!(output.status.success(), "pwsh failed: {}", String::from_utf8_lossy(&output.stderr));
    let rows: Vec<serde_json::Value> = serde_json::from_slice(&output.stdout).expect("WMI JSON");
    let mut modules: Vec<(u64, u64)> = rows
        .iter()
        .map(|row| (row["Capacity"].as_u64().expect("Capacity"), row["ConfiguredClockSpeed"].as_u64().expect("speed")))
        .collect();
    modules.sort_unstable();
    modules
}

// IT-11
#[tokio::test]
async fn it11_memory_facts_match_wmi() {
    let _guard = serial();
    let wmi = wmi_memory();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;
    let frame = next_frame(&mut conn).await;

    println!("IT-11: WMI {wmi:?}; helper {:?}", frame.memory);
    assert!(!frame.memory.is_empty(), "no memory modules");
    let mut seen: Vec<(u64, u64)> = frame
        .memory
        .iter()
        .map(|m| {
            let configured = m.configured_mts.expect("configuredMTs") as u64;
            assert!(configured > 0);
            let mib = (m.size_gb * 1024.0).round() as u64;
            (mib << 20, configured)
        })
        .collect();
    seen.sort_unstable();
    assert_eq!(seen, wmi);
    if owner_pc() {
        assert_eq!(frame.memory.len(), 2);
        assert!(frame.memory.iter().all(|m| m.size_gb == 16.0 && m.kind == "DDR5" && m.configured_mts == Some(6000)));
    }
}

// IT-12
#[tokio::test]
async fn it12_spawn_succeeds_while_the_image_is_held() {
    let _guard = serial();
    let image = HelperImage::open_verified(&helper_path(), env!("POPHOOD_HELPER_SHA256")).expect("verify");
    let process = launch_unprivileged(&image, &new_pipe_name(), &this_exe()).expect("spawn under the file lock");
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert_eq!(process.exit_code(), None, "the helper should be running");
    assert!(process.pid > 0);
    process.terminate();
    assert_eq!(wait_exit(&process, Duration::from_secs(5)).await, Some(1));
}

// IT-13
#[tokio::test]
async fn it13_bad_arguments_exit_64() {
    let _guard = serial();
    let valid_name = new_pipe_name();
    let client = this_exe();
    let client = client.to_str().expect("utf-8 path").to_string();
    let cases: Vec<(&str, Vec<String>)> = vec![
        ("no --pipe", vec!["--client".into(), client.clone()]),
        ("--pipe without a value", vec!["--pipe".into()]),
        ("--client without a value", vec!["--pipe".into(), valid_name.clone(), "--client".into()]),
        ("bad name", vec!["--pipe".into(), "foo".into(), "--client".into(), client.clone()]),
        ("relative client", vec!["--pipe".into(), valid_name.clone(), "--client".into(), "relative.exe".into()]),
        ("no arguments", vec![]),
    ];
    for (name, args) in cases {
        let mut child = Command::new(helper_path()).args(&args).spawn().expect("spawn");
        let end = Instant::now() + Duration::from_secs(10);
        let status = loop {
            if let Some(status) = child.try_wait().expect("try_wait") {
                break status;
            }
            if Instant::now() >= end {
                let _ = child.kill();
                panic!("{name}: the helper did not exit");
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        };
        println!("IT-13: {name:<26} -> exit {:?}", status.code());
        assert_eq!(status.code(), Some(64), "{name}");
    }
}

fn current_user_sid_string() -> String {
    use windows::Win32::Foundation::{CloseHandle, HANDLE, LocalFree};
    use windows::Win32::Security::Authorization::ConvertSidToStringSidW;
    use windows::Win32::Security::{GetTokenInformation, TOKEN_QUERY, TOKEN_USER, TokenUser};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    // SAFETY: standard token query; the buffer is sized from the first call and the handle is closed.
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).expect("OpenProcessToken");
        let mut needed = 0u32;
        let _ = GetTokenInformation(token, TokenUser, None, 0, &mut needed);
        let mut buffer = vec![0u8; needed as usize];
        GetTokenInformation(token, TokenUser, Some(buffer.as_mut_ptr().cast()), needed, &mut needed)
            .expect("GetTokenInformation");
        let user = &*(buffer.as_ptr() as *const TOKEN_USER);
        let mut text = windows::core::PWSTR::null();
        ConvertSidToStringSidW(user.User.Sid, &mut text).expect("ConvertSidToStringSidW");
        let sid = text.to_string().expect("utf-16");
        let _ = LocalFree(Some(windows::Win32::Foundation::HLOCAL(text.0.cast())));
        let _ = CloseHandle(token);
        sid
    }
}

/// (SID string, access mask, ACE type) of every ACE in the DACL of the pipe behind `handle`.
fn pipe_dacl(handle: *mut core::ffi::c_void) -> Vec<(String, u32, u8)> {
    use windows::Win32::Foundation::{HANDLE, HLOCAL, LocalFree};
    use windows::Win32::Security::Authorization::{ConvertSidToStringSidW, GetSecurityInfo, SE_KERNEL_OBJECT};
    use windows::Win32::Security::{
        ACCESS_ALLOWED_ACE, ACE_HEADER, ACL, ACL_SIZE_INFORMATION, AclSizeInformation, DACL_SECURITY_INFORMATION, GetAce,
        GetAclInformation, PSECURITY_DESCRIPTOR, PSID,
    };
    // SAFETY: the descriptor returned by GetSecurityInfo is freed with LocalFree; ACE pointers are used only before that.
    unsafe {
        let mut dacl: *mut ACL = std::ptr::null_mut();
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        let status =
            GetSecurityInfo(HANDLE(handle), SE_KERNEL_OBJECT, DACL_SECURITY_INFORMATION, None, None, Some(&mut dacl), None, Some(&mut descriptor));
        assert_eq!(status.0, 0, "GetSecurityInfo failed: {status:?}");
        assert!(!dacl.is_null(), "the pipe has a NULL DACL (everyone allowed)");

        let mut size = ACL_SIZE_INFORMATION::default();
        GetAclInformation(dacl, (&mut size as *mut ACL_SIZE_INFORMATION).cast(), size_of::<ACL_SIZE_INFORMATION>() as u32, AclSizeInformation)
            .expect("GetAclInformation");
        let mut aces = Vec::new();
        for index in 0..size.AceCount {
            let mut ace: *mut core::ffi::c_void = std::ptr::null_mut();
            GetAce(dacl, index, &mut ace).expect("GetAce");
            let header = &*(ace as *const ACE_HEADER);
            let allowed = &*(ace as *const ACCESS_ALLOWED_ACE);
            let sid = PSID((&allowed.SidStart as *const u32).cast_mut().cast());
            let mut text = windows::core::PWSTR::null();
            ConvertSidToStringSidW(sid, &mut text).expect("ConvertSidToStringSidW");
            let sid_text = text.to_string().expect("utf-16");
            let _ = LocalFree(Some(HLOCAL(text.0.cast())));
            aces.push((sid_text, allowed.Mask, header.AceType));
        }
        let _ = LocalFree(Some(HLOCAL(descriptor.0)));
        aces
    }
}

// IT-14
#[tokio::test]
async fn it14_pipe_dacl_allows_only_the_current_user() {
    let _guard = serial();
    let helper = start(&this_exe());
    let path = format!(r"\\.\pipe\{}", helper.name);
    let client = loop {
        match ClientOptions::new().read(true).write(true).open(&path) {
            Ok(client) => break client,
            Err(e) if matches!(e.raw_os_error(), Some(2 | 231)) => tokio::time::sleep(Duration::from_millis(50)).await,
            Err(e) => panic!("open {path}: {e}"),
        }
    };

    let aces = pipe_dacl(client.as_raw_handle());
    let user = current_user_sid_string();
    println!("IT-14: current user {user}");
    for (sid, mask, kind) in &aces {
        println!("IT-14: ACE type {kind} sid {sid} mask {mask:#010x}");
    }
    assert_eq!(aces.len(), 1, "exactly one ACE expected: {aces:?}");
    let (sid, mask, kind) = &aces[0];
    assert_eq!(*kind, 0, "an ACCESS_ALLOWED_ACE");
    assert_eq!(sid, &user);
    // FILE_READ_DATA (0x1) and FILE_WRITE_DATA (0x2): PipeAccessRule also adds SYNCHRONIZE, so don't compare for equality.
    assert_eq!(mask & 0x3, 0x3, "mask {mask:#x} must include read and write");
    for everyone_like in ["S-1-1-0", "S-1-5-7", "S-1-5-32-544", "S-1-5-2"] {
        assert_ne!(sid, everyone_like);
    }
}

// IT-15
#[tokio::test]
async fn it15_wrong_client_is_dropped_then_the_right_one_gets_hello() {
    let _guard = serial();
    let helper = start(&this_exe());
    let script = format!(
        "$c = [System.IO.Pipes.NamedPipeClientStream]::new('.', '{}', 'InOut'); $c.Connect(8000); \
         $b = New-Object byte[] 16; try {{ $n = $c.Read($b, 0, 16) }} catch {{ $n = -1 }}; Write-Output $n",
        helper.name
    );
    let output = Command::new("pwsh").args(["-NoProfile", "-NonInteractive", "-Command", &script]).output().expect("run pwsh");
    let read: i64 = String::from_utf8_lossy(&output.stdout).trim().parse().unwrap_or_else(|_| {
        panic!("pwsh printed {:?} / {:?}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr))
    });
    println!("IT-15: the wrong client read {read} (0 = EOF, -1 = broken pipe)");
    assert!(read <= 0, "the wrong client received {read} bytes");

    let mut conn = connect(&helper).await;
    assert_eq!(hello(&mut conn).await.v, 1);
}

fn padded_set_period(ms: u32, total: usize) -> Vec<u8> {
    let mut line = format!(r#"{{"v":1,"type":"set_period","ms":{ms}}}"#).into_bytes();
    assert!(line.len() <= total);
    line.resize(total, b' ');
    line
}

// IT-16, helper side
#[tokio::test]
async fn it16_helper_line_limit_is_1024_bytes() {
    let _guard = serial();
    let helper = start(&this_exe());
    let mut conn = connect(&helper).await;
    hello(&mut conn).await;

    conn.send_raw(&padded_set_period(250, 1024)).await.expect("send");
    match next_reply(&mut conn).await {
        HelperMessage::Ack(ack) => assert_eq!(ack.period_ms, 250),
        other => panic!("a 1024-byte line must be accepted, got {other:?}"),
    }

    // One write: an over-long line, then a valid one. The second must still be read.
    let mut both = padded_set_period(300, 1025);
    both.push(b'\n');
    both.extend_from_slice(&padded_set_period(400, 36));
    conn.send_raw(&both).await.expect("send");
    match next_reply(&mut conn).await {
        HelperMessage::Error(error) => assert_eq!(error.code, "too_long"),
        other => panic!("a 1025-byte line must be refused, got {other:?}"),
    }
    match next_reply(&mut conn).await {
        HelperMessage::Ack(ack) => assert_eq!(ack.period_ms, 400),
        other => panic!("the next line must still parse, got {other:?}"),
    }
}

async fn fake_pair() -> (tokio::net::windows::named_pipe::NamedPipeServer, HelperConnection) {
    let name = new_pipe_name();
    let path = format!(r"\\.\pipe\{name}");
    let server = ServerOptions::new().first_pipe_instance(true).create(&path).expect("create the fake server");
    let client = ClientOptions::new().read(true).write(true).open(&path).expect("open the fake server");
    server.connect().await.expect("connect");
    (server, HelperConnection::from_client(client))
}

// IT-16, core side
#[tokio::test]
async fn it16_core_line_limit_is_4_mib() {
    let _guard = serial();

    let (mut server, mut conn) = fake_pair().await;
    let writer = tokio::spawn(async move {
        let mut line = vec![b'a'; MAX_LINE + 1];
        line.push(b'\n');
        let _ = server.write_all(&line).await;
        server
    });
    match tokio::time::timeout(Duration::from_secs(10), conn.next_message()).await.expect("the read ended") {
        Err(PipeError::LineTooLong) => {}
        other => panic!("expected LineTooLong, got {other:?}"),
    }
    drop(conn);
    drop(writer);

    // A realistic ~30 KB frame parses.
    let (mut server, mut conn) = fake_pair().await;
    let sensors: Vec<serde_json::Value> = (0..260)
        .map(|i| {
            serde_json::json!({
                "id": format!("/lpc/it8696e/0/temperature/{i}"), "hw": "/lpc/it8696e/0",
                "name": format!("Sensor number {i} with a fairly long name"), "type": "Temperature",
                "index": i, "value": 42.5
            })
        })
        .collect();
    let line = serde_json::json!({
        "v": 1, "type": "frame", "seq": 1, "t": 1761040800123i64, "periodMs": 1000, "memory": [],
        "hardware": [{"id": "/lpc/it8696e/0", "name": "ITE IT8696E", "type": "SuperIO", "parent": null}],
        "sensors": sensors
    })
    .to_string();
    assert!(line.len() > 25_000 && line.len() < 60_000, "{} bytes", line.len());
    server.write_all(line.as_bytes()).await.expect("write");
    server.write_all(b"\n").await.expect("write");
    match tokio::time::timeout(Duration::from_secs(5), conn.next_message()).await.expect("the read ended") {
        Ok(HelperMessage::Frame(frame)) => assert_eq!(frame.sensors.len(), 260),
        other => panic!("expected a frame, got {other:?}"),
    }
}

// IT-17. The helper's exit 3 (name taken) is a squatter, which always blocks (T12 review, A1).
#[tokio::test]
async fn it17_an_early_child_exit_ends_the_connect_at_once() {
    let _guard = serial();
    let name = new_pipe_name();
    let path = format!(r"\\.\pipe\{name}");
    // Occupy the name with a *busy* server (connected to a dummy client), so the helper's FirstPipeInstance fails
    // with exit code 3 and the app's retries see "pipe busy" rather than a server to talk to.
    let server = ServerOptions::new().first_pipe_instance(true).create(&path).expect("create the squatting pipe");
    let _dummy = ClientOptions::new().read(true).write(true).open(&path).expect("dummy client");
    server.connect().await.expect("connect the dummy");

    let helper = start_on(name.clone(), &this_exe());
    let started = Instant::now();
    let result = connect_verified(&name, &helper.process, started + Duration::from_secs(10)).await;
    let elapsed = started.elapsed();
    println!("IT-17: {:?} after {elapsed:?}", result.as_ref().map(|_| "a connection"));
    match result {
        Err(PipeError::Squatter { detail }) => assert_eq!(detail, "the helper found its pipe name taken"),
        other => panic!("expected Squatter, got {:?}", other.map(|_| "a connection")),
    }
    assert!(elapsed < Duration::from_secs(2), "took {elapsed:?}, long before the 10 s deadline");
}

// IT-09: a pipe that denies the current user isn't one our helper made (its DACL grants us): a squatter, not a retry
// (T12 review, A1).
#[tokio::test]
async fn it09_a_pipe_that_denies_access_is_a_squatter() {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Authorization::{ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1};
    use windows::Win32::Security::{PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES};

    let _guard = serial();
    let helper = start(&this_exe()); // a real child, on its own pipe, never connected
    let name = new_pipe_name();
    let mut sd = PSECURITY_DESCRIPTOR::default();
    // SAFETY: the SDDL literal is valid; `sd` is freed with LocalFree below.
    unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(windows::core::w!("D:(D;;GA;;;WD)"), SDDL_REVISION_1, &mut sd, None)
    }
    .expect("build a deny-everyone descriptor");
    let mut attributes = SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: sd.0,
        bInheritHandle: false.into(),
    };
    // SAFETY: `attributes` and the descriptor it points to outlive the call.
    let _squatter = unsafe {
        ServerOptions::new()
            .first_pipe_instance(true)
            .create_with_security_attributes_raw(format!(r"\\.\pipe\{name}"), (&raw mut attributes).cast())
    }
    .expect("create the denying pipe");

    let result = connect_verified(&name, &helper.process, Instant::now() + Duration::from_secs(5)).await;
    // SAFETY: allocated by ConvertStringSecurityDescriptorToSecurityDescriptorW; the pipe keeps its own copy.
    unsafe {
        let _ = LocalFree(Some(HLOCAL(sd.0)));
    }
    match result {
        Err(PipeError::Squatter { detail }) => assert_eq!(detail, "the pipe denied access"),
        other => panic!("expected Squatter, got {:?}", other.map(|_| "a connection")),
    }
}
