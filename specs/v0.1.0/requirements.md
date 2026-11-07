# Requirements: Pophood v0.1.0–v0.8.0 (the agreed v1, one minor version per slice)

- **Date:** 2026-10-20
- **Mode:** greenfield. The repo holds only specs (`git ls-files` lists 6 files, none of them source code). The spike at `C:\Users\jimmy\projects\pc-bench-spike\` is throwaway reference code.
- **Inputs:** [grill session](grill-session/session.md), [questions with verbatim answers](grill-session/questions.md), [spike results](spike-results.md), [naming](naming.md), the ADRs (status: accepted) in `sessions/20261020135705_pophood-grill-spike-naming/decisions/`, and the [UI proposal](ui-proposal/ui-proposal.md) from the Claude Design round.
- **Revision:** 3 (2026-10-20).
  - Revision 2 followed an adversarial review: verdict "approve with fixes", 6 high, 9 mid and 11 low findings; owner answers #19–#22.
  - Revision 3 adds the evidence from the confidence probes P1–P6 ([probe-results.md](probe-results.md)) and owner answers #23–#33 (see the [Q&A record](#qa-record-this-session)).
  - **2026-10-21:** OQ2 calibration passed (P4), and OQ1 passed across a reboot (P1). The confidence score is final at 92%.
  - **2026-10-21:** the Claude Design round is done. The owner chose the dashboard, drill-down and Runs designs (answer #34). They are recorded in the [UI proposal](ui-proposal/ui-proposal.md), which also settles theme and layout.
  - **2026-10-21:** each slice now ships as its own minor version, v0.1.0 (slice 1) to v0.8.0 (slice 8), and gets its own techspec (answer #37). See the [Version map](#version-map). This doc stays the umbrella requirements for all eight.
  - **2026-10-22:** a patch, v0.1.1, goes before v0.2.0: a new drill-down layout ([scope stub](../v0.1.1/README.md), [UI proposal](../v0.1.1/ui-proposal/ui-proposal.md)). It replaces mockup E2's layout; the rest of this doc's [UI proposal](ui-proposal/ui-proposal.md) stays.
- **Next:** one `techspec` per version, starting with [v0.1.0](techspec.md) (slice 1) and taking the [UI proposal](ui-proposal/ui-proposal.md) into account; then `tasks-breakdown` for that version.
- **Altitude:** this is a reference map and a scope definition, not a design. "How" belongs to the techspec. Where this doc names a mechanism, it is pointing at a precedent, not choosing one.

## Overview

Pophood replaces three things for the owner: HWiNFO (complete, but hard to read), separate benchmark apps (Cinebench, MemTest, CrystalDiskMark), and btop4win (which wants admin rights the owner won't give it). It is one Windows 11 desktop app with a curated live dashboard and a one-click benchmark suite.

Its core promise is trust:
- the app itself never runs elevated;
- only a small, read-only, auditable sensor helper ever runs as admin, and only while the app is open;
- the app never installs a driver;
- the app makes no network connections.

The v0.x releases (v0.1.0–v0.8.0, see the [Version map](#version-map)) are for the owner, built from source, in a public repo. The long-term goal is an open-source release with an installer, so nothing in them may block other users' hardware or a later installer.

## Goals

**Success criteria (user-observable):**
- G1. The owner can open Pophood and see live CPU, GPU, memory, disk and motherboard readings on curated cards, without ever giving the main app admin rights.
- G2. One UAC prompt ("Enable full sensors") turns on the full sensor set. No elevated process outlives the app.
- G3. One click ("Run all") runs the CPU, memory, GPU and disk benchmarks and saves the scores together with a sensor trace.
- G4. The owner can compare 2 or more labeled runs side by side (for example "before XMP" vs "after XMP").
- G5. The owner can give generic motherboard sensors meaningful names ("Fan #1" → "CPU fan").

**Measurable targets:**

| Target | Basis |
|---|---|
| "Run all" takes **≤ 5 min** on the owner's PC; memory test **≤ 30 s**; GPU test **≤ 10 s** (answer #32) | All measured: CPU 32 s (F9); disk ~3.5 min with 3 CDM-9.x passes (F10, P4); memory 2.8–3.8 s quick and 16.4–18.7 s full; GPU about 1–1.5 s (P3). Estimated "Run all" total: about 4.2 min, using the quick memory test (answer #31). |
| Sampling: 1 s live, 250 ms while a benchmark runs | Q22. One LHM update takes ~90 ms (F6). |
| "Connecting to sensors…" shows for at most ~3 s after elevation | Elevated LHM open takes 2.5 s (F6). |
| Disk results are within **±5%** of a real CrystalDiskMark 9.x run on the same drive, per profile | F10; owner answer #25 |
| Zero outbound network connections from the whole Pophood process tree (app, WebView2 child processes, helper, bundled tools), verified by an elevated packet/ETW capture with the app unelevated | Q27; P5 is the method |
| After a normal app exit, the helper is gone within **5 s**. After a crash or kill of the app, within **35 s** (30 s with no client plus a margin). | Q11, ADR 0001. P2 showed the app can terminate even the elevated helper. |

**Business goal:** the owner's own daily tool now; a credible base for a public open-source release later.

Per the greenfield guard, there are **no baseline-style success metrics** (adoption and similar).

## Confidence score

This is the **final** score for revision 3. It was recomputed on 2026-10-21, after OQ2 (calibration) and OQ1 (identifiers after a reboot) both passed.

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Requirements clarity | 40% | 95% | 33 answers in this session, on top of the 31 grill and 5 spike decisions. Every former blocker that needed a decision is decided: OQ4, OQ6, the tolerance, OQ11/OQ12 scope, run-time budgets, the auto-write policy, and residual network traffic. The remaining open items are evidence, not decisions. |
| Codebase-or-constraint understanding | 40% | 90% | Probes P1–P6 measured or read every former unknown: identifier stability **across restarts, elevation and a real reboot, with 6 of 6 comparisons showing only the known duplicate** (P1, OQ1), the elevated pipe (P2), memory and GPU feasibility and timing (P3), the DiskSpd build **and CDM calibration, with all 8 profiles within ±5%** (P4, OQ2), WebView2 traffic (P5), and LHM write paths, dependencies and no-PawnIO behaviour (P6). Still open: the source of `substrate.office.com` (OQ13, gated). This factor rose by +2 for each of OQ2 and OQ1, not more, for two reasons. Calibration used n = 1 pass per tool, with a tightest margin of 1.1 points. And OQ1 covers one reboot on one PC with LHM pinned; the parts of identifiers that depend on order can still move with LHM upgrades or hardware changes (P1). |
| Change-path clarity (reference-map altitude) | 20% | 92% | Every cross-process path now has a working precedent on this machine: duplex pipe, mutual verification, elevated relaunch, deadline sampling (P2); D3D12 compute and the memory kernels (P3); reproducible DiskSpd build and calibration script (P4); WebView2 flags through `tauri.conf.json` (P5). |
| **Total** | | **92%** | 0.4·95 + 0.4·90 + 0.2·92 = 38.0 + 36.0 + 18.4 = 92.4 |

- **Effective threshold:** 90%, the owner's bar for moving to the next phase. The skill's default would be 75%. Below 90%, the next phase waits. Recommendations that depend on an item in [Open questions](#open-questions) are marked **(blocked: OQn)** and must not be fixed in the techspec until that item is resolved.
- **Consequences of the remaining uncertainty:**
  - **OQ13:** if the `substrate.office.com` source can't be disabled, v0.1.0 goes back to the owner (answer #33).
- **Bar met:** 92% ≥ 90%, so the next phase can start. The remaining open items (OQ8, OQ13–OQ15) belong to the techspec, which works on them; OQ13 gates v0.1.0 sign-off, not the techspec.

## Similar features / examples

**Local precedent: the spike** (`C:\Users\jimmy\projects\pc-bench-spike\`). Tags: **COPY** = pattern to copy · **AVOID** = known gap · **SPIKE** = spike-only shortcut.

| Concern | Where | Tag |
|---|---|---|
| Pipe with a user-only DACL, `FirstPipeInstance`, one-way | `helper/SensorHelper/Program.cs:15-22` | COPY |
| Fixed pipe name `pc-bench-sensors` | `helper/SensorHelper/Program.cs:11`, `tauri-hello/src-tauri/src/lib.rs:13` | SPIKE |
| LHM `Computer` toggles and PawnIO presence read | `helper/SensorHelper/Program.cs:32-41`, `:50` | COPY |
| Update loop drifts (1 s plus update time); no 250 ms mode | `helper/SensorHelper/Program.cs:46-54` | AVOID |
| Sensors with a null `Value` are dropped, so frames vary in shape | `helper/SensorHelper/Program.cs:63` | AVOID |
| Frame/Reading records: no schema version, no `Identifier`, no units | `helper/SensorHelper/Program.cs:68-69` | AVOID |
| Source-generated JSON context (AOT-safe) | `helper/SensorHelper/Program.cs:71-73` | COPY |
| Exits after 30 s with no client, and on client disconnect | `helper/SensorHelper/Program.cs:25-28`, `:56-57` | COPY |
| Log written next to the exe (fails under Program Files when unprivileged) | `helper/SensorHelper/Program.cs:12-13` | SPIKE |
| Visitor update pattern with a priming update | `helper/SensorProbe/Program.cs:25-30`, `:49-59` | COPY |
| Elevated relaunch via `ShellExecuteW("runas")`. No process handle comes back. | `tauri-hello/src-tauri/src/lib.rs:23-38` | COPY the idea, AVOID the missing handle |
| Kill the unprivileged helper, elevate, fall back to unprivileged if that fails | `tauri-hello/src-tauri/src/lib.rs:41-53` | COPY |
| Reconnect loop (500 ms); no server-PID check (pipe squatting) | `tauri-hello/src-tauri/src/lib.rs:55-67`, `:57` | COPY the loop, AVOID the missing check |
| Helper spawned with `CREATE_NO_WINDOW`; path is a compile-time dev path | `tauri-hello/src-tauri/src/lib.rs:14-20` | COPY the flag, SPIKE the path |
| `csp: null`; unused opener plugin | `tauri-hello/src-tauri/tauri.conf.json:20-22`, `capabilities/default.json:6-9` | AVOID |
| React `listen` with unlisten on cleanup | `tauri-hello/src/App.tsx:24-31` | COPY |
| Sensors picked by display-name matching (`name === "Package"`) | `tauri-hello/src/App.tsx:10-17` | AVOID |
| Helper csproj: `PublishAot` and `InvariantGlobalization`, using the NuGet LHM package | `helper/SensorHelper/SensorHelper.csproj:5-7` | COPY the flags, AVOID NuGet (see C4) |
| Real hardware identifiers (`/amdcpu/0`, `/lpc/it8696e/0`, `/nvme/0`, `/memory/dimm/1`…) | `results/elevated-aot.json:11,18,156,639,662,685,798,911,1069,1267` | Reference data |

**Upstream precedents** (permalinks pinned to the versions read):

| Need | Precedent |
|---|---|
| Sensor rename persistence, keyed `{sensorId}/name` | LHM v0.9.6 `LibreHardwareMonitorLib/Hardware/Sensor.cs#L63,L96-L104`; app store `LibreHardwareMonitor/Utilities/PersistentSettings.cs#L17-L90`; hide flag `SensorNode.cs#L96,L115` (at commit `3d331e3`) |
| PawnIO detection (registry `Uninstall\PawnIO` → `DisplayVersion`) | LHM v0.9.6 `LibreHardwareMonitorLib/PawnIo/PawnIo.cs#L23-L49`. Verified this session: the key reads without admin (`DisplayVersion 2.2.0.0`). |
| Install prompt (Pophood must **not** copy this) | LHM app `LibreHardwareMonitor/UI/MainForm.cs#L169-L215`. Does the library itself never install anything? Probe scope: a grep for `install`, `Process.Start` and `runas` across `LibreHardwareMonitorLib/**/*.cs` at v0.9.6 found none. The transitive NuGet DLLs were audited in P6: none found (former OQ10). |
| Register writes needed just to read the board's fan chip, plus LHM's fan-control write paths | LHM v0.9.6 `LibreHardwareMonitorLib/Hardware/Motherboard/Lpc/IT87XX.cs:437,559,570-571` (writes needed for reads), `:319-335` (control writes, which Pophood must never call) |
| **Probe precedents from this phase (P1–P6)** | [probe-results.md](probe-results.md). Code is in `C:\Users\jimmy\pophood-probes\`: a duplex pipe with mutual verification (`probe-pipe`), the memory and D3D12 kernels (`probe-bench`), the reproducible DiskSpd build and `calibrate.ps1` (`probe-diskspd`), WebView2 flags and capture scripts (`probe-net`), the identifier dump and diff (`probe-ids`), and the dependency and write-path audit (`probe-audit`). |
| CrystalDiskMark's DiskSpd arguments, pass logic and MB/s maths | CDM 9.0.3 (`hiyohiyo/CrystalDiskMark@0ceaa7a`) `DiskBench.cpp#L575-L713` (test file), `#L768-L850,L913` (args), `#L898-L927` (warm-up, best of N), `DiskMarkDlg.cpp#L516-L549,L1148-L1206` (defaults) |
| 7-Zip benchmark totals line | `ip7z/7zip@26.04` `CPP/7zip/UI/Common/Bench.cpp#L5025-L5032` (`Tot:`), `#L2962-L2975` |
| STREAM rules (array size ≥ 4× LLC, best of N, label non-conforming runs) | https://www.cs.virginia.edu/stream/ref.html |
| Pointer-chase latency | `clamchowder/Microbenchmarks` `MemoryLatency` |
| GPU compute peak and bandwidth | `nihui/vkpeak` (Vulkan), `sebbbi/perftest` (DX11). The Rust D3D12 precedent is now P3, `probe-bench/src/bin/gpu.rs`: ~97% of spec on the RTX 5060 Ti, and it works on the iGPU too. |
| D3D12 from Rust | `microsoft/windows-rs` `crates/samples/windows/direct3d12` (graphics, not compute) |
| GPU adapter ordering (dGPU first) | `IDXGIFactory6::EnumAdapterByGpuPreference` (Learn docs) |
| Elevation with a process handle | `ShellExecuteExW` + `SEE_MASK_NOCLOSEPROCESS`; crate `runas` 1.2.0 `src/impl_windows.rs` |
| Tauri 2 system monitor | `Abdenasser/neohtop` (polling with `invoke`) |
| Unprivileged NVMe health query (only if wanted later) | smartmontools `os_win32.cpp` `win10_nvme_device::open` (access 0) |

