# Task 03 - Helper protocol, control parser and pipe server

## Description

Build the helper's trust boundary: the schema v1 records and source-generated JSON context, the `set_period` control parser (P2's validation order and codes, fuzzed with the 22-case corpus), the per-user-SID named pipe with `FirstPipeInstance` and client image-path verification, the System32-only DLL search as the first statement, and the process lifetime (arguments, 30 s accept window, `hello`, read loop, exit codes). No sensors yet: T4 adds the sampler.

- Status: Completed (2026-10-21)
- Complexity: M
- Estimated time: 4–6h
- Depends on: T1
- Can run in parallel with: T2, T7, T11

## AI guidance

- `implement-task`: runs this task.
- ADRs `0001-trust-model-read-only-elevated-helper.md`, `0004-helper-never-changes-hardware-state.md`, `0011-helper-launch-integrity.md`.
- Trust invariants (until T11 writes `AGENTS.md`): the helper writes no files and no console output; frames use `Utf8JsonWriter`, never `StreamWriter` or `File` (both banned by T1 — the build will fail if used).
- Precedent code is read, never copied blindly: `C:\Users\jimmy\pophood-probes\probe-pipe\helper\Program.cs` (P2).

## Requirements

- First statement of `Main`: `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)`; exit 70 if it fails. `[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]`.
- Arguments: exactly `--pipe pophood-<32 lowercase hex> --client <absolute path>`, else exit 64 (a flag without a value is also 64).
- Pipe: P2's DACL (current user SID ReadWrite), `InOut`, byte mode, 1 instance, `Asynchronous | FirstPipeInstance`, buffers 4096 in / 65536 out; name taken → exit 3.
- A client whose image path ≠ `--client` is disconnected with nothing read or written, and the helper keeps listening inside one fixed 30 s window from pipe creation; no verified client → exit 4.
- After the client is verified, send `hello {v:1, elevated, pawnIo{installed, version, loaded}}` (`loaded` stays `null` until T4 adds the device check).
- Read loop: lines ≤ 1024 B (excess dropped up to `\n`, reply `too_long`); `ControlParser.Parse` never throws; `set_period` → `ack`, otherwise `error` with the code from techspec § ErrorMessage codes. Replies written under `lock(writeGate)`.
- EOF or `IOException` → exit 0.

## Files involved

