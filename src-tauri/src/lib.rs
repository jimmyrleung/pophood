mod commands;
pub mod sensors;
pub mod webview;

use tauri::{Manager, RunEvent};

use sensors::SensorService;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::Security::{GetTokenInformation, TOKEN_ELEVATION, TOKEN_QUERY, TokenElevation};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::Win32::UI::WindowsAndMessaging::{MB_ICONERROR, MB_OK, MessageBoxW};
use windows::core::HSTRING;

/// Shows a native message box and exits. A release build has no console, and an error returned from `setup`
/// would be a silent `panic!` in a `windows_subsystem = "windows"` binary, so every startup failure ends here.
pub fn fatal(message: &str) -> ! {
    // SAFETY: plain Win32 call with owned, NUL-terminated strings.
    unsafe {
        MessageBoxW(None, &HSTRING::from(message), &HSTRING::from("Pophood"), MB_OK | MB_ICONERROR);
    }
    std::process::exit(1)
}

/// C1: Pophood itself never runs elevated. Only the sensor helper may, after one UAC prompt.
fn is_elevated() -> Result<bool, String> {
    // SAFETY: the token handle is closed on every path, and the output buffer is a TOKEN_ELEVATION of the stated size.
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).map_err(|e| e.to_string())?;
        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned = 0u32;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut TOKEN_ELEVATION as *mut core::ffi::c_void),
            size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        );
        let _ = CloseHandle(token);
        result.map_err(|e| e.to_string())?;
        Ok(elevation.TokenIsElevated != 0)
    }
}

fn refuse_if_elevated() {
    match is_elevated() {
        Ok(false) => {}
        Ok(true) => fatal("Pophood never runs as administrator. Start it normally."),
        // Fail closed: if the privilege level can't be read, don't run.
        Err(e) => fatal(&format!("Pophood could not check its privilege level: {e}")),
    }
}

fn setup(app: &mut tauri::App) -> Result<(), String> {
    webview::build_main_window(app)?;
    // `setup` has no tokio context, so the service spawns through `tauri::async_runtime`.
    app.manage(SensorService::start(app.handle().clone()));
    Ok(())
}

pub fn run() {
    refuse_if_elevated();

    let app = tauri::Builder::default()
        // Registered first: a second launch focuses the first window and exits before `setup`.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if let Err(e) = setup(app) {
                fatal(&format!("Pophood could not start: {e}"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::subscribe_sensors,
            commands::enable_full_sensors,
            commands::retry_sensors,
            commands::open_pawnio_site,
        ])
        .build(tauri::generate_context!())
        .unwrap_or_else(|e| fatal(&format!("Pophood could not start: {e}")));

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(service) = app.try_state::<SensorService>() {
                service.shutdown_blocking();
            }
        }
    });
}
