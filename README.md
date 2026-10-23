# Pophood

Pop the hood on your PC. Pophood is an all-in-one Windows hardware monitor and benchmark app (CPU, memory, disk, GPU) with a modern, curated dashboard and a small, read-only, auditable sensor helper. Only the helper ever runs as admin.

Status: v0.1.1, live dashboard with the new sensor drill-down (see [specs/v0.1.1/techspec.md](specs/v0.1.1/techspec.md)). Specs for every version: [specs/](specs/).

- [Grill session](specs/v0.1.0/grill-session/session.md): what we agreed and why
- [Spike results](specs/v0.1.0/spike-results.md): what was verified on real hardware
- [Naming](specs/v0.1.0/naming.md): how the name was chosen

## Build from source

1. Prerequisites: Rust 1.99+, Node 22+, .NET SDK 10.0.402, VS Build Tools 2022 (MSVC), `vswhere` on PATH (`C:\Program Files (x86)\Microsoft Visual Studio\Installer`), and optionally PawnIO 2.2.0 from https://pawnio.eu.
2. `git clone --recurse-submodules <repo URL>` (LibreHardwareMonitor is pinned at 3d331e3).
3. `npm ci`, then `npm run build:helper`, then `npm run tauri build -- --no-bundle`.
4. Run `src-tauri\target\release\pophood.exe`. It never runs as admin; "Enable full sensors" asks UAC for the sensor helper only.

For development use `npm run tauri dev` (after `npm run build:helper`). Tests: `npm test`, `cargo test` in `src-tauri/` (the integration tests need the helper built, and `-- --ignored` adds the 30 s one) and `dotnet test helper.Tests -r win-x64`.

## What it never does

- Only the sensor helper runs elevated; the app refuses to start elevated.
- The helper never changes hardware state and writes no files; the app never installs a driver.
- No network connections from Pophood: no telemetry, no update checks, no crash upload. `scripts/audit-network.ps1` is the check. One known exception: the WebView2 runtime that draws the window calls Windows' Microsoft-account API, and Windows' sign-in service (`wlidsvc`) may then contact `login.live.com`. No WebView2 setting stops it (runtime 155); Pophood's own processes send nothing.
- The app starts the helper only after verifying its SHA-256, and both ends of the pipe verify each other.

Third-party licences: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) (also in the app, under "About and licenses"). Working rules for contributors and agents: [AGENTS.md](AGENTS.md).

Stack: Tauri (Rust + React/TypeScript), plus a .NET NativeAOT sensor helper using [LibreHardwareMonitorLib](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) over the [PawnIO](https://pawnio.eu/) driver.

License: [MIT](LICENSE).
