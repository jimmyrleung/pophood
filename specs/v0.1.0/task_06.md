# Task 06 - Core supervisor, UI contract and commands

## Description

Build `SensorService`: one tokio task that owns all helper state and runs the pure `transition(&State, Event) -> (State, Vec<Effect>)` table from the techspec — start, restart policy, elevation alongside the live unprivileged helper, integrity notices that always block, frame ordering, and one shared shutdown deadline. Add the UI contract types (`events.rs`) and the four Tauri commands, and wire them into `lib.rs`. The owner accepts one UAC prompt at the end: the first run of `ShellExecuteExW` under the file lock.

- Status: Code complete (2026-10-21); owner UAC accept, Retry click and PawnIO link check pending
- Complexity: **L** — kept whole because the techspec makes the supervisor a single owner of state with one transition table; every row is a UT-29 case, and splitting the table would leave half-specified states. Sized at 8–10h because `events.rs` moved in from step 5. If it runs long, split along the pure/async seam rather than through the table: (a) `events.rs`, `transition`, UT-10, UT-29, UT-28 Rust half; (b) the effect runner, `commands.rs`, `lib.rs` and the live checks.
- Estimated time: 8–10h
- Depends on: T5 (connection layer), T7 (`src/test/fixtures/event-frame.json`, the shared contract fixture, and the store and trust panel used by the live checks)
- Can run in parallel with: T8, T9, T10, T11

## AI guidance

- `implement-task`: runs this task.
- ADRs `0011-helper-launch-integrity.md`, `0012-ui-owns-live-history.md` (no core-side history), in `sessions/20261021102214_pophood-v010-techspec/decisions/`.
- Trust invariant (until T11 writes `AGENTS.md`): `sessions/20261021102214_pophood-v010-techspec/long_term_memory.md` item 5 — `helper_missing`, `helper_hash_mismatch`, `pipe_squatter`, `schema_mismatch` always block wherever detected; all helpers terminated; never downgraded.
- Keep `transition` pure: no I/O, no clocks; timers are effects. Debug builds `eprintln!` each transition.

## Requirements

- Every row of techspec § Supervisor state machine, including the elevation sub-states and "unprivileged death during elevation".
- Restart policy: `RESTART_DELAYS = [1s, 5s, 15s]`, failure after attempt 3 → `stopped`; 60 s live resets; UAC is never prompted automatically.
- Only `error{lhm_failed}` counts as a failure; other `error` codes are logged in debug only.
- A frame is forwarded only if its `t` is newer than the last forwarded one.
- Deadlines: unprivileged connect 10 s (cut short on child exit) + 10 s hello→first frame; elevated 20 s from `ShellExecuteExW` returning to the first frame.
- Re-verify and lock the image before **every** launch (start, restart, `enable_full_sensors`); a verify failure means nothing launched and no UAC prompt.
- `subscribe_sensors` replaces any previous Channel and sends `status`, then the latest frame.
- `enable_full_sensors` no-op unless live, unprivileged, idle; `retry_sensors` no-op unless `stopped`.
- `open_pawnio_site` opens the hard-coded `https://pawnio.eu` with `ShellExecuteW`; `Err("could not open the browser (code N)")` if ≤ 32.
- `RunEvent::Exit` → `shutdown_blocking`: drop pipes, `wait_all` one 3 s deadline, terminate the rest.
- `SensorStatus`, `UiFrame` etc. serialise exactly as techspec § UI contract: camelCase, except the explicit renames `sizeGB` and `configuredMTs` (see T5).

## Files involved

| Path | Action |
|---|---|
| `src-tauri/src/sensors/events.rs` | Create |
| `src-tauri/src/sensors/mod.rs` | Modify (created in T5 as a module stub → `SensorService` + supervisor + `transition`) |
| `src-tauri/src/commands.rs` | Create |
| `src-tauri/src/lib.rs` | Modify (created in T2; adds `.manage(SensorService::start(..))` via `tauri::async_runtime::spawn`, `invoke_handler`, `RunEvent::Exit`) |
| `src/test/fixtures/event-frame.json` | Modify only to correct it (created in T7). If UT-28 fails, decide against techspec § UI contract which side is wrong; when it is the fixture, fix it and re-run T7's `npm test` (UT-28 TS half). |

## Implementation steps