## Entrypoints

Greenfield, so this is the **proposed entry surface**, not existing code:

| Entry | What starts there |
|---|---|
| The Pophood desktop app exe (Tauri, `windows_subsystem = "windows"`) | Single instance. Verifies the helper, spawns it unprivileged, and opens the dashboard. |
| The sensor helper exe (NativeAOT) | Started only by the app, unprivileged or elevated through UAC. Serves the sensor stream on the pipe. Never started by the user directly. |
| User actions in the UI | "Enable full sensors", a card click (drill-down), rename a sensor, run one benchmark, "Run all", cancel, Runs page (select, compare, label, delete, export). |
| Bundled child processes | `7za.exe b` (CPU) and `diskspd.exe` (disk), started by the core after their SHA-256 has been verified. |

## Execution flow

There is no current flow (greenfield). Expected flows, at the level of behaviour:

1. **App start (reduced mode):**
   - The app starts unprivileged.
   - It sweeps away any leftover disk-test temp file from a crashed run.
   - It verifies the helper binary against the build manifest, then launches it unprivileged.
   - It connects to the pipe, checks that the pipe server is our helper, and checks the schema version.
   - The dashboard fills at 1 s. Cards whose data needs full sensors show a "needs full sensors" placeholder, never a misleading 0.
   - A prominent call to action pushes "Enable full sensors". If PawnIO isn't installed, it explains what's missing and links to pawnio.eu.
2. **Enable full sensors:**
   - The helper binary is verified again.
   - A UAC prompt appears. If the user accepts, the unprivileged helper is replaced by an elevated one, the UI shows "Connecting to sensors…" (~2.5 s), and then the full card set.
   - If the elevated helper never connects within a timeout, the app falls back to reduced mode with an error.
   - If the user cancels UAC or elevation fails, the app stays in reduced mode with a message and can retry.
3. **Live use:**
   - Each card shows sparklines from an in-memory history of the last ~10 minutes.
   - A card click opens the full sensor list for that component.
   - Any sensor can be renamed there. The label then shows in the full list, on the Motherboard card's fan rows and (from v0.3.0) in traces; fixed card labels keep their names ([v0.2.0 requirements](../v0.2.0/requirements.md), Q&A #2).
4. **Benchmark (single test or "Run all"):**
   - A pre-run check warns about background load, and about reduced sensors if not elevated, but doesn't block.
   - Sampling switches to 250 ms for the duration of the run.
   - The tests run in order: CPU → memory → GPU (chosen adapter) → disk (chosen drive).
   - Progress shows throughout. Cancel is always possible.
   - The run is saved with its scores, settings, hardware snapshot, driver and tool versions, sensor trace and flags (reduced sensors, partial).
5. **Runs page:**
   - Lists saved runs. Selecting 2 or more shows a bar chart per test with the % difference, plus overlaid sensor traces.
   - Runs can be relabeled, deleted, or exported to JSON or CSV through a save dialog.
6. **App close (including a crash or kill):**
   - The helper sees the disconnect and exits.
   - If the app went away before the helper connected (for example during the UAC prompt), the 30 s no-client rule applies.
   - No helper process remains after 35 s at most.
   - The PawnIO driver itself stays loaded until reboot (F7). That is outside the app's control, and only admins can open it.

## Scope

