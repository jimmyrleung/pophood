# Task 02 - App shell and WebView2 lockdown

## Description

Scaffold the Tauri 2.12 + React 19 + Vite app (`pophood.exe`), compile the helper's SHA-256 into it, and lock the webview down: the C1 guard (refuse to run elevated), single instance, the app's own WebView2 environment (COM initialised first, `BROWSER_ARGS`, custom crash reporting), navigation pinned to the app origin, and a message box instead of a silent panic on any `setup` failure. The UI is a placeholder; T7 builds the real shell.

- Status: Completed (2026-10-21); C1 elevated dry run pending (owner)
- Complexity: M
- Estimated time: 5–7h
- Depends on: T1 (the sidecar exe must exist for `build.rs` and `externalBin`)
- Can run in parallel with: T3, T4. While T3 or T4 re-stages the sidecar, restart any running `tauri dev` (the hash in `build.rs` changes).

## AI guidance

- `implement-task`: runs this task.
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: what the browser command line must contain.
- ADRs `0005-webview2-network-lockdown.md` (`sessions/20261020214713_…/decisions/`), `0010-own-webview2-environment.md` and `0011-helper-launch-integrity.md` (`sessions/20261021102214_…/decisions/`).
- Trust invariants (until T11 writes `AGENTS.md`): `sessions/20261021102214_pophood-v010-techspec/long_term_memory.md` items 2–4. **Never set `additionalBrowserArgs` in `tauri.conf.json`**; flags live only in `webview.rs`.

## Requirements

- `pophood.exe` exits with code 1 and a message box when its own token is elevated, before any plugin or window (C1).
- A second launch focuses the first window and exits (RF7); the single-instance plugin is registered first.
- The WebView2 environment is created by the app in `setup()`, after `CoInitializeEx(STA)`, with `BROWSER_ARGS` and `IsCustomCrashReportingEnabled = true` (OQ15); user data folder `%LOCALAPPDATA%\dev.pophood`.
- Navigation is allowed only to the exact app origin; new windows are denied (RF29).
- `POPHOOD_HELPER_SHA256` is compiled in by `build.rs`; a missing sidecar fails the build with "run npm run build:helper first".
- CSP exactly as techspec § Fixed source parameters; no capability files; `withGlobalTauri` false.
- Every npm package pinned exactly, lock files committed.

## Files involved

