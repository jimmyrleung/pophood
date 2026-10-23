# Task 05 - Core connection layer and pipe integration tests

## Description

Build the Rust side of the helper link: the pipe message types and `sensor_key`, the helper image check that hashes and holds the exe locked from verify to launch, the unprivileged and elevated launchers, the per-launch pipe name, and `connect_verified` with the server-PID check. Then prove the helper and the core client together with IT-01…IT-17 against the real published helper.

- Status: Completed (2026-10-21)
- Complexity: **L** — kept whole because the IT suite is the only proof that the two ends interoperate; shipping the client code without it would be an untested increment, and the ITs need every module here.
- Estimated time: 6–8h
- Depends on: T2 (the crate, `Cargo.toml` features), T4 (a helper that sends frames)
- Can run in parallel with: T7, T8, T9, T11

## AI guidance

- `implement-task`: runs this task.
- Session skill draft `sensor-id-stability-check.md` (`sessions/20261021071727_pophood-oq1-oq2-closeout/skills/`): the `sensor_key` basis.
- ADRs `0008-sensor-label-key-basis.md`, `0011-helper-launch-integrity.md`.
- Precedent: `C:\Users\jimmy\pophood-probes\probe-pipe\client\src\main.rs` (P2 client: connect retry, `GetNamedPipeServerProcessId`, fuzz corpus) and `probe-pipe\scripts\run-all.ps1` (T1–T7).

## Requirements

- `parse_line` checks the `Envelope { v }` first: `v ≠ 1` → `SchemaMismatch(v)` even if other fields are wrong; missing/non-numeric `v` or bad JSON → `Malformed`.
- `sensor_key(id, name) = "{id}|{name}"`.
- `HelperImage::open_verified` opens with `FILE_SHARE_READ` only, hashes through that handle, and keeps it open until launch (C11 narrowing); errors `Missing`, `HashMismatch { actual }`.
- `launch_unprivileged`: `CREATE_NO_WINDOW`, null stdio, `OwnedHandle`. `launch_elevated`: `ShellExecuteExW("runas", SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC, SW_HIDE)` on a blocking thread after `CoInitializeEx(STA)`, owner HWND passed as `isize`; `ERROR_CANCELLED` → `Cancelled`.
- `new_pipe_name()` = `pophood-` + 32 lowercase hex from `getrandom`.
- `connect_verified`: retry every 50 ms on NotFound / OS error 231 until the deadline; return `ChildExited(code)` as soon as the child has exited; then require `GetNamedPipeServerProcessId == child.pid`, else drop **without writing** → `Squatter { pid }`.
- `HelperConnection` lines capped at 4 MiB (`LineTooLong`).
- Wire field names match the techspec exactly. serde's `rename_all = "camelCase"` turns `size_gb` into `sizeGb` and `configured_mts` into `configuredMts`, not the schema's `sizeGB` and `configuredMTs`: those two fields need an explicit `#[serde(rename = "…")]`. Otherwise every frame that carries a memory module fails to parse (`Malformed`).
- Hardware-specific IT assertions only under `POPHOOD_OWNER_PC=1`; the 30 s tests are `#[ignore]`.

## Files involved

| Path | Action |
|---|---|
| `src-tauri/src/sensors/protocol.rs` | Create |
| `src-tauri/src/sensors/helper.rs` | Create |
| `src-tauri/src/sensors/pipe.rs` | Create |
| `src-tauri/src/sensors/mod.rs` | Create (module declarations only; T6 adds the supervisor) |
| `src-tauri/src/lib.rs` | Modify (created in T2; adds `pub mod sensors;` so the integration tests can reach `pophood_lib::sensors::{helper, pipe, protocol}`) |
| `src-tauri/tests/helper_pipe.rs` | Create |

## Implementation steps

1. `protocol.rs` per techspec § Implementation map → Core (`protocol.rs` row) and § Pipe protocol, schema v1.
2. `helper.rs` per the techspec row and § Interfaces: `HelperImage`, `launch_unprivileged`, `launch_elevated`, `HelperProcess { exit_code, terminate }`, `wait_all` (`WaitForMultipleObjects`, `bWaitAll = true`). Precedents: spike `tauri-hello/src-tauri/src/lib.rs → start_unprivileged (≈:14-21)`; crate `runas` 1.2.0 `src/impl_windows.rs`.
3. `pipe.rs` per the techspec row: `new_pipe_name`, `connect_verified`, `HelperConnection { next_message, send }`.
4. A thin `sensors/mod.rs` declaring the modules; expose them from `lib.rs` for the integration tests.
5. `tests/helper_pipe.rs`: IT-01…IT-17 exactly as specified in techspec § Integration Tests, launching `binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` through `pophood_lib::sensors::{helper, pipe}` with `--client` = `std::env::current_exe()`. IT-14 uses the dev-dependency feature `Win32_Security_Authorization`. IT-11 reads WMI with `pwsh Get-CimInstance Win32_PhysicalMemory`. IT-09 serves a fake pipe from the test process.
6. Unit tests UT-07, UT-08, UT-09, UT-11 in `#[cfg(test)]` modules.
7. Run IT-12 early: it is the first check that a spawn succeeds while the image is held (techspec "Next checks").

## Acceptance Criteria