**In scope (all of the agreed v1, delivered as vertical slices, one minor version per slice; see the [Version map](#version-map)):**
- The live dashboard:
  - fixed curated cards with sparklines;
  - one card per GPU and one card per drive;
  - reduced mode with placeholders;
  - "Enable full sensors" through one UAC prompt;
  - a drill-down to the full sensor list.
- Renaming any sensor (F3 decision).
- Four benchmarks (CPU, memory, GPU, disk), "Run all", per-test runs, cancel, and partial-run saving.
- Saved runs in SQLite under `%LOCALAPPDATA%`, with a sensor trace.
- The Runs page: compare, relabel, delete, export to JSON or CSV.
- PawnIO detection and guidance, without installing it.
- Pinned, hash-verified third-party tools, and the license notices for everything bundled.
- A trust-boundary hardening baseline:
  - a pipe only the user can open;
  - mutual verification of client and server;
  - a versioned schema;
  - helper hash checks before launch;
  - no file writes when elevated;
  - helper lifetime rules.

**Out of scope, with reasons:**

| Item | Why |
|---|---|
| Installer, code signing, auto-update | v0.1.0 is built from source (answer this session). The installer is a long-term goal. |
| Stress and stability tests (CPU, GPU, in-OS memory, VRAM) | v2 (Q3, Q4). The test-runner seam must allow them. |
| Dashboard customization: pinning, reordering, hiding cards or sensors | v2 (Q6b). Only renaming was pulled forward (F3). |
| Continuous or CSV logging | v2 (Q19) |
| Fan control, tuning, any change to hardware state | Permanently excluded (Q12, ADR 0001). The register writes LHM needs just to read a chip are the only exception; see RF1. |
| USB/HID fan and RGB controllers (LHM `IsControllerEnabled`) | Off in v1 (answer #19) to keep the elevated surface small. The board's SuperIO fans are still read. |
| Any network use, including online score lookup, telemetry, crash reports, update checks | v1 excludes it (Q27) |
| Linux and macOS builds, CI for them | Not before v2 ships (Q14b) |
| 3D-scene GPU benchmark | Not planned (Q16) |
| User-configurable disk passes or file size, or a quick 1-pass disk mode (F10 option) | Fixed to the CDM 9.x defaults (answer #13) |
| VID on cards | Readings are suspicious (F4) |
| Unprivileged NVMe SMART through a direct IOCTL | Q21 makes the helper the only sensor source, and the owner prefers pushing elevation (F1). There's a precedent if it's ever wanted. |

## Slice requirement

Delivery is a sequence of vertical slices. Each one is user-observable and builds on the previous ones. Slice 1 is specified in full here; the others are listed in [Later slices](#later-slices-in-order).

- **Goal:** the owner opens Pophood and watches live hardware readings on curated cards, and can turn on full sensors with one UAC prompt.
- **Done-when (happy path):**
  - [x] Launching the app (unprivileged) shows the dashboard. CPU, Memory and GPU cards appear, with one card per detected GPU.
  - [x] **Reduced mode:** unprivileged LHM detects no drives and no fan chip (spike `results/unprivileged-aot.json` lists only `/motherboard`, `/amdcpu/0`, `/vram`, `/ram`, `/gpu-amd/0`, `/gpu-nvidia/0`). So the Disk and Motherboard cards appear as one "needs full sensors" placeholder card each, never as empty or zeroed cards.
  - [x] **Full sensors:** one Disk card per detected drive and one Motherboard card.
  - [x] Readings refresh every ~1 s, and each card shows sparklines covering up to the last ~10 minutes (in memory only).
  - [x] **CPU card:** package temperature, total load, average effective clock, package power, hottest core.
  - [x] **GPU card:** temperature, load, VRAM used/total, power, core clock.
  - [x] **Memory card:** used/total and configured speed (from WMI). "OC profile likely on" appears **only with full sensors**, when the configured speed is above the SPD JEDEC speed (answer #24). In reduced mode the card shows only the speed.
  - [x] **Disk card:** read/write throughput, temperature, SMART health %.
  - [x] **Motherboard card:** fan speeds. No card shows VID.
  - [x] In reduced mode, every reading that needs full sensors shows a "needs full sensors" placeholder. This includes CPU temperature, power and clocks that LHM reports as 0 or null unprivileged (F1). No card shows a fake 0.
  - [x] A prominent "Enable full sensors" action is visible in reduced mode.
  - [x] If PawnIO isn't installed, the app says what's missing and offers a link to the official page (pawnio.eu), which opens in the user's browser. It never installs anything. Without PawnIO, elevation adds only storage (SMART/NVMe); CPU temperature, power and clocks, the motherboard sensors and the DIMMs still need PawnIO (P6).
  - [x] Accepting the UAC prompt shows "Connecting to sensors…" and then the full readings.
  - [x] Clicking a card opens the full sensor list for that component, with live values.
  - [x] Launching Pophood a second time brings the existing window forward. No second helper or pipe is created.
- **Done-when (error and empty states):**
  - [x] **UAC cancelled or denied:** the app stays in reduced mode with a clear message, and the action can be retried.
  - [x] **The elevated helper never connects** (UAC accepted, but no frames within a stated timeout): the app shows an error, returns to reduced mode, and the action can be retried.
  - [x] **Elevated, but PawnIO is missing:** the app shows what it got (storage) and what is still missing, never the fake values LHM reports without PawnIO (AMD 0 °C / 0 W / 1.55 V VID, Intel 0 W, EC zeros; P6).
  - [x] **No GPU, drive or fan detected** in full mode: the card shows an explicit "none detected" empty state instead of disappearing silently. Verified by UT-17 (not reproducible live on this PC: it has GPUs, a drive and fans).
  - [x] **The helper exe is missing, or fails its hash check:** the app doesn't launch it. It shows a clear error and stays usable as an empty shell. It never offers to elevate an unverified binary.
  - [x] **Pipe squatter:** if the pipe server is not the bundled helper, the app refuses the connection, shows a security warning, and doesn't send it anything. Verified by IT-09 and UT-29 (no live squatter in E2E).
  - [x] **Schema version mismatch** between app and helper: the app shows a clear incompatibility error and doesn't show half-parsed data. Verified by UT-07 and UT-29 (no mismatched helper build in E2E).
  - [x] **The helper dies, or the pipe breaks:** the UI shows a "sensors disconnected" state and recovers (reconnects or restarts the helper unprivileged) without freezing.
  - [x] **The app closes normally:** no Pophood helper process remains after 5 s. **The app crashes or is killed:** none remains after 35 s. Elevated or not; verify in Task Manager.
  - [x] **No network:** the whole process tree makes no outbound connection during the slice. Verify with the P5 method: an elevated pktmon/ETW capture, with the app unelevated. T14: no flow and no DNS from the tree in the scripted 180 s capture with the elevated helper inside the window (run 3, 2026-10-22) and the 30-min idle capture (run 2), and `msOneAuthWAM` holds on runtime 155. A `login.live.com` lookup by Windows' `wlidsvc` after WebView2's own account call is the disclosed exception in RF29 (owner: "Disclosed exception (Recommended)").
- **Building on:** nothing; this is the first slice. The precedents are the spike paths listed under [Similar features](#similar-features--examples).
- **Constraints:** these bind this slice only.
  - The main app process is never elevated.
  - The helper never changes hardware state (RF1), and it is the only sensor source.
  - `IsControllerEnabled` is off.
  - Pipe access is limited to the interactive user (RF2).
  - Both ends verify each other (RF9, RF31).
  - The message schema carries a version.
  - LHM 0.9.6 is built from pinned source, and its NuGet dependencies are lock- and hash-pinned (C4).
  - The helper is verified against the build manifest before every launch (RF14).
  - The elevated helper writes no files (RF5).
  - The helper exits on client disconnect, or after 30 s with no client.

### Later slices (in order)

| # | Slice goal ("the owner can…") | Notes |
|---|---|---|
| 2 | …rename any sensor in the full list, and see the label on the Motherboard card's fan rows and in the full list. Renames persist per machine across restarts. | Includes "reset to the default name". The key follows RF13. OQ1 is resolved: identifiers were stable across a reboot. |
| 3 | …run the CPU benchmark and see the multi-thread and single-thread 7-Zip ratings, saved as a run with a 250 ms sensor trace, in a basic run list. | This slice introduces SQLite persistence, tool hash verification, the reduced-sensors warning, and cancel. |
| 4 | …run the memory benchmark (bandwidth for read, write and copy, plus latency). | Must follow the STREAM sizing rules (≥ 4× LLC; the owner's 9900X has 2 × 32 MB L3). Results that don't conform to STREAM are labeled. "Run all" uses the quick variant; running it alone gives the full one (answer #31). Budget ≤ 30 s. |
| 5 | …run the GPU benchmark on a chosen adapter (defaulting to the discrete GPU) and see FP32 throughput and VRAM bandwidth. | Adapter picker. Budget ≤ 10 s (P3 measured ~1.5 s). |
| 6 | …run the disk benchmark on a chosen drive and get CrystalDiskMark-comparable MB/s for the 4 default profiles. | Uses CDM 9.x defaults (RF18). The temporary file is always deleted. Before starting, a warning shows the expected write volume (~234 GB on the NV3). The numbers can be presented as CDM-comparable, because calibration passed (OQ2, resolved). |
| 7 | …click "Run all" and get one saved run covering CPU → memory → GPU → disk in about 5 min. | Pre-run load check (warns only). Partial runs are kept and marked. |
| 8 | …compare 2 or more runs on the Runs page, and relabel, delete or export a run. | Bar charts with % difference; overlaid traces, matching sensors across runs with the RF13 key (OQ1, resolved). Elevated-only sensors have no trace in unprivileged runs; JSON/CSV export via a save dialog, with serial numbers stripped by default (answer #23). |

### Version map

Each slice ships as its own minor version and gets its own techspec (answer #37). Minor versions, not patches, because every slice adds a capability.

| Version | Slice | Spec |
|---|---|---|
| v0.1.0 | 1: live dashboard, full sensors, trust baseline | [techspec](techspec.md) |
| v0.1.1 | Patch: drill-down layout (group cards in columns, chart on top), reduced-mode copy on the drill-down | [scope stub](../v0.1.1/README.md), [UI proposal](../v0.1.1/ui-proposal/ui-proposal.md), [techspec](../v0.1.1/techspec.md) |
| v0.2.0 | 2: rename any sensor | [scope stub](../v0.2.0/README.md), [requirements](../v0.2.0/requirements.md), [techspec](../v0.2.0/techspec.md), [tasks](../v0.2.0/tasks.md) |
| v0.3.0 | 3: CPU benchmark, SQLite, basic run list | [scope stub](../v0.3.0/README.md); techspec to write |
| v0.4.0 | 4: memory benchmark | [scope stub](../v0.4.0/README.md); techspec to write |
| v0.5.0 | 5: GPU benchmark | [scope stub](../v0.5.0/README.md); techspec to write |
| v0.6.0 | 6: disk benchmark | [scope stub](../v0.6.0/README.md); techspec to write |
| v0.7.0 | 7: "Run all" | [scope stub](../v0.7.0/README.md); techspec to write |
| v0.8.0 | 8: Runs page (compare, relabel, delete, export). This completes the agreed v1. | [scope stub](../v0.8.0/README.md); techspec to write |

- This doc stays the umbrella requirements for all eight versions; each techspec cites the slice and the RFs it delivers.
- A patch (v0.N.1) changes an existing capability without adding one. It gets its own folder, `specs/v0.N.1/`, with a scope stub and a techspec, like a slice.
- Each `specs/v0.N.0/README.md` is a scope stub. It holds the slice goal, the RFs it delivers, what it inherits, the items earlier techspecs handed to it, and the open questions for its own techspec. The techspec goes next to it as `specs/v0.N.0/techspec.md`.
- Constraints and accepted risks that this doc states "for v0.1.0" (C3, C4, C6, C11, R-trust-launch, RF14's limit, the anti-scaffolding list) apply to **every v0.x release** until the public release.
- OQ13 gates v0.1.0, because slice 1's "no network" done-when is the first place it's signed off. Every later version re-runs the P5 capture before release.

## User experience

**Audience:** the owner, an experienced PC user who tunes their system (XMP, drivers) and wants before/after evidence. Long term: other enthusiasts who distrust admin-level tools.

**Workflows:**
- glance at the dashboard;
- enable full sensors once per session;
- drill into a component;
- name the motherboard fans;
- "Run all" before and after a change;
- compare labeled runs.

**UI/UX requirements:**
- A modern, curated look, explicitly unlike HWiNFO's "read everything" list (Q6). The visual design comes from the owner's Claude Design round and is recorded in the **[UI proposal](ui-proposal/ui-proposal.md)**. It covers the shell, dark and light themes, colour tokens, type, the three screens, which states were mocked, and which were not. The theme follows Windows, and the in-app toggle overrides it and is remembered (answer #35, recorded in the v0.1.0 techspec); the mockups' "dark by default" is superseded.
- Temperatures are in °C. Disk throughput is in decimal MB/s, as CrystalDiskMark reports it.
- Reduced mode has to look intentional: placeholders and a clear path to full sensors, not empty or zeroed cards.
- Inferred values are labeled as inferred ("OC profile likely on").
- Long-running work (the ~5 min "Run all", the ~3.5 min disk test) shows progress and the current step, and can be cancelled.
- Before it starts, the disk test warns how much it will write to the chosen drive. The amount depends on the drive's speed, because each test runs for a fixed time, not a fixed amount of data. On the owner's NV3 it is about 234 GB per run (see [Side effects](#side-effects--impact)).
- Runs taken in reduced mode, and partial runs, are visibly marked wherever runs are listed or compared.

**Accessibility:** the requirement level is not set beyond basics, which the [UI proposal](ui-proposal/ui-proposal.md#accessibility-conventions-in-the-mockups) follows:
- keyboard reachable actions;
- text contrast in the chosen theme;
- no information conveyed by colour alone (status, % difference up or down).

## Summary of the work to be done

Requirements are numbered RF1…RFn and grouped by area.

**A. Sensor helper (the trust boundary).** A small .NET 10 NativeAOT console process wrapping LHM 0.9.6, built from pinned source. It is the only sensor source and never changes hardware state. Why it matters: it is the only code that ever runs elevated, so it must stay small and auditable.
- RF1. Runs unprivileged by default. When relaunched through UAC it runs elevated. It **never changes hardware state**:
  - It never calls LHM's control or set APIs (for example `ISensor.Control`/`IControl` set paths, which reach the fan-control writes at `IT87XX.cs:319-335`).
  - It never writes fan, clock, voltage, power or SPD settings.
  - LHM's register writes needed just to *read* a chip (bank and index selection, e.g. `IT87XX.cs:437,559,570-571`) are accepted and documented.
  - **Allow-listed monitoring-enablement writes** (answer #29) are the *only* other writes accepted. LHM and its dependencies make them automatically to make sensors readable:
    - ATA SMART ENABLE when a SMART read fails (DiskInfoToolkit `DiskHandler.cs:601…873`);
    - the Realtek 9220DP USB-bridge mode switch, which is restored (`DiskHandler.cs:154/161`);
    - Nuvoton NCT668x voltage-sense init and the I/O-lock clear (`Nct677X.cs:483-494,554-565,668,1281-1305`, `LpcIO.cs:475-479`);
    - WireViewPro2's STM32 COM-port probe (`WireViewPro2.cs:80-88`), because `IsPowerMonitorEnabled` stays on (answer #30).

    The list lives in the repo with file:line references. **Every LHM or dependency version bump must re-audit it** (probe method: `probe-audit`).
  - **No persisting settings store.** A persisted LHM `ISettings` replays saved fan values at Open (`Control.cs:33-44`), so the helper uses only the default in-memory settings (`Computer.cs:58-61`).
  - A mechanical check that runs with every helper build must show the helper never references the write surfaces found in P6:
    - `IControl.SetSoftware` / `SetDefault`;
    - the WireViewPro2 `WriteConfig` / `NonVolatileMemoryCommand` / `ScreenCmd` / `ClearFaults`;
    - the `LibreHardwareMonitor.PawnIo.*` write methods;
    - RAMSPDToolkit `i2c_smbus_write_*`;
    - HidSharp `HidStream.Write` / `SetFeature`;
    - Mono.Posix `Stdlib.system`;
    - a persisting `ISettings`.
  - `IsControllerEnabled` stays off (answer #19).
- RF2. Serves sensor frames over a named pipe that only the interactive user can open. The message schema carries an explicit version.
- RF3. Each frame identifies hardware and sensors by stable identifiers, not display names alone. It includes the sensor type and enough information to derive units, plus availability: whether the helper is elevated, whether PawnIO is present, and which values are unavailable. LHM's `ISensor.Value` is nullable, but unprivileged reads through PawnIO return zero-filled buffers (`PawnIo.cs#L120`), so a 0 can mean "unavailable". The helper must classify these values itself.
- RF4. Sampling period: 1 s normally, 250 ms while a benchmark is active. The app must be able to change the period while the helper runs. The period must not drift by the update time (spike AVOID). Each frame carries its own sample timestamp, which the UI uses, because client receive jitter reaches ~50 ms. Precedent: P2 deadline scheduling (mean 1000.2 / 250.5 ms, max jitter ≤ 29 ms, no cumulative drift, elevated too).
- RF5. Exits when its client disconnects, or when no client connects within 30 s. On a normal app exit, the helper must be gone within 5 s. The app may terminate it, which P2 showed works even when the helper is elevated. **The elevated helper writes no files.** Diagnostics travel over the pipe. That removes junction and symlink redirection attacks on an elevated writer.
- RF6. Never installs or starts a driver installer. It only detects PawnIO.
- RF31. Treats everything it receives from the client as untrusted input:
  - it accepts only the documented control messages;
  - it rejects anything else, malformed messages, and messages over a size limit;
  - it verifies that the connecting client process is the Pophood app before acting on any message;
  - it never crashes on bad input. P2 fuzzing showed that invalid UTF-8 and escaped lone surrogates get past `JsonDocument.Parse` and throw later, so both an upfront encoding check and a catch-all are required;
  - the P2 fuzz corpus (22 cases) is the minimum test set.

**B. App core (Rust, unprivileged).** Owns helper lifetime, elevation, persistence, benchmarks and tool execution.
- RF7. Single instance: a second launch focuses the existing window.
- RF8. Spawns the helper hidden. Relaunches it elevated on request through UAC, with a fallback to unprivileged if UAC is cancelled or fails. Reconnects automatically.
- RF9. Before trusting a pipe, verifies that the server process is the bundled helper (anti pipe squatting).
- RF10. Keeps the last ~10 minutes of live readings in memory for the sparklines. Live readings are never persisted; only benchmark runs (RF22) and sensor labels (RF13) are.
- RF11. The UI knows whether PawnIO is installed, in both reduced and full mode. The precedent is the registry check, which is readable unprivileged. Whether the helper or the core reads it is left to the techspec; see Q21 below.
- RF12. The Memory card gets the configured memory speed. The precedent is WMI `Win32_PhysicalMemory.ConfiguredClockSpeed`, which works unprivileged. "OC profile likely on" is shown only with full sensors, when the configured speed is above the SPD JEDEC speed (tCKAVGmin; answer #24).
  - **Q21 note:** Q21 makes the helper the only *sensor* source. Static facts that aren't sensors (configured speed, PawnIO presence) don't need a sensor-path exception, but the techspec must say where they are read.
- RF13. Stores and applies user sensor labels per machine, and offers reset to default.
  - The key must identify exactly one sensor. **The LHM `Identifier` alone does not**: `/gpu-nvidia/0/load/3` is used by two sensors (P1).
  - A label whose sensor disappears, or whose sensor's type or name changes, must not silently attach to another sensor.
  - **OQ1, resolved 2026-10-21:** on this PC, with LHM pinned, the `Identifier` and the name, type and index of every sensor were stable across restarts, elevation and a reboot (P1). So the identifier is a sound base for the key, but it has to be made unique to separate the `/gpu-nvidia/0/load/3` pair ("GPU Bus" and "GPU Memory"). The techspec chooses the exact composite key.
  - LHM upgrades or hardware changes can still move identifiers (P1, the parts that depend on order), so the no-silent-reattach rule above stays.
- RF14. Every bundled executable is verified by SHA-256:
  - **When:** the helper before **every launch**, unprivileged and elevated alike; `7za.exe` and `diskspd.exe` before every run.
  - **Trusted hashes** (answer #21): `7za.exe` is downloaded, so its hash is kept in the repo. The helper and `diskspd.exe` are self-built, so the build writes a manifest of their hashes next to the app.
  - **Failure:** a mismatch stops the launch or the test with a clear error.
  - **Limit:** the manifest catches tampering after the build, not a tampered build or a tampered manifest. That is accepted for v0.1.0 (R-trust-launch).
  - **Reproducible builds:** P4 showed that DiskSpd builds deterministically across folders (`/experimental:deterministic /pathmap /PDBALTPATH`, exe only). That makes manifest hashes independently checkable. Whether the NativeAOT helper can be made reproducible is not known (OQ14, non-blocking).

**C. Benchmarks.** Implemented behind one test-runner seam ("run, report progress, return a result"), with several test types per component. v1 ships the benchmark type only (Q4, Q14b).
- RF15. **CPU:** `7za b` (multi-thread) and `7za b -mmt1`. The result is the total rating (MIPS) from the `Tot:` line for each.
- RF16. **Memory:** STREAM-style bandwidth (read, write, copy) and pointer-chasing latency, in Rust.
  - Arrays must be at least 4× the total LLC.
  - Results that don't conform to STREAM are labeled. P3's `copy_from_slice` Copy likely used non-temporal stores, so it was non-conformant.
  - Two variants (answer #31): **quick** (all threads plus 1 GiB latency, ~3–4 s, used by "Run all") and **full** (adds per-CCD, 1-thread and a latency ladder, ~17–19 s, when run alone).
  - Budget ≤ 30 s.
  - The result records the thread count and placement.
  - P3 pitfalls are requirements for correctness: work must not be optimised away, and timing must not depend on one thread being scheduled.
- RF17. **GPU:** D3D12 compute, measuring FP32 throughput and VRAM bandwidth, in Rust. Runs on a user-picked adapter, defaulting to the high-performance (discrete) one; software adapters are excluded. Budget ≤ 10 s. Precedent: P3, which measured 25.3 TFLOPS and 434 GB/s, about 97% of spec.
- RF18. **Disk:** DiskSpd built from MIT source at a pinned version, reproducing CrystalDiskMark 9.x's 4 default profiles (SEQ1M Q8T1, SEQ1M Q1T1, RND4K Q32T1, RND4K Q1T1). Parity details to reproduce or calibrate:
  - read and write;
  - 1 GiB test file on a user-picked drive, in a location the unprivileged user can write;
  - 5 s measure time, 5 s interval between tests;
  - 1 unscored warm-up plus 3 scored passes, keeping the best;
  - decimal MB/s.
  - **Reference:** CDM's own DiskSpd arguments (`-S -W0 -ag`, and `-si` only when threads > 1) differ from the spike's (`-Sh -W1 -si` on T1; `pc-bench-spike/results/diskspd-cdm.txt:4`).
  - DiskSpd 2.3 changed two defaults compared with CDM's 2.2.0 fork. `-aup -bsn` restore the 2.2 behaviour (P4).
  - DiskSpd is pinned at tag `v2.3` (`5e7025b`).
  - The final flags are calibrated within ±5% of CDM 9.0.3 on the NV3 (OQ2, resolved 2026-10-21; the worst profile was −3.89%).
    - Reads: `-b<K>K -o<Q> -t<T> -W0 -S -w0 [-r] -ag -aup -bsn -d5 -L <file>`.
    - Writes: the same, with `-w100 -Z<K>K` in place of `-w0`.
    - Add `-si` only for sequential tests with threads > 1.
    - The test file is created the CDM way, with random fill.
    - Score = DiskSpd "total:" MiB/s × 1.048576.
    - The precedent is P4's `calibrate.ps1`.
  - The temporary file is deleted on success, failure and cancel.
  - A startup sweep removes any temp file left behind by a crash or power loss.
  - A free-space check runs before starting.
- RF19. "Run all" runs CPU → memory (quick) → GPU → disk as one run, within ≤ 5 min, and each test can also run alone. A pre-run background-load check warns but doesn't block.
- RF20. Starting a run in reduced mode warns that the trace will lack CPU temperature and power. The run is allowed and gets a "reduced sensors" flag.
- RF21. Cancelling, or a failure mid-way, keeps the completed tests as a run flagged "partial". The failed or cancelled test records its reason.

**D. Persistence (SQLite under `%LOCALAPPDATA%`).**
- RF22. Each saved run stores:
  - label and timestamp;
  - per-test results and settings;
  - a hardware snapshot;
  - driver, LHM and tool versions;
  - flags (reduced, partial);
  - a sensor trace sampled at 250 ms.
- RF23. Runs can be relabeled and deleted. Deleting removes the trace too.
- RF24. A run can be exported to JSON or CSV through a save dialog. Export is local file I/O only. **Serial numbers (drive, DIMM, board) are stripped by default** (answer #23); the local DB keeps them.

**E. UI (React/TypeScript).**
- RF25. Dashboard cards as specified in the [Slice requirement](#slice-requirement), with sparklines, placeholders, and the "Enable full sensors" action.
- RF26. Drill-down: the full sensor list for a component, with live values and an inline rename.
- RF27. Benchmark screen: run one test or "Run all", the adapter and drive pickers, progress, cancel, and the warnings from RF19, RF20 and RF18.
- RF28. Runs page: a list with flags, multi-select, per-test bar charts with % difference, overlaid traces (sensors matched with the RF13 key), relabel, delete, export.

**F. Compliance and trust hygiene.**
- RF29. No outbound network connections from the whole Pophood process tree: the app, the WebView2 child processes, the helper and the bundled tools. The webview loads only bundled assets under a strict CSP: no CDN fonts or scripts, and no remote IPC.
  - **WebView2 defaults violate this** (P5): an Edge experimentation/config fetch, the component updater, WPAD, and `substrate.office.com`.
  - The webview **must** run with `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-background-networking --disable-component-update --no-proxy-server`. Setting `additionalBrowserArgs` replaces wry's defaults, so the default flags must be re-added. P5 verified this value through `tauri.conf.json`.
  - WebView2 crash-dump upload to Microsoft must be disabled (`IsCustomCrashReportingEnabled`). wry doesn't expose that option, so the techspec must find a way.
  - The remaining `substrate.office.com` flow from the WebView2 browser process must be found and disabled in the techspec, then re-captured with the P5 method **(OQ13; gates v0.1.0, answer #33)**. Done: `msOneAuthWAM` removes it (T14, E2E-15).
  - **Disclosed exception (T14, 2026-10-22; owner: "Disclosed exception (Recommended)").** The WebView2 runtime calls Windows' Microsoft Account APIs on every launch observed: the browser process loads WAM at start, and its crashpad handler calls the OnlineId API about 30 s in. In some launches (3 of 11 watched) the `wlidsvc` service, which runs outside Pophood's tree, then starts and resolves `login.live.com`. What decides it isn't established; likely Windows' token cache. On runtime 155.0.4283.62 no `--disable-features` name, `msDiagnosticDataForceOff` or `--disable-breakpad` stops the calls. Pophood's own tree still makes no connection. The README and the trust panel disclose it (done in the follow-ups session, `sessions/20261022132420_pophood-v010-followups/`).
- RF30. Ship license notices for every bundled third-party component (see [Dependencies](#dependencies)). Say where the LHM source can be obtained, as MPL-2.0 requires.

### Files to Modify

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `README.md` | Project front page | Update the status from "planning", and add build-from-source instructions and the trust invariants once slice 1 lands |
| `specs/v0.1.0/grill-session/session.md` | Decision record | Note the changes made in this session: CDM 3 passes instead of 5, DiskSpd built from source, LHM built from source, the "OC profile" label, one GPU card per GPU, single instance, controllers off, build-manifest hashes. Or link to this doc's Q&A. |
| `sessions/20261020135705_pophood-grill-spike-naming/decisions/0003-benchmark-building-blocks.md` | Accepted ADR | Lines 10–11 and 16 still say 5 passes, ~4.5 min disk, ~6 min "Run all". Amend to 3 passes, ~3.5 min and ~5 min, citing answer #13. Also update the "pinned versions, with SHA-256" sentence to the build-manifest scheme (#21). |
| `sessions/20261020135705_pophood-grill-spike-naming/decisions/0001-trust-model-read-only-elevated-helper.md` | Accepted ADR | Restate "read-only" as "never changes hardware state", with the documented read-path register writes (RF1). |
| `specs/v0.1.0/spike-results.md` | Spike record | Add a dated note under the F10 decision row (line 65): the 5-pass decision is superseded by 3 passes (answer #13). |

### Files to Create

Proposed top-level layout only (see [Proposed structure](#proposed-structure)); exact files are for the techspec.

| File | Purpose | Type (Component/Service/Util) |
| ---- | ------- | ----------------------------- |
| `src/` (React/TS UI) | Dashboard, drill-down, benchmarks, Runs | Component |
| `src-tauri/` (Rust core crate) | Helper lifetime, elevation, pipe client, benchmarks, persistence | Service |
| `helper/` (.NET NativeAOT project) | Sensor helper | Service |
| `third_party/LibreHardwareMonitor` (pinned at v0.9.6, commit `3d331e3`) | LHM built from source | Dependency |
| `third_party/diskspd` (pinned tag or commit) | DiskSpd built from MIT source | Dependency |
| A pinned-tool record in the repo (7za version + SHA-256) and a build-generated hash manifest (helper, diskspd) | Hash verification before each launch and run (RF14) | Util / data |
| NuGet lock file for the helper (`packages.lock.json` with content hashes) | Pins LHM's transitive dependencies (C4) | Config |
| `THIRD-PARTY-NOTICES` (+ license texts) | License compliance | Docs |
| `AGENTS.md` | Trust invariants and build notes (drafted in `sessions/…/long_term_memory.md`) | Docs |

### APIs Affected

All new.

| Endpoint | Method | Changes |
| -------- | ------ | ------- |
| Named pipe: helper → app sensor stream | Stream of versioned frames | New. Only the interactive user can access it. Each side verifies the other (RF9, RF31). |
| App → helper control (at least the sampling period) | Mechanism for the techspec | New. Precedent: P2's duplex pipe, which carries versioned JSON control messages with acks and works elevated too. The helper treats every message as untrusted (RF31). |
| Tauri IPC: core → UI live sensor stream | Event or channel | New. The docs prefer `ipc::Channel` for high-frequency data; the spike used events. |
| Tauri IPC: UI → core commands | Commands | New: enable full sensors, rename and reset a sensor, run, cancel, list runs, compare, relabel, delete, export |
| Child processes: `7za.exe`, `diskspd.exe` | Process + stdout / exit code | New. Hash-verified before each launch. |
| Opening pawnio.eu in the user's browser | Shell open of a fixed URL | New. User-initiated. The precedent is the opener plugin, scoped to that single URL, or a Win32 shell open. The techspec decides. |

### Database Changes

New SQLite database under `%LOCALAPPDATA%`. These are entities, not a schema. Note that Tauri's `app_local_data_dir` is `%LOCALAPPDATA%\{identifier}`; `tauri-plugin-sql` defaults to Roaming AppConfig instead.

| Table | Change Type | Details |
| ----- | ----------- | ------- |
| Runs | New | Label, timestamp, flags (reduced, partial), versions, hardware snapshot |
| Test results | New | One per test in a run: test type, settings, metrics, status or reason |
| Sensor traces | New | Samples at 250 ms per run (volume ≈ 5 min × 4 Hz × the sensor count) |
| Sensor labels | New | Per-machine custom names, keyed per RF13 |
| Schema version / migrations | New | The DB must be migratable from day one, because persisted data outlives versions |

## Key components & responsibilities

| Component | Responsibility | Privilege |
|---|---|---|
| Sensor helper (.NET AOT + LHM) | Read sensors; serve versioned frames; validate the client and its messages; exit with its client; write no files when elevated | Unprivileged, or elevated on request |
| App core (Rust) | Helper verification, lifetime and elevation; pipe trust check; live history; benchmark orchestration; tool verification; temp-file sweep; SQLite. Static facts (memory speed, PawnIO presence) are placed by the techspec (RF11, RF12). | Always unprivileged |
| Test runners (Rust + bundled tools) | CPU (7za), memory (Rust), GPU (D3D12, Rust), disk (DiskSpd) behind one interface | Unprivileged |
| UI (React/TS in WebView2) | Dashboard, drill-down, rename, benchmarks, Runs page | Sandbox; IPC only through the app's registered commands and its Channel. v0.1.0 has no capability files, so no plugin or core API is reachable (see the techspec). |
| Build tooling | Builds LHM, the helper and DiskSpd from pinned source; restores NuGet from the lock file; writes the hash manifest | Developer machine |

## High-level technical constraints

- **C1, privilege:** the main app never runs elevated. Only the helper may, and only after a UAC prompt in the current session.
- **C2, no hardware changes:** the helper permanently never changes hardware state (RF1). Read-path register writes inside LHM are the only accepted writes. Any control feature would need a separate product decision and a separate helper.
- **C3, drivers:** in v0.1.0, the app never installs or bundles a driver or driver installer. It detects PawnIO and links to pawnio.eu, as PawnIO's own wiki recommends. Per Q10, a future installer *may* offer PawnIO as a labeled optional step, which needs its own decision.
- **C4, supply chain:**
  - LHM 0.9.6 is built from pinned source, not the NuGet package the spike used.
  - **LHM's NuGet dependencies also run elevated**: DiskInfoToolkit 1.1.2, RAMSPDToolkit-NDD 1.4.2, BlackSharp.Core, HidSharp 2.6.4, System.Management and Mono.Posix.NETStandard 1.0.0. They come as prebuilt DLLs (LHM `LibreHardwareMonitorLib.csproj:57-73`). In v0.1.0 they are pinned by a NuGet lock file with content hashes (answer #20). P6 audited them: no driver-install, service or process-launch code. Building them from source is deferred to the public release (answer #26).
  - DiskSpd is built from pinned MIT source. Its release zip carries a no-redistribution EULA.
  - 7-Zip 26.04 `7za.exe` is pinned.
  - Every bundled executable is SHA-256 verified per RF14.
- **C5, network:** no outbound connections from the whole process tree (no telemetry, updates, crash reports, CDN assets, online lookups). Opening pawnio.eu in the user's browser is a user-initiated link, not an app connection. Windows' `wlidsvc` contacting `login.live.com` after WebView2's account lookups is a disclosed exception (RF29, T14).
- **C6, IPC security:**
  - Only the interactive user can access the pipe.
  - The client verifies the server process (RF9), and the server verifies the client and validates its messages (RF31).
  - The schema is versioned.
  - The webview has a strict CSP and minimal capabilities.
  - **Over-the-shoulder elevation** (a standard user entering a different admin's credentials) runs the helper under the admin's account. A DACL built from the helper's own SID (spike `Program.cs:15-19`) would then lock out the real user. Not a v0.1.0 case (the owner is an admin; P2 confirmed the user and logon SIDs are the same across elevation here). Deferred to the public release (answer #26).
- **C11, elevated launch path:**
  - In a build from source, the helper exe lives in a user-writable folder, so a same-user process could swap it before the UAC prompt.
  - v0.1.0 accepts this risk: hash verification just before launch (RF14) narrows the window, but doesn't close it.
  - The installer must place the helper in an admin-only location (Program Files).
- **C7, data:** everything stays local, under `%LOCALAPPDATA%`. A hardware snapshot may include serial numbers, so exports strip serial numbers by default (answer #23).
- **C8, platform:** Windows 11 x64 only. WebView2 ships with Windows 11. Exactly two cross-platform seams: the versioned sensor schema and the test-runner interface. No others.
- **C9, comparability:** disk numbers must not be called CDM-comparable until they are calibrated against CDM 9.x on the same drive. Memory results that don't follow STREAM rules must be labeled.
- **C10, build:**
  - The NativeAOT build needs `vswhere` on PATH.
  - MSVC comes from VS Build Tools 2022, which needs the **ATL component** (`Microsoft.VisualStudio.Component.VC.ATL`) to build DiskSpd (P4).
  - The DiskSpd tag targets toolset `v145` (VS 2026), so the build overrides it to `v143`.
  - DiskSpd links the C runtime dynamically. Either ship the VC++ runtime DLLs, or build with `/MT`.
  - HLSL is compiled at build time with the Windows SDK's `dxc.exe` (P3).
  - Every helper change needs an AOT smoke test of the elevated paths (ADR 0002), and every LHM or dependency bump needs the P6 write-path re-audit (RF1).

## Architecture insights

- **Two processes, one trust boundary.** Everything privileged sits behind the pipe. The spike proved a medium-integrity client can read an elevated server's pipe under a user-only DACL (F7).
- **The helper is the only sensor source** (Q21). That keeps one sensor model and one code path. The cost is that reduced mode is almost empty (F1), so the UX pushes elevation.
- **Exactly two seams** (Q14b): the sensor schema and the test-runner interface. Adding any other abstraction "for cross-platform" is out of scope.
- **Benchmarks run unprivileged.** DiskSpd works without admin; file preparation is just slower without SeManageVolumePrivilege (F10). Large-page memory tests would need SeLockMemoryPrivilege, which the unelevated token lacks. Whether memory results are 4 KB-page numbers is a techspec decision.
- **Precedents for ownership:**
  - Tauri sidecars (`bundle.externalBin`, triple-suffixed, copied next to the exe, even for `--no-bundle`) vs `bundle.resources`.
  - Does `tauri-plugin-shell` have an elevation path? A read of `plugins-workspace/plugins/shell/src/process/mod.rs` (v2 branch) found no `runas`. The precedent for an elevated launch is raw Win32 (`ShellExecuteExW`).
  - Who owns the DB, Rust (rusqlite/sqlx) or JS (`tauri-plugin-sql`), is a techspec choice.
- **Pattern consistency (spike):** medium. The patterns work but are spike-grade, with several AVOIDs. **Documentation quality:** high (grill, spike, ADRs). **Architectural clarity:** high.

## Dependencies

| Dependency | Version (pinned / observed) | License | Obligation / note |
|---|---|---|---|
| Tauri | 2.12.4 (tauri-build 2.7.3, CLI 2.12.3) | MIT / Apache-2.0 | `tauri v3.0.0-alpha` exists; stay on 2.x |
| React / TypeScript / Vite | 19.3.1 / 6.0.3 / 8.3.4 (spike) | MIT | Charting library open: uPlot, Recharts, visx, ECharts and others were listed without a pick |
| `windows` crate | 0.62.2 | MIT / Apache-2.0 | Win32, D3D12, DXGI |
| tokio | 1.54.0 | MIT | Pipe client |
| SQLite access | rusqlite 0.40.2 / sqlx 0.9.0 / tauri-plugin-sql 2.6.0 | MIT | Techspec choice |
| .NET SDK | 10.0.402 | MIT | NativeAOT |
| LibreHardwareMonitorLib | 0.9.6 @ `3d331e3`, built from source | **MPL-2.0** | Make the source available and say where (MPL §3.2). The embedded PawnIO module blobs are **LGPL-2.1**. |
| LHM transitive NuGet packages (run elevated) | DiskInfoToolkit 1.1.2, RAMSPDToolkit-NDD 1.4.2, BlackSharp.Core 1.0.7 (MPL-2.0); HidSharp 2.6.4 (Apache-2.0); System.Management 10.0.2 and other Microsoft packages (MIT) | as listed | Pinned by lock file and content hash (C4). Prebuilt DLLs, not built from source in v0.1.0 (answer #26). The P6 audit found no install or launch code. BlackSharp.Core's `1.0.7` git tag differs from its nuspec commit (c70b735), so pin the commit. |
| Mono.Posix.NETStandard | 1.0.0 (pulled in by LHM) | MIT | Ships 1.5 MB of DLLs; whether they can be dropped is unknown (OQ8) |
| PawnIO driver | 2.2.0 (user-installed, not bundled) | GPL-2.0+ with an IOCTL exception; binaries proprietary | Not shipped; detected only. Setup link: `https://pawnio.eu` |
| 7-Zip `7za.exe` | 26.04 | LGPL-2.1+, plus BSD-3 (zstd) and BSD-2 (xxhash) | Include `License.txt` and the related notices. The unRAR restriction doesn't apply (not linked). |
| DiskSpd | Tag `v2.3`, commit `5e7025bfc9d1364f185d4c30963d7ac79195435e`, built from source (P4) | MIT | Keep the copyright notice. Don't redistribute the release-zip binary (EULA). v2.3 changed thread/buffer defaults; `-aup -bsn` restore the 2.2 behaviour of CDM's fork. Build needs ATL; uses the VC++ runtime (C10). |
| ATL (build-time only) | MSVC 14.44 ATL headers/libs (VS Build Tools component) | Microsoft (VS license) | Needed to compile DiskSpd; not redistributed |
| D3D shader compiler | FXC (`d3dcompiler_47.dll`, in System32) or DXC (`dxc.exe` in Windows SDK 10.0.26100; latest 1.9.2609) | Microsoft | Precompile vs runtime compile is a techspec choice; redistribution terms for `dxcompiler.dll` are unverified |
| WebView2 Runtime | 155.0.4283.62 (this PC) | Microsoft | Ships with Windows 11 |

## Observations

**Strengths:**
- The riskiest unknowns were retired on real hardware before requirements (F1–F11).
- Every owner decision is recorded verbatim.
- Clear trust invariants already exist as drafts (`sessions/…/long_term_memory.md`).

**Corrections found this session, compared with earlier records:**
- **LHM has no driver auto-install setting to turn off.** In the library source, no install path was found (probe scope: a grep for `install`, `Process.Start` and `runas` across `LibreHardwareMonitorLib/**/*.cs` at v0.9.6). Only the LHM WinForms app prompts. So the "auto-install turned off" requirement is met by using the library alone and never copying the app's prompt, and P6 found no install path in the transitive DLLs either.
- **"Read-only" needed restating.** LHM writes to SuperIO registers just to read them (`IT87XX.cs:437,559,570-571`). The invariant is now "never changes hardware state" (RF1).
- **Elevated code isn't only LHM.** Six NuGet dependencies run elevated as prebuilt DLLs (C4).
- **SSD writes depend on time, not file size.** DiskSpd runs each test for a fixed time (`-d5`), so a fast NVMe writes far more than the 1 GiB file size. One spike pass wrote ~58.4 GB (`pc-bench-spike/results/diskspd-cdm.txt:231,493,755,1015`).
- **CrystalDiskMark 9.x defaults to 3 passes** (8.x used 5). The owner chose to match 9.x, which brings "Run all" back to about 5 min.
- **The DiskSpd release zip is not MIT for redistribution** (it has a EULA). The owner chose to build from source.
- **The spike used the NuGet LHM package**, not a source build. The owner chose a source build.
- **The test RAM kit is sold as XMP** (Corsair lists XMP, not EXPO), hence the vendor-neutral "OC profile" label.
- **WMI on this PC reports `Speed` = `ConfiguredClockSpeed` = 6000** (verified this session), even though SMBIOS defines `Speed` as the maximum capable speed. WMI alone therefore can't supply the JEDEC base, so the OC-profile check uses SPD with full sensors only (answer #24).
- **PawnIO detection works unprivileged** (verified this session). The spike's `pawnIoInstalled: false` in the unprivileged run was most likely because PawnIO wasn't installed yet at that point.

**Opportunities:**
- LHM's own `{sensorId}/name` convention is a ready precedent for renames.
- smartmontools shows a possible unprivileged NVMe health path if a reduced-mode disk card is ever wanted.

**Anti-scaffolding (rejected for v0.1.0):**
- CI/CD pipelines;
- logging or telemetry pipelines;
- middleware layers;
- monitoring;
- generic plugin systems;
- "set up the project" as a slice goal;
- cross-platform abstractions beyond the two seams.

## Side effects / impact

- **SSD wear:** writes = write throughput × 5 s, for each of the 4 write profiles and each of the 4 passes (warm-up + 3). One spike pass on the NV3 wrote ~58.4 GB (28.1 + 26.3 + 2.7 + 1.3 GB, `diskspd-cdm.txt:231,493,755,1015`), so one full disk run writes about **234 GB** there. Faster drives write more. Users must be warned with this estimate before the test (slice 6), and the temp file must always be removed (RF18). Recording bytes written with each run is a techspec option.
- **PawnIO stays loaded until reboot** after first use (F7). This is a system-wide effect of enabling full sensors, though only admins can open the device. Worth one line in the UI or docs.
- **UAC prompt once per session** (Q11). Accepted for v1; a Windows service would be reconsidered with the installer.
- **Benchmarks load the machine heavily** (CPU, memory, GPU and disk at full load for about 5 min). Expect heat and fan noise, which is visible in the trace.
- **Local DB growth:** traces at 250 ms add up across many runs. Delete exists (RF23); no retention policy in v1.

## Risks & considerations

| Severity | Risk | Mitigation / next probe |
|---|---|---|
| **Critical** | Pipe squatting: an unprivileged process creates the pipe first and feeds fake data, or receives commands. | RF9 server-identity check, plus `FirstPipeInstance` on the helper side. Must be in slice 1 and tested. |
| **Critical** | Scope creep into hardware writes (fan control, tuning) erodes the trust model. LHM's control write paths are compiled into the helper. | C2 and RF1: never call the control or set APIs, with a mechanical check; `IsControllerEnabled` off. Any request becomes a separate decision with a separate helper. |
| **High** | R-trust-launch: in a build from source, the helper exe sits in a user-writable folder. A same-user process could swap it before the UAC prompt, or tamper with the build manifest. | Accepted for v0.1.0 (C11). Hash check just before every launch (RF14). The installer must move the helper to an admin-only location. |
| **High** | An elevated process that writes files into user-controlled folders can be redirected by junctions or symlinks. | RF5: the elevated helper writes no files. |
| **High** | Elevated NuGet dependencies are prebuilt binaries, outside the "built from source" audit story. | Lock file and content hashes (C4). P6 audit: no install or launch code. Building them from source is deferred to the public release (answer #26). |
| **High** | LHM and its dependencies write to hardware automatically (SMART ENABLE, Nuvoton init, USB-bridge mode switch, a COM-port probe; P6). An LHM upgrade could add new writes silently. | RF1 allow-list plus the mechanical check; the P6 re-audit is mandatory on every LHM or dependency bump; no persisting settings store. |
| **High** | The client sends control messages into an elevated process. | RF31: verify the client process and accept only documented, well-formed messages. |
| **High** | R2: unstable sensor identifiers. LHM identifiers are built from enumeration order and indexes; they changed across LHM releases (PRs #1183, #1797, #1923, #2310, #2328); CCD temperature indexes depend on read order. Renames and run comparisons could attach to the wrong sensor. **P1:** identifiers are stable across restarts, elevation and a reboot on this PC (OQ1, resolved), but `/gpu-nvidia/0/load/3` is duplicated. | RF13: the key must be unique (the identifier alone isn't). Keep LHM pinned. Labels never silently re-attach. On any LHM upgrade, re-run the P1 comparisons. |
| **High** | R3: disk numbers don't match CDM. Spike writes exceeded the drive rating. DiskSpd 2.3 defaults differ from CDM's forked 2.2.0. CDM reads results from the exit code rather than parsed output. | Calibrated against CDM 9.0.3 on the NV3: all 8 profiles are within ±5% (OQ2, resolved). RF18 fixes the flags. C9 still applies to any new DiskSpd version or argument change, which must be recalibrated before the numbers are called CDM-comparable. |
| **High** | Reduced-mode zeros look like real readings. `ISensor.Value` is nullable, but unprivileged PawnIO reads return zero-filled buffers (`PawnIo.cs#L120`), so 0 appears where null should be. Does LHM expose a loaded or unavailable state? Probe scope: `PawnIo.cs`, `AmdFamily17.cs`, `Amd17Cpu.cs`, `ISensor.cs`; none found. | RF3 and the slice-1 placeholders. The helper must classify unreliable-when-unprivileged sensors itself. |
| **Mid** | SSD wear is far higher than the file size suggests (~234 GB per disk run on the NV3). | A pre-test warning with an estimate (slice 6). See [Side effects](#side-effects--impact). |
| **High** | WebView2 contacts Microsoft by default: an Edge experimentation/config fetch, the component updater, WPAD, `substrate.office.com`, and possibly crash dumps (P5). | RF29: three required flags (verified), the crash-reporting option, and OQ13 for `substrate.office.com`, which gates v0.1.0. Re-capture with the P5 method before sign-off. T14: `substrate.office.com` is gone; WebView2's Windows-account lookups (`wlidsvc` → `login.live.com`) remain, as a disclosed exception. |
| **Mid** | The elevated helper can't be tracked or killed if it's launched without a process handle (spike `ShellExecuteW`). | Use a launch method that returns a handle (precedent: `ShellExecuteExW` + `SEE_MASK_NOCLOSEPROCESS`, the `runas` crate). |
| **Low** | Benchmark timing pitfalls: loops get optimised away, a descheduled timing thread inflates results, and a non-temporal Copy breaks STREAM conformance (P3). | RF16 correctness requirements; P3 code is the precedent. |
| **Mid** | AOT/trim warnings in LHM: a helper change could break elevated paths silently. | C10 AOT smoke test of the elevated paths for every helper change. |
| **Low** | Memory bandwidth on a 2-CCD Ryzen is capped per CCD (Infinity Fabric), so results vary with thread placement. | The techspec decides between all-cores and per-CCD reporting. Record the thread count and affinity with the result. |
| **Low** | Disk temp file location: unprivileged users can't write files at a drive root. A crash leaves a 1 GiB file behind (the spike did: `results/diskspd-test.dat`). | RF18: a user-writable location plus a startup sweep. |
| **Low** | An elevated helper can outlive the app by up to 30 s if the app goes away before the helper connects. | Bounded at 35 s (Goals table); tested in slice 1. |
| **Low** | The license notice set is incomplete (MPL transitive packages, LGPL PawnIO modules, 7-Zip BSD parts). | RF30, with the [Dependencies](#dependencies) table as the checklist. |

## Open questions

| # | Question | Blocks | Next probe |
|---|---|---|---|
| OQ8 | Can the Mono.Posix DLLs be dropped from the helper on Windows? LHM uses Mono.Posix only by reflection, only on Unix (P6). | Helper footprint (minor, non-blocking) | Build without them and run the AOT smoke test |
| OQ13 | What in the WebView2 browser process contacts `substrate.office.com`, and how is it disabled? Possibly identity or M365 integration tied to the work account on this PC. | **RF29 sign-off; gates v0.1.0** (answer #33) | Techspec research (WebView2 environment options, `--disable-features` names, policies), then re-capture with the P5 method |
| OQ14 | Can the NativeAOT helper build be made reproducible, like DiskSpd (P4)? | Independent checking of manifest hashes (non-blocking) | Two clean builds in different folders, then compare hashes |
| OQ15 | How can WebView2 crash-dump upload be disabled, given that wry doesn't expose `IsCustomCrashReportingEnabled`? | RF29 (techspec) | Techspec: a custom WebView2 environment via `webview2-com`, or an upstream wry option |

**Resolved in revision 3:**

| # | Resolution |
|---|---|
| OQ3 | Run times were measured (P3) and turned into budgets (#32). |
| OQ4 | The OC-profile check uses SPD, with full sensors only (#24). |
| OQ5 | Answered by P5. The residual traffic became OQ13 and OQ15. |
| OQ6 | Serial numbers are stripped from exports by default (#23). |
| OQ7 | The precedent is P3's `gpu.rs`. |
| OQ9 | Elevation without PawnIO adds only storage; everything else is missing or fake (P6, code reading, #28). |
| OQ10 | No install, service or launch code in the dependencies (P6). |
| OQ11, OQ12 | Moved to the public release (#26); see [Deliberately NOT building yet](#deliberately-not-building-yet). |
| OQ1 | Resolved on 2026-10-21. After a real reboot (boot 06:56:53), all 6 comparisons show only the known duplicate `/gpu-nvidia/0/load/3`: restart, elevation and reboot, each unprivileged and elevated. There were 0 renames, type changes, index changes, removals or additions. See [P1](probe-results.md#p1-sensor-identifiers-oq1). |
| OQ2 | Calibration passed on 2026-10-21. All 8 profiles are within ±5% of CDM 9.0.3 on the NV3, using the default `calibrate.ps1` flags, so no iteration was needed. The worst is −3.89%, SEQ1M Q1T1 read. n = 1 pass per tool. See [P4](probe-results.md#p4-diskspd-built-from-source-oq2-rf14). |

## Proposed structure

These are directories and conventions only, pointing at ecosystem-standard layouts, not class designs:

```
pophood/
  src/                 React/TS UI (create-tauri-app react-ts layout)
  src-tauri/           Rust core crate: tauri.conf.json, capabilities/, src/lib.rs, src/main.rs
  helper/              .NET 10 NativeAOT sensor helper (csproj with PublishAot)
  third_party/         pinned sources: LibreHardwareMonitor (v0.9.6), diskspd
  specs/vX.Y.Z/        grill, spike, requirements, techspec, tasks
  sessions/            session logs
  THIRD-PARTY-NOTICES, LICENSE (MIT), README.md, AGENTS.md
```

Conventions to adopt:
- Tauri 2 project layout ([project structure](https://v2.tauri.app/start/project-structure/)).
- Capabilities kept minimal: no unscoped template plugins (the spike's `opener:default` was unused), and a strict CSP in place of `csp: null`. The only external link, pawnio.eu, must still open (see APIs Affected).
- Bundled executables shipped either as `bundle.externalBin` sidecars (target-triple suffix, copied next to the exe) or as `resources`. This is a techspec choice.
- Specs and sessions follow the existing repo conventions.
- Branching: not decided here. The current branch is `master`. "Commit directly to main" exists only in an unapproved draft (`sessions/…/long_term_memory.md`).

## Deliberately NOT building yet

| Capability | What would earn it a place |
|---|---|
| Installer, signing, update check | A decision to publish for other users (the long-term goal). The update check would need an owner-approved exception to C5. |
| Windows service instead of UAC per session | Being built together with the installer (Q11) |
| Stress/stability modes, in-OS memory stability, VRAM stability (memtest_vulkan) | Scheduled for v2 (Q3, Q4). Earned once v1's benchmarks are trusted and the owner wants to validate an overclock or tuning change. The test-runner seam keeps room for them. |
| Pin, reorder or hide cards and sensors | Scheduled for v2 (Q6b). Earned when the fixed card set hides something the owner checks regularly, or shows something they never look at. |
| CSV/continuous logging | Scheduled for v2 (Q19). Earned when the owner needs to diagnose something outside a benchmark run (e.g. a gaming crash). |
| Quick 1-pass disk mode (F10 option) | Earned if the ~3.5 min disk test proves too slow for routine before/after runs. |
| USB/HID fan and RGB controllers (`IsControllerEnabled`) | Earned if the owner, or a target user, has fans or an AIO on a USB hub, and the control-API check (RF1) covers those paths. |
| Unprivileged NVMe SMART | A wish for a disk card in reduced mode |
| Per-CCD memory bandwidth breakdown | If all-core numbers turn out too noisy to compare |
| Large-page memory tests | If 4 KB-page results prove misleading. Needs SeLockMemoryPrivilege. |
| Cross-platform builds | Earned after v2 ships (Q14b), when the owner wants Pophood on another OS |
| Building LHM's NuGet dependencies from source (former OQ11) | Required before the public release, which puts the audit story in front of other users |
| Over-the-shoulder elevation support: a pipe ACL taken from the launching user, not the helper's token (former OQ12) | Required before the public release, where standard-user installs are expected |
| Retention policy for old runs | DB size becoming a problem |

## Caller closure

The repo has no source code, so there are no existing callers to enumerate.

| Command | Result |
|---|---|
| `git ls-files \| wc -l` | 6 |
| `git ls-files \| grep -Ev '^(specs/\|README.md\|LICENSE)' \| wc -l` | 0 |

Every symbol in this doc is new.

## Q&A record (this session)

Answers #1–#22 were given on 2026-10-20 by choosing options; the chosen option is quoted. #34 was free text, quoted verbatim.

| # | Question | Answer |
|---|---|---|
| 1 | Mode? | "Greenfield" |
| 2 | What does v0.1.0 cover? | "All of v1, built in slices" |
| 3 | Which GPU does the benchmark run on? | "User picks, dGPU default" |
| 4 | Distribution of v0.1.0? | "Built from source" |
| 5 | First vertical slice? | "Live dashboard" |
| 6 | Renaming scope? | "Rename any sensor" (no hiding or reordering) |
| 7 | Can the user change the disk passes? | "Fixed" (originally 5; superseded by #13) |
| 8 | Show the inferred EXPO? | "Show as 'likely on'" (wording superseded by #16) |
| 9 | Run management besides label and compare? | "Delete a run, Edit the label later, Export a run (JSON/CSV)" |
| 10 | Benchmark started in reduced mode? | "Warn, allow, mark the run" |
| 11 | Cancel or failure mid-way? | "Keep completed tests" (partial run, temp file always deleted) |
| 12 | Theme and units? | "Leave to Claude Design" (°C and decimal MB/s fixed) |
| 13 | CDM baseline passes? | "Match CDM 9.x: 3 passes" |
| 14 | How to get diskspd.exe? | "Build from MIT source" |
| 15 | LHM source or NuGet? | "Build from pinned source" |
| 16 | XMP/EXPO label? | "'OC profile likely on'" |
| 17 | How many GPU cards? | "One card per GPU" |
| 18 | Second launch? | "Focus the running window" |
| 19 | Keep LHM `IsControllerEnabled` (USB/HID controllers) in v1? | "Off in v1" |
| 20 | How are the elevated NuGet dependencies trusted? | "Lock + hash pin" |
| 21 | Where does the trusted hash for self-built binaries come from? | "Build writes a manifest" |
| 22 | Split slice 1 into 1a/1b/1c? | "Keep as one slice" (error states added instead) |
| 23–33 | Decisions made during the confidence probes: serial numbers stripped, OC profile from SPD, ±5% tolerance, OQ11/OQ12 deferred, reduced calibration, OQ9 by code reading, allow-listed auto-writes, PowerMonitor on, quick memory in "Run all", budgets, and residual traffic gating v0.1.0 | Verbatim in [probe-results.md](probe-results.md#owner-decisions-taken-during-the-probes-verbatim-option-labels) |
| 34 | Which UI designs? (Claude Design round, 2026-10-21, free text) | "D1 + timeline (last 10 minutes) below the six cards", "C for motherboard sensors", "D4 for runs"; earlier: "I liked C color scheme better" and "support light/dark themes for all options". Recorded in the [UI proposal](ui-proposal/ui-proposal.md). |
| 37 | Techspec scope, after the size estimate (≈15 tasks for slice 1, ≈45 for all eight slices; 2026-10-21, free text) | "okay let's do something here: let's break each slice into a separate patch or minor so I can do techspec for each one". Applied as one **minor** version per slice; see the [Version map](#version-map). Answers #35 and #36 (theme, app identifier) are techspec decisions, recorded in [techspec.md](techspec.md#qa-record). |