| Path | Action |
|---|---|
| `package.json`, `package-lock.json` | Create |
| `index.html`, `vite.config.ts`, `tsconfig.json` | Create |
| `src/main.tsx`, `src/App.tsx` | Create (placeholder; T7 replaces) |
| `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | Create |
| `src-tauri/build.rs` | Create |
| `src-tauri/tauri.conf.json` | Create |
| `src-tauri/icons/*` | Create (generated) |
| `src-tauri/src/main.rs` | Create |
| `src-tauri/src/lib.rs` | Create (T5 adds `pub mod sensors;`; T6 adds `.manage(SensorService)`, the commands and `RunEvent::Exit`) |
| `src-tauri/src/webview.rs` | Create |
| `src-tauri/capabilities/main.json` | Create **only** if `tauri-build` refuses to build without one (techspec fallback) |

## Implementation steps

1. Create the npm side per techspec § Implementation map → Repo and build (`package.json` and `index.html`/`vite.config.ts`/`tsconfig.json` rows): exact pins, the `dev`/`build`/`test`/`tauri`/`build:helper` scripts, port 1420 `strictPort`, `assetsInlineLimit: 0`, **no `<style>` in `index.html`**. Install the not-yet-pinned packages (`@fontsource/*`, `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `jsdom`) with `--save-exact` and record the versions. Configure Vitest with the `jsdom` environment.
2. Create `src-tauri/Cargo.toml` per the techspec row (edition 2024, the dependency list and `windows` features, dev-dep feature `Win32_Security_Authorization`). Confirm the `tauri-plugin-single-instance` version from crates.io when this runs.
3. Create `src-tauri/build.rs` per the techspec row: hash `binaries/pophood-sensors-{TARGET}.exe` **before** `tauri_build::build()`, emit `rustc-env` and `rerun-if-changed`.
4. Create `src-tauri/tauri.conf.json` per the techspec row: `create: false`, no `additionalBrowserArgs`, `externalBin`, CSP. Generate icons with `npm run tauri icon` from a 1024 px PNG of the mockup's hood mark (`specs/v0.1.0/ui-proposal/mockups/dashboard.dc.html`).
5. Create `src-tauri/src/main.rs` and `lib.rs` per the techspec rows: `refuse_if_elevated()` first, then the single-instance plugin, then `setup` calling `webview::build_main_window(app)`; every `setup` error → `MessageBoxW` + `exit(1)`. Leave `SensorService` and the command list for T6.
6. Create `src-tauri/src/webview.rs` per the techspec row: `BROWSER_ARGS`, `create_environment` (COM init, `create_dir_all`, options, `CreateCoreWebView2EnvironmentWithOptions` + `wait_with_pump`), `build_main_window` (`with_environment`, `on_navigation(is_app_url)`, `on_new_window` → `Deny`), and `is_app_url` (exact scheme/host/port; dev URL only under `cfg(dev)`). Precedent: wry 0.57.0 `src/webview2/mod.rs → InnerWebView::create_environment`.
7. Placeholder `src/main.tsx` / `src/App.tsx` that renders "Pophood" (no inline styles that need a nonce).
8. Run `npm run tauri dev` (the techspec's "first `tauri dev` run") and the checks below. If environment creation fails even with COM initialised, **stop and report to the owner** with the error: the techspec fallback in § Confidence score (a `[patch.crates-io]` wry, with the flags back in `additionalBrowserArgs`) is a design change that costs −2 on patterns and reverses the "never set `additionalBrowserArgs`" invariant. Apply it only after the owner approves; the AC on `additionalBrowserArgs` below then changes to "the flags appear once, in the patched wry's arguments", and the owner confirms the new wording.

## Acceptance Criteria

- `npm run tauri dev` opens the `main` window titled "Pophood" with the placeholder content; no message box (screenshot or owner confirmation).
- While it runs, `Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Select-Object -ExpandProperty CommandLine` shows, for the browser process, every flag in `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1`, and `--user-data-dir` under `%LOCALAPPDATA%\dev.pophood` (command output).
- Starting `pophood.exe` a second time leaves one `pophood.exe` process and brings the window forward (`Get-Process pophood` count = 1).
- Running the debug `pophood.exe` from an elevated terminal shows "Pophood never runs as administrator. Start it normally." and exits with code 1, with no window (`$LASTEXITCODE`; owner runs if no elevated shell is available to the agent).
- Deleting `src-tauri/binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` makes `cargo build` fail with a message containing "npm run build:helper" (command output); restoring it builds again.
- `cargo test` passes UT-12 and UT-13; `npm test` runs (zero or placeholder tests) and `npm run build` succeeds.
- `src-tauri/tauri.conf.json` contains no `additionalBrowserArgs` and no `plugins` section (file contents); `src-tauri/capabilities/` is absent unless the build demanded it (and then holds only `main.json` with an empty `permissions` list).

## Testing

- **UT-12** `is_app_url` (in `webview.rs` `#[cfg(test)]`): every allow/reject case listed in techspec UT-12, including the four prefix traps.
- **UT-13** compiled-in hash (moved here from step 5 because `build.rs` lives here): `env!("POPHOOD_HELPER_SHA256")` equals the SHA-256 computed in the test from `binaries/pophood-sensors-x86_64-pc-windows-msvc.exe`, 64 lowercase hex.
- **Manual first-run checks:** the AC above (environment creation, browser command line, single instance, C1 dry run). The release-build versions are E2E-11 (T13) and E2E-26 (T14); E2E-20 (CSP and navigation in a release build) is in T13.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Workflow: app start, § Implementation map (Repo and build; Core: `main.rs`, `lib.rs`, `webview.rs`), § Fixed source parameters (WebView2 environment, CSP, Window), § Key decisions
- `C:\Users\jimmy\projects\pc-bench-spike\tauri-hello\` (scaffold precedent)
- `C:\Users\jimmy\pophood-probes\probe-net\tauri.conf.flags.json` (the old flags, now in `BROWSER_ARGS` instead)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 92%. The first-run risk (environment creation in `setup()` with COM initialised) is settled: it works, no fallback needed. Remaining uncertainty: the C1 elevated dry run (not run, needs an elevated shell), the visible window content (no screenshot: the capture grabbed an unrelated window, so it was deleted), `cfg(dev)` behaviour in a release build (T13).
- **Evidence:**
  - `npm run tauri dev` (background): Vite on :1420, `cargo run` built and started `pophood.exe`; `Get-Process pophood` → one process, `MainWindowTitle = Pophood`, `Responding = True`; no message box.
  - Browser process of the app (parent = `pophood.exe`, `--webview-exe-name=pophood.exe`): `--user-data-dir="C:\Users\jimmy\AppData\Local\dev.pophood\EBWebView" --noerrdialogs --embedded-browser-webview-dpi-awareness=2 --edge-webview-disable-crash-reporting=1 --disable-background-networking --disable-component-update --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,msOneAuthWAM --no-proxy-server`. Every `BROWSER_ARGS` flag plus the crash-reporting flag is there.
  - Second launch of `pophood.exe`: exits with code 0, `Get-Process pophood` count stays 1.
  - Missing sidecar: `cargo build` fails with "cannot read the sensor helper at …" and "run `npm run build:helper` first." (exit 101); restored → builds.
  - `cargo test`: UT-12 (4 tests + browser-args test) and UT-13 pass. `npm run build` succeeds; `npm test` runs with no test files (`passWithNoTests`).
  - `tauri.conf.json` has no `additionalBrowserArgs` and no `plugins`; there is no `capabilities/` directory and `tauri-build` did not need one (the techspec fallback was not used).
  - Dev processes stopped afterwards (port 1420 free, no `pophood`).
- **Pending, owner:** C1 dry run — from an elevated terminal run `C:\Users\jimmy\projects\pophood\src-tauri\target\debug\pophood.exe`; expect the "Pophood never runs as administrator. Start it normally." box, exit code 1, no window (E2E-26 repeats this on the release build in T14).
- **Decisions / gaps:**
  - `Cargo.lock` pins `tauri` 2.12.4 and `tauri-build` 2.7.3 (downgraded from 2.12.5 / 2.7.4 with `cargo update --precise`) so the sources the techspec read are the ones built. `Cargo.toml` still says `^`; the lock is what pins. `wry` 0.57.0, `tao` 0.37.1, `webview2-com` 0.39.1 as in the techspec. `tauri-plugin-single-instance` 2.5.4 confirmed on crates.io. `sha2` 0.10.9 and `getrandom` 0.3.4 chosen (the techspec names no version; sha2 0.11 changes the digest API).
  - npm versions pinned exactly: react/react-dom 19.3.1, @tauri-apps/api 2.12.4, @tauri-apps/cli 2.12.3, vite 8.3.4, typescript 6.0.3, @vitejs/plugin-react 6.1.2, vitest 5.0.5, @testing-library/react 16.3.3 (+ @testing-library/dom 10.4.2, its peer), jsdom 30.1.3, @types/react(-dom) 19.3.0, @fontsource/ibm-plex-sans and -mono 5.3.0.
  - **`devCsp` added** in `tauri.conf.json` (not in the techspec): the release `csp` is exactly the spec, but under `tauri dev` Vite injects `<style>` elements and an HMR WebSocket, which the strict policy blocks. `devCsp` differs only by `style-src 'unsafe-inline'` and `connect-src … ws://localhost:1420`. It is never used in a release build.
  - `tsconfig.json` includes `vite.config.ts` directly (no `tsconfig.node.json` project reference): a composite node config made `tsc -b` emit `vite.config.js`/`.d.ts` next to the sources.
  - `tauri icon` also produced Android/iOS/Appx files; the Android and iOS folders were deleted (Windows only, C8). The 1024 px source `src-tauri/icons/icon-source.png` is rasterised from the mockup's hood-mark path by a throwaway script (not committed).
  - `fatal()` is `pub` in `lib.rs`; `is_elevated()` fails closed (a token read error shows a message box and exits 1).
  - UT-13 lives in `src-tauri/tests/helper_hash.rs`; UT-12 in `webview.rs`.
  - Tooling notes for later tasks: `Start-Process npm.cmd` doesn't resolve on this PC (run long npm/tauri commands with the Bash tool in the background); in PowerShell `rd` is an alias of `Remove-Item` (a function named `Rd` ran it).
