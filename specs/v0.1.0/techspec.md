# Techspec - Pophood v0.1.0: live dashboard and trust baseline (slice 1)

- **Date:** 2026-10-21
- **Mode:** greenfield. The repo holds only specs. This techspec covers **v0.1.0 = slice 1** of the [version map](requirements.md#version-map) (answer #37). Slices 2–8 ship as v0.2.0–v0.8.0, each with its own techspec.
- **Inputs:**
  - [requirements.md](requirements.md): the slice 1 requirement, RF1–RF14, RF25, RF26, RF29–RF31, C1–C11;
  - [ui-proposal.md](ui-proposal/ui-proposal.md) and its mockups;
  - [probe-results.md](probe-results.md) (P1–P6);
  - ADRs 0001–0008.
- **Precedent code** (read for this spec, never copied blindly):
  - the spike at `C:\Users\jimmy\projects\pc-bench-spike\`;
  - the probes at `C:\Users\jimmy\pophood-probes\`;
  - LHM at `3d331e3370efb858411f19511373eff65a218701` (tag v0.9.6);
  - the crate sources tauri 2.12.4, wry 0.57.0, webview2-com 0.39.1, tokio 1.54.0 and windows 0.62.2.
- **Owner answers:** #35–#41 from the techspec session and #42–#44 after the adversarial review, recorded in the [Q&A record](#qa-record).
- **Next:** `tasks-breakdown` for v0.1.0.

## Summary

v0.1.0 ships the two-process trust model end to end, and puts the first screen the owner uses daily on top of it.

**The processes:**
- **The sensor helper** is a .NET 10 NativeAOT `WinExe` wrapping LHM 0.9.6, built from a pinned git submodule.
  - It serves self-describing JSON-lines frames (schema v1) on a per-launch random named pipe.
  - Only the user's SID can open the pipe, and the helper accepts only the Pophood app as its client.
  - It classifies the fake zeros LHM reports without PawnIO as `null`.
  - It accepts exactly one control message (`set_period`) through a validation pipeline fuzzed with P2's 22 cases.
  - Its first acts restrict DLL loading to System32 (`SetDefaultDllDirectories`, then a P/Invoke resolver; T15), so a DLL planted next to it can't run elevated.
- **The Rust core** (Tauri 2.12):
  - refuses to start if it is itself elevated (C1);
  - verifies the helper against a SHA-256 compiled into `pophood.exe`, and keeps the file locked from the check until launch;
  - launches the helper unprivileged, or elevated through `ShellExecuteExW("runas")` with a process handle;
  - accepts the pipe only if the server PID equals the PID it launched;
  - runs a small supervisor state machine (start, elevate, restart, stop) and forwards frames to the UI over an `ipc::Channel`.
- **The React UI:**
  - keeps the 10-minute history it draws;
  - renders the chosen E1/E2 designs with plain SVG charts;
  - turns every unavailable reading into "Needs full sensors" or "Needs PawnIO", never a 0.

**WebView2 lockdown:** the app creates its own WebView2 environment (after initialising COM on the main thread, which wry would otherwise do later), with custom crash reporting (OQ15) and a single browser-argument constant that adds `msOneAuthWAM` for OQ13. Navigation is pinned to the app's origin.

**Blast radius:** new code only. The only edits outside the new tree are README, AGENTS.md (new) and THIRD-PARTY-NOTICES.md (new).

## Approach

**Chosen approach: pragmatic-balance.** The greenfield guidance asks us to weigh it against clean-architecture.
- Clean-architecture would add abstractions now: a sensor-source trait, generated TS types, a chart library, a DI layer.
- The one structure kept for testability is the supervisor's state table, written as a pure `transition` function. It is the most complex logic in the slice, and the QA pass showed it can't be pinned any other way without mocking pipes.
- Only two seams are allowed (C8): the sensor schema and the test-runner interface. v0.1.0 needs only the first.
- So the design keeps each component concrete and small, and spends its effort on the trust boundary. The trust boundary is what this slice exists to prove.

**Reused:**
- **P2's duplex pipe:** DACL, `FirstPipeInstance`, client image-path check, validation order, deadline loop, fuzz corpus.
- **The spike:**
  - its LHM toggle names (not its values: the spike enabled `IsControllerEnabled` and never set `IsPowerMonitorEnabled`);
  - the recursive update;
  - the source-generated JSON context;
  - the AOT csproj flags;
  - its `CREATE_NO_WINDOW` spawn.
- **Tauri's own hooks:** `with_environment`, `on_navigation`, `ipc::Channel`, `externalBin`, and the single-instance plugin.
- **The mockups' SVG drawing approach.**

**Net-new:**
- the per-launch pipe name;
- PID-based server verification;
- the file lock across verify-and-launch;
- the compile-time helper hash;
- the RF3 availability classification, including a PawnIO device check;
- the helper's System32-only DLL search;
- the C1 guard (the app refuses to run elevated);
- the supervisor state machine and the sampler's per-tick exception policy;
- the custom WebView2 environment and navigation lock;
- the card field rules, GPU ordering and sparkline sources;
- the unmocked UI states.

**Explicitly not built:** these are the YAGNI decisions, accepted by the owner (#41); details in the [Anti-overengineering breakdown](#anti-overengineering-breakdown).
- **Not built at all in v0.1.0:**
  - core-side history (#38);
  - a Job Object;
  - a high-resolution timer;
  - a command ACL manifest or capability files;
  - tauri-driver E2E;
  - generated license lists for every transitive crate;
  - OQ14 (a reproducible AOT build);
  - a logging pipeline;
  - `freezePrototype`;
  - any router, state or chart library.
- **Left to later versions:**
  - the "Run" buttons and the Runs page (v0.3.0+);
  - renaming (v0.2.0);
  - GPU discrete/integrated labels (v0.5.0);
  - drive letters (v0.6.0).

## Confidence score

**History:** Rev 1.1 scored 91%. The adversarial review (2026-10-21) re-scored it at 85%: COM wasn't initialised before the WebView2 environment, the ban list had public bypasses, a planted DLL could run elevated, and the state machine froze when the unprivileged helper died during elevation. Rev 1.3 applies every finding. The scores below are re-scored from the review's evidence, not raised by assertion: each fix is backed by source the review read, and what remains unrun is listed.

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| API/docs and requirements clarity | 30% | 93% | Slice 1 is specified in full in requirements.md, with done-when and error states. Every design fork that needed the owner is answered (#35–#41). The UI proposal fixes the shell, tokens and three screens. The review's gaps are now specified: the state-machine rows for every source and elevation sub-state, sparkline sources, GPU order, titles and labels, the starting state, drill-down layout at 1024 px. **Open for the owner:** only copy they may want to tune. The review's decisions are answered (#42–#44). |
| Suitable inspected patterns | 25% | 90% | **Read at source, then re-verified by the review:** every "Patterns reused" row against current source, anchored on the symbol (P2, the spike, LHM `3d331e3`, tauri, wry, tao, tokio, windows); the 22 fuzz codes hand-traced and matched to P2's log; the two transcription errors fixed (the COM precondition of wry's environment creation; P2's deadline step). **Verified on this PC:** the NuGet lock pins the packages behind a ProjectReference with content hashes; a helper exe held with read-only sharing still launches, while rename, overwrite, delete and parent-folder rename fail. **Not yet run here:** environment creation in `setup()` with COM initialised (two public precedents), `ShellExecuteExW` under the file lock, the GPU DLLs under `SetDefaultDllDirectories`. |
| Data-flow/dependency understanding | 20% | 91% | Mapped: helper → core → UI frame flow, lazy SuperIO sensors, PawnIO's zero buffers, `/ram` having no total, the iGPU's sensor quirks, GPU order in every P1 dump. Every card field is mapped to a sensor seen in the P1 dumps. **Now verified at source:** SMBIOS `Size` in MiB and `MemoryType.DDR5`; `ValuesTimeWindow` semantics; LHM's own threads (the DIMM retry on the thread pool, storage hot-plug) and the bare-name vendor DLL loads. **From decoded IL only:** DiskInfoToolkit's `StorageManager` threads. |
| Complexity understood and controlled | 15% | 87% | The supervisor is the most complex part: elevation alongside a live (or dead) unprivileged helper, restart policy, one shutdown deadline. It is one task, holds a single owner of state, and every row of its table is a UT-29 case, plus IT-17 and E2E-02…E2E-10 and E2E-25. The table grew, so it costs one point against Rev 1.1. |
| Cross-system impact understood and bounded | 10% | 85% | **Checked by the review:** WebView2Feedback #5760 reports `msOneAuthWAM` removing the flow on runtime 155.0.4283.45; every OQ13 ladder feature name is in the local runtime's `msedge.dll`; `edge-webview-disable-crash-reporting` is in its `EmbeddedBrowserWebView.dll` (155.0.4283.62). C1 is now enforced and DLL planting is mitigated. **Still open:** OQ13 isn't captured on this PC; MC1490911 says the switch may be ignored from 157; OneAuth may delegate outside the tree; NVML's `%ProgramW6432%` fallback is unverified. |
| **Total** | | **90%** | 0.30·93 + 0.25·90 + 0.20·91 + 0.15·87 + 0.10·85 = 27.9 + 22.5 + 18.2 + 13.05 + 8.5 = **90.15** |

- **Effective threshold:** 90%, the owner's bar.
- **Bar met, with no margin:** 90% ≥ 90%, so `tasks-breakdown` can start. Any of the lowering events below puts it under the bar until its fallback is in.
- **What would lower the score:**
  - E2E-15 still showing `substrate.office.com` after the whole fallback ladder: −3 on cross-system, and v0.1.0 goes back to the owner (#33). **T14 outcome (2026-10-22):** it happened in a `login.live.com` form (see the OQ13 disposition). The −3 is applied (cross-system 85 → 82, total 90.15 → 89.85). The written fallback, back to the owner, is done ("Disclosed exception"), so the item no longer blocks; the score above is the techspec-time record.
  - `ShellExecuteExW` failing under the file lock: −2 on patterns. Fallback: release the lock just before the call, which is the requirements' original C11 posture.
  - Environment creation failing in `setup()` even with COM initialised: −2 on patterns. Fallback: the rejected alternative from Key decisions, a `[patch.crates-io]` wry whose own `create_environment` also sets `IsCustomCrashReportingEnabled`, with the flags back in `additionalBrowserArgs`.
  - A vendor GPU DLL not found under `SetDefaultDllDirectories(System32)`: −2 on patterns. Fallback: preload `%SystemRoot%\System32\<dll>` by full path before `Open`; LHM's later bare-name `LoadLibrary` then returns the module already loaded.
- **Next checks, in task order:**
  - step 2's first `tauri dev` run (environment creation in `setup()`);
  - E2E-19 (every class of ban fails the build);
  - IT-12 (spawn under the lock);
  - E2E-02 (elevation under the lock, UAC in the foreground, GPU sensors with the DLL restriction);
  - E2E-15 (network sign-off; OQ13 gates v0.1.0 sign-off, not tasks).

## Out-of-scope

| Item | Why | Revisit |
|---|---|---|
| Renaming sensors and storing labels | Slice 2. v0.1.0 fixes the key the labels will use (`sensor_key`), so v0.2.0 needs no schema change. | [v0.2.0](../v0.2.0/README.md) |
| Benchmarks, the 250 ms caller, SQLite, the run list, the "Run one test" / "Run all" buttons, the Runs nav item | Slices 3–7. `set_period` exists in schema v1 (#40), but nothing calls it from the UI. The buttons and the Runs nav item are hidden, not shown disabled. | [v0.3.0](../v0.3.0/README.md)–[v0.7.0](../v0.7.0/README.md) |
| Runs page, export | Slice 8 | [v0.8.0](../v0.8.0/README.md) |
| Startup sweep of disk temp files | It belongs to the disk test (RF18) | [v0.6.0](../v0.6.0/README.md) |
| "GPU · discrete / integrated" labels, and a GPU order based on them | LHM doesn't say which is which. D3D12 `UMA` (v0.5.0) does. v0.1.0 shows "GPU" and orders GPUs by `GPU Memory Total` (see [Card field rules](#card-field-rules-lhm--card)). | [v0.5.0](../v0.5.0/README.md) |
| Drive letter on the Disk card ("Disk · C:") | Needs volume mapping, which the drive picker needs anyway | [v0.6.0](../v0.6.0/README.md) |
| Over-the-shoulder elevation (C6), building LHM's NuGet deps from source, the installer, signing | Public release (answers #4, #26) | Public release |
| OQ14, a reproducible NativeAOT helper | Non-blocking (requirements) | Public release |
| A full generated notice list for every transitive Rust/npm package | Built from source for the owner. THIRD-PARTY-NOTICES covers the Dependencies table. | Public release (installer) |
| Matching the native title bar to the in-app theme override | Cosmetic. Calling `setTheme` would hide the real Windows theme from `prefers-color-scheme` (see [Key decisions](#key-decisions)). | When it bothers the owner |

## Architecture

```
 ┌──────────────────────── pophood.exe (unprivileged, single instance) ─────────────────────────┐
 │  React UI (WebView2, own environment, CSP, navigation pinned)                                 │
 │    SensorStore ── keeps 10-min history ── Dashboard / SensorList / About                      │
 │        ▲  Channel<SensorEvent> (status, frame)          │ invoke: enable_full_sensors, …      │
 │  ──────┼────────────────────────────────────────────────┼─────────────────────────────────── │
 │  Rust core  SensorService (supervisor task) ◄───────────┘                                     │
 │     │ verify+lock image (SHA-256 compiled in) → launch → connect_verified (server PID check)   │
 └─────┼─────────────────────────────────────────────────────────────────────────────────────────┘
       │ \\.\pipe\pophood-<128-bit hex>   JSON lines, schema v1, DACL = user SID
       ▼
 ┌─ pophood-sensors.exe (NativeAOT WinExe; unprivileged, or elevated after one UAC prompt) ─┐
 │  PipeServer (FirstPipeInstance, client image path == --client) → hello                    │
 │  Sampler thread (sole owner of LHM Computer): deadline loop → Update → classify → frame   │
 │  Reader: ControlParser (≤1024 B, UTF-8, allow-list) → set_period → ack / error            │
 └─────────────────────── LibreHardwareMonitorLib 0.9.6 (submodule) → PawnIO (if installed) ─┘
```

**Components:**

| Component | Path | Role |
|---|---|---|
| Sensor helper | `helper/` | The only sensor source (Q21). Serves frames, validates the client and its messages, never changes hardware state, writes no files. |
| Helper tests | `helper.Tests/` | xunit tests for the pure parts: parser, classification, deadline maths, serialization |
| LHM | `third_party/LibreHardwareMonitor/` | Git submodule pinned at `3d331e3`, referenced as a ProjectReference |
| Core: supervisor | `src-tauri/src/sensors/mod.rs` | Owns helper lifetime and state, and forwards frames to the subscribed Channel |
| Core: helper image and process | `src-tauri/src/sensors/helper.rs` | Hash plus lock, unprivileged spawn, elevated `ShellExecuteExW`, terminate and wait |
| Core: pipe client | `src-tauri/src/sensors/pipe.rs` | Random name, connect with retry, server-PID check, bounded line I/O |
| Core: protocol | `src-tauri/src/sensors/protocol.rs` | Pipe message types, schema version, `sensor_key` |
| Core: UI contract | `src-tauri/src/sensors/events.rs` | `SensorEvent`, `SensorStatus`, `UiFrame` (serde, camelCase) |
| Core: webview | `src-tauri/src/webview.rs` | Own WebView2 environment, `BROWSER_ARGS`, main window, navigation pin |
| Core: commands | `src-tauri/src/commands.rs` | The four Tauri commands |
| UI | `src/` | Store, card rules, charts, shell, pages |
| Scripts | `scripts/` | `build-helper.ps1`, `audit-network.ps1` |

**Workflow: app start (reduced mode).**
1. `run()` first checks its own token (`TokenElevation`). If `pophood.exe` is elevated (Run as administrator, an elevated terminal, or UAC turned off), it shows a message box, "Pophood never runs as administrator. Start it normally.", and exits with code 1 (C1).
2. The single-instance plugin runs next. A second process focuses the first window and exits before `setup`.
3. `setup()` runs on the main thread. It:
   1. initialises COM there (`CoInitializeEx(STA)`). With `create: false` no window exists yet, so neither tao (`OleInitialize`) nor wry (`CoInitializeEx` in `new_in_hwnd`) has done it;
   2. creates `app_local_data_dir()`, then the WebView2 environment in it;
   3. builds the `main` window (`create: false` in the config);
   4. starts `SensorService`.

   If any of this fails, it shows a message box with the error and exits with code 1. A `setup` error would otherwise be a silent `panic!` in a `windows_subsystem = "windows"` build.
4. The supervisor:
   1. resolves `<exe dir>\pophood-sensors.exe`;
   2. opens it with `FILE_SHARE_READ` only, hashes it through that handle and compares the hash with `POPHOOD_HELPER_SHA256`;
   3. on success, spawns it with `--pipe pophood-<hex> --client <current_exe>` and `CREATE_NO_WINDOW`, then drops the lock;
   4. connects, polling every 50 ms for up to 10 s, and stops early if the child has already exited (its exit code goes into the notice `detail`);
   5. checks `GetNamedPipeServerProcessId == child.pid`.
5. The helper:
   1. restricts DLL loading to System32: `SetDefaultDllDirectories` before anything can load a vendor DLL, then `DllSearch.TryConfine()` before the first lazy P/Invoke (T15);
   2. creates the pipe (DACL = user SID, `FirstPipeInstance`);
   3. accepts a client and checks its image path against `--client` (a mismatch disconnects it and keeps listening, within 30 s);
   4. sends `hello {v:1, elevated:false, pawnIo}`;
   5. opens LHM on its sampler thread, sends the first frame right after `Open`, then one every 1000 ms on a deadline schedule.
6. The core checks `v == 1` on every line, adds `key` to each sensor, and sends `frame` events. The first frame moves the status to `live`.

**Workflow: Enable full sensors.**
1. The UI calls `enable_full_sensors`. The supervisor sets `elevation: prompting` and re-verifies and locks the image.
2. On a blocking thread it initialises COM (`CoInitializeEx(STA)`, as Microsoft's `ShellExecuteEx` docs ask) and calls `ShellExecuteExW(verb "runas", SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC, SW_HIDE)` with a **new** pipe name and the `main` window's HWND as the owner, so the UAC prompt comes to the foreground.
3. The outcome:
   - `ERROR_CANCELLED` → notice `uac_cancelled`.
   - Any other error → `elevation_failed`.
   - Success → `elevation: connecting`. Throughout, **the unprivileged helper keeps streaming.**
4. The core connects to the new pipe and checks the server PID against `GetProcessId(hProcess)`. It requires `hello.elevated == true` and a first frame within 20 s of `ShellExecuteExW` returning.
   - **On success:** the elevated connection becomes the frame source. The core closes the old pipe; the old helper exits on disconnect, and is terminated if it's still alive after 3 s.
   - **On timeout:** the core terminates the elevated process through the `hProcess` that `ShellExecuteExW` returned, sets the notice `elevation_timeout` and stays unprivileged. (P2 E2 saw `TERMINATE` granted to a fresh medium-integrity `OpenProcess`, but only on the console; E2E-04 asserts the termination through this handle.)
5. **If the unprivileged helper fails while elevation is in flight**, the phase becomes `reconnecting` at once, but no unprivileged restart starts until the elevation outcome is known (see the [state machine](#supervisor-state-machine)).

**Workflow: app exit.**
1. `RunEvent::Exit` triggers `shutdown_blocking()`.
2. It drops every pipe connection, so the helpers run `computer.Close()` and exit 0.
3. It waits for all helper processes together, against one 3 s deadline (`WaitForMultipleObjects`), then calls `TerminateProcess` on any still running. Requirement: gone within 5 s, even with two helpers during elevation.
- **On a crash or kill:** the OS closes the pipe handle, and the helper sees EOF and exits.
- **If the app dies before the helper connects** (for example during the UAC prompt), the 30 s rule applies.

**Data flow, per frame:** LHM `Update()` → helper walk (hardware + sensors, `null` where untrustworthy) → JSON line → core `parse_line` + `sensor_key` → the supervisor forwards it only if its `t` is newer than the last forwarded frame's (the switch to the elevated source can reorder them) → `UiFrame` over the Channel (~30 KB, delivered through Channel `fetch`, ordered by index) → `SensorStore.applyFrame` (latest frame + appended history, trimmed to 10 min) → `buildDashboard()` → cards and charts. A frame-age watchdog in the store marks values stale when no frame has arrived for 3 periods.

## Design

### Patterns reused

Every citation below was read during this techspec. Line numbers are hints that drift; the anchor is the symbol.

| Pattern | Source | Usage here |
|---|---|---|
| Pipe server: `NamedPipeServerStreamAcl.Create(name, InOut, 1, Byte, Asynchronous \| FirstPipeInstance, …)`, DACL with the user SID ReadWrite | `pophood-probes/probe-pipe/helper/Program.cs → NamedPipeServerStreamAcl.Create (≈:13-49)` | `helper/PipeServer.cs → Create` |
| Client check: `GetNamedPipeClientProcessId` → `OpenProcess(0x1000)` → `QueryFullProcessImageNameW`; a mismatch does `Disconnect()` and keeps listening | `probe-pipe/helper/Program.cs → VerifyClient (≈:227-236)`, `Native.ImagePath (≈:313-326)` | `PipeServer.AcceptVerifiedClient` |
| Control validation order (`MaxLine 1024`, `Utf8.IsValid`, `JsonDocument` with MaxDepth 2 and no duplicates, field allow-list, version, type, range) plus the catch-all | `probe-pipe/helper/Program.cs → ParseControl (≈:243-282)`, `ReadLoop (≈:140-164)`, `Handle` catch (≈:119-120) | `helper/ControlParser.cs` |
| Deadline loop: the normal step advances from the previous **deadline**, `next += p; while (next < now) next += p` (≈:206), never from the measured wake time; on a period change, `next = max(lastTick + p, now)` (≈:188); each sample is stamped at its tick's start (`tMs = tick`, ≈:193-201) | `probe-pipe/helper/Program.cs → SampleLoop (≈:168-208)` | `helper/Deadline.cs`, `Program.cs` sampler. Changed: an `AutoResetEvent` replaces P2's `Task.Delay`/`TaskCompletionSource` race, and a synchronous `lock(writeGate)` replaces P2's `SemaphoreSlim`. |
| 30 s accept window, a fixed deadline from pipe creation that a rejected client doesn't reset; exit on EOF or `IOException` | `probe-pipe/helper/Program.cs` (≈:54-71, ≈:210-225) | `helper/Program.cs`. P2 has no exit code 70, and its argument parsing throws on a missing value, so both are new. |
| The 22-case fuzz corpus | `probe-pipe/client/src/main.rs → fuzz()` `cases` (≈:249-272) | `helper.Tests/ControlParserTests.cs`, `src-tauri/tests/helper_pipe.rs` |
| Connect with retry on OS error 2/231 every 50 ms; `GetNamedPipeServerProcessId(HANDLE(client.as_raw_handle()))` | `probe-pipe/client/src/main.rs → connect (≈:65-78)`, `server_image (≈:37-56)` | `sensors/pipe.rs → connect_verified`, which checks the PID instead of the image path |
| LHM toggle names (not values: the spike sets `IsControllerEnabled = true` and never sets `IsPowerMonitorEnabled`); `LibreHardwareMonitor.PawnIo.PawnIo.IsInstalled`; elevation via `WindowsPrincipal.IsInRole(Administrator)` | `pc-bench-spike/helper/SensorHelper/Program.cs` (≈:16, ≈:32-40, ≈:50) | `helper/SensorReader.cs → CreateComputer`, `Program.cs`. Not the spike's `StreamWriter` frame writes (≈:43) or `File.AppendAllText` log (≈:13): both types are banned, so frames use P2's `Utf8JsonWriter` path. |
| Recursive `hw.Update()` plus `SubHardware`, because the library has no `Computer.Update` | `pc-bench-spike/helper/SensorProbe/Program.cs → UpdateVisitor (≈:49-59)`; LHM `Hardware/Computer.cs` (no `Update`) | `SensorReader.UpdateAndSnapshot` |
| Source-generated JSON context, camelCase | `SensorHelper/Program.cs → HelperJson (≈:71-73)` | `helper/Protocol.cs → HelperJson` |
| AOT csproj flags (`PublishAot`, `InvariantGlobalization`, `net10.0-windows`) | `SensorHelper/SensorHelper.csproj` | `helper/PophoodSensors.csproj` |
| Hidden spawn with `CREATE_NO_WINDOW` | `pc-bench-spike/tauri-hello/src-tauri/src/lib.rs → start_unprivileged (≈:14-21)` | `sensors/helper.rs → launch_unprivileged` |
| Elevate with a handle: `ShellExecuteExW` + `SEE_MASK_NOCLOSEPROCESS \| SEE_MASK_NOASYNC` | crate `runas` 1.2.0 `src/impl_windows.rs` (requirements precedent) | `sensors/helper.rs → launch_elevated` |
| Elevate, then fall back to unprivileged | `tauri-hello/src-tauri/src/lib.rs → enable_full_sensors (≈:41-53)` | Supervisor. Changed: the unprivileged helper keeps running until the elevated one delivers a frame. |
| Subscription with cleanup on unmount | `tauri-hello/src/App.tsx` `useEffect` listen/unlisten (≈:24-31) | `src/sensors/store.ts → start()` returns a dispose function |
| WebView2 environment creation (`CreateCoreWebView2EnvironmentWithOptions` + `webview2_com::wait_with_pump`), **including its precondition**: wry reaches it only after `CoInitializeEx(None, COINIT_APARTMENTTHREADED)` in `new_in_hwnd` (≈:115) | `wry-0.57.0/src/webview2/mod.rs → InnerWebView::create_environment (≈:289-362)`, `new_in_hwnd (≈:115)`; tao `platform_impl/windows/window.rs → create_window_data` (`OleInitialize`, ≈:1140) is the only other COM init, and it needs a window | `src-tauri/src/webview.rs → create_environment`, which calls `CoInitializeEx` itself |
| A supplied environment skips wry's own (its data directory, browser args, extensions and scroll-bar settings are then ignored) | `wry-0.57.0/src/webview2/mod.rs → new_in_hwnd` (≈:131-135); `tauri-2.12.4/src/webview/webview_window.rs → WebviewWindowBuilder::with_environment (≈:1432)` | `webview.rs → build_main_window` |
| A `setup` error is a `panic!("Failed to setup app: {e}")` | `tauri-2.12.4/src/app.rs` (≈:1442-1446) | `lib.rs` shows a message box and exits instead |
| Navigation filter; the dev URL vs `http://tauri.localhost` is chosen by `cfg(dev)`, not `debug_assertions` | `tauri-2.12.4/src/webview/webview_window.rs → on_navigation (≈:266)`, `on_new_window (≈:315)`; `src/manager/mod.rs` (≈:345-353, ≈:786-791) | `webview.rs → is_app_url` |
| Config windows are built before `setup`, hence `create: false` | `tauri-2.12.4/src/app.rs → fn setup (≈:2691-2698)` | `tauri.conf.json` |
| Sidecar `-<triple>.exe` copied next to the exe; a missing file fails the compile | `tauri-build-2.7.3/src/lib.rs → copy_binaries (≈:139-168)`; `tauri-utils-2.10.2/src/resources.rs` (≈:46-61, ≈:205-207) | `bundle.externalBin`, `build.rs` |
| Channel: eval when under 8192 B JSON, else `plugin:__TAURI_CHANNEL__\|fetch`; ordered by index; `fetch` is exempt from the ACL | `tauri-2.12.4/src/ipc/channel.rs` (≈:36-38, ≈:284, ≈:293-322); `webview/mod.rs → on_message` (≈:2082) | `commands.rs → subscribe_sensors` |
| App commands allowed for local-origin windows when there's no app manifest | `tauri-2.12.4/src/webview/mod.rs → on_message` (≈:2077-2108) | No capability files |
| Single instance via a named mutex and `WM_COPYDATA`, registered first | https://v2.tauri.app/plugin/single-instance/ (plugin 2.5.4) | `lib.rs → run` |
| SVG drawing: `M/L` paths, `viewBox` 300×60 (sparkline) and 600×200 (history chart), `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`, axes in HTML; the Disk sparkline's two lines (write in `s2`, dash `4 3`, no area); the drill-down chart's 600×160 single series with an area at 0.1 and no y-axis | `ui-proposal/mockups/dashboard.dc.html` (sparkline ≈:115, Disk ≈:201, history chart ≈:251-264), `sensors-motherboard.dc.html` (drill-down chart ≈:84-85) | `src/charts/path.ts`, `Sparkline.tsx`, `LineChart.tsx` |
| Colour tokens, type scale, spacing | `ui-proposal.md` → Colour tokens; Type, spacing and icons | `src/theme/tokens.css` |
| Elevated capture with the app unelevated; pktmon + Kernel-Network/DNS ETW; process-tree attribution | `pophood-probes/probe-net/pktmon-capture-unelev.ps1`; skill draft `sessions/20261020214713…/skills/webview2-network-audit.md` | `scripts/audit-network.ps1` |
| Identifier as the key base, made unique | ADR 0008. P1 dumps: `Identifier`+`Name` is unique in all 6 dumps; the only duplicate `Identifier` is `/gpu-nvidia/0/load/3`. | `protocol.rs → sensor_key` |
| AMD sensor set: no per-core temperatures outside Raven Ridge's SMU table (`RyzenSMU.cs` ≈:37-40); `CCDn (Tdie)` created lazily, `CCDs Max/Average (Tdie)` only with more than one CCD; `Cores (Average)` is the nominal clock, `Cores (Average Effective)` the effective one | LHM `Hardware/Cpu/Amd17Cpu.cs → Processor.UpdateSensors (≈:290-363)`, sensor names (≈:132-141, ≈:327-354) | `src/cards/fields.ts` CPU rules |
| Intel per-core names: `CPU Core #n`, or `P-Core #n` / `E-Core #n` on hybrid CPUs; `Core Max` temperature | LHM `Hardware/Cpu/IntelCpu.cs` (≈:340-345, ≈:359) | `fields.ts` "Hottest core" suffix |
| Intel iGPU `GPU Power` comes from the PawnIO MSR module (fake 0 W without it) | LHM `Hardware/Gpu/IntelIntegratedGpu.cs` (`new IntelMsr()` ≈:41, `GPU Power` ≈:82-90) | `Availability.cs` |
| `tCKAVGmin (Minimum Cycle Time)` timing sensor (ns), with the same name for DDR4 and DDR5 | LHM `Hardware/Memory/DimmMemory.cs → CreateSensorsDDR4 (≈:84)`, `CreateSensorsDDR5 (≈:106-136)` | OC-profile rule |
| SMBIOS `MemoryDevice`, read unprivileged: `Size = GetWord(0x0C)` in **MiB**, extended through `GetDword(0x1C)` when it is `0x7FFF`; `0xFFFF` (unknown) passes through raw; `Type` is the `MemoryType` enum (`DDR5 = 0x22`); `ConfiguredSpeed` in MT/s; `MemoryDevices` stays **null** if the RSMB read fails | LHM `Hardware/SMBios.cs → MemoryDevice (≈:1079-1150, ≈:1091-1094)`, `SMBios` ctor (≈:1196-1197), `FirmwareTable.cs` (≈:17-62) | `SensorReader` memory facts |
| Zero-filled buffers without PawnIO; the device path `\\?\GLOBALROOT\Device\PawnIO`; no public "driver loaded" check (`IsLoaded` is an instance property, and no instance is reachable) | LHM `PawnIo/PawnIo.cs → Execute (≈:98-120)`, `LoadModuleFromResource (≈:65-90)`, `IsLoaded (≈:59-63)` | `helper/Availability.cs`, including `PawnIoDevicePresent` |
| `ValuesTimeWindow` defaults to 1 day per sensor; setting `TimeSpan.Zero` clears `Values` and stops appending | LHM `Hardware/Sensor.cs` (≈:26, setter ≈:154-163, `Value` ≈:115-132) | `SensorReader` sets `TimeSpan.Zero` |
| Vendor GPU DLLs are loaded by bare name (`PInvoke.LoadLibrary`), so the application directory is searched first; LHM never calls `SetDefaultDllDirectories` | LHM `Interop/NvApi.cs` (≈:259), `Interop/AtiAdlxx.cs` (≈:184), `Interop/IntelGcl.cs` (≈:217), `Interop/NvidiaML.cs` (≈:174) | `helper/Program.cs` calls `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` first |
| LHM changes its own hardware lists on other threads: the DIMM retry runs on the thread pool, and DiskInfoToolkit's `StorageManager` threads drive `StorageGroup.OnStoragesChanged`. `Computer.Hardware` returns a new list built under LHM's lock, but enumerating a group's list can still race. | LHM `Hardware/Memory/MemoryGroup.cs → StartRetryTask (≈:125-142)`, `Storage/StorageGroup.cs → OnStoragesChanged (≈:48-70)`, `Computer.cs → Hardware (≈:79-91)`; `StorageManager` from decoded IL (not run) | `SensorReader.UpdateAndSnapshot`, and the sampler's per-tick exception policy |

### Interfaces

**Helper (C#, `helper/`):**
```
static class ControlParser
  Parse(ReadOnlySpan<byte> line) -> ControlResult        // Accepted(SetPeriod ms) | Rejected(code, detail)
static class Availability
  IsTrustworthy(HardwareType hw, SensorType type, bool pawnIoUsable) -> bool
  PawnIoDevicePresent() -> bool                          // elevated only: \\?\GLOBALROOT\Device\PawnIO opens
static class Deadline
  Next(long previousDeadlineMs, long periodMs, long nowMs) -> long     // from the previous deadline, never the wake time
  AfterPeriodChange(long lastTickMs, long newPeriodMs, long nowMs) -> long
static class PipeServer
  Create(string pipeName) -> NamedPipeServerStream       // IOException/UnauthorizedAccess = name taken
  AcceptVerifiedClient(NamedPipeServerStream pipe, string expectedClient, TimeSpan remaining) -> bool
sealed class SensorReader : IDisposable                  // used only on the sampler thread
  static CreateComputer() -> Computer                    // the fixed toggles; no ISettings
  SensorReader(Computer computer, bool pawnIoUsable)     // calls Open(); tests pass a Memory-only Computer
  UpdateAndSnapshot() -> FrameBody                       // memory, hardware, sensors (null = untrustworthy)
```

**Core (Rust, `src-tauri/src/sensors/`):**
```
// helper.rs
pub struct HelperImage { file: std::fs::File, path: PathBuf }      // file held open with FILE_SHARE_READ only
impl HelperImage { pub fn open_verified(path: &Path, sha256_hex: &str) -> Result<Self, ImageError> }
pub fn launch_unprivileged(img: &HelperImage, pipe: &str, client: &Path) -> io::Result<HelperProcess>
pub fn launch_elevated(img: &HelperImage, pipe: &str, client: &Path, owner: isize /* HWND */) -> Result<HelperProcess, ElevateError>
pub struct HelperProcess { handle: OwnedHandle, pub pid: u32 }
impl HelperProcess { pub fn exit_code(&self) -> Option<u32>; pub fn terminate(&self) }
pub fn wait_all(procs: &[&HelperProcess], timeout: Duration) -> bool   // one shared deadline
// pipe.rs
pub fn new_pipe_name() -> String                                    // "pophood-" + 32 lowercase hex
pub async fn connect_verified(name: &str, child: &HelperProcess, deadline: Instant) -> Result<HelperConnection, PipeError>
                                                                    // checks child.exit_code() between retries, then the server PID
impl HelperConnection { pub async fn next_message(&mut self) -> Result<HelperMessage, PipeError>;
                        pub async fn send(&mut self, msg: &ControlMessage) -> io::Result<()> }
```
```
// protocol.rs
pub const SCHEMA_VERSION: u32 = 1;
pub fn parse_line(line: &[u8]) -> Result<HelperMessage, ProtocolError>   // SchemaMismatch(u32) | Malformed(String)
pub fn sensor_key(id: &str, name: &str) -> String                        // "{id}|{name}"
// mod.rs
pub struct SensorService { tx: mpsc::UnboundedSender<Command> }
impl SensorService { pub fn start(app: AppHandle) -> Self; pub fn subscribe(&self, ch: Channel<SensorEvent>);
                     pub fn enable_full(&self); pub fn retry(&self); pub fn shutdown_blocking(&self) }
fn transition(state: &State, event: Event) -> (State, Vec<Effect>)   // pure; the async loop runs the effects
// Event:  Verified | VerifyFailed(ImageError) | Launched | Connected | Hello | Frame | LineError | Eof | Timeout
//         ChildExited(code) | HelperFatal(lhm_failed) — each connection event carries Source::{Unprivileged, Elevated}
//         ElevateRequested | ElevateResult(..) | RestartTimer | RetryRequested | LiveFor60s | Exit
// Effect: Verify | Launch{elevated} | Connect | SwitchSource | Terminate(which) | StartTimer(d) | Emit(status)
```

**UI (TypeScript, `src/`):**
```
// sensors/store.ts
createSensorStore(): SensorStore
SensorStore.start(): Promise<() => void>          // invoke("subscribe_sensors", { onEvent: Channel })
useSensorStatus(): SensorStatus
useFrame(): { frame: UiFrame | null; stale: boolean }   // stale: phase ≠ live, or no frame for 3 × periodMs
useSeries(key: string): Series | undefined        // { t: number[]; v: (number | null)[] }, ≤ 10 min
// cards/fields.ts
buildDashboard(frame: UiFrame | null, status: SensorStatus): DashboardModel   // null → the "starting" model
componentScope(frame: UiFrame, cardId: string): string[]                // hardware ids for the drill-down
gpuOrder(frame: UiFrame): string[]                // Gpu* ids, largest "GPU Memory Total" first, ties in LHM order
jedecSpeed(tckNs: number): number                 // nearest JEDEC bin to 2000 / tCK
// charts/path.ts
linePath(s: Series, domain: [number, number], w: number, h: number, nowMs: number, windowMs: number): string
areaPath(s: Series, domain: [number, number], w: number, h: number, nowMs: number, windowMs: number): string
                                                  // each non-null segment closed to the baseline on its own
```

### Implementation map

Each entry gives the file, Create or Modify, what it does and why, the pattern it follows, and its tests. Before/after snippets apply only to Modify entries, and there are three.

**Repo and build:**

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `.gitignore` | C | Ignores `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/binaries/`, `helper/bin/`, `helper/obj/`, `helper.Tests/bin/`, `helper.Tests/obj/` | — | — |
| `.gitmodules`, `third_party/LibreHardwareMonitor` | C | Submodule `https://github.com/LibreHardwareMonitor/LibreHardwareMonitor.git` at `3d331e3370efb858411f19511373eff65a218701` (C4, RF30's source location) | requirements C4 | E2E-24 |
| `nuget.config` | C | `<packageSources><clear/><add key="nuget.org" value="https://api.nuget.org/v3/index.json"/></packageSources>`. One feed only, for the helper and for LHM's restore. Don't add `Directory.Packages.props` or `Directory.Build.targets` at the root: LHM would pick them up (NU1008). | LHM build layout (no CPM) | — |
| `scripts/build-helper.ps1` | C | Runs `dotnet publish helper -c Release -r win-x64 -p:RestoreLockedMode=true -p:GeneratePackageOnBuild=false -o helper/bin/publish`, after checking `vswhere` is on PATH (C10). Copies **only** `pophood-sensors.exe` to `src-tauri/binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` (so the Mono.Posix DLLs never ship; OQ8). Prints the SHA-256. **T15 (BUG-T14-01):** publishes with `-p:IlcGenerateMapFile=true` and fails when the ILC map has a P/Invoke module (`__nativemodule_<assembly>__Module__<library>`) without a System32-only search path in an assembly `DllSearch` doesn't cover. | `pophood-probes/REBUILD.md`, P4 `build.ps1` style | E2E-24 |
| `scripts/audit-network.ps1` | C | Port of `pktmon-capture-unelev.ps1`, with these changes: `-UserDataMarker` defaults to `dev.pophood`; no `-ExtraBrowserArgs`, because the flags are compiled in; **don't port** the source's hard-coded deletion of a `%LOCALAPPDATA%` folder (≈:85-86): an opt-in `-FreshProfile` switch deletes only `%LOCALAPPDATA%\dev.pophood\EBWebView`, so the theme override and local crash dumps survive; the force-kill (≈:88) is limited to processes whose path is the `-ExePath` folder's `pophood.exe` and `pophood-sensors.exe`; drop the comment that relies on `tauri.conf.json` browser args; a system-wide DNS listing for `substrate.office.com`, `odc.officeapps.live.com`, `hrd.svc.cloud.microsoft` and `login.live.com` during the window (OneAuth may delegate outside the tree); a browser-process command-line check for `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1`; and a `-Quick` mode (no capture, no admin) that runs only that check. **Follow-ups session (2026-10-22; owner: "All four, one capture (Recommended)"):** it closes the app by its `Tauri Window` class (`CloseMainWindow()` missed in T14 run 2) and fails a run the close didn't end; it records every process seen each second (name, parent, services) to name each watch-list requester, and the WAM / OnlineId DLLs loaded in the tree's WebView2 processes; it applies ADR 0024 (a `login.live.com` lookup by `wlidsvc`, or by Dnscache within 2 s of one, outside the tree, after such a load, is recorded, not failed); and it takes pktmon's remote IPv4 addresses only from each packet's address pair (T14 observation 8). | P5 method | E2E-15 |
| `package.json`, `package-lock.json` | C | Every version exact (`npm install --save-exact`), and the lock file committed. Known pins: `react`, `react-dom` 19.3.1, `@tauri-apps/api` 2.12.4 (as in the spike's `node_modules`), `vite` 8.3.4, `typescript` 6.0.3, `@tauri-apps/cli` 2.12.3. The rest are pinned to their current release when task 2 runs: `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@vitejs/plugin-react`, `vitest`, `@testing-library/react`, `jsdom`. Scripts: `dev`, `build` (`tsc -b && vite build`), `test` (`vitest run`), `tauri`, `build:helper` (`pwsh -File scripts/build-helper.ps1`). | create-tauri-app react-ts | — |
| `index.html`, `vite.config.ts`, `tsconfig.json` | C | Vite on port 1420 (`strictPort`). `build.assetsInlineLimit: 0`, so no `data:` URIs: fonts are files under `font-src 'self'`. **No `<style>` element in `index.html`**: one would make Tauri add a nonce to `style-src`. | Tauri 2 project layout | — |
| `src-tauri/Cargo.toml`, `Cargo.lock` | C | Package `pophood` 0.1.0 (edition 2024); lib `pophood_lib` (`rlib` only; the mobile template's `staticlib` and `cdylib` were dropped in the T12 review, O2). Deps: `tauri` 2.12.4, `tauri-plugin-single-instance` 2.5.4 (from the plugin docs; it isn't in the local cargo cache, so confirm the version when task 2 runs), `serde`, `serde_json`, `tokio` 1.54 (`net`, `io-util`, `time`, `sync`, `macros`, `rt`), `webview2-com` 0.39.1 (tauri doesn't re-export it; all of tauri, runtime-wry and wry use 0.39, so the COM types unify), `sha2`, `getrandom` (`tauri::Url` is re-exported, so no `url` dependency), and `windows` 0.62.2 with features `Win32_Foundation`, `Win32_Security` (`TokenElevation`), `Win32_Storage_FileSystem`, `Win32_System_Com` (`CoInitializeEx`), `Win32_System_Pipes`, `Win32_System_Registry`, `Win32_System_Threading`, `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging` (`MessageBoxW`, `SW_HIDE`). Build deps: `tauri-build` 2.7.3, `sha2`. Dev deps: `windows` with the extra feature `Win32_Security_Authorization`, for IT-14 and the access-denied IT-09 case. | Tauri agent's feature list (`ShellExecuteExW` is gated on `Win32_System_Registry`) | — |
| `src-tauri/build.rs` | C | Hashes `binaries/pophood-sensors-{TARGET}.exe` **before** `tauri_build::build()` (which exits on error). Emits `cargo:rustc-env=POPHOOD_HELPER_SHA256=<hex>` and `cargo:rerun-if-changed=<path>`. A missing file fails the build with "run npm run build:helper first". This is the build-written manifest, compiled into `pophood.exe` (#39). | Tauri agent §5 | UT-13 |
| `src-tauri/tauri.conf.json` | C | `productName` "Pophood", `version` "0.1.0", `identifier` "dev.pophood" (#36). `build.beforeDevCommand` "npm run dev". `beforeBuildCommand` "npm run build:helper && npm run build". `devUrl` http://localhost:1420, `frontendDist` "../dist". `app.windows`: one entry, `label` "main", `title` "Pophood", 1280×860, `minWidth` 1024, `minHeight` 680, `center`, **`create: false`**. **No `additionalBrowserArgs`**: it would be silently ignored with our environment, so the flags live only in `webview.rs`. `app.security.csp` = [CSP](#fixed-source-parameters). `withGlobalTauri` false. `bundle.externalBin` ["binaries/pophood-sensors"]. `bundle.icon` from `icons/`. No plugins config. | requirements Proposed structure; Tauri agent §1, §4, §5 | E2E-15, E2E-20 |
| `src-tauri/icons/*` | C | Generated with `npm run tauri icon` from a 1024 px PNG of the mockup's hood mark | — | — |
| *(no `src-tauri/capabilities/`)* | — | The UI calls only app commands and a Channel. Neither needs a capability without an app manifest (Tauri agent §2, §3). No `core:default`, so no window, menu or tray APIs are reachable from JS. If `tauri-build` refuses to build with no capability file, add `capabilities/main.json` with `"windows": ["main"]` and an empty `permissions` list. | C6 minimal capabilities | E2E-20 |

**Helper (`helper/`):**

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `helper/PophoodSensors.csproj` | C | `OutputType` **WinExe** (no console in either launch mode); `net10.0-windows`; `RuntimeIdentifier` win-x64; `AssemblyName` `pophood-sensors`; `Version` 0.1.0; `PublishAot`; `InvariantGlobalization`; `Nullable`; `ImplicitUsings`; `AllowUnsafeBlocks` (LibraryImport); `RestorePackagesWithLockFile`; `RestoreLockedMode` (T12 review, B6: a plain `dotnet build` or `test` can't rewrite the lock file); `WarningsAsErrors` RS0030; `<LinkerArg Include="/DEPENDENTLOADFLAG:0x800" />` (T12 review, R1: the non-KnownDLL static imports `bcrypt`, `CRYPT32`, `IPHLPAPI` load from System32 only; a planted `bcrypt.dll` next to the helper was loaded before the fix). `<LinkerArg Include="/DELAYLOAD:CRYPT32.dll" />` and `delayimp.lib` (T15, BUG-T14-01: the flag doesn't reach the imports' own imports; CRYPT32's flag is 0, and its delay import `DPAPI.dll` was resolved at process start, before `Main`, helper folder first). ProjectReference to LHM's `LibreHardwareMonitorLib.csproj`. `Microsoft.CodeAnalysis.BannedApiAnalyzers` (latest stable when implemented, `PrivateAssets=all`) with `AdditionalFiles` `BannedSymbols.txt`. `InternalsVisibleTo` `PophoodSensors.Tests`. | spike csproj | E2E-02, E2E-19, E2E-24 |
| `helper/packages.lock.json` | C | Generated by the first restore and committed. Covers the shipped closure: LHM's transitive packages appear as `Transitive` with `contentHash` (checked today with a scratch ProjectReference). | C4, #20 | build fails on drift (`RestoreLockedMode`) |
| `helper/BannedSymbols.txt` | C | The RF1 write surfaces and their public bypasses (persisting settings, hardware constructed outside `Computer`, the controller and PSU toggles), plus file-writing APIs (RF5) and process launching (RF6). List in [Data models](#bannedsymbolstxt-rf1-mechanical-check). | BannedApiAnalyzers | E2E-19 |
| `helper/WRITE-ALLOWLIST.md` | C | The RF1 allow-list with file:line at LHM `3d331e3` (read-path selects and the 4 monitoring-enablement writes, from P6), the toggles, the "never a persisting `ISettings`" rule, and the re-audit rule for LHM or dependency bumps (skill draft `lhm-write-path-audit`). RF1 says "the list lives in the repo". | requirements RF1, P6 | review |
| `helper/Protocol.cs` | C | Records `Hello`, `Frame`, `HardwareInfo`, `SensorInfo`, `MemoryModule`, `Ack`, `ErrorMessage`, each with `V` declared first so it's serialized first. `[JsonSourceGenerationOptions(PropertyNamingPolicy = CamelCase, DefaultIgnoreCondition = Never)]`, so nulls are written. `SchemaVersion = 1`. | spike `HelperJson` | UT-06 |
| `helper/ControlParser.cs` | C | P2's `ParseControl` order and codes, with `set_period` and `ms ∈ [250,1000]` as the only accepted message (#40). Never throws: a catch-all returns `internal_error` with the exception type name. | P2 `ParseControl` | UT-01…UT-03 |
| `helper/Availability.cs` | C | RF3 classification ([table](#availability-classification-rf3)). `pawnIoUsable = elevated && PawnIo.IsInstalled && PawnIoDevicePresent()`. **`PawnIoDevicePresent`** (elevated only) opens `\\?\GLOBALROOT\Device\PawnIO` with desired access 0, `OPEN_EXISTING`, and closes it at once: it fails when the driver isn't loaded, so an installed-but-dead PawnIO no longer lets fake zeros through. Evaluated once, before `Open`. | PawnIO zero buffers; LHM `LoadModuleFromResource` device path | UT-04, IT-02 |
| `helper/Deadline.cs` | C | Pure deadline maths from P2: `Next` steps from the previous deadline, never from the measured wake time (stepping from the wake time adds up to ~15.6 ms per tick at the default timer resolution) | P2 `SampleLoop` | UT-05 |
| `helper/SensorReader.cs` | C | `CreateComputer()` returns `new Computer { IsCpuEnabled, IsGpuEnabled, IsMemoryEnabled, IsMotherboardEnabled, IsStorageEnabled, IsPowerMonitorEnabled = true }`; every other toggle stays false, including `IsControllerEnabled` (#19, #30). It uses the default constructor (no `ISettings`). The `SensorReader` constructor calls `Open()` on the **sampler thread**. `UpdateAndSnapshot` takes `computer.Hardware` once per tick (a new list built under LHM's lock) and walks it and its `SubHardware` recursively: `Update()` first, then collect. It caches `Identifier.ToString()` per sensor (each get allocates). It sets `ValuesTimeWindow = TimeSpan.Zero` on any sensor where it isn't zero, so lazily created SuperIO sensors and late DIMMs are covered too. It builds `memory` from `computer.SMBios.MemoryDevices ?? []`, skipping entries whose `Size` is 0, `0xFFFF` or has bit 15 set (KiB granularity); `sizeGB = Size / 1024`. LHM itself mutates hardware lists on other threads (DIMM retry, storage hot-plug), so an exception here is handled by the sampler, not prevented. | spike `Read(hw)`; LHM `Computer.Hardware`, `SMBios.MemoryDevice`, `MemoryGroup.StartRetryTask` | UT-33, UT-36, IT-01, IT-02, IT-11, E2E-02 |
| `helper/PipeServer.cs` | C | `Create` uses P2's DACL and `FirstPipeInstance`, with in-buffer 4096 and out-buffer 65536. `AcceptVerifiedClient` loops `WaitForConnectionAsync` within the remaining window. A client whose image path (`Path.GetFullPath`, `OrdinalIgnoreCase`) isn't `--client` gets `Disconnect()` with nothing read or written. | P2 | IT-07, IT-08 |
| `helper/DllSearch.cs` | C (T15) | BUG-T14-01. NativeAOT binds a P/Invoke whose search path is missing or includes `AssemblyDirectory` (the framework's default) by loading `<helper folder>\<name>` **by full path** first; neither `SetDefaultDllDirectories` nor KnownDLLs stop a full-path load. `TryConfine()` gives `NativeLibrary.SetDllImportResolver` to the seven assemblies whose P/Invokes the ILC map shows without a System32-only path (CoreLib, System.Security.Principal.Windows, LHM, HidSharp, DiskInfoToolkit, RAMSPDToolkit-NDD, BlackSharp.Core). `Resolve` takes plain file names only and calls `LoadLibraryExW(name, LOAD_LIBRARY_SEARCH_SYSTEM32)`; it never returns 0 (that would fall back to the folder probe) and throws `DllNotFoundException` instead. | — | `DllSearchTests`, `dll-plant-check.ps1` |
| `helper/Native.cs` | C | `[LibraryImport]` for `SetDefaultDllDirectories`, `LoadLibraryExW` (`DllSearch`, T15), `GetNamedPipeClientProcessId`, `OpenProcess`, `QueryFullProcessImageNameW`, `CreateFileW` (the PawnIO device check only: access 0, `OPEN_EXISTING`), `CloseHandle`. The assembly carries `[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]`. | P2 `Native` | — |
| `helper/Program.cs` | C | **First statement:** `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)`; exit 70 if it fails. It must run before anything can load `nvapi64.dll`, `atiadlxx.dll`, `ControlLib.dll` or `nvml.dll`, which LHM loads by bare name (app directory first). All four live in System32 (NVML's fallback is an absolute path). **Second statement (T15):** `DllSearch.TryConfine()`, before the first lazy P/Invoke (the pipe setup binds CoreLib's ntdll); exit 70 if it fails. **Third statement (follow-ups session, ADR 0028):** set the process's `ProgramW6432` to `Environment.GetFolderPath(SpecialFolder.ProgramFiles)`; exit 70 if that is empty. NVML's fallback path is built from `%ProgramW6432%`, which a same-user `HKCU\Environment` value sets. Parses args: exactly `--pipe <pophood-[0-9a-f]{32}> --client <absolute path>`, else exit 64; a flag without a value is also 64 (P2's `args[++i]` threw). The `pophood-` prefix is part of the pipe name the helper validates. Then: create the pipe (exit 3 if taken), accept a verified client within 30 s (exit 4 if none), send `hello`, start the sampler thread and the read loop. **Sampler thread:** opens LHM, sends the **first frame right after `Open`** (the deadline schedule starts there), then waits on an `AutoResetEvent` until each next deadline, runs `UpdateAndSnapshot`, stamps the frame's `t` with the tick's start (P2), writes it under `lock(writeGate)` with a `Utf8JsonWriter` on the pipe stream (never `StreamWriter` or `File`, both banned), and computes the next deadline. **Per-tick exception policy:** an exception from `UpdateAndSnapshot` skips that frame; after 5 in a row the helper sends `error{code:"lhm_failed", detail: exception type}` and exits 70. **Read loop:** reads lines of at most 1024 B (dropping the rest up to `\n`, then replying `too_long`) and runs `ControlParser.Parse`. On `set_period` it sets the period, signals the event and sends `ack`; otherwise it sends `error`. Replies are written synchronously under the same `writeGate`. **Shutdown:** EOF or `IOException` on either side cancels; the sampler calls `computer.Close()`; the process exits 0. If LHM's `Open` throws, it sends `error{code:"lhm_failed"}` and exits 70. **It writes no files and no console output.** | P2 `Program` | IT-01…IT-17 |
| `helper.Tests/PophoodSensors.Tests.csproj`, `packages.lock.json` | C | xunit, `Microsoft.NET.Test.Sdk`, `xunit.runner.visualstudio` (all cached locally), with a lock file | — | — |
| `helper.Tests/ControlParserTests.cs`, `AvailabilityTests.cs`, `DeadlineTests.cs`, `ProtocolTests.cs`, `SensorReaderTests.cs`, `DllSearchTests.cs` (T15) | C | UT-01…UT-06, UT-33, UT-36; `DllSearchTests` pins the resolver's rules (System32 only, refusals throw, a copy in the app folder is ignored, the seven assemblies). `SensorReaderTests` uses a real `Computer { IsMemoryEnabled = true }` (`/ram` only: unprivileged, no hardware access). | — | — |

**Core (`src-tauri/`):**

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `src-tauri/src/main.rs` | C | `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] fn main() { pophood_lib::run() }` | Tauri template | — |
| `src-tauri/src/lib.rs` | C | `run()` first calls `refuse_if_elevated()`: `OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY)` + `GetTokenInformation(TokenElevation)`; if elevated, `MessageBoxW` ("Pophood never runs as administrator. Start it normally.") and `std::process::exit(1)` (C1). It then registers `tauri_plugin_single_instance::init` **first** among plugins; its callback unminimizes, shows and focuses `main`. In `setup`, `webview::build_main_window(app)` runs, then `.manage(SensorService::start(...))`, which spawns with `tauri::async_runtime::spawn` (`setup` has no tokio context, so `tokio::spawn` would panic). Any `setup` error is shown with `MessageBoxW` and ends in `exit(1)`, because a returned error is a silent `panic!` in this subsystem. `invoke_handler` lists the four commands. `.run(\|app, e\| if let RunEvent::Exit = e { if let Some(s) = app.try_state::<SensorService>() { s.shutdown_blocking() } })`. | single-instance docs; tauri `app.rs` setup panic | E2E-09, E2E-11, E2E-26 |
| `src-tauri/src/webview.rs` | C | `pub const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,msOneAuthWAM --disable-background-networking --disable-component-update --no-proxy-server";`. `create_environment(data_dir)` first calls `CoInitializeEx(None, COINIT_APARTMENTTHREADED)` (no window exists yet, so nothing else has; wry's own call comes later in `new_in_hwnd`, and an `S_FALSE` there is harmless) and `create_dir_all(data_dir)`. It builds `CoreWebView2EnvironmentOptions::default()` and sets `additional_browser_arguments = BROWSER_ARGS` and `is_custom_crash_reporting_enabled = true` (OQ15). It leaves every other option at its default: SSO false, extensions off. Unlike wry, it doesn't set `language`; WebView2's default applies. It calls `CreateCoreWebView2EnvironmentWithOptions(null, data_dir, options, handler)` and then `wait_with_pump`. `build_main_window(app)` takes the `main` config, adds `with_environment(env)` and `on_navigation(is_app_url)`, and builds. `on_new_window` returns `NewWindowResponse::Deny`. `is_app_url(url: &tauri::Url)` compares the parsed scheme, host and port exactly: `http` + `tauri.localhost` + no port, plus `http` + `localhost` + `1420` only when `cfg!(dev)` (Tauri picks the dev URL by `cfg(dev)`, not `debug_assertions`). It never uses a prefix match. | wry `create_environment` / `new_in_hwnd`; tauri `with_environment` / `on_navigation` | UT-12, E2E-15 |
| `src-tauri/src/commands.rs` | C | `subscribe_sensors(on_event: Channel<SensorEvent>)`, `enable_full_sensors()`, `retry_sensors()`, `open_pawnio_site() -> Result<(), String>`. The last calls `ShellExecuteW(None, "open", "https://pawnio.eu", …)` with the URL hard-coded and no argument from the UI. | Tauri agent §2 | E2E-14 |
| `src-tauri/src/sensors/protocol.rs` | C | `HelperMessage` (`#[serde(tag = "type", rename_all = "snake_case")]`: `Hello`, `Frame`, `Ack`, `Error`) and `ControlMessage::SetPeriod { ms }`. `parse_line` deserializes `Envelope { v: u32 }` first, so a version mismatch is reported even if the fields changed. A missing or non-numeric `v`, or bad JSON, gives `Malformed`. `sensor_key(id, name) = format!("{id}\|{name}")`: Identifier parts are `Uri.EscapeDataString`-encoded, so `\|` can't occur in an id. | ADR 0008 | UT-07, UT-08 |
| `src-tauri/src/sensors/events.rs` | C | The UI contract: `SensorEvent`, `SensorStatus`, `Phase`, `Elevation`, `Notice`, `NoticeCode`, `UiFrame`, `UiSensor`, `UiHardware`, `MemoryModule` ([Data models](#ui-contract-core--ui)). `UiFrame::from(frame, elevated)` adds `key`. | — | UT-28 |
| `src-tauri/src/sensors/helper.rs` | C | **`open_verified`:** `OpenOptions::new().read(true).share_mode(FILE_SHARE_READ.0).open(path)` (denies write and delete); SHA-256 through `sha2` over that `File`; lowercase-hex comparison; errors `Missing` (NotFound) and `HashMismatch { actual }`. **`launch_unprivileged`:** `Command::new(&img.path).args(["--pipe", pipe, "--client", client]).creation_flags(CREATE_NO_WINDOW).stdin/stdout/stderr(Stdio::null()).spawn()`, then `OwnedHandle::from(child)`. **`launch_elevated`:** `SHELLEXECUTEINFOW { lpVerb: "runas", lpFile, lpParameters: "--pipe <name> --client \"<path>\"", nShow: SW_HIDE, fMask: SEE_MASK_NOCLOSEPROCESS \| SEE_MASK_NOASYNC }` through `ShellExecuteExW`. `ERROR_CANCELLED.to_hresult()` maps to `ElevateError::Cancelled`, anything else to `Failed(String)`; pid = `GetProcessId(hProcess)`. The call runs on a blocking thread that first calls `CoInitializeEx(STA)` (Microsoft's `ShellExecuteEx` docs), with `hwnd` = the `main` window's HWND (passed as `isize`, since `HWND` isn't `Send`) so the consent prompt opens in the foreground; `nShow` is `SW_HIDE.0`. **`exit_code`:** `GetExitCodeProcess`, `None` while `STILL_ACTIVE`. **`wait_all`:** `WaitForMultipleObjects(…, bWaitAll = true, timeout)`. **`terminate`:** `TerminateProcess(h, 1)`. | spike, runas crate | UT-09, IT-12, E2E-02, E2E-03 |
| `src-tauri/src/sensors/pipe.rs` | C | `new_pipe_name` uses `getrandom` for 16 bytes. **`connect_verified`:** loops `ClientOptions::new().open(r"\\.\pipe\{name}")` every 50 ms on `NotFound` or OS error 231 until the deadline (`Timeout`); between retries it returns `ChildExited(code)` as soon as `child.exit_code()` is `Some`. Then it calls `GetNamedPipeServerProcessId` and compares it with `child.pid`. A mismatch drops the client **without writing** and returns `Squatter { pid }`. **`HelperConnection`:** a `BufReader` with lines capped at 4 MiB (`LineTooLong`), plus `send` (JSON + `\n`). | P2 client | UT-11, IT-01, IT-09 |
| `src-tauri/src/sensors/mod.rs` | C | `SensorService` plus the supervisor: one `tokio` task that owns all state and gets commands over mpsc. Each event goes through the pure `transition(&State, Event) -> (State, Vec<Effect>)` ([state machine](#supervisor-state-machine)); the async loop runs the effects (verify, launch, connect, terminate, timers, emit). Elevation runs `launch_elevated` in `spawn_blocking`, then `connect_verified`, as a sub-future raced in the same `select!` loop as the live connection. **The unprivileged helper failing during elevation** sets the phase to `reconnecting` at once (the elevation sub-state is kept) but defers the restart until the elevation outcome; see the [state machine](#supervisor-state-machine). **Only `error{lhm_failed}` from a helper counts as a failure**; other `error` codes are replies to control messages and are only logged (debug). **Forwarding:** a frame is forwarded only if its `t` is newer than the last forwarded frame's. **Restart policy:** up to 3 restart attempts, with delays `RESTART_DELAYS = [1s, 5s, 15s]` before attempts 1, 2 and 3. A failure after attempt 3 means `stopped`. A connection that stays live for 60 s resets the count. `shutdown_blocking` sends `Exit` to the supervisor and blocks on its reply: the supervisor drops the connections, runs `wait_all` with one 3 s deadline, then terminates whatever is left. Debug builds `eprintln!` each transition. | spike flow, changed | UT-10, UT-29, IT-*, E2E-02…E2E-10, E2E-25 |
| `src-tauri/tests/helper_pipe.rs` | C | IT-01…IT-17 against the real published helper (`binaries/pophood-sensors-x86_64-pc-windows-msvc.exe`), launched through `pophood_lib::sensors::{helper, pipe}` with `--client` set to the test binary's own path. The 30 s tests are `#[ignore]` (run with `cargo test -- --ignored`). | P2 `run-all.ps1` T1–T7 | — |

**UI (`src/`):**

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `src/main.tsx` | C | Imports the fonts (`@fontsource/ibm-plex-sans/latin-{400,500,600}.css`, `@fontsource/ibm-plex-mono/latin-{400,500}.css`), `theme/tokens.css` and `styles/app.css`. Calls `applyTheme()` **before** the first render (it sets `data-theme`), then renders `<App/>`. | — | — |
| `src/App.tsx` | C | The shell (`Sidebar` + `<main>`), page state `{ page: "dashboard" } \| { page: "sensors", cardId } \| { page: "about" }`, and `SensorStoreProvider`. No router. | mockup shell | E2E-12 |
| `src/theme/theme.ts` | C | `readOverride()` and `writeOverride()` use localStorage key `pophood.theme` inside try/catch. `systemTheme()` uses `matchMedia("(prefers-color-scheme: dark)")`. `applyTheme()` sets `document.documentElement.dataset.theme` to the effective theme. `toggleTheme()`: `next = effective === "dark" ? "light" : "dark"`; if `next === systemTheme()`, the override is cleared, otherwise stored (#35). Re-applies on a `matchMedia` change while there is no override. | — | UT-26, E2E-13 |
| `src/theme/tokens.css` | C | Tokens from ui-proposal.md under `:root[data-theme="light"]` and `:root[data-theme="dark"]`, plus `@media (prefers-color-scheme: dark) { html { background: #0A0F1A } }` to avoid a first-paint flash | ui-proposal tokens | — |
| `src/styles/app.css` | C | Layout from the mockups: nav `flex: 1 1 200px`, main `flex: 999 1 560px` with padding 28/32/40, card grid `repeat(auto-fill, minmax(300px, 1fr))` with gap 16, the radii and spacing, and `:focus-visible` with a 2 px accent outline and `outline-offset: 2px`. **Drill-down:** list `flex: 1 1 250px`, detail `flex: 999 1 400px` (the mockup's 300/460 bases need about 844 px, more than the ~743–760 px a 1024 px window leaves, so the detail would wrap below a ~1,170 px list). With 250/400 the pair needs 734 px and stays side by side down to 1024, even with a classic scrollbar. | mockup CSS | E2E-21, E2E-22 |
| `src/icons/Icons.tsx` | C | Inline 24-px stroke icons from the mockups: hood, sun, moon, shield-check, shield, PawnIO, no-network, lock. **New, not in any mockup:** warning (a triangle with an exclamation mark, same 2 px stroke), used by the blocking panels and the trust panel's "not running" row | mockup icons | — |
| `src/sensors/protocol.ts` | C | TS mirror of `events.rs`, hand-maintained and locked by the shared fixture `src/test/fixtures/event-frame.json` (UT-28) | — | UT-28 |
| `src/sensors/history.ts` | C | `appendFrame(map, frame)` pushes `(t, value)` per key, then drops the prefix older than `frame.t − 600_000` (binary search, then `splice`). Series whose newest point ages out are deleted. | — | UT-21 |
| `src/sensors/store.ts` | C | `createSensorStore()` keeps `status`, `frame`, `stale` and `history`. `start()` creates a `Channel<SensorEvent>` and calls `invoke("subscribe_sensors", { onEvent })`. On `status`, `stale = phase !== "live"` or the last frame is older than 3 × `periodMs` (a status change during a stall must not make old values look live; T12 review, D1); when the phase is `stopped` with a blocking notice, `frame` becomes `null`. On `frame`, it runs `appendFrame`, records the local receive time and sets `stale = false`. **Frame-age watchdog:** a 1 s interval sets `stale = true` when no frame has arrived for 3 × `frame.periodMs`, whatever the phase says. It is a backstop for a dead source the supervisor hasn't reported yet, and for a stalled Channel. Hooks use `useSyncExternalStore` with one version counter. | spike listen/unlisten | UT-21 |
| `src/sensors/commands.ts` | C | `enableFullSensors()`, `retrySensors()`, `openPawnIoSite()` (thin `invoke` wrappers) | — | — |
| `src/cards/format.ts` | C | The [number formats](#number-formats), with `Intl.NumberFormat("en-US")` for thousands separators, except MT/s (`useGrouping: false`: "6000 MT/s", "DDR5-6000") | mockup copy | UT-23 |
| `src/cards/fields.ts` | C | `buildDashboard`: the [card field rules](#card-field-rules-lhm--card), card titles and kind labels, GPU order (`gpuOrder`), the needs model ([locks](#availability-classification-rf3)), placeholders and empty states, the "starting" model when there's no frame yet, the header summary, the [sparkline sources](#sparklines), the history-chart series and legend, and the OC-profile inference (`jedecSpeed`) | — | UT-14…UT-20, UT-37 |
| `src/cards/CardParts.tsx` | C | `Card` (kind label, title, "All sensors" button-link, clickable body), `Hero`, `Field`, `LockedValue` ("Needs full sensors" / "Needs PawnIO" with a lock), `NotReported` ("—") | mockup card | UT-24 |
| `src/cards/CpuCard.tsx`, `GpuCard.tsx`, `MemoryCard.tsx`, `DiskCard.tsx`, `MotherboardCard.tsx`, `PlaceholderCard.tsx` | C | Render the `CardModel`s from `fields.ts`, following the mockup layouts, including the per-card variations (Memory with one row, Disk with two 28 px heroes and a two-line sparkline, Motherboard as a fan list with no sparkline). The GPU VRAM bar is a `muted` fill on a `line` track. | mockup E1 | UT-24 |
| `src/charts/path.ts` | C | `linePath`: x from time (`nowMs − windowMs` to `nowMs`), y from the domain (clamped); `null` breaks the path (a new `M`), and so does a gap of more than 3 s between frames (no readings in between; T12 review, D2; owner: "Yes, break at >3 s (Recommended)"); 1-decimal coordinates. `areaPath`: the same points, each non-null segment closed to the baseline on its own (`…L x_end h L x_start h Z` per segment), because closing one multi-`M` path once fills the wrong region. | mockup path maths | UT-22 |
| `src/charts/Sparkline.tsx`, `LineChart.tsx` | C | **Sparkline:** viewBox 300×60, CSS height 56 px, area at fill-opacity 0.12, stroke 1.5, `aria-hidden`. **Disk variant:** two lines (read in `accent`; write in `s2`, dash `4 3`), no area, `role="img"`, `aria-label` "Read (solid) and write (dashed) throughput, last 10 minutes". **LineChart, history:** viewBox 600×200, CSS height 240 px, gridlines at 0/100/200 in `line`, up to 3 series at stroke 2 with dash patterns `none` / `6 4` / `2 3`, `role="img"` with `aria-label` "{metric} over the last 10 minutes"; the y-axis is an HTML column (`100 °C` / `60` / `20`, the unit on the top label only) and the x labels are `−10 min` / `−5 min` / `now` (U+2212). **LineChart, drill-down:** viewBox 600×160, CSS height 200 px, one series with an area at 0.1, gridlines at 0/80/160, x labels only; y-domain = the window's min–max padded by 10 % (a flat series sits on the baseline). | mockup | UT-22 |
| `src/shell/Sidebar.tsx`, `TrustPanel.tsx` | C | Brand, theme toggle (`aria-label` "Switch to light/dark theme"), `<nav aria-label="Main">` with the Dashboard item (`aria-current="page"`; no Runs item in v0.1.0), the [trust panel states](#ui-states-not-mocked), and the "About and licenses" link | mockup shell | UT-27 |
| `src/shell/StatusBanner.tsx`, `BlockingPanel.tsx` | C | The [banner and blocking states](#ui-states-not-mocked). **Blocking panel style:** `surface` background, a 1 px `danger-line` border, the title and the warning icon in `danger-text`, body in `sub`. The two danger tokens come from the Runs mockup (`runs.dc.html` ≈:14-15), so no new tokens are needed. | — | UT-25 |
| `src/pages/Dashboard.tsx`, `HistoryPanel.tsx` | C | **Dashboard:** header (title, summary; no Run buttons), `StatusBanner`, then `BlockingPanel` **or** the card grid and `HistoryPanel` (the history panel is hidden while a blocking panel shows, so old history never sits next to "stopped"), and the footnote "Readings refresh every second. The last 10 minutes are kept in memory only." With no frame yet (`starting`), the grid area shows one info panel, "Starting the sensor helper…", in place of the cards. **HistoryPanel:** `section aria-label="History"`, "Last 10 minutes" with the Temperatures/Load/Power segmented control (`role="group" aria-label="Chart metric"`, `aria-pressed`; Temperatures selected first), the chart and the legend. | mockup E1 | E2E-01 |
| `src/pages/SensorList.tsx` | C | Drill-down for any card: breadcrumb ("Dashboard / {Component}"), title "{Component} sensors", subline "{hardware names} · {n} sensors" (the mockup's "· generic names until you rename them" waits for v0.2.0), the grouped list (`section aria-label="Sensor list"`, `aria-pressed` rows; the selected row has the `raised` background and an `accent` border; the first row is selected on open; rows whose value is 0 RPM or `null` use `muted`) and the detail panel (`section aria-label="Sensor detail"`: group, name, identifier in mono, big value, "now · refreshes every second", 10-min chart, Min (10 min) / Max (10 min) / Unit in a `<dl>`). See [Drill-down groups and card scopes](#drill-down-groups-and-card-scopes) for scopes with several hardware items. No rename form (v0.2.0). | mockup E2 | E2E-12 |
| `src/pages/About.tsx` | C | App version, LHM 0.9.6 @ `3d331e3`, the helper SHA-256 (`status.helperSha256`), and `THIRD-PARTY-NOTICES.md` (imported `?raw`, shown in a `<pre>`). URLs appear as text, never `<a href>`: navigation is pinned. | — | E2E-14 |
| `src/test/fixtures/frame-full.json`, `frame-reduced.json`, `frame-elevated-no-pawnio.json`, `event-frame.json` | C | Hand-trimmed `UiFrame`s (~40 sensors each), copied from the P1 dumps with the RF3 classification applied, **keeping LHM's hardware order** (the AMD iGPU before the RTX, as in every P1 dump). The no-PawnIO frame is the reduced frame plus `/nvme/0`, with `elevated: true`; E2E-14 checks the real thing. | P1 dumps | UT-14…UT-20, UT-28, UT-32, UT-37 |
| `src/cards/fields.test.ts`, `src/sensors/history.test.ts`, `src/sensors/store.test.ts`, `src/charts/path.test.ts`, `src/cards/format.test.ts`, `src/cards/Cards.test.tsx`, `src/shell/StatusBanner.test.tsx`, `src/shell/TrustPanel.test.tsx`, `src/theme/theme.test.ts`, `src/sensors/protocol.test.ts` | C | UT-14…UT-28, UT-30…UT-32, UT-34, UT-35, UT-37 | — | — |

**Docs:**

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `THIRD-PARTY-NOTICES.md` | C | One section per bundled component, with version, licence, copyright and source location: LHM 0.9.6 (MPL-2.0; source = the submodule and the upstream URL at `3d331e3`, MPL §3.2); the PawnIO modules embedded in LHM (LGPL-2.1, source `namazso/PawnIO.Modules`); DiskInfoToolkit, RAMSPDToolkit-NDD, BlackSharp.Core (MPL-2.0); HidSharp (Apache-2.0); System.Management and the other Microsoft packages, Mono.Posix.NETStandard and the .NET NativeAOT runtime (MIT); Tauri, wry, tao, webview2-com, windows-rs, tokio, serde, sha2, getrandom (MIT/Apache-2.0); React and `@tauri-apps/api` (MIT); IBM Plex Sans/Mono (OFL-1.1) and Fontsource (MIT). Not shipped, but named: the WebView2 Runtime and the PawnIO driver. | RF30, requirements Dependencies | review |
| `AGENTS.md` | C | From the drafts in `sessions/…/long_term_memory.md`, updated per ADR 0004: the trust invariants ("never changes hardware state", the allow-list, `IsControllerEnabled` off and `IsPowerMonitorEnabled` on, no persisting `ISettings`, no file writes, the helper's first act is `SetDefaultDllDirectories(System32)`, `pophood.exe` refuses to run elevated, both pipe ends verify, `BROWSER_ARGS` in one place, the network audit after any Tauri/wry/WebView2 bump, the P1 and P6 re-checks and a re-check of `BannedSymbols.txt` for new public write surfaces after any LHM bump), the LHM threading facts (our calls stay on the sampler thread; LHM's own DIMM retry and storage hot-plug threads don't, hence the per-tick exception policy), the build notes (vswhere, MSVC Build Tools; ATL comes with v0.6.0), and the conventions. **The owner approves the text before it's committed**; branching is left to the owner. | drafts | review |

**`README.md`** (Modify): replace the status line, then add build-from-source steps and the trust invariants.

Before:
```markdown
Status: planning. See [specs/v0.1.0](specs/v0.1.0/):
```
After:
```markdown
Status: v0.1.0, live dashboard (see [specs/v0.1.0/techspec.md](specs/v0.1.0/techspec.md)). Specs for every version: [specs/](specs/).

## Build from source
1. Prerequisites: Rust 1.99+, Node 22+, .NET SDK 10.0.402, VS Build Tools 2022 (MSVC), `vswhere` on PATH, and optionally PawnIO 2.2.0 from https://pawnio.eu.
2. `git clone --recurse-submodules …` (LibreHardwareMonitor is pinned at 3d331e3)
3. `npm ci`, then `npm run build:helper`, then `npm run tauri build -- --no-bundle`
4. Run `src-tauri\target\release\pophood.exe`. It never runs as admin; "Enable full sensors" asks UAC for the sensor helper only.
```

**`specs/v0.1.0/requirements.md`** (Modify, done this session): the title, revision note, Next line, Overview, Scope sentence and Q&A #37, plus the new [Version map](requirements.md#version-map).

### Anti-overengineering breakdown

| Candidate | Verdict | Why |
|---|---|---|
| Core-side history ring buffer and snapshot | **Cut** (#38) | The UI has to keep the window it draws anyway. Core history would only survive a webview reload. Deliberate deviation from RF10's placement under "App core": the 10-minute, memory-only behaviour is unchanged. |
| Job Object around the helper | **Cut** (#41) | Pipe EOF plus the 30 s rule plus terminate-on-exit already bound lifetime (P2 E8). The elevated helper can't join our job anyway. |
| Client-PID argument for the helper; image-path check in the app | **Cut** | The helper's check of the client's image path (P2) and the random pipe name are enough. In the app, a server PID equal to a child we hold a handle to is strictly stronger than an image path. |
| `timeBeginPeriod(1)` | **Cut** (#41) | Deadline scheduling already removes drift (P2: 1000.2 ms mean, 29 ms jitter). Frames carry their own `t`. |
| Command ACL manifest / capability files | **Cut** (#41) | One local-origin window. Navigation is pinned and new windows are denied, so no remote origin can reach the commands. There's no `core:default` surface. |
| tauri-driver E2E automation | **Cut** (#41) | The owner runs the UAC, elevated-capture and Task Manager checks by hand anyway (long-term memory #2). Pure logic is covered by UT and IT. |
| Generated licence list for every transitive crate | **Cut** (#41) | Built from source for the owner; the Dependencies table is the RF30 checklist. Due before the public release. |
| OQ14 (reproducible AOT) | **Cut** (#41) | Non-blocking per requirements |
| Logging pipeline | **Cut** (#41) | Anti-scaffolding. Helper errors travel over the pipe; debug builds print supervisor transitions. |
| `freezePrototype` | **Cut** (#41) | No remote content, and a risk of breaking libraries for little gain |
| Router, state library, chart library, TS codegen | **Cut** | Three pages, one store, two chart shapes. A shared JSON fixture locks the Rust↔TS contract (UT-28). |
| Catalog/delta frame protocol | **Cut** | Self-describing frames (~30 KB/s) avoid reconciling lazily created sensors and late DIMMs |
| Calling `setTheme` for the title bar | **Cut** | It would make `prefers-color-scheme` report our own override, which breaks "toggle back to the system theme clears the override" |
| `set_period` in schema v1 | **Keep** (#40) | About 20 lines from P2. Schema v1 stays unchanged through v0.3.0, and the fuzz corpus tests real field checks. |
| Random per-launch pipe name | **Keep** | Defeats pre-creation squatting (DoS) and lets the unprivileged and elevated helpers coexist during elevation |
| File lock from verify to launch | **Keep** | About 5 lines (`share_mode`). It closes the exe-swap window between the check and the launch (verified today for a normal launch). It does **not** close C11 on its own: the folder stays user-writable, so a planted DLL could still run elevated. The next row covers that. |
| `SetDefaultDllDirectories(System32)` as the helper's first call | **Keep** | About 3 lines. LHM loads `nvapi64.dll`, `atiadlxx.dll`, `ControlLib.dll` and `nvml.dll` by bare name, application directory first, so without it the hash check and the lock are bypassed by a DLL dropped next to the helper. **T15 (BUG-T14-01):** it covers bare-name `LoadLibrary` only. P/Invokes are confined by `DllSearch`, static imports by `/DEPENDENTLOADFLAG:0x800` and the `CRYPT32` delay load. |
| C1 guard: `pophood.exe` refuses to run elevated | **Keep** | About 15 lines. It is the only thing that makes the hard constraint C1 true; otherwise "Run as administrator" or UAC turned off runs the whole app, webview included, as admin. |
| PawnIO device check in `pawnIoUsable` | **Keep** | About 8 lines, elevated only, access 0. LHM exposes no public "driver loaded" check, and without one an installed-but-unloaded PawnIO lets fake zeros through (RF3). |
| Frame-age watchdog in the store | **Keep** | About 5 lines. A backstop that shows "—" instead of frozen values when frames stop and no status says why (a dead source mid-elevation, a stalled Channel). |
| Sampler per-tick exception policy | **Keep** | LHM mutates its hardware lists on its own threads; one racing enumeration shouldn't kill an elevated helper. Skip the frame; give up after 5 in a row. |
| Wider `BannedSymbols.txt` | **Keep** | Cheap text. It closes public bypasses of the surfaces RF1 lists (persisting `ISettings` via `Motherboard`, the public controller/PSU groups, the toggles) and the RF5/RF6 file and process APIs found in the shipped closure. |
| BannedApiAnalyzers | **Keep** | RF1 requires a mechanical check on every build. Compiler-enforced symbol bans are exact; grep isn't. |
| Helper-side RF3 classification plus UI "needs" labels | **Keep both, with separate owners** | The helper owns *validity* (`null` instead of fake values; it also protects v0.3.0 traces). The UI owns *copy* (which lock label). The UI never rewrites values. |
| Keeping the unprivileged helper alive during elevation | **Keep** | Simpler than kill-then-fall-back (nothing to restart), and no data gap |
| Fuzz corpus in two places (parser UT and pipe IT) | **Keep** | The UT locks the codes; the IT proves the catch-all keeps the connection and process alive (the P2 crash was found only end to end) |

### Data models

#### Pipe protocol, schema v1

**Envelope:** one UTF-8 JSON object per line, ending with `\n`. Every message starts with `"v": 1`. Both sides reject a line whose `v` isn't 1:
- the helper replies `bad_version`;
- the app stops with `schema_mismatch`.

#### `Hello`: helper → app, once, right after the client is verified

| Field | Type | Required | Description |
|---|---|---|---|
| `v` | int | yes | `1` |
| `type` | `"hello"` | yes | |
| `elevated` | bool | yes | `WindowsPrincipal.IsInRole(Administrator)` |
| `pawnIo` | object | yes | `{ installed: bool, version: string \| null, loaded: bool \| null }`. `installed` and `version` come from `PawnIo.IsInstalled` / `PawnIo.Version` (registry; installation only). `loaded` is `Availability.PawnIoDevicePresent()` when elevated, and `null` unprivileged (not checked). |

```json
{"v":1,"type":"hello","elevated":false,"pawnIo":{"installed":true,"version":"2.2.0.0","loaded":null}}
```

#### `Frame`: helper → app, every period

| Field | Type | Required | Description |
|---|---|---|---|
| `v`, `type` | `1`, `"frame"` | yes | |
| `seq` | int | yes | 1, 2, 3… per connection |
| `t` | int64 | yes | Unix ms (UTC) at the start of the tick that produced the frame (P2's `tMs = tick`), so frame-to-frame deltas show the schedule, not `Update()` time. The UI plots this, not the receive time (P2: ~50 ms receive jitter). |
| `periodMs` | int | yes | The period that produced this frame |
| `memory` | `MemoryModule[]` | yes | From SMBIOS. Empty if unavailable. |
| `hardware` | `HardwareInfo[]` | yes | Every hardware item and sub-hardware item |
| `sensors` | `SensorInfo[]` | yes | Every active sensor, including those with `value: null` (frames never change shape; spike AVOID) |

`HardwareInfo`:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | `Identifier.ToString()`, e.g. `/lpc/it8696e/0` |
| `name` | string | yes | LHM name, e.g. `ITE IT8696E` |
| `type` | string | yes | `HardwareType` name: `Cpu`, `GpuNvidia`, `GpuAmd`, `GpuIntel`, `Memory`, `Motherboard`, `SuperIO`, `EmbeddedController`, `Storage`, `PowerMonitor`… |
| `parent` | string \| null | yes | Parent hardware id, or `null` |

`SensorInfo`:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | e.g. `/amdcpu/0/temperature/2` (not unique on its own, so see `key`) |
| `hw` | string | yes | Owning hardware id |
| `name` | string | yes | LHM default name (no settings store, so never a user name) |
| `type` | string | yes | `SensorType` name: `Temperature`, `Load`, `Clock`, `Power`, `Fan`, `Voltage`, `Data` (GiB), `SmallData` (MiB), `Throughput` (B/s), `Level`, `Timing` (ns), `Control`, `Factor`… |
| `index` | int | yes | `ISensor.Index` |
| `value` | number \| null | yes | `null` when LHM returns `null` **or** [Availability](#availability-classification-rf3) says it's untrustworthy |

`MemoryModule`:

| Field | Type | Required | Description |
|---|---|---|---|
| `locator` | string | yes | `DeviceLocator`, e.g. `DIMM 1` |
| `sizeGB` | number | yes | `MemoryDevice.Size / 1024`. LHM reads `Size` in MiB (`SMBios.cs` ≈:1091-1094, extended size when it is `0x7FFF`). Entries with `Size` 0, `0xFFFF` (unknown) or bit 15 set (KiB granularity) are skipped. IT-11 asserts 16 per module on this PC. |
| `type` | string | yes | `MemoryDevice.Type` enum name (`MemoryType.DDR5 = 0x22`; IT-11 expects `DDR5`) |
| `configuredMTs` | int \| null | yes | `ConfiguredSpeed` (MT/s); `0` becomes `null`. Serial numbers are **never** sent. |

`memory` is `[]` when `computer.SMBios.MemoryDevices` is null, which LHM leaves when the firmware-table read fails (`SMBios.cs` ≈:1196-1197).

```json
{"v":1,"type":"frame","seq":42,"t":1761040800123,"periodMs":1000,
 "memory":[{"locator":"DIMM 1","sizeGB":16,"type":"DDR5","configuredMTs":6000}],
 "hardware":[{"id":"/amdcpu/0","name":"AMD Ryzen 9 9900X","type":"Cpu","parent":null}],
 "sensors":[{"id":"/amdcpu/0/temperature/2","hw":"/amdcpu/0","name":"Core (Tctl/Tdie)","type":"Temperature","index":2,"value":null},
            {"id":"/amdcpu/0/load/0","hw":"/amdcpu/0","name":"CPU Total","type":"Load","index":0,"value":12.3}]}
```

> **Elevated with PawnIO:** the same shape. `/amdcpu/0/temperature/2` carries a value, and `/lpc/it8696e/0`, `/memory/dimm/{1,3}` and `/nvme/0` appear with their sensors: 258 sensors on this PC (P1).

#### `SetPeriod` (app → helper), `Ack` and `Error` (helper → app)

```json
{"v":1,"type":"set_period","ms":250}
{"v":1,"type":"ack","periodMs":250}
{"v":1,"type":"error","code":"out_of_range","detail":"ms must be 250..1000"}
```

#### `ErrorMessage` codes

These replies leave the connection open, except `lhm_failed`.

| Code | Meaning |
|---|---|
| `too_long` | Control line over 1024 bytes (the excess is dropped up to `\n`) |
| `bad_encoding` | Not valid UTF-8 (checked before parsing; P2 crash fix) |
| `bad_json` | `JsonDocument.Parse` failed (MaxDepth 2, duplicate properties rejected) |
| `not_object` | Root is not an object |
| `unknown_field` | A field other than `v`, `type`, `ms` |
| `bad_field` | `v` or `ms` isn't an Int32, or `type` isn't a string (P2 `ParseControl` ≈:262-275) |
| `bad_version` | `v != 1` |
| `unknown_type` | `type != "set_period"` |
| `out_of_range` | `ms` outside 250..1000 |
| `internal_error` | Caught exception (e.g. the lone surrogate `"\ud800"`); `detail` = exception type |
| `lhm_failed` | **Fatal.** LHM `Open` threw, or 5 ticks in a row threw; `detail` = the exception type. Sent once before exit code 70. |

#### Helper command line and exit codes

| Item | Value |
|---|---|
| Arguments | Exactly `--pipe pophood-<32 lowercase hex> --client <absolute path to pophood.exe>` |
| 0 | Clean exit (client disconnected) |
| 3 | Pipe name already taken (`FirstPipeInstance`) |
| 4 | No verified client within 30 s |
| 64 | Bad arguments |
| 70 | Internal failure: `lhm_failed` (LHM `Open` threw, or 5 ticks in a row failed), or `SetDefaultDllDirectories` failed |

#### Availability classification (RF3)

`pawnIoUsable = elevated && PawnIo.IsInstalled && PawnIoDevicePresent()`. When it's true, every sensor is trustworthy and the value is passed through.

When `pawnIoUsable` is false:

| HardwareType | Trustworthy SensorTypes | Why |
|---|---|---|
| `Cpu` | `Load` only | Load comes from `NtQuerySystemInformation` (`CpuLoad.cs`). AMD: temperature, power and clocks read 0, VID 1.55 V (`Amd17Cpu.cs`, `PawnIo.cs`), per-core clocks are null. Intel: temperatures and clocks are null, but `CPU Package` / `CPU Cores` power reads a fake 0 W (`IntelCpu.cs` ≈:469-499). |
| `Motherboard`, `SuperIO`, `EmbeddedController` | none | Read through PawnIO LPC/EC modules; absent or zero without it |
| `Memory` | all | `/ram` and `/vram` come from `GlobalMemoryStatusEx`; DIMMs (SPD) are absent without PawnIO |
| `Storage` | all | Present only when elevated (admin, no PawnIO) |
| `GpuIntel` | all except `Power` | `GPU Power` comes from the PawnIO MSR module and reads a fake 0 W without it (`IntelIntegratedGpu.cs` ≈:41, ≈:82-90) |
| `GpuNvidia`, `GpuAmd`, others | all | NvAPI, ADL and D3DKMT don't use PawnIO |

**Residual:** the device check proves the PawnIO driver is loaded, not that every module loaded (an unsupported CPU family can still read zeros). It closes the "installed, driver not running" case, which is the one seen in practice.

**Lock labels** in the UI (copy only; it never changes values). A card field declares `needs: "none" | "admin" | "pawnio"`. A field with a `null` value shows:
- "Needs full sensors" when `needs ≠ none` and the helper isn't elevated;
- "Needs PawnIO" when `needs = pawnio`, the helper is elevated, and PawnIO isn't installed or its driver isn't loaded (`pawnIo.loaded == false`);
- otherwise "—" ("Not reported").

#### Card field rules (LHM → card)

Matches are exact names, tried in order: first match wins. Rules are never keyed on an identifier index, because indices depend on order (P1). Each rule is locked by the P1 fixtures (UT-14…UT-20).

| Card · field | Hardware | SensorType | Name rule (first match) | Needs | Format |
|---|---|---|---|---|---|
| CPU · hero "Package temperature" | `Cpu` | Temperature | `Core (Tctl/Tdie)`, `Core (Tdie)`, `CPU Package` | pawnio | 1 dp °C |
| CPU · hero when that is locked | `Cpu` | Load | `CPU Total` | none | 0 dp % |
| CPU · first field | `Cpu` | — | "Total load" (`CPU Total`, 0 dp %) when the hero is the temperature. When the hero falls back to Total load, this cell becomes a locked "Package temperature" instead (mockup `dashboard.dc.html` ≈:354). | none / pawnio | — |
| CPU · "Effective clock" | `Cpu` | Clock | `Cores (Average Effective)` only. `Cores (Average)` is the nominal clock (P1 elevated: 4668 vs 656 MHz), so it is never used as a fallback. | pawnio | MHz ÷ 1000, 2 dp, "GHz avg" |
| CPU · "Package power" | `Cpu` | Power | `Package`, `CPU Package` | pawnio | 1 dp W |
| CPU · "Hottest CCD" / "Hottest core" | `Cpu` | Temperature | `CCDs Max (Tdie)` → label "Hottest CCD", suffix = the `CCDn (Tdie)` with that value ("°C · CCD1"); else `CCD1 (Tdie)` alone (suffix "CCD1"); else `Core Max` → "Hottest core", suffix = the `CPU Core #n`, `P-Core #n` or `E-Core #n` temperature with that value (Intel; `IntelCpu.cs` ≈:340-359; UNVERIFIED on hardware, no Intel PC). **When nothing matches** (always the case unprivileged, where only `Core (Tctl/Tdie)` exists): label "Hottest core", value `null`, no suffix. A null value never shows a suffix. | pawnio | 1 dp °C |
| GPU · hero "Temperature" | `Gpu*` | Temperature | `GPU Core`, `GPU VR SoC` (AMD APU), then the first Temperature | none | 1 dp °C |
| GPU · "Load" | `Gpu*` | Load | NVIDIA: `GPU Core`. AMD and Intel: `D3D 3D`, then `GPU Core` (the AMD iGPU's `GPU Core` load stays 0). | none | 0 dp % |
| GPU · "Core clock" | `Gpu*` | Clock | `GPU Core` | none | 0 dp, thousands, MHz |
| GPU · "Power" | `Gpu*` | Power | `GPU Package`, `GPU Core`, then the first Power | none | 1 dp W |
| GPU · "VRAM" | `Gpu*` | SmallData | `GPU Memory Used` / `GPU Memory Total` (MiB ÷ 1024) plus a bar | none | 1 dp "/ x GB" |
| Memory · title | `memory[]` | — | `{n} × {sizeGB} GB {type}` when all sizes are equal, else `{total} GB {type}` | none | — |
| Memory · hero "Used" | id `/ram` | Data | `Memory Used`; total = `Memory Used` + `Memory Available` (LHM has no total sensor) | none | 1 dp "/ x GB" |
| Memory · "Configured speed" | `memory[]` | — | max `configuredMTs` | none | 0 dp MT/s |
| Memory · "OC profile" (full only) | DIMM hardware (`/memory/dimm/*`) | Timing | `tCKAVGmin (Minimum Cycle Time)` (same name for DDR4 and DDR5) → JEDEC = `jedecSpeed(tCK)`, the bin nearest to 2000 / tCK in {1600, 1866, 2133, 2400, 2666, 2933, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800, 7200, 7600, 8000, 8400, 8800}, max over DIMMs. (Rounding to the nearest 100 is wrong for DDR4: 0.750 ns would give 2700, not 2666.) Chip "Likely on · inferred" if configured > JEDEC, else "Likely off · inferred". Caption: "Inferred: configured {c} MT/s is above the SPD JEDEC speed of {j} MT/s." (or "matches"). The cell and caption are hidden when no DIMM sensor has a value. | pawnio | — |
| Disk · heroes | `Storage` | Throughput | `Read Rate`, `Write Rate` (B/s ÷ 1e6) | admin | 1 dp "MB/s read" / "MB/s write" |
| Disk · "Temperature" | `Storage` | Temperature | `Composite Temperature`, `Temperature`, then the first Temperature | admin | 0 dp °C |
| Disk · "SMART health" | `Storage` | Level | `Life` | admin | 0 dp "% life left" |
| Motherboard · title | `Motherboard` + child `SuperIO` | — | `{board name} · {chip name}`, LHM names verbatim: "Gigabyte B850 EAGLE WIFI6E · ITE IT8696E" (the mockup's shortened "B850 EAGLE WIFI6E · IT8696E" was illustrative) | pawnio | — |
| Motherboard · fans | children `SuperIO` / `EmbeddedController` | Fan | All Fan sensors with a value > 0, as rows. The headers that read exactly 0 go in a footer (a `null` reading is not counted; T12 review, D3): "{n} more fan headers read 0 RPM." ("1 more fan header reads 0 RPM." when n = 1; no footer when n = 0) plus "All sensors". Bar = rpm ÷ max(2000, the highest RPM shown rounded up to 500). No sparkline (see [Sparklines](#sparklines)). | pawnio | 0 dp, thousands, RPM |

**Card titles and kind labels:**
- **Kind labels** (12 px uppercase): "CPU", "Memory", "GPU", "Disk", "Motherboard". "GPU · discrete / integrated" waits for v0.5.0, and "Disk · C:" for v0.6.0.
- **Titles:** the LHM hardware name with "(TM)" and "(R)" removed: "AMD Ryzen 9 9900X", "NVIDIA GeForce RTX 5060 Ti", "AMD Radeon Graphics", "KINGSTON SNV3S1000G". Memory uses the memory summary (above), Motherboard the title rule above.

**Cards and their order:** CPU (one per `Cpu`), Memory (one), GPU (one per `Gpu*`, in `gpuOrder`), Disk (one per `Storage`), Motherboard (one).
- **`gpuOrder`:** `Gpu*` hardware sorted by its `GPU Memory Total` sensor, largest first; hardware without that sensor goes last; ties keep LHM order. LHM lists the AMD iGPU before the RTX in every P1 dump, which would put the iGPU first and swap the chart series against the chosen design. On this PC the sort gives the RTX (16311 MiB) before the iGPU (512 MiB), as in mockup E1. D3D12 `UMA` replaces this heuristic in v0.5.0.

**Header summary:** CPU title · board name · memory summary (`{n} × {size} GB {type}-{configuredMTs}`, MT/s without grouping) · each GPU title in `gpuOrder` · each drive title. Missing items are left out: no drives in reduced mode. On this PC: "AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E · 2 × 16 GB DDR5-6000 · NVIDIA GeForce RTX 5060 Ti · AMD Radeon Graphics · KINGSTON SNV3S1000G" (the mockup's shortened names and "16 GB" on the GPU were illustrative).

**History chart series** (up to 3; colours accent / s2 / s3; dashes solid / `6 4` / `2 3`; fixed domains 20–100 °C, 0–100 %, 0–200 W; Temperatures selected first). "First GPU" and "second GPU" follow `gpuOrder`.

| Metric | Series 1 | Series 2 | Series 3 |
|---|---|---|---|
| Temperatures | CPU package temperature | first GPU temperature | first drive temperature |
| Load | CPU total load | first GPU load | second GPU load |
| Power | CPU package power | first GPU power | second GPU power |

- **Legend names:** "CPU package" (Temperatures, Power) or "CPU total" (Load); a GPU's or drive's card title for the others.
- **Legend values** use the card formats (0 dp load and drive temperature, 1 dp °C and W).
- A series that is locked has no path. Its legend row shows the lock (swatch in `locked`) and the lock label.
- **No drive:** in reduced mode the third Temperatures row reads "Drive" with the lock label; in full mode with no drive, the row is omitted. A missing second GPU omits its row.

#### Sparklines

The done-when asks for sparklines on each card. Each one draws the card's hero over the last 10 minutes, as in mockup E1 (`dashboard.dc.html` ≈:351-359):

| Card | Series | y-domain |
|---|---|---|
| CPU | The hero: package temperature, or `CPU Total` when the hero falls back | 20–100 °C, or 0–100 % |
| Memory | `/ram` `Memory Used` | 0 to `Memory Used + Memory Available` |
| GPU | The hero temperature | 20–100 °C |
| Disk | `Read Rate` and `Write Rate`, two lines (the Disk variant in `Sparkline.tsx`) | 0 to max(10 MB/s, the highest value in the window) |
| Motherboard | **None.** The chosen mockup (#34) draws the card as a fan list with bars and no sparkline. The owner accepted this deviation from "each card shows sparklines" (#44). The fans' history is one click away in the drill-down. | — |

#### Drill-down groups and card scopes

**Drill-down groups:** by SensorType, in this order: Fan, Temperature, Voltage, Clock, Load, Power, Current, Data, SmallData, Throughput, Level, Factor, Timing, Control, then the rest alphabetically. Group labels are plural ("Fans · 5"). Rows keep LHM `index` order.
- **Scopes with more than one hardware item that has sensors** (Memory: `/ram`, `/vram` and the DIMMs) are grouped by hardware first, with the hardware name as a heading, then by SensorType. Otherwise two rows named "Memory Used" (`/ram/data/0`, `/vram/data/2`), and the 20 sensor names the two DIMMs share, can't be told apart.
- The Motherboard scope has sensors only on the SuperIO chip (`/motherboard` has none in P1), so it stays grouped by type. Its six `Control` sensors ("Fan #1"…"Fan #6", all `null` in the elevated P1 dump) form a "Controls · 6" group, and the subline counts 26 sensors, not the mockup's 19.

**Card scopes** (the hardware ids a drill-down lists):
- CPU: the `Cpu` hardware;
- Memory: `/ram`, `/vram` and the DIMMs;
- GPU: that GPU;
- Disk: that drive;
- Motherboard: `/motherboard` and all its sub-hardware.

#### Number formats

| SensorType (unit) | Drill-down format | Example |
|---|---|---|
| Temperature | 1 dp °C | 38.0 °C |
| Load, Control, Level | 1 dp % (cards: 0 dp) | 12.3 % |
| Clock | 0 dp, thousands, MHz | 4,668 MHz |
| Power | 1 dp W | 62.3 W |
| Voltage | 3 dp V | 1.244 V |
| Current | 2 dp A | 1.20 A |
| Fan | 0 dp, thousands, RPM | 1,142 RPM |
| Data (GiB) | 1 dp GB | 14.2 GB |
| SmallData (MiB) | 0 dp, thousands, MB | 2,429 MB |
| Throughput (B/s) | ÷ 1e6, 1 dp MB/s (decimal, like CDM) | 0.4 MB/s |
| Timing (ns) | 3 dp ns | 0.416 ns |
| Factor | 2 dp, no unit | 46.50 |
| others | 2 dp, no unit | — |
| `null` | "—" | — |

Memory "GB" means GiB, as Windows Task Manager shows it. Only disk throughput is decimal (requirements UX). Memory speeds in MT/s are never grouped ("6000 MT/s", "DDR5-6000"). Values and units are separated by a space ("38.0 °C", "12 %").

#### UI contract (core → UI)

**`SensorEvent`**, sent over the Channel: `{ kind: "status", status: SensorStatus }` | `{ kind: "frame", frame: UiFrame }`.

`SensorStatus`:

| Field | Type | Required | Description |
|---|---|---|---|
| `phase` | `"starting" \| "live" \| "reconnecting" \| "stopped"` | yes | See the [state machine](#supervisor-state-machine) |
| `elevated` | bool \| null | yes | From the current connection's `hello`; `null` before the first hello |
| `pawnIo` | `{installed, version, loaded} \| null` | yes | From `hello` |
| `elevation` | `"idle" \| "prompting" \| "connecting"` | yes | |
| `notice` | `{ code: NoticeCode, detail: string \| null } \| null` | yes | The last problem; cleared by the next successful action |
| `restartAttempt` | int \| null | yes | 1..3 while `reconnecting` |
| `helperSha256` | string | yes | `POPHOOD_HELPER_SHA256` (About page) |

`UiFrame` = `Frame` minus `v`/`type`, plus `elevated: bool`, with each sensor extended to `UiSensor = SensorInfo + { key: string }`.

```json
{"kind":"status","status":{"phase":"live","elevated":false,"pawnIo":{"installed":true,"version":"2.2.0.0","loaded":null},
 "elevation":"connecting","notice":null,"restartAttempt":null,"helperSha256":"71c0…e9a4"}}
```

> **Stopped with a blocking notice:** `{"phase":"stopped","elevated":null,"pawnIo":null,"elevation":"idle","notice":{"code":"helper_hash_mismatch","detail":"expected 71c0…e9a4, got 03ab…11f2"},…}`. The UI drops `frame` and shows the blocking panel in place of the grid (the app stays usable as a shell).

#### `NoticeCode` (error envelope)

**Rule:** the four integrity and security codes are **always blocking, wherever they're detected**: at start, on a restart, or during elevation. Every helper process is terminated and the phase becomes `stopped`. A detected tamper is never downgraded to a warning.

| Code | Blocking? | When |
|---|---|---|
| `helper_missing` | yes, always | No `pophood-sensors.exe` next to `pophood.exe`, at any verify (start, restart, or `enable_full_sensors`) |
| `helper_hash_mismatch` | yes, always | SHA-256 ≠ the compiled-in value, at any verify. Nothing is launched, and no UAC prompt is shown. |
| `pipe_squatter` | yes, always | Another process holds the pipe, on the unprivileged **or** the elevated pipe: the server PID ≠ the launched PID (`detail` = "process N"), opening the pipe gives `ERROR_ACCESS_DENIED` (our helper's DACL always grants the current user; "the pipe denied access"), or the helper exits 3 because its name was taken ("the helper found its pipe name taken"). The name is 128 random bits per launch, so none of these is an accident (T12 review, A1; owner: "Yes, map to squatter (Recommended)"). Disconnected without writing. |
| `schema_mismatch` | yes, always | A line with `v ≠ 1` from any helper |
| `helper_error` | after 3 restart attempts | The helper sent `error` `lhm_failed` (other `error` codes are replies to control messages and don't count), a malformed line, a line over 4 MiB, or (while `starting`) didn't connect or send its first frame within the deadlines |
| `helper_exited` | after 3 restart attempts | Pipe EOF or I/O error with no error message, or the child exited before the pipe connected (`detail` = "exit code N") |
| `full_sensors_lost` | no | The **elevated** helper died, and the restart brought Pophood back to reduced mode. Stays until the next `enable_full_sensors`. |
| `uac_cancelled` | no | `ShellExecuteExW` returned `ERROR_CANCELLED` |
| `elevation_failed` | no | Any other `ShellExecuteExW` error, the elevated helper exiting or sending a malformed line or `lhm_failed` before its first frame, or `hello.elevated == false`. That process is terminated. `detail` = the error text or exit code. |
| `elevation_timeout` | no | No elevated first frame within 20 s of `ShellExecuteExW` returning, whether or not the pipe connected. The elevated process is terminated. `detail` = null. |

If the unprivileged helper failed while elevation was in flight and elevation then doesn't succeed, the elevation notice is shown and the restart's `helper_exited` / `helper_error` follows in `reconnecting`; the banner precedence below decides which one the user sees.

#### BannedSymbols.txt (RF1 mechanical check)

These are the doc IDs verified against LHM `3d331e3` and the package metadata (techspec LHM agent §5; re-verified by the adversarial review, which decoded the NuGet assemblies' metadata). A type ban blocks every member, including constructors: `new LpcAcpiEc()` alone loads a PawnIO module. **`T:LibreHardwareMonitor.PawnIo.PawnIo` is not banned**, because the helper needs `IsInstalled` and `Version`.

Why the second half of the list exists (review, 2026-10-21):
- **Persisting settings:** `ISettings` is public, and `public Motherboard(SMBios, ISettings)` (`Motherboard/Motherboard.cs:34`) builds SuperIO hardware that replays saved fan values. Banning only `Computer.#ctor(ISettings)` left that path open.
- **Toggles:** `AeroCoolGroup`, `AquaComputerGroup`, `CorsairPsuGroup` and `MsiPsuGroup` are public with public constructors and open HID devices (Corsair sends `INIT`) whatever the toggles say. `Computer.IsControllerEnabled` and `IsPsuEnabled` have public setters. The helper sets only the six enabled toggles in an object initializer, so it never needs those two properties; UT-33 reads them from the test project, which the analyzer doesn't check.
- **RF5/RF6 in the shipped closure:** Mono.Posix `Stdlib.remove`/`rename` P/Invoke `msvcrt` and work on Windows; BlackSharp.Core's `Logger.SaveToFile` and its public `Kernel32.CreateFile`; `System.IO.Ports.SerialPort`; `Process`; the registry.
- **RAMSPDToolkit's driver API (T12 review, B1):** LHM registers its PawnIO driver as `DriverManager.Driver` (`MemoryGroup.cs:35`), so helper code could call `IPawnIODriver.LoadModule(…)` then `IPawnIOModule.Execute("ioctl_smbus_xfer", …)` and reach the SMBus module through the interface, past the `PawnIo.ExecuteHr` and `SMBusInterface` bans. `DriverManager`, `IPawnIODriver`, `IPawnIOModule` and `IGenericDriver` (port and PCI-config writes) are banned. `PCICMDIOGuard` is not public. A probe build confirmed the gap before the bans and an RS0030 on each after.
- **More file writers (T12 review, B4):** `ZipFile`, `ZipFileExtensions`, `TarFile`, and the path overloads of `XmlWriter.Create`, `XmlDocument.Save`, `XDocument.Save` and `XElement.Save`.

```
P:LibreHardwareMonitor.Hardware.ISensor.Control
M:LibreHardwareMonitor.Hardware.IControl.SetSoftware(System.Single)
M:LibreHardwareMonitor.Hardware.IControl.SetDefault
M:LibreHardwareMonitor.Hardware.Computer.#ctor(LibreHardwareMonitor.Hardware.ISettings)
T:LibreHardwareMonitor.Hardware.ISettings
T:LibreHardwareMonitor.Hardware.Motherboard.Motherboard
P:LibreHardwareMonitor.Hardware.Computer.IsControllerEnabled
P:LibreHardwareMonitor.Hardware.Computer.IsPsuEnabled
T:LibreHardwareMonitor.Hardware.Controller.AeroCool.AeroCoolGroup
T:LibreHardwareMonitor.Hardware.Controller.AquaComputer.AquaComputerGroup
T:LibreHardwareMonitor.Hardware.Psu.Corsair.CorsairPsuGroup
T:LibreHardwareMonitor.Hardware.Psu.Msi.MsiPsuGroup
T:LibreHardwareMonitor.Hardware.PowerMonitor.WireViewPro2
T:LibreHardwareMonitor.PawnIo.IsaBridgeEc
T:LibreHardwareMonitor.PawnIo.LpcAcpiEc
T:LibreHardwareMonitor.PawnIo.LpcCrOSEc
T:LibreHardwareMonitor.PawnIo.AmdFamily0F
T:LibreHardwareMonitor.PawnIo.AmdFamily10
T:LibreHardwareMonitor.PawnIo.AmdFamily17
T:LibreHardwareMonitor.PawnIo.IntelMsr
T:LibreHardwareMonitor.PawnIo.RyzenSmu
M:LibreHardwareMonitor.PawnIo.PawnIo.Execute(System.String,System.Int64[],System.Int32)
M:LibreHardwareMonitor.PawnIo.PawnIo.ExecuteHr(System.String,System.Int64[],System.UInt32,System.Int64[],System.UInt32,System.UInt32@)
T:LibreHardwareMonitor.Hardware.Motherboard.Lpc.EC.WindowsEmbeddedControllerIO
T:LibreHardwareMonitor.Hardware.Motherboard.Lpc.EC.ChromeOSEmbeddedControllerIO
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_quick(System.Byte,System.Byte)
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_byte(System.Byte,System.Byte)
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_byte_data(System.Byte,System.Byte,System.Byte)
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_word_data(System.Byte,System.Byte,System.UInt16)
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_block_data(System.Byte,System.Byte,System.Byte,System.Byte[])
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_write_i2c_block_data(System.Byte,System.Byte,System.Byte,System.Byte[])
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_smbus_proc_call(System.Byte,System.Byte,System.Byte,System.UInt16)
M:RAMSPDToolkit.I2CSMBus.SMBusInterface.i2c_write_block(System.Byte,System.Int32,System.Byte[])
T:RAMSPDToolkit.I2CSMBus.SMBusManager
M:RAMSPDToolkit.SPD.SPDAccessor.SetPage(System.Byte)
M:RAMSPDToolkit.SPD.SPDAccessor.ChangePage(RAMSPDToolkit.SPD.Enums.PageData)
T:RAMSPDToolkit.SuperInOut.SuperIO
T:RAMSPDToolkit.Windows.Driver.DriverManager
T:RAMSPDToolkit.Windows.Driver.Interfaces.IPawnIODriver
T:RAMSPDToolkit.Windows.Driver.Interfaces.IPawnIOModule
T:RAMSPDToolkit.Windows.Driver.Interfaces.IGenericDriver
T:HidSharp.DeviceList
M:HidSharp.HidStream.Write(System.Byte[])
M:HidSharp.HidStream.SetFeature(System.Byte[])
M:HidSharp.HidStream.SetFeature(System.Byte[],System.Int32,System.Int32)
T:Mono.Unix.Native.Stdlib
T:Mono.Unix.Native.Syscall
M:BlackSharp.Core.Logging.Logger.SaveToFile(System.String,System.Boolean)
T:BlackSharp.Core.Interop.Windows.Native.Kernel32
T:System.IO.File
T:System.IO.FileStream
T:System.IO.FileInfo
T:System.IO.StreamWriter
T:System.IO.Directory
T:System.IO.DirectoryInfo
T:System.IO.RandomAccess
M:System.IO.Path.GetTempFileName
T:System.IO.Compression.ZipFile
T:System.IO.Compression.ZipFileExtensions
T:System.Formats.Tar.TarFile
M:System.Xml.XmlWriter.Create(System.String)
M:System.Xml.XmlWriter.Create(System.String,System.Xml.XmlWriterSettings)
M:System.Xml.XmlDocument.Save(System.String)
M:System.Xml.Linq.XDocument.Save(System.String)
M:System.Xml.Linq.XDocument.Save(System.String,System.Xml.Linq.SaveOptions)
M:System.Xml.Linq.XElement.Save(System.String)
M:System.Xml.Linq.XElement.Save(System.String,System.Xml.Linq.SaveOptions)
T:System.IO.MemoryMappedFiles.MemoryMappedFile
T:System.IO.Ports.SerialPort
T:System.Diagnostics.Process
T:Microsoft.Win32.Registry
T:Microsoft.Win32.RegistryKey
```

- **Known gap:** `HidStream.Write(byte[], int, int)` binds to `System.IO.Stream.Write` and can't be banned on its own. `T:HidSharp.DeviceList` blocks device discovery instead.
- **Root bans:** `SMBusManager` (the only source of `SMBusInterface` instances) and `SuperIO` (static `SuperIOWriteByte` and `SuperIOEnter`) cover their write methods even if a signature above drifts in a package bump. `SPDAccessor.SetPage` is protected, so its ban is moot but harmless.
- **IDs without an XML doc entry:** `i2c_write_block` and `Kernel32` were read from the assemblies' metadata tables (2026-10-21): both are public, `Kernel32` sits in `BlackSharp.Core.Interop.Windows.Native`, and the signatures are as listed. BannedApiAnalyzers ignores an entry that resolves to nothing, so E2E-19's negative per class still proves each entry works after any package bump.
- **Scope:** the analyzer checks only Pophood's helper code. LHM's internal writes are covered by `WRITE-ALLOWLIST.md` and the P6 re-audit. The helper's own `[LibraryImport]`s in `Native.cs` aren't banned; reviews keep `CreateFileW` to the access-0 PawnIO device check.

#### Fixed source parameters

| API | Main parameters |
|---|---|
| **LHM `Computer`** | Default constructor. `IsCpuEnabled`, `IsGpuEnabled`, `IsMemoryEnabled`, `IsMotherboardEnabled`, `IsStorageEnabled`, `IsPowerMonitorEnabled` = true; `IsControllerEnabled`, `IsNetworkEnabled`, `IsPsuEnabled`, `IsBatteryEnabled` = false. `ValuesTimeWindow = TimeSpan.Zero` on every sensor. Every call **the helper makes** happens on the sampler thread (`ThreadAffinity.Set` changes the calling thread's affinity, so a dedicated OS thread is required). LHM's own DIMM retry (thread pool, ~10 s after `Open`) and DiskInfoToolkit's storage threads still touch LHM state on other threads, hence the sampler's per-tick exception policy. |
| **Named pipe** | `\\.\pipe\pophood-<32 hex>`; `InOut`; byte mode; max 1 instance; `Asynchronous \| FirstPipeInstance`; DACL = current user SID `ReadWrite`; buffers in 4096 / out 65536. The client uses tokio's default `SECURITY_IDENTIFICATION` QoS. |
| **Timing** | Period 1000 ms (250–1000 via `set_period`); the first frame goes out right after `Open`, and `t` is the tick's start. Helper accept window 30 s, a fixed deadline from pipe creation. App connect deadline 10 s (unprivileged; cut short if the child exits), plus 10 s from `hello` to the first frame. Elevated: 20 s from `ShellExecuteExW` returning to the first frame. Exit grace: one shared 3 s deadline for all helpers, then `TerminateProcess`. Up to 3 restart attempts, after 1 / 5 / 15 s; 60 s live resets the count. Sampler: 5 failed ticks in a row → `lhm_failed`, exit 70. UI watchdog: stale after 3 × `periodMs` without a frame. |
| **Size limits** | Control line ≤ 1024 B (helper). Helper line ≤ 4 MiB (app). |
| **WebView2 environment** | Created on the main thread after `CoInitializeEx(STA)`. `AdditionalBrowserArguments = BROWSER_ARGS`; `IsCustomCrashReportingEnabled = true`; user data folder = `app_local_data_dir()` = `%LOCALAPPDATA%\dev.pophood` (created first; it is also where Tauri would put it); everything else at the webview2-com defaults (`AllowSingleSignOnUsingOSPrimaryAccount = false`, extensions off, tracking prevention on). |
| **Helper process** | `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` before anything else; `[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]`; then (T15) the `DllSearch` resolver for every assembly whose P/Invokes lack a System32-only search path, and `/DEPENDENTLOADFLAG:0x800` plus `/DELAYLOAD:CRYPT32.dll` for the static imports. |
| **CSP** | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'` |
| **Window** | `main`, 1280×860, min 1024×680 (open UI question 4). At a 1024 px client width the grid has 2 columns (about 372 px each) and the sidebar doesn't stack (it stacks below about 760–768 px of client width); 3 columns need about 1196 px. The drill-down's list and detail stay side by side down to 1024 with the 250/400 bases. The history legend fits beside the chart at 1024 with about 2 px to spare, so with a classic scrollbar it wraps below the chart; that is accepted. |

### Endpoints mapping

#### Overview

| Method | Route | Description |
|---|---|---|
| Tauri command | `subscribe_sensors(onEvent: Channel<SensorEvent>)` | Register the UI's Channel, replacing any previous one. Immediately sends `status`, then the latest `frame` if there is one. |
| Tauri command | `enable_full_sensors()` | Start elevation. A no-op unless `phase = live`, `elevated = false` and `elevation = idle`. |
| Tauri command | `retry_sensors()` | Restart from `stopped`; a no-op otherwise |
| Tauri command | `open_pawnio_site() -> Result<(), String>` | Open `https://pawnio.eu` in the default browser |
| Named pipe | `\\.\pipe\pophood-<hex>` | Helper ↔ core, [schema v1](#pipe-protocol-schema-v1) |
| Process | `pophood-sensors.exe --pipe … --client …` | [Arguments and exit codes](#helper-command-line-and-exit-codes) |

---

#### `subscribe_sensors`

**Request body**

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `onEvent` | `Channel<SensorEvent>` | — | Required. A later call replaces the earlier Channel, which happens on a webview reload. |

**Responses**

| Status | Body | When |
|---|---|---|
| `Ok(())` | — | Always. Events follow on the Channel. |

**Example: success**
```text
invoke("subscribe_sensors", { onEvent })
→ onEvent: {"kind":"status","status":{"phase":"live","elevated":false,…}}
→ onEvent: {"kind":"frame","frame":{"seq":7,"t":1761040800123,"elevated":false,"sensors":[…]}}
```

**Example: helper missing**
```text
→ onEvent: {"kind":"status","status":{"phase":"stopped","notice":{"code":"helper_missing","detail":"C:\\…\\pophood-sensors.exe"},…}}
```
> No frame follows. The UI shows the blocking panel with Retry.

---

#### `enable_full_sensors`

**Request body:** none.

**Responses**

| Status | Body | When |
|---|---|---|
| `Ok(())` | — | Always. Progress and outcome arrive as `status` events: `prompting` → `connecting` → `live` with `elevated: true`, or a notice. |

**Example: UAC cancelled**
```text
→ {"kind":"status","status":{"phase":"live","elevated":false,"elevation":"prompting",…}}
→ {"kind":"status","status":{"phase":"live","elevated":false,"elevation":"idle","notice":{"code":"uac_cancelled","detail":null},…}}
```
> Unprivileged frames keep flowing throughout. The button is enabled again.

---

#### `retry_sensors`

**Request body:** none. **Response:** `Ok(())`. Valid only from `stopped`; clears the notice and runs app-start workflow step 4 again.

---

#### `open_pawnio_site`

| Status | Body | When |
|---|---|---|
| `Ok(())` | — | `ShellExecuteW` returned > 32 |
| `Err(String)` | `"could not open the browser (code N)"` | Otherwise. The UI shows the URL as text to copy. |

> The URL is a constant in Rust. The UI can't pass one. The browser that opens is user-initiated and outside the C5 guarantee (requirements C5).

#### Supervisor state machine

| From | Event | To | Effects |
|---|---|---|---|
| — | `setup` | `starting` | Verify and lock, spawn unprivileged, connect (10 s), `hello`, first frame (10 s after hello) |
| `starting` / `reconnecting` | First frame | `live` (`elevated: false`) | Forward frames. Clear the notice, unless it's `full_sensors_lost`. |
| `starting` / `reconnecting` | Connect timeout, the child exiting before the pipe connects, EOF, I/O error, malformed line, `lhm_failed`, or no first frame in time | `reconnecting` (next attempt) + `helper_error` / `helper_exited` | Counts as a failure (see the restart policy) |
| any verify (start, restart, `enable_full_sensors`) | Image missing or hash mismatch | `stopped` + `helper_missing` / `helper_hash_mismatch` | Terminate every helper; nothing launched; no UAC prompt |
| any connect (unprivileged or elevated) | Server PID ≠ launched PID, access denied, or the helper exited 3 | `stopped` + `pipe_squatter` | Drop that pipe without writing; terminate every helper |
| any | A line with `v ≠ 1` | `stopped` + `schema_mismatch` | Terminate every helper |
| `live`, unprivileged, idle | `enable_full_sensors` | `live`, `elevation: prompting` | Verify and lock, then `ShellExecuteExW` (blocking thread). A no-op in any other state. |
| `prompting` | `Cancelled` | `live`, `idle`, `uac_cancelled` | — |
| `prompting` | `Failed` | `live`, `idle`, `elevation_failed` | — |
| `prompting` | Launched | `connecting` | Connect to the new pipe; check the PID, `hello.elevated`, and a first frame within 20 s |
| `connecting` | First elevated frame | `live` (`elevated: true`), `idle` | Switch source; close the old pipe; terminate the old helper if it's alive after 3 s; clear the notice |
| `connecting` | Elevated EOF before a frame, or `hello.elevated == false` | `live` (unprivileged), `idle`, `elevation_failed` | Terminate the elevated process |
| `connecting` | 20 s deadline | `live` (unprivileged), `idle`, `elevation_timeout` | Terminate the elevated process |
| `connecting` | Elevated malformed line or `error{lhm_failed}` before its first frame | `live` (unprivileged), `idle`, `elevation_failed` | Terminate the elevated process |
| `live` with elevation `prompting` or `connecting` | **Unprivileged** EOF, I/O error, malformed line, `error{lhm_failed}` or child exit | `reconnecting` (attempt n as below) + `helper_exited` / `helper_error`; **elevation keeps its state** | Emit the status at once. **No restart is scheduled yet:** the elevation outcome decides (next two rows). |
| `reconnecting` with elevation `connecting` | First elevated frame | `live` (`elevated: true`), `idle` | Switch source; clear the notice; the attempt count is unchanged (the 60 s rule resets it) |
| `reconnecting` with elevation `prompting` or `connecting` | Cancelled, failed or timed out (the same causes as the `prompting` / `connecting` rows above) | `reconnecting`, `idle`, with the elevation notice | Terminate the elevated process if there is one; then wait `RESTART_DELAYS[n−1]` and restart **unprivileged** |
| `live` (no elevation in flight) | EOF, I/O error, malformed line, `error{lhm_failed}` or child exit | `reconnecting` (attempt 1, or the next attempt if the last live period was under 60 s) + `helper_exited` / `helper_error`; an elevated source sets `full_sensors_lost` once live again | Wait `RESTART_DELAYS[n−1]`, then restart **unprivileged** (UAC is never prompted automatically) |
| `live` | Any other `error` code from a helper | unchanged | Logged in debug builds only; these are replies to control messages |
| `reconnecting` | A failure after attempt 3 | `stopped` (notice kept) | — |
| `live` | 60 s live | unchanged | Reset the attempt count |
| `live` | A frame whose `t` isn't newer than the last forwarded one | unchanged | Drop it (the source switch can reorder frames) |
| `stopped` | `retry_sensors` | `starting` | Clear the notice and the attempt count. A no-op in any other state. |
| any | `RunEvent::Exit` | — | Drop the pipes, `wait_all` with one 3 s deadline, `TerminateProcess` on the rest |

**Restart policy, worked through:** the helper dies → attempt 1 after 1 s → live. It dies again within 60 s → attempt 2 after 5 s → live. Again → attempt 3 after 15 s → live. Again, within 60 s → `stopped`. Staying live for 60 s at any point resets the count to 0.

**Unprivileged death during elevation, worked through:** the UAC prompt is up and the unprivileged helper dies → `reconnecting` at once, banner "Sensors disconnected · waiting for full sensors…", values show "—"; nothing restarts while the prompt is up. The owner accepts → the elevated helper delivers its first frame → `live`, elevated. Had they cancelled instead → `uac_cancelled`, then attempt 1 after 1 s → live, unprivileged.

#### UI states not mocked

These use the same shell and tokens. The banner slot sits under the header; the highest-priority row in this table wins. Blocking panels replace the card grid **and** the history panel, and use the style in the `BlockingPanel.tsx` row (`surface`, `danger-line` border, `danger-text` title and warning icon).

| Status | Banner / panel | Copy | Actions |
|---|---|---|---|
| `stopped` + `helper_missing` | Blocking panel (replaces the grid) | "Sensor helper not found" · "pophood-sensors.exe is missing next to Pophood. Rebuild with `npm run build:helper`. Pophood never offers to elevate a file it hasn't verified." | Retry |
| `stopped` + `helper_hash_mismatch` | Blocking panel | "Sensor helper failed verification" · "Its SHA-256 doesn't match the one this build of Pophood expects, so it wasn't started. {detail}" | Retry |
| `stopped` + `pipe_squatter` | Blocking panel, warning icon | "Security warning: sensor connection refused" · "Another program answered on the sensor pipe. Pophood disconnected without sending it anything." | Retry |
| `stopped` + `schema_mismatch` | Blocking panel | "Sensor helper is incompatible" · "The helper speaks a different message format ({detail}). Rebuild the app and helper from the same checkout." | Retry |
| `stopped` + `helper_exited` / `helper_error` | Blocking panel | "Sensors stopped" · "The sensor helper kept stopping, and 3 restarts didn't help. {detail}" | Retry |
| `starting` (no frame yet) | Info panel in place of the card grid; no history panel | "Starting the sensor helper…" | — |
| `reconnecting` | Info banner, `role="status"`; cards stay but every value shows "—" (`stale`). If elevation is in flight, its line is added below. | "Sensors disconnected · restarting the sensor helper (attempt {n} of 3)…" (while elevation is in flight: "Sensors disconnected · waiting for full sensors…") | — |
| `live`, but no frame for 3 periods (watchdog) | No banner; every value shows "—" | — | — |
| `elevation: prompting` | Info banner (replaces the reduced banner's button) | "Waiting for the UAC prompt…" | — |
| `elevation: connecting` | Info banner, `role="status"` | "Connecting to sensors…" | — |
| `live`, unprivileged, with notice `uac_cancelled` / `elevation_*` | The reduced banner plus one line | `uac_cancelled`: "The UAC prompt was cancelled. Pophood is still in reduced mode." `elevation_failed`: "Full sensors didn't start ({detail}). Pophood is still in reduced mode." `elevation_timeout`: "Full sensors didn't start within 20 seconds. Pophood is still in reduced mode." | Enable full sensors (retry) |
| `live`, unprivileged, with notice `full_sensors_lost` | The reduced banner plus one line | "Full sensors stopped: the elevated helper exited, so Pophood is back in reduced mode." | Enable full sensors |
| `live`, unprivileged, PawnIO installed | Reduced banner (mockup copy; `section aria-label="Reduced sensors"`) | Title "Reduced sensors" · "CPU temperature, power and clocks, drives, fans and DIMMs need the sensor helper elevated. Pophood itself never runs as admin." · "One UAC prompt · exits when Pophood closes" | Enable full sensors |
| `live`, unprivileged, PawnIO missing | Reduced banner plus a PawnIO line | The banner copy plus: "PawnIO isn't installed. Without it, elevation adds only drives; CPU temperature, power and clocks, fans and DIMMs also need PawnIO. Pophood never installs drivers." | Enable full sensors · "Get PawnIO (pawnio.eu)" |
| `live`, elevated, PawnIO missing | Info banner | "Full sensors are on, but PawnIO isn't installed" · "Drives and SMART are live. CPU temperature, power and clocks, fans and DIMMs need PawnIO. Pophood never installs drivers." | "Get PawnIO (pawnio.eu)" |
| `live`, elevated, PawnIO installed but `loaded == false` | Info banner | "Full sensors are on, but PawnIO's driver isn't running" · "Drives and SMART are live. CPU temperature, power and clocks, fans and DIMMs need the PawnIO driver; restarting Windows or reinstalling PawnIO usually starts it." | — |
| `live`, elevated, PawnIO installed | none | — | — |

**Empty states** (full mode only; reduced mode shows the dashed placeholders):

| Case | Card | Copy |
|---|---|---|
| No `Gpu*` hardware | GPU empty card | "No GPU detected" · "LHM found no graphics adapter it can read." |
| Elevated, no `Storage` | Disk empty card | "No drives detected" |
| `pawnIoUsable`, no SuperIO or EC | Motherboard empty card | "No fan chip detected" · "LHM doesn't support this board's fan chip yet." |
| SuperIO present, 0 Fan sensors | Motherboard empty card | "No fans detected" |

**Reduced placeholders** (mockup, with the reduced-mode data gaps fixed):
- **Disks**, "Needs full sensors": "Drives, throughput, temperature and SMART health are read by the elevated helper."
- **Motherboard**, "Needs full sensors": "The fan chip needs the helper elevated and PawnIO." The chip's name isn't known unprivileged.
- **Elevated without PawnIO**, the Motherboard placeholder says "Needs PawnIO": "The fan chip is read through PawnIO, which isn't installed."

**Trust panel rows:**

| Row | State | Title · sub-line |
|---|---|---|
| Helper | live, elevated | shield-check "Sensor helper verified" · "Elevated · read-only" |
| Helper | live, unprivileged | shield-check "Sensor helper verified" · "Unprivileged" (verified by hash and PID) |
| Helper | starting / reconnecting | shield "Starting sensor helper…" |
| Helper | stopped | warning (the new icon, in `danger-text`) "Sensor helper not running" · short reason |
| PawnIO | installed | "PawnIO {version with one trailing .0 removed}" ("2.2.0.0" → "2.2.0") · "Detected, not managed by Pophood" |
| PawnIO | not installed | "PawnIO not installed" · "Needed for CPU, fans and DIMMs" |
| PawnIO | unknown (no hello) | "PawnIO" · "Not checked yet" |
| Network | always | "No network" · "Pophood makes no connections. Its web view asks Windows about your Microsoft account; Windows may then contact login.live.com." (the disclosed exception, owner #11 in the T14 session; copy approved in the follow-ups session: "Full sentence in the row (Recommended)") |

**Mockup corrections:**
- Every page uses the dashboard's shell: the PawnIO row and the About link.
- "Hottest core · Core 7" becomes "Hottest CCD · CCD1" on Zen. Unprivileged, the cell reads "Hottest core" with the lock and no suffix.
- The motherboard footer link is "All sensors" in v0.1.0; "Name your fans" arrives with renaming in v0.2.0. Fan rows show LHM's names ("Fan #1"), not the mockup's rename ("CPU fan").
- The whole card is clickable, and "All sensors" is the keyboard target (the requirement says "clicking a card opens the full sensor list").
- The Run buttons and the Runs nav item are hidden.
- **GPU order:** the RTX comes first because of `gpuOrder`, not LHM order (which lists the iGPU first).
- **Kind labels:** "GPU" (not "GPU · discrete / integrated") and "Disk" (not "Disk · C:").
- **Names:** card titles, the Motherboard title and the header summary use LHM's names, with "(TM)"/"(R)" removed. The mockup's shortened names ("Ryzen 9 9900X", "Kingston NV3 1 TB", "RTX 5060 Ti 16 GB") were illustrative.
- **Header summary in reduced mode** leaves the drive out (unprivileged LHM sees no drive); the mockup shows it.
- **Drill-down subline:** "· generic names until you rename them" waits for v0.2.0; the Motherboard count is 26 (P1 includes the 6 `Control` sensors), not 19.
- **Warning icon:** new; no mockup has one.

**Open UI questions (UI proposal), answered:**
1. Theme: follow Windows, and the toggle overrides it and is remembered (#35).
2. Charts: plain SVG, with no library.
3. Comparing 3 or more runs: v0.8.0.
4. Minimum window size: 1024×680.

## Sequence

| # | Step | Why here | Depends on |
|---|---|---|---|
| 1 | **Helper build chain:** `.gitignore`, LHM submodule, `nuget.config`, `PophoodSensors.csproj` + lock file + `BannedSymbols.txt` + `WRITE-ALLOWLIST.md`, a stub `Program.cs`, `build-helper.ps1` | Proves the source-built LHM under AOT, the lock file and the bans before any feature code (C4, C10) | — |
| 2 | **App scaffold and WebView2 lockdown:** Vite/React/Tauri scaffold, `build.rs` hash, `tauri.conf.json`, the C1 guard and the `setup` error message box in `lib.rs`, `webview.rs` (COM init, own environment, `BROWSER_ARGS`, navigation pin), single instance. The first `tauri dev` run is the check that environment creation works in `setup()`. | Every later UI and core step runs inside this shell. OQ15 is designed in from the start. | 1 (sidecar needed at compile time) |
| 3 | **Helper protocol and pipe:** `Protocol.cs`, `ControlParser.cs`, `PipeServer.cs`, `Native.cs` (including `SetDefaultDllDirectories`), lifetime in `Program.cs`, plus helper tests UT-01…UT-03 and UT-06 | The trust boundary first: it's the riskiest and most-reviewed code | 1 |
| 4 | **Helper sensors:** `SensorReader.cs`, `Availability.cs` (with the PawnIO device check), `Deadline.cs`, the sampler loop and its exception policy, `set_period`, plus UT-04 and UT-05 | Frames need the pipe | 3 |
| 5 | **Core helper integration:** `protocol.rs`, `events.rs`, `helper.rs`, `pipe.rs`, plus UT-07…UT-09, UT-11, UT-13, UT-28 and IT-01…IT-17 | The ITs prove the helper and the core client together, unprivileged, before the supervisor depends on them | 2, 4 |
| 6 | **Core supervisor and commands:** `sensors/mod.rs`, `commands.rs`, exit handling, plus UT-10 | Needs a working connection layer | 5 |
| 7 | **UI foundation:** tokens, theme, fonts, icons, shell, trust panel, store (with the watchdog), history, banners and blocking panels, plus UT-21, UT-25…UT-27 | Can start after step 2 using fixtures, in parallel with steps 3–6 | 2 |
| 8 | **UI cards and charts:** `format.ts`, `fields.ts` + fixtures, `path.ts`, Sparkline/LineChart, the 5 cards plus placeholder, empty and starting states, Dashboard, HistoryPanel, plus UT-14…UT-20, UT-22…UT-24, UT-30…UT-32, UT-35, UT-37 | Builds on the store and the shell | 7 |
| 9 | **UI drill-down and About:** `SensorList.tsx`, `About.tsx`, plus `THIRD-PARTY-NOTICES.md` | Needs the store and the charts | 8 |
| 10 | **Docs:** `AGENTS.md` (owner approves the text), `README.md` | Written once the build steps are real | 1, 2 |
| 11 | **Verification and sign-off:** E2E-01…E2E-26 and PERF-01…PERF-05 on a release build (`tauri build --no-bundle`). The owner runs the UAC, PawnIO-uninstall and elevated-capture items. Then the OQ13 ladder (below). | Last: it needs everything | 6, 9, 10 |

Each step ships with its own tests, so there are no test-only steps afterwards. The steps map one-to-one onto `tasks-breakdown` tasks, which may split steps 2 and 8.

**OQ13 ladder** (step 11; each rung is a rebuild and an E2E-15 run):
1. `BROWSER_ARGS` as specified (with `msOneAuthWAM`).
2. If `substrate.office.com` (or `odc.officeapps.live.com`, `hrd.svc.cloud.microsoft`) still appears, add one at a time, re-capturing after each: `msEdgeOSAccountInfoSubstrate`, `msLoadOneAuthInBackground`, `msImplicitSignin`, `msEdgeOnlineAccounts`, `msIdentityCore`.
3. If it's still present: stop, and take it back to the owner (#33). The options are a disclosed exception, or a Fixed Version runtime (`webviewInstallMode: fixedRuntime`), which loses automatic security updates.

## Integration points [external]

| Integration | Availability | Auth / infrastructure | Error handling |
|---|---|---|---|
| **LibreHardwareMonitorLib 0.9.6** (submodule) | Build-time source; runs inside the helper | None. The NuGet closure is pinned by `helper/packages.lock.json` (`RestoreLockedMode`). | `Open` throws → `lhm_failed` → `helper_error`, then retries. Global ISA/PCI mutexes held by another tool silently skip updates (values go stale; see Known risks). |
| **PawnIO driver 2.2.0** (user-installed) | Optional | Opened only by an elevated process (the device ACL is SYSTEM and Administrators) | Detected through the registry in `hello`. Missing → "Needs PawnIO" copy plus the pawnio.eu link. Never installed (C3). |
| **WebView2 Runtime** (Evergreen, system) | Ships with Windows 11; updated by EdgeUpdate, outside the process tree | Needs an STA thread: `setup` calls `CoInitializeEx` first | Environment creation fails → `lib.rs` shows a message box with the error and exits with code 1. (A returned `setup` error would be a silent `panic!("Failed to setup app")` in this subsystem.) Every runtime bump must re-run E2E-15 (ADR 0005). |
| **UAC / AppInfo** (`ShellExecuteExW` runas) | Interactive desktop | User consent; the `main` window is the owner, and COM is initialised on the calling thread | `ERROR_CANCELLED` → `uac_cancelled`; other errors → `elevation_failed`; no frame within 20 s → `elevation_timeout` |
| **Windows APIs** (named pipes, process, SMBIOS, registry) | Always | The pipe DACL is the user SID; client QoS is `SECURITY_IDENTIFICATION` | Mapped to `PipeError` and `ImageError` → notices |
| **Default browser** (pawnio.eu) | User-initiated | — | `Err` → the URL is shown as text |
| **nuget.org, crates.io, npm** | Build time only | `nuget.config` limits NuGet to nuget.org; the lock files pin versions and hashes | A restore failure fails the build |

## Test plan

The scenarios come from the design, and then from an independent QA-scenario pass. That pass was run by a separate worker, which derived about 98 scenarios before reading this plan. Its additions and fixes are merged below, and so are the five spec contradictions it found; see the [QA-scenario pass](#qa-scenario-pass).

### Unit Tests

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| UT-01 | ControlParser accepts `set_period`, and checks the bounds | RF4, RF31 | `Accepted(250)`, `Accepted(1000)`; 249 and 1001 → `out_of_range` |
| UT-02 | ControlParser rejects the P2 parser cases, each with its pinned code | RF31 | The 21 parser cases from P2's corpus (the 1 MiB case moves to IT-05, because it never reaches the parser) are copied into the test, each with the code P2's `ParseControl` returns. Examples: array or string → `not_object`; `"ms":"250"`, `1e30` and `250.5` → `bad_field`; a duplicate field → `bad_json`; CRLF + BOM → `bad_json`; a wrong version → `bad_version`. None throws. |
| UT-03 | Lone surrogate and other unexpected throws | RF31 (P2 crash) | `internal_error` with the exception type; the method returns |
| UT-04 | Availability table and `pawnIoUsable` | RF3 | Unprivileged: `Cpu` → only Load; Motherboard, SuperIO and EC → false; Memory, Storage, `GpuNvidia` and `GpuAmd` → true; `GpuIntel` → true except `Power`. `pawnIoUsable(elevated, installed, devicePresent)`: only `(true, true, true)` is true; `(true, true, false)` (driver not loaded) is false, as are `(true, false, …)` and `(false, …)`. When true, everything is trustworthy. |
| UT-05 | Deadline maths | RF4 | `Next` skips missed ticks and keeps the phase. **Late wake-ups don't drift:** with every wake 15 ms late, 100 calls of `Next(previousDeadline, 1000, wake)` still land on multiples of 1000 from the start. `AfterPeriodChange = max(last + p, now)` |
| UT-06 | Frame serialization | RF2, RF3 | `"v":1` first, camelCase, `"value":null` kept, no serial numbers |
| UT-07 | `parse_line` | RF2, schema mismatch | hello, frame, ack and error parse. `{"v":2,"type":"x","junk":1}` → `SchemaMismatch(2)`, which proves the envelope is checked first. `"v":"1"`, a missing `v`, or non-JSON → `Malformed`. |
| UT-08 | `sensor_key` | RF13 basis, ADR 0008 | `"/gpu-nvidia/0/load/3\|GPU Bus"` ≠ `"…\|GPU Memory"`; the format is `id\|name` |
| UT-09 | `HelperImage::open_verified` | RF14, C11 | Match → Ok; mismatch → `HashMismatch`; missing → `Missing`; while it's held, rename, overwrite and delete fail with a sharing violation |
| UT-10 | Restart policy: a full death sequence | Slice 1 "helper dies" | The worked example: attempts after 1, 5 and 15 s, then `stopped`; a 60 s live period resets to attempt 1 |
| UT-11 | `new_pipe_name` | RF2 | Matches `^pophood-[0-9a-f]{32}$`; 1000 calls give distinct names |
| UT-12 | `is_app_url` | RF29 | Allows `http://tauri.localhost/…` (and `http://localhost:1420/…` only under `cfg(dev)`); rejects `https://pawnio.eu`, `https://substrate.office.com`, `file:`, and the prefix traps `http://tauri.localhost.evil.com/`, `http://tauri.localhost@evil.com/`, `http://tauri.localhost:8080/` and `https://tauri.localhost/` |
| UT-13 | Compiled-in hash | RF14 | `POPHOOD_HELPER_SHA256` equals the SHA-256 the test computes from `binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` (64 lowercase hex) |
| UT-14 | CPU rules (full fixture) | Slice 1 CPU card | Hero = `Core (Tctl/Tdie)`; load; effective clock in GHz; package power; "Hottest CCD · CCD1" from `CCDs Max (Tdie)` |
| UT-15 | Reduced fixture | Slice 1 reduced mode | Hero = Total load; the first field is a locked "Package temperature"; clock, power and "Hottest core" (no suffix) are locked "Needs full sensors"; Disks and Motherboard placeholders; no OC chip; the header has no drive |
| UT-16 | Elevated-without-PawnIO fixture | Slice 1 "elevated, PawnIO missing" | The Disk card is live; CPU fields "Needs PawnIO"; Motherboard placeholder "Needs PawnIO"; never AMD 0 °C / 0 W |
| UT-17 | Empty states | Slice 1 "none detected" | No GPU → "No GPU detected"; elevated without Storage → "No drives detected"; no SuperIO → "No fan chip detected"; SuperIO with 0 fans → "No fans detected" |
| UT-18 | OC profile | RF12, #24 | `jedecSpeed`: 0.416 ns → 4800, 0.357 → 5600, 0.312 → 6400, 0.625 → 3200, and the DDR4 bins 0.750 → 2666, 0.938 → 2133, 0.682 → 2933, 1.071 → 1866. Configured 6000 vs 4800 → "Likely on · inferred" and the caption; 4800 → "Likely off · inferred"; configured 2666 vs tCK 0.750 → "Likely off"; reduced → hidden |
| UT-19 | GPU rules | Slice 1 GPU card | NVIDIA load = `GPU Core`; AMD iGPU load = `D3D 3D`, temperature = `GPU VR SoC`, VRAM 512 MiB → "0.5 GB" |
| UT-20 | Motherboard rules | Slice 1 MB card | Rows for Fan #1 (1,744 RPM) and Fan #5; footer "4 more fan headers read 0 RPM."; scale = 2000 for a top value of 1744, and 2500 for a synthetic 2140 |
| UT-21 | History store and watchdog | RF10 (UI, #38) | Appends; trims > 600 s; keeps nulls; drops aged-out series; `stale` follows the phase; with fake timers, `live` with no frame for 3 × `periodMs` → `stale`, a status event then keeps it stale (T12), and the next frame clears it |
| UT-22 | `linePath` and `areaPath` | Charts | Time-to-x mapping; a null starts a new `M`, and so does a time gap over 3 s (T12); values clamp to the domain; a series with a gap gives two closed area segments, each ending on the baseline (no fill across the gap) |
| UT-23 | Formats | UX units | Every row of the [number formats](#number-formats) table; MT/s without grouping ("6000") |
| UT-24 | Cards render | "No card shows a fake 0" | A locked field never renders a digit; the lock text is present; placeholder cards aren't clickable |
| UT-25 | Banner selection, including combined states | Error and empty states | Each status in the [UI states](#ui-states-not-mocked) table gives its copy and actions. Combined states (e.g. `reconnecting` with PawnIO missing, `prompting` with a notice, `reconnecting` while elevation is in flight) show the highest-priority row only. The `starting` panel, the three `elevation_*` copies (`elevation_timeout` has no `{detail}`), the "Reduced sensors" title and the PawnIO-driver-not-running banner each render. The history panel is absent under every blocking panel. |
| UT-26 | Theme | #35 | Follows the system by default; toggling stores an override; toggling to the system theme clears it; a localStorage exception is tolerated |
| UT-27 | Trust panel | UI proposal shell | Each row and state in the trust-panel table |
| UT-28 | Rust↔TS contract | RF2 seam | Rust serializes a sample `SensorEvent` equal to `src/test/fixtures/event-frame.json`; TS parses the same file into `UiFrame` |
| UT-29 | Supervisor transitions | [State machine](#supervisor-state-machine), NoticeCode | One case per row through the pure `transition`. **Failures:** while `starting` → `reconnecting`; each integrity code at start, restart and elevation → `stopped` plus `Terminate(all)`; elevated PID mismatch → `pipe_squatter`. **Elevation outcomes:** EOF, a malformed line or `lhm_failed` before the elevated frame, or `hello.elevated == false` → `elevation_failed`; 20 s → `elevation_timeout`; an elevated source dying → `full_sensors_lost` once live again. **Unprivileged death during elevation:** while `prompting` or `connecting` → `reconnecting` with elevation kept and **no** restart effect; then elevated first frame → `live` elevated; or cancel / fail / timeout → a restart effect after `RESTART_DELAYS[n−1]`. **Edge rows:** a child exit before connect → failure with "exit code N"; a non-`lhm_failed` `error` → no state change; a frame with `t` ≤ the last forwarded → dropped; `Exit` → one `wait_all` effect. **Guards:** `enable_full` is a no-op unless live, unprivileged and idle; `retry` is a no-op unless `stopped`; the notice clears on success, except `full_sensors_lost`; `restartAttempt` is null outside `reconnecting`. |
| UT-30 | Disk and Memory rules | Disk and Memory done-when | **Disk:** Read/Write ÷ 1e6 at 1 dp; temperature fallback chain; `Life` → "% life left"; a 2-drive synthetic fixture gives 2 cards. **Memory:** "2 × 16 GB DDR5"; unequal sizes → the total; used / (used + available); speed = the max. |
| UT-31 | Lock-label matrix, and no VID | Lock labels; "No card shows VID" | Every needs × elevated × pawnIo (`installed`, `loaded` true / false / null) combination with a null value gives the right label, or "—"; installed but `loaded == false` while elevated gives "Needs PawnIO". The full fixture puts no Voltage sensor on any card. |
| UT-32 | History chart series | Series table | On the full fixture (LHM order: iGPU first), Temperatures series 2 is the RTX's `GPU Core` and Load/Power series 2 and 3 are RTX then iGPU, as in mockup E1; a locked series has no path and its legend shows the lock label; legend names and card-format values; the "Drive" row when there's no drive; the fixed domains |
| UT-33 | `CreateComputer` toggles | #19, #30 | The 6 toggles true; Controller, Network, Psu and Battery false |
| UT-34 | Card scopes and drill-down groups | Card scopes, Drill-down groups | `componentScope` for each card; group order; plural labels; `index` order; the Memory scope is grouped by hardware first (`/ram` and `/vram` "Memory Used" rows sit under different headings); the Motherboard scope has a "Controls · 6" group |
| UT-35 | Remaining field fallbacks | Card field rules | CPU `Core (Tdie)`, `CPU Package`, CCD1 only, and Intel `Core Max` with `CPU Core #n` and hybrid `P-Core #n` / `E-Core #n` suffixes; no match → "Hottest core" with no suffix; `Cores (Average)` alone → "Effective clock" stays "—"; the GPU power and clock chains; the Motherboard title and the fan footer for n = 0, 1 and 4 |
| UT-37 | Titles, labels, GPU order and sparklines | Card titles and kind labels, `gpuOrder`, Sparklines, Header summary | Kind labels "GPU" and "Disk"; titles drop "(TM)"/"(R)" ("AMD Radeon Graphics"); `gpuOrder` puts the RTX (16311 MiB) before the iGPU (512 MiB) and keeps LHM order on ties; each card's sparkline series and domain from the [Sparklines](#sparklines) table (CPU switches to load in reduced mode; Motherboard has none); the header summary string for the full and reduced fixtures |
| UT-36 | `ValuesTimeWindow` reset | Memory growth: LHM keeps one value every 4 updates (`Sensor.cs` ≈:115-129) | `SensorReader` over a real `Computer { IsMemoryEnabled = true }`, after 20 updates: every sensor has `ValuesTimeWindow == Zero` and empty `Values` |

**Strategy:**
- **Helper:** xunit covers the pure parts (parser, classification, deadline maths, serialization). UT-33 and UT-36 also load LHM, using only its unprivileged Memory group.
- **Core:** `#[test]` covers protocol, key, image lock, restart policy, the `transition` table and the navigation filter. No mocks: the image tests use temp files, and `transition` is pure.
- **UI:** vitest + jsdom covers the rules against P1-derived fixtures, plus a few `@testing-library/react` renders for the "never a fake 0" and banner contracts.

### Integration Tests

All of these are in `src-tauri/tests/helper_pipe.rs`: the real published helper, unprivileged, on the owner's PC. The helper must be built first. IT-14 needs the `windows` feature `Win32_Security_Authorization`, set as a `[dev-dependencies]` feature only.

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| IT-01 | Launch, verify, hello, first frame | RF2, RF9 | `hello` v1, `elevated: false`, `pawnIo.installed` matches the registry; first frame within 3 s; ≥ 150 sensors; keys unique |
| IT-02 | RF3 in a real unprivileged frame | RF3 | Every `Cpu` sensor except Load is `null`; no `SuperIO` or `Storage` hardware |
| IT-03 | Cadence at 1000 ms | RF4 | Mean frame `t` delta 1000 ± 20 ms over 10 frames; cumulative drift < 50 ms |
| IT-04 | `set_period` 250, then 1000 | RF4 | `ack`. Skip frames until the first one after the ack. The next 10 frames have `periodMs` 250 and a mean of 250 ± 10 ms. Back to 1000 the same way. |
| IT-05 | Fuzz over the pipe | RF31 | All 22 cases, including the 1 MiB line (`too_long`), get an `error` reply; then a valid `set_period` gets an `ack`; the helper keeps running |
| IT-06 | Disconnect → exit | RF5 | After the client drops, the process exits within 5 s with code 0 |
| IT-07 | Foreign client | RF31 | Helper launched with `--client C:\Windows\notepad.exe`: our connection reads 0 bytes, then EOF or OS error 233/109; the helper is still running (the test then kills it) |
| IT-08 | Squatter before the helper | RF9, `FirstPipeInstance` | The test creates the pipe first; the helper exits with code 3 |
| IT-09 | Squatter answering the app | RF9 | The test process serves the name; `connect_verified(expected_pid = other)` → `Squatter`; the fake server reads 0 bytes. Second case (T12): a pipe whose DACL denies everyone → `Squatter` ("the pipe denied access") |
| IT-10 | No client | RF5 | `#[ignore]`: exits with code 4 in 30–31 s |
| IT-11 | Memory facts | RF12 | ≥ 1 module, `configuredMTs` > 0, equal to `Win32_PhysicalMemory.ConfiguredClockSpeed` (read through `pwsh Get-CimInstance` in the test), and `sizeGB` × 1024 equal to `Win32_PhysicalMemory.Capacity` / 2²⁰. On this PC: 2 × 16 GB, `DDR5`, 6000. |
| IT-12 | Spawn under the file lock | C11 | `launch_unprivileged` succeeds while the `HelperImage` is held |
| IT-13 | Bad arguments | RF31 | A missing `--pipe`, `--pipe` with no value, the name `foo` or a relative `--client` → exit code 64 |
| IT-14 | Pipe DACL | RF2 | `GetSecurityInfo(SE_KERNEL_OBJECT, DACL)` on the connected pipe: exactly one allow ACE, for the current user SID, whose mask **includes** read and write (`PipeAccessRule` adds `SYNCHRONIZE`, so don't compare the mask for equality); no Everyone, Anonymous, Administrators or NETWORK ACE |
| IT-15 | Wrong client, then the right one | "keeps listening" | A pwsh `NamedPipeClientStream` client gets disconnected with 0 bytes; the test then connects inside the window and gets `hello` |
| IT-16 | Line-size limits | 1024 B / 4 MiB | **Helper:** a 1024-byte `set_period` (padded with JSON whitespace) gets an `ack`; 1025 bytes → `too_long`, and the next line in the same write still parses. **Core:** a test server sends 4 MiB + 1 → `LineTooLong`; a 30 KB line parses. |
| IT-17 | Early child exit | Supervisor edge rows | The test creates the pipe name first, then launches the helper on it (it exits 3); `connect_verified` returns `Squatter` ("the helper found its pipe name taken"; T12 review, A1) within 1 s, well before the 10 s deadline |

**Test data:** the owner's PC (PawnIO 2.2.0 installed). The hardware-specific assertions (the IT-11 values, IT-01's "≥ 150") are behind `POPHOOD_OWNER_PC=1`, so they skip elsewhere.

### E2E Tests

Run these on a release build (`npm run tauri build -- --no-bundle`). **O** = the owner runs it (UAC or an elevated capture); **A** = the agent can run it.

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| E2E-01 (A) | Reduced mode at first launch | Slice 1 happy path, reduced | Briefly "Starting the sensor helper…", then CPU, Memory and 2 GPU cards with the RTX first; sparklines on the CPU, Memory and GPU cards; dashed Disks and Motherboard placeholders; the "Reduced sensors" banner; trust panel "Unprivileged"; ~1 s refresh; no fake 0 anywhere; no Run buttons and no Runs nav item |
| E2E-02 (O) | Enable full sensors, plus the AOT smoke test and privilege checks | G2, C1, C10, Connecting ≤ ~3 s | **Before clicking:** a background pwsh loop tries an exclusive open and a rename of the helper exe every 250 ms and logs each sharing violation; a screen recording runs from the "Yes" click. **Then:** the UAC prompt opens in the foreground (not as a flashing taskbar button), "Waiting for the UAC prompt…", then "Connecting to sensors…" for ≤ ~3 s (measured on the recording), then 258 sensors on this PC (CPU temperatures, SuperIO 26, DIMMs 2 × 21, NVMe 21), a Disk card, Motherboard fans and the OC chip. **Both GPUs keep their sensors when elevated,** which proves `SetDefaultDllDirectories(System32)` still finds `nvapi64.dll` and `atiadlxx.dll`. Trust panel "Elevated · read-only". The log shows sharing violations up to the elevated launch. **Privilege:** Task Manager's Elevated column shows No for `pophood.exe` and `msedgewebview2.exe`; exactly one `pophood-sensors.exe` (Yes) within 4 s of going live; no console window. |
| E2E-03 (O) | UAC cancelled | Error state | Stays reduced with the message; the button works again |
| E2E-04 (O) | Elevated helper never connects | Error state | A pre-armed elevated loop suspends the new elevated `pophood-sensors.exe` as soon as it appears (Sysinternals `pssuspend`, or `NtSuspendProcess` through `Add-Type`). After 20 s: the `elevation_timeout` message, reduced mode, and the process **terminated through the `ShellExecuteExW` handle**: `Get-Process -Id <pid>` fails within 1 s of the message, and the pre-armed loop never resumed it. This is the real check of P2 E2's console-only "TERMINATE allowed". |
| E2E-05 (A) | Helper missing | Error state | Rename the exe next to `pophood.exe`: blocking panel, no UAC offered, Retry works after restoring it |
| E2E-06 (A) | Hash mismatch | Error state | Replace the helper with another exe: blocking panel; Task Manager shows no `pophood-sensors.exe`; no Enable button |
| E2E-07 (A) | Helper dies and recovers | Error state, restart policy | First end-task on `pophood-sensors.exe` → "restarting… (attempt 1 of 3)" and values back in ≤ 3 s. Kill again each time the restart is live, all within 60 s: attempts 2 (5 s) and 3 (15 s). A 4th kill → "Sensors stopped" + Retry. The UI never freezes. |
| E2E-08 (O) | Elevated helper dies | Error state | Reduced mode with the `full_sensors_lost` line; no automatic UAC prompt; "Enable full sensors" works again |
| E2E-09 (A, O) | Normal close | Lifetime | No `pophood-sensors.exe` 5 s after closing, unprivileged and elevated (`Get-Process pophood-sensors` loop), and also when closing during "Connecting to sensors…", while two helpers run |
| E2E-10 (A, O) | App killed | Lifetime | End task on `pophood.exe`: the helper is gone in ≤ 35 s (expected ≤ 2 s), in both an unprivileged and an elevated run. **UAC window:** a timed background `Stop-Process -Name pophood` fires 3 s after clicking Enable, while the prompt is up; then accept UAC. The orphaned elevated helper exits in ≤ 35 s (the 30 s no-client rule). |
| E2E-11 (A) | Second launch | RF7 | The existing window comes forward; still one `pophood.exe` and one helper |
| E2E-12 (A) | Drill-down | RF26 | Card click and "All sensors" open the list with live values; the first row is selected; detail Min/Max; the Memory drill-down is grouped by hardware; the breadcrumb goes back |
| E2E-13 (A) | Theme across restarts and OS switches | #35 | The override persists across a restart; with no override, a live Windows theme switch is followed |
| E2E-14 (O) | PawnIO missing: banner, link and elevated without PawnIO | C3, C5; done-when "If PawnIO isn't installed…" and "Elevated, but PawnIO is missing" | The owner uninstalls PawnIO, which removes `Uninstall\PawnIO`, so `PawnIo.IsInstalled` is false (the driver may stay loaded until reboot, which doesn't matter). **Unprivileged:** trust panel "PawnIO not installed"; the reduced banner has the PawnIO line; "Get PawnIO (pawnio.eu)" opens the default browser and the webview doesn't navigate. **Then Enable full sensors:** the Disk card is live; CPU temperature, clock and power show "Needs PawnIO", never 0 °C, 0 W or 1.55 V; the Motherboard placeholder says "Needs PawnIO"; the elevated-without-PawnIO banner shows. Reinstall PawnIO afterwards. This is the only live check of these two done-when items on this PC; UT-16 covers them with a fixture. |
| E2E-15 (O) | Network sign-off, the P5 method | RF29, OQ13 | **Scripted flow** during `audit-network.ps1` (elevated capture, app unelevated): start, 60 s reduced, Enable full sensors (accept UAC), open a drill-down, switch theme, then idle. **Don't click the PawnIO link:** its browser may be a child of `pophood.exe`. 180 s, plus one 30-min idle run. **Pass:** no non-loopback flow from the tree; no system-wide DNS for substrate, odc, hrd or login.live during the window; the browser command line has `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1`. **Disclosed exception (T14, owner: "Disclosed exception (Recommended)"):** a `login.live.com` lookup by `wlidsvc` (with Dnscache) that follows the tree's own WAM or OnlineId call is recorded, not failed (RF29). Since the follow-ups session, `audit-network.ps1` records the tree's WAM / OnlineId loads and each requester's services and applies this rule itself (before, it needed Process Monitor alongside or the module-load pre-screen, `oq13-prescreen.ps1` in the T14 session). Any flow or DNS from the tree still fails. Passed in T14 (run 3). |
| E2E-16 (O) | Elevated helper writes nothing and installs nothing | RF5, RF6 | Process Monitor, started before Enable and filtered on process name `pophood-sensors.exe`: no file creates or writes other than the pipe and devices; no Process Create; no writes under `HKLM\SYSTEM\CurrentControlSet\Services` |
| E2E-17 (A, O) | Re-verify before every launch | RF14 "every launch"; "never offers to elevate an unverified binary" | While live unprivileged, move the helper aside and put another exe in its place. **Enable full sensors** → no UAC prompt, and the hash-mismatch blocking panel. Restore it and Retry → live. **Swap again, then end the running helper** → the restart finds the mismatch: blocking panel, nothing launched. |
| E2E-18 (A) | Webview reload | `subscribe_sensors` replaces the Channel | F5 or Ctrl+R: values return in ≤ ~1 s and history restarts empty; still one helper; an elevated session stays elevated with no new UAC prompt |
| E2E-19 (A) | Banned API check works | RF1, RF5, RF6 | Each of these temporary lines fails the build with RS0030 (then reverted), one per class of ban: `sensor.Control.SetSoftware(50)`; `new Motherboard(computer.SMBios, null)`; `computer.IsControllerEnabled = true`; `new CorsairPsuGroup(null)`; `SMBusManager.DetectSMBuses()`; `DriverManager.Driver`; `Stdlib.remove("x")`; `Logger.SaveToFile("x", false)`; a `Kernel32` member; `File.WriteAllText("x", "")`; `ZipFile.CreateFromDirectory("a", "b")`; `Process.Start("x")`. A line that builds means its entry resolves to nothing and must be fixed. |
| E2E-20 (A) | CSP and navigation pin | RF29, C6 | A release build with the `devtools` feature: `fetch("https://example.com")` and a remote `<img>` are blocked by the CSP; `location.href = "https://example.com"` and `window.open(…)` do nothing; `invoke("plugin:window\|close")` is rejected; zero CSP violations during a walk through every screen |
| E2E-21 (A) | Minimum window size | UI question 4 | At 1024×680: 2 columns, nothing clipped; the Motherboard and Memory drill-downs keep the list and detail side by side. At 1280: 3 columns. The history legend may sit below the chart at 1024 (accepted). |
| E2E-22 (A) | Keyboard and focus | Accessibility | Every action reachable with Tab; 2 px focus ring with a 2 px offset; the toggle's `aria-label`; the landmarks (`nav` "Main", "Reduced sensors", "History", "Sensor list", "Sensor detail") are present |
| E2E-23 (A) | About page and notices | RF30, Monitoring | Shows 0.1.0 and LHM 0.9.6 @ `3d331e3`. The SHA-256 equals `Get-FileHash` of the shipped helper. Every Dependencies-table component and the LHM source location are listed; URLs appear as text. |
| E2E-24 (A) | Supply-chain pins and the shipped files | C4, OQ8, #39 | Changing one `contentHash` in `helper/packages.lock.json` makes `build-helper.ps1` fail (NU1403). `git submodule status` shows `3d331e3`. The release folder holds only `pophood.exe` and `pophood-sensors.exe` (no Mono.Posix DLLs). Rebuilding the helper changes `POPHOOD_HELPER_SHA256` (`rerun-if-changed`). **Static imports:** `dumpbin /imports pophood-sensors.exe` (from the MSVC Build Tools) lists only KnownDLLs and `api-ms-win-*` API sets, because static imports resolve before `Main` and `SetDefaultDllDirectories` can't cover them; any other import (the NativeAOT runtime brings `bcrypt` and `IPHLPAPI`) is allowed only while `dumpbin /loadconfig` shows `0800 Dependent Load Flag`, and a copy of the helper next to garbage files with those names still starts (exit 64 without arguments, not `0xC000012F`). T12 review, R1. **T15 (BUG-T14-01):** the flag doesn't reach the imports' own imports, so each non-KnownDLL static import whose own flag isn't 0x800 may import (statically or by delay load) only KnownDLLs, API sets, ntdll and the names the plant check shows load after `Main`'s first act (`bcryptPrimitives.dll`); `CRYPT32` is a delay-load import; the garbage files include `CRYPT32` and `DPAPI`. Script: `sessions/20261022100556_pophood-v010-t15-dll-confine/e2e24-static.ps1`. |
| E2E-25 (O) | Unprivileged helper dies during the UAC prompt | State machine: unprivileged death during elevation | Click Enable full sensors; while the prompt is up, a pre-armed background `Stop-Process -Name pophood-sensors` (unprivileged instance only) fires. Within ~1 s: "Sensors disconnected · waiting for full sensors…", every value "—", and no second `pophood-sensors.exe` appears. **Run A:** accept → live, elevated. **Run B:** cancel → the `uac_cancelled` line, then attempt 1 after 1 s → live, unprivileged. The UI never shows frozen values as live. |
| E2E-26 (O) | Refuses to run elevated | C1 | Right-click `pophood.exe` → Run as administrator and accept UAC: the "Pophood never runs as administrator" message box, exit code 1, no window and no `pophood-sensors.exe`. |

### Perf baselines (manual)

The repo has no perf/regression skill, and the requirements set no CPU, memory or render budgets beyond the sampling rates. These scenarios **record baselines** now, so that v0.3.0's 250 ms sampling has something to compare against. The thresholds are starting points for this PC, not repo baselines.

**Gap:** a repo-local perf skill is a candidate for the `close` skill's repo-local skill mint.

| ID | Surface | Manual scenario |
|---|---|---|
| PERF-01 | ~30 KB frames go through a Channel `fetch` and two JSON parses | Devtools build, elevated, a 60 s Performance trace: main-thread work per frame p95 < 16 ms, no task > 50 ms |
| PERF-02 | One store version counter, so the whole dashboard re-renders each frame | React Profiler commit time per frame, on the Dashboard and in a drill-down |
| PERF-03 | 10-min history (258 series × 600 points, `splice` on every frame) | JS heap flat (±10%) from minute 11 to minute 30 |
| PERF-04 | Elevated update time (SMART, SPD, SuperIO) against 1000 and 250 ms; missed ticks are skipped silently | The owner runs IT-03 and IT-04 from an elevated shell (the helper then starts elevated with PawnIO): p99 of the frame `t` delta; no skipped ticks at 1000 ms |
| PERF-05 | Idle CPU of the whole tree | A 5-min `Get-Counter '\Process(*)\% Processor Time'` for pophood, msedgewebview2 and pophood-sensors, recorded |

### QA-scenario pass

- **Who and how:** one independent worker. It derived about 98 scenarios from the Design sections and the slice-1 done-when list before it read this plan.
- **Added:**
  - UT-29…UT-36;
  - IT-14…IT-16;
  - E2E-17 (re-verify before every launch), E2E-18 (webview reload), E2E-23 (About and notices), E2E-24 (supply-chain pins);
  - PERF-01…PERF-05.
- **Fixed:**
  - weak or wrong expectations in UT-01, UT-02, UT-04, UT-07, UT-10, UT-13, UT-17, UT-20, UT-25;
  - weak or wrong expectations in IT-04, IT-07, IT-11;
  - steps that couldn't be run as written in E2E-01, E2E-02, E2E-04, E2E-07, E2E-08, E2E-10, E2E-13, E2E-15, E2E-16, E2E-20.
- **Cut or merged:**
  - IT-07's 30 s part (the same as IT-10);
  - the separate elevated AOT smoke test, folded into E2E-02, with the Mono.Posix check moved into E2E-24;
  - the helper working-set test, replaced by UT-36. It couldn't catch the leak it was meant for: LHM keeps one value every 4 updates, about 0.6 MB per 10 min, far inside a +10 MB threshold.
- **Contradictions settled in the design:**
  1. A PID mismatch on the elevated pipe is `pipe_squatter`, which is blocking. All four integrity codes are blocking wherever they're detected.
  2. The restart policy is now one worked example: 3 attempts after 1, 5 and 15 s.
  3. A verify failure at `enable_full_sensors` blocks, with no UAC prompt.
  4. Failures while `starting` lead to `reconnecting`.
  5. `elevation_timeout` (20 s, no elevated frame) and `elevation_failed` (an error, an early exit, or `hello.elevated == false`) are now distinct.
  - **Added along the way:** the notice `full_sensors_lost`, for E2E-08.
- **Verdict:** every committed behaviour maps to at least one scenario.

**Adversarial review (Rev 1.3):**
- **Added:** UT-37, IT-17, E2E-25 (unprivileged death during the UAC prompt), E2E-26 (refuses to run elevated).
- **Rewritten:** E2E-14 is now the owner's PawnIO-uninstall run; the old version couldn't run on a PC with PawnIO installed, because the link only shows when it's missing.
- **Strengthened:** UT-04 (Intel GPU power, device check), UT-05 (late wake-ups), UT-12 (prefix traps), UT-15, UT-18 (DDR4 bins), UT-21 (watchdog), UT-22 (area segments), UT-23, UT-29 (the new rows), UT-32 (GPU order), UT-34, UT-35, IT-11 (size), IT-13, IT-14 (mask includes), E2E-01, E2E-02 (UAC foreground, GPU DLLs), E2E-04 (termination through the handle), E2E-09 (two helpers), E2E-12, E2E-19 (one negative per ban class), E2E-21 (drill-down), E2E-22, E2E-24 (static imports).

## Monitoring and observability

There is no telemetry, crash upload or remote logging (C5, RF29). Local observability only:
- **`SensorStatus`** (phase, notice code and detail, restart attempt) is the user-visible health signal.
- **The trust panel** shows helper verification, privilege and PawnIO state.
- **The About page** shows the app version, LHM version and commit, and the expected helper SHA-256, for checking against `build-helper.ps1`'s output.
- **The helper's `error` messages** carry diagnostics over the pipe; the helper writes no files (RF5).
- **Debug builds** `eprintln!` each supervisor transition, and every non-fatal helper `error` reply, to the `tauri dev` console.
- **Startup failures** (the C1 guard, WebView2 environment creation, `setup`) show a native message box before exiting, because a release build has no console.
- **WebView2 crash dumps** stay local in `%LOCALAPPDATA%\dev.pophood\EBWebView\Crashpad\reports` (custom crash reporting) and are never uploaded.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Rejected alternatives |
|---|---|---|
| History in the UI (#38) | The UI needs the window anyway; least code | Core ring buffer plus a snapshot on subscribe: survives F5, costs a component and ordering logic |
| Helper hash compiled into `pophood.exe` by `build.rs` (#39) | No separate file to lose or edit; the About page shows it; v0.6.0 adds `diskspd` the same way | `pophood-manifest.json` next to the app |
| `set_period` in schema v1 (#40) | Schema v1 stays unchanged through v0.3.0; the fuzz corpus exercises real fields | v0.1.0 accepting no messages, and a v2 schema in v0.3.0 |
| Own WebView2 environment through `with_environment` | The only supported way to set `IsCustomCrashReportingEnabled` (OQ15); also puts the flags in one Rust constant | `[patch.crates-io]` for wry; `--disable-breakpad` (not honored; research) |
| `msOneAuthWAM` in `--disable-features` | OneAuth (`oneauth.dll` in the runtime folder) has `substrate.office.com/profileb2` built in; WebView2Feedback #5760 shows the switch removes the flow on 155 | `AllowSingleSignOnUsingOSPrimaryAccount` (already false); Edge policies (they don't apply to WebView2) |
| Navigation pinned to the app origin; new windows denied | CSP doesn't govern top-level navigation, so one stray `<a href="https://…">` would make the webview connect out | Relying on CSP alone |
| Server check by PID equality | We hold the child's handle, so the PID can't be reused; stronger than comparing image paths | P2's image-path compare in the client |
| Per-launch random pipe name | Pre-creation squatting becomes impractical; the unprivileged and elevated helpers can coexist | A fixed name (spike) |
| File lock across verify and launch | Closes the exe-swap window between the check and the launch, as tested today. It doesn't close C11 alone: the folder stays user-writable. | Hashing, then launching by path (the original C11 posture) |
| `SetDefaultDllDirectories(System32)` first in the helper | LHM loads four vendor DLLs by bare name, application directory first; a DLL planted next to the helper would run elevated and bypass the hash. All four live in System32. **T15:** plus the `DllSearch` resolver for P/Invokes and the `CRYPT32` delay load for static imports (BUG-T14-01; owner: "Resolver (Recommended)", "Delay-load CRYPT32 (Recommended)"). | Relying on the hash and the lock (they never see DLLs); an admin-only install folder (the installer's job, C11) |
| `pophood.exe` refuses to run elevated | Makes C1 true when the user, a terminal or UAC-off would elevate it, and keeps the WebView2 browser unelevated | Documenting it only |
| COM initialised in `setup` before the environment | With `create: false` no window exists before `setup`, so neither tao nor wry has initialised COM yet, and WebView2 needs an STA thread | Creating the environment later, after a window exists (it must exist before `with_environment` builds the window) |
| GPUs ordered by `GPU Memory Total` | LHM lists the AMD iGPU first; the chosen design puts the discrete GPU first and charts it. VRAM size is the one discrete-vs-integrated signal already in the frame. | LHM order (contradicts mockup E1); D3D12 `UMA` (v0.5.0's job) |
| Frame `t` = the tick's start | Deltas then show the schedule, not `Update()` time; P2's precedent | The time after `Update()` (adds update-time jitter to every delta) |
| Unprivileged helper keeps streaming during elevation | No data gap, and no restart on failure | Kill, elevate, fall back (spike) |
| `sensor_key = id\|name` | Unique in all 6 P1 dumps; a name change orphans a label instead of re-attaching it (RF13) | `id` + `type` (not unique: the type is already in the id); an occurrence ordinal (depends on order) |
| Card rules by exact name and hardware type, not identifier index | Indices depend on order (P1); names are stable with LHM pinned; one tested table instead of ad-hoc matching (spike AVOID) | Identifier patterns |
| "Hottest CCD" on Zen | LHM has no per-core temperatures on Zen desktop parts (`Amd17Cpu.cs`); only Raven Ridge's SMU table has some (`RyzenSMU.cs` ≈:37-40) | Showing "Core n" (impossible on this CPU) |
| Helper as `WinExe`, shipping only the exe | No console window when elevated; Mono.Posix native DLLs never ship (OQ8) | Console exe + `SW_HIDE` |
| Theme through `data-theme` only (#35) | `prefers-color-scheme` keeps reporting the real Windows theme, so "toggle back clears the override" works | `window.setTheme`, which also sets the webview's scheme and hides the system value |
| No capability files | App commands plus a Channel need none; no `core:default` surface | `core:default` (brings window, menu and tray APIs) |

### Known Risks

| Risk | Likelihood / impact | Mitigation / next check |
|---|---|---|
| `msOneAuthWAM` is undocumented; MC1490911 says it may be ignored from Edge 157, and the Evergreen runtime will auto-update | Medium / High (breaks C5 silently) | Re-run E2E-15 on every WebView2 runtime bump (ADR 0005); the OQ13 ladder; test against Dev/Canary with `WEBVIEW2_RELEASE_CHANNELS` (unelevated) before 157 ships |
| OneAuth may delegate to Windows services outside the tree (`wlidsvc`, WebView2Feedback #5688) | **Seen in T14** / Medium. The browser process loads WAM at start and its crashpad handler calls OnlineId about 30 s in; in some launches (3 of 11 watched) `wlidsvc` then starts and resolves `login.live.com`. No feature flag or `--disable-breakpad` stops the calls on 155. | System-wide DNS correlation in `audit-network.ps1`. Disclosed exception (owner #11 in the T14 session, RF29); re-check on every runtime bump |
| `ShellExecuteExW` may refuse while we hold the image lock | Low / Medium | E2E-02. Fallback: drop the lock right before the call (the original C11 posture). |
| WebView2 environment creation in `setup()` hasn't run here yet, even with COM initialised | Low / High (no window) | The first `tauri dev` run in step 2; two public precedents use `with_environment`. A failure shows a message box instead of a silent exit. |
| The helper folder is user-writable (C11). **Corrected in T15 (BUG-T14-01):** this row said `SetDefaultDllDirectories` covers P/Invoke resolution; it doesn't (NativeAOT loads a P/Invoke DLL from the folder by full path first). Coverage by load path: static imports through `/DEPENDENTLOADFLAG:0x800` (the exe's own imports) and the `CRYPT32` delay load (its delay import `DPAPI` had been resolved at process start, folder first); P/Invokes through the `DllSearch` resolver; `LoadLibrary` by bare name through `SetDefaultDllDirectories`. A flag-0 import's own delay imports (`bcrypt` → `bcryptPrimitives`) are safe only because their first use comes after `Main`'s first act: a runtime or LHM change that calls them earlier reopens the hole, which E2E-24 and the plant check are there to catch. NVML's fallback path is built from `%ProgramW6432%`, which a same-user `HKCU\Environment` value sets (verified in the follow-ups session); the helper pins it to the Program Files known folder (ADR 0028). Per-user COM registrations (`HKCU\Software\Classes`) don't reach the elevated helper: Windows ignores them for UAC-elevated processes, and T15's E2E-16 capture shows no CLSID lookup at all | Low / High (code runs elevated) | `build-helper.ps1` checks the P/Invoke modules against the resolver's list (ILC map); E2E-24 walks the static imports; `dll-plant-check.ps1` plants genuine copies of every module the helper loads, unelevated and elevated. Accepted with C11 until the installer puts the helper in Program Files. |
| PawnIO's driver is loaded but one of its modules fails (an unsupported CPU family): fake zeros can still pass | Low / Medium | The device check closes the "installed, driver not running" case. The module case is accepted; a heuristic (CCD or SuperIO sensors present) can come later if it's ever seen. |
| LHM mutates hardware lists on its own threads (DIMM retry, storage hot-plug); an enumeration can race with the sampler | Low / Low | The sampler's per-tick exception policy: skip the frame, give up after 5 in a row. `StorageManager`'s threads come from decoded IL, not from a run. |
| One failed Channel `fetch` stalls every later frame (the JS side buffers by index) | Very low / Medium | The store's frame-age watchdog shows "—" instead of frozen values; a webview reload recovers. |
| Another monitoring tool (HWiNFO) holds LHM's global ISA/PCI mutexes, so values go stale silently | Low / Low | Documented in `AGENTS.md`. `t` keeps advancing while the values repeat, so the UI can't tell. Accepted for v0.x. |
| The AMD iGPU's ADL readings are ambiguous (`GPU Core` power 33–43 W looks like SoC power; the only temperature is `GPU VR SoC`) | Medium / Low | Shown as LHM reports them; revisit the labels with D3D12 data in v0.5.0 |
| Card rules are name-based; other CPUs and boards (Intel, other SuperIO chips) may miss | Medium / Low | Misses show "—" ("Not reported"), never a wrong sensor; add rules plus fixtures as new hardware appears |
| `gpuOrder` by VRAM size could misorder an iGPU with a large carve-out, or two discrete GPUs | Low / Low | Only order and chart slots change, never values. v0.5.0 replaces it with D3D12 `UMA`. |
| `ValuesTimeWindow = Zero` must hold on every sensor, including late ones (the semantics are verified at source: `Sensor.cs` setter clears `Values`, and the `Value` setter stops appending) | Low / Medium (memory growth) | UT-36 (asserts `ValuesTimeWindow == Zero` and empty `Values` after 20 updates) |
| `additionalBrowserArgs` added to `tauri.conf.json` later would be silently ignored | Low / Medium | `AGENTS.md`: flags live only in `webview.rs`; E2E-15 checks the command line |
| Terminating the helper after the 3 s grace could interrupt an LHM bus transaction | Very low / Low | Graceful close first; terminate only as a fallback |
| Unprivileged and elevated LHM both reading the GPUs for about 3 s during elevation | Low / Low | NVAPI and ADL are multi-client. If problems show up, switch to kill-then-elevate. |
| F5 reload loses the 10-minute history (#38) | — / Low | Accepted |
| The native title bar follows Windows even when the toggle overrides | — / Low (cosmetic) | Accepted; revisit on request |
| The NuGet lock covers the shipped closure only; LHM's build-time-only packages (CsWin32, `PrivateAssets`) and other-TFM packages are pinned by version, not by content hash | Low / Medium | nuget.org versions are immutable; building the dependencies from source is due before the public release (#26) |

**Areas needing more research:** whether `msOneAuthWAM` survives runtime 157, and whether a later runtime stops the Windows-account lookups (OQ13 on this PC was settled in T14 with a disclosed exception). **First runs that settle design assumptions:** environment creation in `setup()` (step 2), `ShellExecuteExW` under the lock and the GPU DLLs under `SetDefaultDllDirectories` (E2E-02).

### Compliance with AGENTS.md and Rules

- **Repo state:** no `AGENTS.md` or `.agents/rules/` yet. The drafts in `sessions/20261020135705_pophood-grill-spike-naming/long_term_memory.md` and `sessions/20261020214713_pophood-define-reqs-confidence/long_term_memory.md` were reviewed.
- **Trust invariants:** honoured as restated by ADR 0004: never change hardware state, the allow-list, `IsControllerEnabled` off, no persisting `ISettings`, no elevated file writes, both pipe ends verify, `BROWSER_ARGS`, the elevated-capture audit.
- **Build notes:** `vswhere` on PATH (checked in `build-helper.ps1`).
- **Conventions:** specs under `specs/vX.Y.Z/`; verbatim decisions (Q&A record); sessions under `sessions/`.
- **Branching:** left to the owner. The "commit to main" line in the draft isn't approved, and step 10 drafts `AGENTS.md` for the owner's approval.
- **Machine facts used:** Python isn't installed (scripts are pwsh); WebView2 ignores `WEBVIEW2_*` env vars when elevated, which is irrelevant here because the app is never elevated; use exact-string edits for Windows paths.

### Compliance with Skills

There are no project skills (`.agents/skills`) yet. These session skill drafts apply:
- **`webview2-network-audit`:** E2E-15, and every Tauri/wry/WebView2 bump.
- **`lhm-write-path-audit`:** `WRITE-ALLOWLIST.md` and `BannedSymbols.txt`, and every LHM or dependency bump.
- **`sensor-id-stability-check`:** the `sensor_key` basis; re-run P1 after any LHM bump.
- **Not applicable to v0.1.0:** `disk-calibration-vs-cdm` (v0.6.0) and `check-name-availability`.

### Relevant and Dependent Files

- **Specs:**
  - `specs/v0.1.0/requirements.md`
  - `specs/v0.1.0/ui-proposal/ui-proposal.md`
  - `specs/v0.1.0/ui-proposal/mockups/{dashboard,sensors-motherboard}.dc.html`
  - `specs/v0.1.0/probe-results.md`
  - `specs/v0.1.0/spike-results.md`
- **ADRs:** `sessions/*/decisions/0001…0008`
- **Precedents:**
  - `C:\Users\jimmy\pophood-probes\probe-pipe\{helper\Program.cs, client\src\main.rs, scripts\*.ps1}`
  - `probe-net\pktmon-capture-unelev.ps1`
  - `probe-ids\ids-{unpriv,elev}-*.json`
  - `C:\Users\jimmy\projects\pc-bench-spike\{helper\SensorHelper\Program.cs, helper\SensorProbe\Program.cs, tauri-hello\src-tauri\src\lib.rs, tauri-hello\src\App.tsx}`
- **Upstream sources:**
  - LHM `3d331e3`: `Hardware/Computer.cs`, `Hardware/Sensor.cs`, `Hardware/ISettings.cs`, `Hardware/SMBios.cs`, `Hardware/Cpu/Amd17Cpu.cs`, `Hardware/Cpu/IntelCpu.cs`, `Hardware/Gpu/IntelIntegratedGpu.cs`, `Hardware/Memory/DimmMemory.cs`, `Hardware/Memory/MemoryGroup.cs`, `Hardware/Motherboard/Motherboard.cs`, `Hardware/Storage/StorageGroup.cs`, the public `Controller` and `Psu` groups, `Interop/{NvApi,AtiAdlxx,IntelGcl,NvidiaML}.cs`, `PawnIo/PawnIo.cs`, `LibreHardwareMonitorLib.csproj`
  - NuGet XML docs and metadata: RAMSPDToolkit-NDD 1.4.2, BlackSharp.Core 1.0.7, HidSharp 2.6.4, Mono.Posix.NETStandard 1.0.0
  - tauri 2.12.4: `src/webview/webview_window.rs`, `src/webview/mod.rs`, `src/ipc/channel.rs`, `src/app.rs`, `src/manager/mod.rs`
  - wry 0.57.0: `src/webview2/mod.rs`; tao 0.37.1: `src/platform_impl/windows/window.rs`
  - webview2-com 0.39.1: `src/options.rs`
  - tauri-build 2.7.3: `src/lib.rs`
- **New in this version:** every file in the [Implementation map](#implementation-map).

## Open questions from requirements: disposition

| # | Disposition |
|---|---|
| OQ8 | **Resolved by design:** only `pophood-sensors.exe` ships (`build-helper.ps1`). Confirmed by E2E-02 (elevated smoke test) and E2E-24 (no DLLs in the release folder). |
| OQ13 | **Closed with a disclosed exception (T14, 2026-10-22).** `msOneAuthWAM` removes `substrate.office.com`: none from Pophood's tree in any T14 capture. The ladder's five features, 25 more identity features, `msWebView2EnableFamilySafety`, `--enable-features=msDiagnosticDataForceOff` and `--disable-breakpad` don't stop WebView2's Windows-account calls, which can make `wlidsvc` contact `login.live.com`. Taken back to the owner (#33): "Disclosed exception (Recommended)". `BROWSER_ARGS` stays at rung 1. Evidence: `sessions/20261021181500_pophood-v010-owner-e2e/evidences/oq13-prescreen/SUMMARY.md`. |
| OQ14 | **Deferred** to the public release (non-blocking) |
| OQ15 | **Resolved by design:** `IsCustomCrashReportingEnabled = true` on our own environment. E2E-15 checks `--edge-webview-disable-crash-reporting=1`. |

## Q&A record

Answers given during this techspec session (2026-10-21), with the chosen option quoted verbatim.

| # | Question | Answer |
|---|---|---|
| 35 | Theme default and persistence (open UI question 1) | "Follow Windows, toggle overrides" |
| 36 | Tauri app identifier (names `%LOCALAPPDATA%\<identifier>`) | "dev.pophood" |
| 37 | Techspec scope. The owner first asked "how big of it would be all of v0.1.0? if you had to estimate in tasks, how much would it be?" and got ≈15 tasks for slice 1 and ≈45 for all 8. | "okay let's do something here: let's break each slice into a separate patch or minor so I can do techspec for each one". Applied as one minor version per slice ([version map](requirements.md#version-map)). |
| 38 | Where the live 10-minute history lives | "In the UI (Recommended)" |
| 39 | Where the build puts the trusted helper hash | "Embedded in pophood.exe (Recommended)" |
| 40 | `set_period` in schema v1 now | "Include in v0.1.0 (Recommended)" |
| 41 | The anti-overengineering cut list | "Accept as proposed (Recommended)" |
| 42 | After the adversarial review: E2E-14 now means uninstalling PawnIO for a while, the only live check of the two "PawnIO missing" done-when items on this PC | "that's fine" |
| 43 | After the adversarial review: the re-scored 90% has no margin, and four first runs could each cost about 2 points | "I think that's fine as we have some unknown?" Accepted: the remaining unknowns can only be settled by running the code, and each has a written fallback. |
| 44 | The Motherboard card has no sparkline in the chosen mockup: keep that, or add one? | "Keep it as in the mockup" |

## Revision history

- **Rev 1 (2026-10-21):** first version.
- **Rev 1.1 (2026-10-21):** the independent QA-scenario pass is merged.
  - The supervisor now uses a pure `transition` table.
  - Five state-machine contradictions are settled: integrity codes block wherever they're detected; the restart policy is one worked example; a verify failure at Enable blocks; failures while starting retry; timeout and failure are distinct during elevation.
  - New notice `full_sensors_lost`.
  - `SensorReader.CreateComputer()` is split out for UT-33.
  - Tests: UT-29…UT-36, IT-14…IT-16, E2E-17/18/23/24 and PERF-01…05 added; several existing rows fixed.
- **Rev 1.2 (2026-10-21):** the "Revisit" column links to the `specs/v0.N.0/README.md` scope stubs.
- **Rev 1.3 (2026-10-21):** the adversarial review's findings are applied (verdict "approve with fixes", 85%: 4 high, 8 mid, 18 low).
  - **High:** COM is initialised before the WebView2 environment, and `setup` failures show a message box; `BannedSymbols.txt` covers the public bypasses (persisting `ISettings` through `Motherboard`, the public controller/PSU groups, the toggles) and the RF5/RF6 file and process APIs; the helper calls `SetDefaultDllDirectories(System32)` first, and the lock is no longer said to close C11; the state machine handles the unprivileged helper dying during elevation.
  - **Mid:** GPU order by VRAM size; LHM's own threads and the sampler's exception policy; `Deadline.Next` steps from the previous deadline; the C1 guard; the PawnIO-uninstall E2E; drill-down bases for 1024 px; sparkline sources; the supervisor's edge rows (non-fatal `error` codes, one shutdown deadline, `starting` UI, early child exit, elevated malformed lines, frame order).
  - **Low:** `is_app_url` uses `cfg(dev)` and exact host matching; Intel iGPU power; JEDEC bins; SMBIOS units verified; the PawnIO device check; precedent misquotes; error-table and test-ID fixes; card-rule gaps; mockup corrections; blocking-panel style and the new warning icon; history hidden when blocked; the audit-script port hazards; Memory drill-down grouping; UAC owner window and COM; first frame right after `Open`; requirements wording; the unverifiable versions; the Channel-stall risk.
  - New tests: UT-37, IT-17, E2E-25, E2E-26; E2E-14 rewritten. Confidence re-scored from the review's evidence.
- **T15 (2026-10-22, BUG-T14-01):** the DLL-search coverage is corrected (Summary, steps, the csproj, `Native.cs`, `Program.cs` and test rows, the new `DllSearch.cs` row, the build script, the "Keep" and decision rows, E2E-24, the Known Risks row). Owner: "Resolver (Recommended)", "Delay-load CRYPT32 (Recommended)", "Guard in build (Recommended)".
- **v0.1.1 (2026-10-22):** the drill-down rows (the `SensorList.tsx` and `app.css` drill-down entries, E2E-12, E2E-21, E2E-22, E2E-23) are superseded by [specs/v0.1.1/techspec.md](../v0.1.1/techspec.md). The rest of this spec stands.