| Path | Action |
|---|---|
| `helper/Protocol.cs` | Create |
| `helper/ControlParser.cs` | Create |
| `helper/PipeServer.cs` | Create |
| `helper/Native.cs` | Create (T4 uses its `CreateFileW`/`CloseHandle` for the PawnIO device check) |
| `helper/Program.cs` | Modify (replace T1's stub; T4 adds the sampler thread) |
| `helper.Tests/PophoodSensors.Tests.csproj`, `helper.Tests/packages.lock.json` | Create |
| `helper.Tests/ControlParserTests.cs`, `helper.Tests/ProtocolTests.cs` | Create |

## Implementation steps

1. `Protocol.cs` per techspec § Implementation map → Helper (`Protocol.cs` row) and § Pipe protocol, schema v1: records `Hello`, `Frame`, `HardwareInfo`, `SensorInfo`, `MemoryModule`, `Ack`, `ErrorMessage`, with `V` declared first; `HelperJson` with CamelCase and `DefaultIgnoreCondition = Never`. Precedent: spike `HelperJson` (`pc-bench-spike/helper/SensorHelper/Program.cs ≈:71-73`).
2. `ControlParser.cs` per the techspec row and P2 `ParseControl (≈:243-282)`: `MaxLine 1024`, `Utf8.IsValid`, `JsonDocument` (MaxDepth 2, no duplicate properties), field allow-list `v`/`type`/`ms`, version, type, range `[250,1000]`, catch-all → `internal_error` with the exception type name.
3. `Native.cs` per the techspec row (`[LibraryImport]`s, `DefaultDllImportSearchPaths`).
4. `PipeServer.cs` per the techspec row: `Create` and `AcceptVerifiedClient` (P2 `VerifyClient (≈:227-236)`, `Native.ImagePath (≈:313-326)`), image paths compared with `Path.GetFullPath` + `OrdinalIgnoreCase`.
5. `Program.cs` per the techspec row, steps up to and including the read loop: DLL directories, argument parsing (new; P2's `args[++i]` threw), pipe creation, accept window (P2 ≈:54-71), `hello`, read loop with the 1024 B cap, shutdown on EOF/`IOException`. Leave a clear seam (a method or class) where T4 starts the sampler thread.
6. Create the test project (xunit, `Microsoft.NET.Test.Sdk`, `xunit.runner.visualstudio`, all cached locally) with `RestorePackagesWithLockFile` and a committed lock file.
7. Write UT-01, UT-02, UT-03 and UT-06 (see Testing). Copy the 21 parser cases from `pophood-probes/probe-pipe/client/src/main.rs → fuzz()` `cases (≈:249-272)`, each pinned to the code P2's `ParseControl` returns (cross-check against `probe-pipe/out/logs/run-all.txt`).
8. Re-run `scripts/build-helper.ps1` so the staged sidecar is the new helper.

## Acceptance Criteria

- `dotnet test helper.Tests` passes UT-01, UT-02, UT-03, UT-06 (test output).
- `scripts/build-helper.ps1` succeeds (RS0030 stays an error, so no banned API slipped in) and prints the new hash.
- Running the published exe by hand: no arguments → exit 64; `--pipe foo --client C:\x.exe` → 64; `--pipe pophood-<32 hex>` alone → 64 (`$LASTEXITCODE`). The full IT matrix (IT-05…IT-10, IT-13…IT-16) runs in T5 against the finished helper.
- A pwsh `NamedPipeClientStream` connecting to a helper launched with `--client C:\Windows\notepad.exe` reads 0 bytes and is disconnected, and `Get-Process -Id <pid>` shows the helper still running (manual smoke; IT-07 automates it in T5).
- `Program.cs`'s first executable statement is the `SetDefaultDllDirectories` call (file contents).
- No `Console.*`, `File*` or `StreamWriter` use in `helper/` (the build enforces the banned ones; `rg "Console\." helper` returns nothing).

## Testing

- **UT-01** `set_period` accepted at 250 and 1000; 249 and 1001 → `out_of_range`.
- **UT-02** the 21 P2 parser cases, each with its pinned code; none throws (the 1 MiB case is IT-05 in T5, since it never reaches the parser).
- **UT-03** lone surrogate `"\ud800"` and any other throw → `internal_error` with the exception type; the method returns.
- **UT-06** serialization: `"v":1` first, camelCase, `"value":null` kept, no serial-number field on `MemoryModule`.
- Pipe-level behaviour (accept window, foreign client, squatter, exit codes, DACL, line limits) is covered by IT-05…IT-10 and IT-13…IT-16 in **Task 05**, which drives the real published helper.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Patterns reused (pipe server, client check, validation order, 30 s window, fuzz corpus), § Data models (Pipe protocol; ErrorMessage codes; Helper command line and exit codes; Fixed source parameters → Named pipe, Helper process)
- `C:\Users\jimmy\pophood-probes\probe-pipe\helper\Program.cs`, `probe-pipe\client\src\main.rs`, `probe-pipe\out\logs\run-all.txt`

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 90% → done 92%. Remaining uncertainty: pipe-level behaviours (accept window, squatter, DACL, line limits at exactly 1024/1025 B) are covered only by the manual smoke here; IT-05…IT-16 in T5 are the real check.
- **Evidence:**
  - `dotnet test helper.Tests -r win-x64`: 37 passed (UT-01, UT-02 ×21 pinned cases, UT-03 incl. 10 000 random/mutated inputs, UT-06, MessageWriter).
  - `scripts/build-helper.ps1` exit 0, RS0030 still an error; new sidecar SHA-256 `9e7f16f3…50a7`.
  - Published exe by hand: no args, `--pipe foo --client C:\x.exe`, a pipe name alone, `--pipe --client C:\x.exe`, and a relative `--client` all exit 64.
  - Smoke through a pwsh `NamedPipeClientStream`: `--client C:\Windows\notepad.exe` → 0 bytes read and the helper stays running; with the right client path: `hello` (`pawnIo.installed:true,"version":"2.2.0.0","loaded":null`), `set_period 250` → `ack`, unknown type → `unknown_type`, a 1025-byte line → `too_long`; dropping the client → exit 0.
  - `Program.Main`'s first statement is `Native.SetDefaultDllDirectories(...)`; `Select-String Console\. helper\*.cs` → 0 matches.
- **Decisions:**
  - Non-`async` `Main` with a `Session` class (writer, period, `AutoResetEvent`, `CancellationTokenSource`) and an empty `StartSampler(Session)` seam for T4. The read loop runs on the main thread with blocking reads.
  - `Frame.Sensors[].Value` is `float?` (not `double?`), so `12.3f` serializes as `12.3` instead of `12.300000190734863`. Core and UI see ordinary decimals.
  - `ControlParser.Parse` strips one trailing `\r` itself (P2 did it in `Handle`), so CRLF lines behave the same for the UT and the pipe.
  - Test project uses the locally cached xunit 2.5.3 / Test.Sdk 17.8.0, with its own `packages.lock.json`.
  - Builds of the helper and test project need `-r win-x64` (see T1 notes).
  - `Process`/launch arguments: a client path with spaces must be quoted by the launcher (`--client "C:\Program Files\…"`); the smoke script showed an unquoted path gives exit 64. T5's `launch_*` must quote it (`launch_elevated` already does per the techspec).
  - `Native.DeviceOpens(path)` (CreateFileW access 0 + CloseHandle) is in place for T4's PawnIO device check.
