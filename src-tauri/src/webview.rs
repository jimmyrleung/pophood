//! The app's own WebView2 environment and the navigation lock (RF29, OQ13, OQ15).
//!
//! The environment is created here, so every browser flag lives in [`BROWSER_ARGS`] and nowhere else. A supplied
//! environment makes wry ignore its own data directory, browser arguments and extension settings, so
//! `additionalBrowserArgs` in `tauri.conf.json` would be silently dropped: never set it there.

use std::path::Path;
use std::sync::mpsc;

use tauri::webview::NewWindowResponse;
use tauri::{App, Manager, Url, WebviewWindowBuilder};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    CreateCoreWebView2EnvironmentWithOptions, ICoreWebView2Environment, ICoreWebView2EnvironmentOptions,
};
use webview2_com::{CoreWebView2EnvironmentOptions, CreateCoreWebView2EnvironmentCompletedHandler};
use windows::Win32::Foundation::{E_POINTER, E_UNEXPECTED};
use windows::Win32::System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx};
use windows::core::{HSTRING, PCWSTR};

/// wry's defaults, which setting browser arguments replaces, plus:
/// - `msOneAuthWAM`: OneAuth (inside the WebView2 runtime folder) otherwise contacts `substrate.office.com` (OQ13);
/// - `--disable-background-networking`, `--disable-component-update`, `--no-proxy-server`: P5's verified flags.
pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,msOneAuthWAM --disable-background-networking --disable-component-update --no-proxy-server";

/// Creates the WebView2 environment on the calling thread, which must be the main thread.
pub fn create_environment(data_dir: &Path) -> Result<ICoreWebView2Environment, String> {
    // With `create: false` no window exists yet, so neither tao (`OleInitialize`) nor wry (`CoInitializeEx` in
    // `new_in_hwnd`) has initialised COM on this thread, and WebView2 needs a single-threaded apartment.
    // SAFETY: plain COM initialisation of the calling thread. S_FALSE (already initialised) is not an error.
    unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }
        .ok()
        .map_err(|e| format!("could not initialise COM: {e}"))?;

    std::fs::create_dir_all(data_dir).map_err(|e| format!("could not create {}: {e}", data_dir.display()))?;

    let (tx, rx) = mpsc::channel();
    let options = CoreWebView2EnvironmentOptions::default();
    // SAFETY: `options` outlives the call, and the completion handler only sends on a channel.
    unsafe {
        options.set_additional_browser_arguments(BROWSER_ARGS.to_string());
        // OQ15: keep crash dumps local (`--edge-webview-disable-crash-reporting=1`).
        options.set_is_custom_crash_reporting_enabled(true);
        // Every other option stays at its default: no SSO, no extensions, tracking prevention on.

        CreateCoreWebView2EnvironmentWithOptions(
            PCWSTR::null(),
            &HSTRING::from(data_dir.as_os_str()),
            &ICoreWebView2EnvironmentOptions::from(options),
            &CreateCoreWebView2EnvironmentCompletedHandler::create(Box::new(move |error_code, environment| {
                let result = (|| {
                    error_code?;
                    environment.ok_or_else(|| webview2_com::Error::WindowsError(windows::core::Error::from(E_POINTER)))
                })();
                tx.send(result).map_err(|_| windows::core::Error::from(E_UNEXPECTED))
            })),
        )
        .map_err(|e| format!("could not start WebView2: {e}"))?;
    }

    webview2_com::wait_with_pump(rx)
        .map_err(|e| format!("WebView2 did not start: {e}"))?
        .map_err(|e| format!("could not create the WebView2 environment: {e}"))
}

/// Builds the `main` window from `tauri.conf.json` (`create: false`) inside our own environment.
pub fn build_main_window(app: &App) -> Result<(), String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or("the main window is missing from tauri.conf.json")?
        .clone();
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let environment = create_environment(&data_dir)?;

    WebviewWindowBuilder::from_config(app.handle(), &config)
        .map_err(|e| e.to_string())?
        .with_environment(environment)
        .on_navigation(is_app_url)
        .on_new_window(|_url, _features| NewWindowResponse::Deny)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Navigation is pinned to the app's own origin, compared by parsed parts (never by prefix). CSP doesn't govern
/// top-level navigation, so one stray `<a href="https://…">` would otherwise make the webview connect out.
///
/// Tauri serves the bundled UI at `http://tauri.localhost`; under `tauri dev` it loads the Vite server.
/// The dev origin is chosen by `cfg(dev)`, which is how Tauri picks the dev URL (not `debug_assertions`).
pub fn is_app_url(url: &Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    match (url.scheme(), url.host_str(), url.port()) {
        ("http", Some("tauri.localhost"), None) => true,
        ("http", Some("localhost"), Some(1420)) => cfg!(dev),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allowed(url: &str) -> bool {
        is_app_url(&Url::parse(url).unwrap())
    }

    // UT-12
    #[test]
    fn allows_the_bundled_origin() {
        assert!(allowed("http://tauri.localhost/"));
        assert!(allowed("http://tauri.localhost/index.html"));
        assert!(allowed("http://tauri.localhost/assets/index.js?x=1#top"));
    }

    // UT-12
    #[test]
    fn allows_the_dev_server_only_under_cfg_dev() {
        assert_eq!(allowed("http://localhost:1420/"), cfg!(dev));
        assert_eq!(allowed("http://localhost:1420/index.html"), cfg!(dev));
    }

    // UT-12
    #[test]
    fn rejects_other_hosts_and_schemes() {
        assert!(!allowed("https://pawnio.eu/"));
        assert!(!allowed("https://substrate.office.com/"));
        assert!(!allowed("file:///C:/Windows/win.ini"));
        assert!(!allowed("about:blank"));
        assert!(!allowed("http://localhost:1421/"));
        assert!(!allowed("http://localhost/"));
    }

    // UT-12: prefix and userinfo traps
    #[test]
    fn rejects_the_prefix_traps() {
        assert!(!allowed("http://tauri.localhost.evil.com/"));
        assert!(!allowed("http://tauri.localhost@evil.com/"));
        assert!(!allowed("http://tauri.localhost:8080/"));
        assert!(!allowed("https://tauri.localhost/"));
        assert!(!allowed("http://evil.com/http://tauri.localhost/"));
        assert!(!allowed("http://user@tauri.localhost/"));
    }

    #[test]
    fn browser_args_carry_every_required_flag() {
        for flag in [
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,msOneAuthWAM",
            "--disable-background-networking",
            "--disable-component-update",
            "--no-proxy-server",
        ] {
            assert!(BROWSER_ARGS.contains(flag), "missing {flag}");
        }
    }
}