1. `events.rs` per techspec § Implementation map (`events.rs` row) and § UI contract: `SensorEvent`, `SensorStatus`, `Phase`, `Elevation`, `Notice`, `NoticeCode`, `UiFrame`, `UiSensor`, `UiHardware`, `MemoryModule`; `UiFrame::from(frame, elevated)` adds `key` via `sensor_key`.
2. `sensors/mod.rs`: `State`, `Event`, `Effect` as sketched in techspec § Interfaces, then `transition` row by row from § Supervisor state machine and § NoticeCode. Then the async loop: one `select!` over the command mpsc, the live connection, the elevation sub-future (`spawn_blocking(launch_elevated)` then `connect_verified`) and timers; it executes effects and emits status/frames to the subscribed Channel.
3. `SensorService { start, subscribe, enable_full, retry, shutdown_blocking }` per § Interfaces; `shutdown_blocking` sends `Exit` and blocks on the reply.
4. `commands.rs` per the techspec row and § Endpoints mapping.
5. `lib.rs`: manage the service in `setup` (after `build_main_window`), register the four commands, handle `RunEvent::Exit` (techspec `lib.rs` row). Pass the `main` window's HWND as `isize` for the UAC owner.
6. Write UT-10, UT-29 and the Rust half of UT-28.
7. `npm run tauri dev` smoke through T7's store and shell (`withGlobalTauri` is false, so the devtools console can't call `invoke` directly): the trust panel and status banner show the phase moving `starting → live`.
8. **Owner UAC accept:** with `tauri dev` live and unprivileged, the agent clicks "Enable full sensors" in the reduced banner (T7) and the owner accepts the prompt. This is the first run of `ShellExecuteExW` under the file lock (techspec "Next checks").

## Acceptance Criteria

- `cargo test` passes UT-10, UT-28 (Rust half) and UT-29, and still passes T5's tests (test output).
- UT-29 has at least one named case per row of the techspec state-machine table and per `NoticeCode` (the test names listed in the output map 1:1 to the rows; a reviewer can tick them off).
- `npm run tauri dev`: the debug console prints the `starting → live` transitions, and T7's trust panel shows "Sensor helper verified · Unprivileged" (console output and screenshot).
- `stopped` + `helper_missing`: rename `src-tauri\target\debug\pophood-sensors.exe` (the copy the dev app launches, not `src-tauri/binaries/`), then end the running `pophood-sensors.exe`. The restart's verify fails, so the debug console shows `stopped` with `helper_missing`, the blocking panel "Sensor helper not found" appears, and Task Manager shows no `pophood-sensors.exe`. Restore the file and click Retry → `live` (console output and screenshot).
- Closing the dev window leaves no `pophood-sensors.exe` after 5 s (`Get-Process pophood-sensors` errors).
- `open_pawnio_site` opens the default browser at pawnio.eu and the webview stays on the app page (manual).
- **Owner UAC accept:** the prompt opens in the foreground; the debug console shows `prompting → connecting → live (elevated)`; the trust panel shows "Elevated · read-only"; `Get-Process pophood-sensors` lists exactly one process within 4 s of going live (agent's command output plus the owner's confirmation of the prompt). If `ShellExecuteExW` fails under the lock, stop and report to the owner: the techspec fallback (release the lock just before the call) is a design change.

## Testing

