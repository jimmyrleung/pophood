//! The four Tauri commands. There are no capability files: app commands and a Channel need none, and no `core:default`
//! means no window, menu or tray API is reachable from JavaScript.

use tauri::State;
use tauri::ipc::Channel;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
use windows::core::w;

use crate::labels::{LabelStore, LoadedLabels};
use crate::sensors::SensorService;
use crate::sensors::events::SensorEvent;

/// Registers the UI's Channel, replacing any earlier one. Status and the latest frame follow on it.
#[tauri::command]
pub fn subscribe_sensors(service: State<'_, SensorService>, on_event: Channel<SensorEvent>) {
    service.subscribe(on_event);
}

/// Starts elevation. A no-op unless the helper is live, unprivileged and no elevation is in flight.
#[tauri::command]
pub fn enable_full_sensors(service: State<'_, SensorService>) {
    service.enable_full();
}

/// Restarts from `stopped`. A no-op otherwise.
#[tauri::command]
pub fn retry_sensors(service: State<'_, SensorService>) {
    service.retry();
}

/// Opens https://pawnio.eu in the default browser. The URL is a constant: the UI can't pass one.
#[tauri::command]
pub fn open_pawnio_site() -> Result<(), String> {
    // SAFETY: constant, NUL-terminated wide strings; ShellExecuteW only reads them.
    let result = unsafe { ShellExecuteW(None, w!("open"), w!("https://pawnio.eu"), None, None, SW_SHOWNORMAL) };
    let code = result.0 as isize;
    if code > 32 { Ok(()) } else { Err(format!("could not open the browser (code {code})")) }
}

#[tauri::command]
pub fn load_labels(labels: State<'_, LabelStore>) -> LoadedLabels {
    labels.load()
}

#[tauri::command]
pub fn set_label(labels: State<'_, LabelStore>, key: String, label: Option<String>) -> Result<(), String> {
    labels.set(key, label)
}