- `cargo test` passes UT-07, UT-08, UT-09, UT-11 and IT-01…IT-09, IT-11…IT-17 (test output, with `POPHOOD_OWNER_PC=1` on the owner's PC).
- `cargo test -- --ignored` passes IT-10 (exit code 4 in 30–31 s).
- IT-01's frame parses with `memory[]` populated (the `sizeGB`/`configuredMTs` names above), and IT-11 on this PC reports 2 modules, `DDR5`, `configuredMTs` 6000, and `sizeGB` × 1024 equal to `Win32_PhysicalMemory.Capacity` / 2²⁰ (the WMI values printed by the test, not the spec).
- IT-12 passes: `launch_unprivileged` succeeds while the `HelperImage` lock is held. If it fails, stop and report to the owner: the techspec fallback (release the lock just before the launch) is a design change.
- IT-14 prints the DACL: one allow ACE for the current user SID, mask including read and write, nothing else.
- IT-03/IT-04 print the measured mean and drift within the stated bounds.

## Testing

- **UT-07** `parse_line`: four message kinds parse; `{"v":2,"type":"x","junk":1}` → `SchemaMismatch(2)`; `"v":"1"`, missing `v`, non-JSON → `Malformed`.
- **UT-08** `sensor_key` format and the `/gpu-nvidia/0/load/3` disambiguation.
- **UT-09** `open_verified`: match, mismatch, missing; while held, rename, overwrite and delete fail with a sharing violation (temp files, no mocks).
- **UT-11** `new_pipe_name` pattern and 1000 distinct names.
- **IT-01…IT-17** per techspec § Integration Tests, all in `src-tauri/tests/helper_pipe.rs`.
- The elevated launch path (`launch_elevated`) has no automated test: it needs a UAC click. Its first run is the owner's UAC accept in **Task 06**; E2E-02, E2E-03 and E2E-04 in **Task 14** are the sign-off checks.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Interfaces (Core), § Patterns reused (connect with retry, elevate with a handle), § Data models (Pipe protocol), § Integration Tests
- `C:\Users\jimmy\pophood-probes\probe-pipe\client\src\main.rs`, `probe-pipe\scripts\*.ps1`
- `C:\Users\jimmy\pophood-probes\probe-ids\ids-*.json` (P1 dumps; IT-01 key uniqueness)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 93%. Everything but `launch_elevated` ran for real. Remaining uncertainty: `launch_elevated` (first run is T6's owner UAC accept), and `wait_all` with an elevated process handle (the access rights `ShellExecuteExW` returns are checked in E2E-04/E2E-09).
- **Evidence:**
  - `cargo test` (no env): 21 lib tests (UT-07, UT-08, UT-09, UT-11, UT-12, …), UT-13, and 17 ITs pass; IT-10 is `ignored`.
  - `POPHOOD_OWNER_PC=1 cargo test --test helper_pipe -- --test-threads=1`: 17 passed, 1 ignored. `cargo test --test helper_pipe -- --ignored`: IT-10 exit 4 after 30.15 s.
  - IT-01: first frame 565 ms after hello, 164 sensors, 6 hardware, 2 memory modules, keys unique, `memory[]` parsed (the `sizeGB`/`configuredMTs` renames work).
  - IT-03: deltas 1012, 998, 1000, 997, 1000, 999, 1002, 997, 996, 1013 → mean 1001.4 ms, drift +14.0 ms. IT-04: 250 ms mean 250.2, 1000 ms mean 1000.3.
  - IT-05: all 22 cases get the pinned code (same codes as UT-02, plus `too_long` for the 1 MiB line); the helper survives and still acks a valid `set_period`.
  - IT-06: exit 0, 30 ms after the drop. IT-12: spawn under the held image works, so the lock-release fallback is **not** needed.
  - IT-11: WMI `[(17179869184, 6000) ×2]` = helper's two 16 GB DDR5 6000 modules (`sizeGB × 1024 << 20` equals `Capacity`).
  - IT-14 DACL: one ACE, type 0 (allow), SID = the current user, mask `0x0012019b` (includes read `0x1` and write `0x2`).
  - IT-15: the pwsh client read 0 bytes, then the test's `connect_verified` got hello. IT-17: `ChildExited(3)` after 53 ms.
- **Decisions / gaps:**
  - `launch_elevated` runs `ShellExecuteExW` on a thread it spawns itself (`std::thread::scope`), initialising COM as STA there, instead of relying on the caller's blocking thread. The caller (T6) can still run it inside `spawn_blocking`; the function blocks until the UAC prompt is answered.
  - `connect_verified` checks `child.exit_code()` **before** each open attempt, so a helper that already died wins over any server that answers. IT-17 therefore occupies the name with a *busy* server (a connected dummy client), which is how a real "name taken" looks.
  - `HelperConnection` also has `from_client(NamedPipeClient)` and `send_raw(bytes)`, used by the ITs (the 4 MiB limit test and the fuzz run). `ControlMessage` is serialised by hand so `"v":1` comes first.
  - `MAX_LINE` is exported from `pipe.rs`; a line of exactly 4 MiB is accepted, one byte more is `LineTooLong`.
  - The ITs are serialised with a process-wide mutex (each helper runs LHM; IT-03/04 timing needs a quiet machine). Total run ≈ 31 s with IT-10 excluded.
  - Clippy/rustfmt were not run (no AC asks for them).