- **UT-10** the restart worked example: attempts after 1, 5, 15 s, then `stopped`; a 60 s live period resets.
- **UT-29** every transition row through the pure `transition` (failures while starting, integrity codes at start/restart/elevation, elevation outcomes, unprivileged death during `prompting`/`connecting`, edge rows, guards) — the case list is techspec UT-29.
- **UT-28, Rust half:** serialise a sample `SensorEvent` and assert equality (as JSON values) with `src/test/fixtures/event-frame.json`. The TS half is in **Task 07**.
- Live state-machine behaviour (helper killed, close during connect, reload) is E2E-07, 09, 10, 17, 18 in **Task 13**, and the elevated cases (E2E-02, 03, 04, 08, 25) are in **Task 14**.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Workflow (app start; Enable full sensors; app exit), § Supervisor state machine, § NoticeCode, § UI contract, § Endpoints mapping, § Fixed source parameters (Timing), § Confidence score (fallbacks)
- `C:\Users\jimmy\projects\pc-bench-spike\tauri-hello\src-tauri\src\lib.rs → enable_full_sensors (≈:41-53)` (the flow this changes)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 85% → done 88% for the code; the elevated path (`ShellExecuteExW` under the lock, the elevated switch, `wait_all` on an elevated handle) has **never run**, so those parts stay at plan-level confidence. Remaining uncertainty: the first UAC accept; the Retry button and `open_pawnio_site` (clicks I couldn't drive); `Terminate`/`wait_all` rights on the elevated process handle (E2E-04, E2E-09 O).
- **Evidence:**
  - `cargo test`: 74 lib tests pass (UT-10 ×2, UT-28 Rust half, UT-29 and UT-10 = 49 tests in `machine.rs`, plus the T5/T2 tests); `npm test` 73 pass against the same fixture.
  - UT-29 case names map to the table rows: `row_setup_*`, `row_first_frame_*`, `row_failures_while_starting_*`, `row_child_exit_before_connect_*`, `row_verify_failure_at_{start,restart,enable_full}_*`, `row_squatter_on_the_{unprivileged,elevated}_pipe_*`, `row_schema_mismatch_*`, `row_enable_full_*`, `row_prompting_{cancelled,failed,launched}_*`, `row_connecting_*` (frame, EOF, hello not elevated, deadline, malformed/lhm_failed, child exit), `row_unprivileged_death_while_{prompting,connecting}_*`, `row_reconnecting_then_*`, `row_live_*`, `row_a_non_fatal_error_code_*`, `row_a_frame_not_newer_*`, `row_retry_*`, `row_exit_*`, the `guard_*` cases and `every_notice_code_has_a_producer` (one producer per `NoticeCode`).
  - `npm run tauri dev` (background; `[sensors]` transitions on stderr): `Begin → Verify → Launch → Connect → Hello → first frame → Live` in about 3 s; `PrintWindow` capture showed trust panel "Sensor helper verified · Unprivileged", "PawnIO 2.2.0 · Detected, not managed by Pophood", the Reduced sensors banner with "Enable full sensors" and the UAC hint.
  - Killed the helper: `Eof → Reconnecting → RestartTimer → Verify → Launch → Hello`, restart delay 1 s; killing it again within 60 s used the 5 s delay.
  - Renamed `target\debug\pophood-sensors.exe`, killed the helper: `RestartTimer → Verify` → `VerifyFailed(HelperMissing)` → `Stopped`, no `pophood-sensors.exe` left, capture showed the blocking panel "Sensor helper not found" with Retry and the trust row "Sensor helper not running · Not found next to Pophood". The file was restored afterwards.
  - `CloseMainWindow` with a live helper: the helper was gone after 142 ms (`pophood` also gone).
  - Screenshots were deleted after reading (not committed).
- **Pending (owner or a click I can't drive from here):**
  1. **UAC accept** (the first `ShellExecuteExW` under the file lock): run `npm run tauri dev`, click "Enable full sensors", accept the prompt. Expect the console `prompting → connecting → live (elevated)`, "Elevated · read-only", one `pophood-sensors.exe` within 4 s. If it fails under the lock, stop: the techspec fallback (release the lock just before the call) is a design change.
  2. Clicking **Retry** after restoring the helper (→ `live`) and the **Get PawnIO** link are covered by unit tests (`retry_*`, UT-25) but were not clicked live.
- **Decisions / gaps:**
  - The state machine is in `sensors/machine.rs` (pure) and the runner in `sensors/mod.rs`; the techspec put both in `mod.rs`. `events.rs` and `commands.rs` as specified.
  - `gen` is a reserved word in edition 2024, so link generations are `generation`.
  - **Notice handling on a first frame:** the techspec says the notice clears on success except `full_sensors_lost`. Implemented as: helper_error/helper_exited notices clear, while `uac_cancelled`, `elevation_*` and `full_sensors_lost` stay. Reason: when the unprivileged helper dies during the UAC prompt and the owner then cancels, the elevation outcome was never visible (the reconnecting banner outranks it), and E2E-25 run B expects the `uac_cancelled` line once live again. Enabling full sensors again clears the notice.
  - `Event::Connected` from the techspec's list is not an event: the runner starts the reader when the pipe connects; only `Hello` and later lines drive the machine.
  - A connect error other than timeout/child exit/squatter becomes `LineError` (→ `helper_error`); a read I/O error becomes `Eof` (→ `helper_exited`); `error{…}` codes other than `lhm_failed` are logged in debug builds only.
  - A verify I/O error (e.g. a sharing violation from a scanner) is reported as `helper_missing` with the OS message and blocks; Retry tries again.
  - Restart delays are `[1s, 5s, 15s]`; a failure while elevation is in flight counts as an attempt but defers the restart; with 3 attempts used it stops everything, including the elevated process.
  - The debug log prints one line per transition and skips routine frames (no 30 KB frame dumps).
  - `shutdown_blocking` waits at most 6 s for the supervisor's reply (3 s helper deadline plus margin).
