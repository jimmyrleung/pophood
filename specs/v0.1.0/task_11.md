# Task 11 - AGENTS.md, README and the network audit script

## Description

Write the repo's first `AGENTS.md` from the session drafts (trust invariants, LHM threading facts, build notes, conventions), for the owner to approve before it's committed, and update `README.md` with the v0.1.0 status line and build-from-source steps. Port the P5 capture script to `scripts/audit-network.ps1`, which T13 (`-Quick`) and T14 (E2E-15) run.

- Status: Completed (2026-10-21); AGENTS.md approved by the owner in the T13 session; the elevated capture is T14 (E2E-15)
- Complexity: M
- Estimated time: 3–4h
- Depends on: T1, T2 (the build steps must be real; `-Quick` needs a running app)
- Can run in parallel with: T3–T10

## AI guidance

- `implement-task`: runs this task.
- Sources for `AGENTS.md`, in this order (later ones extend earlier ones): `sessions/20261020135705_pophood-grill-spike-naming/long_term_memory.md`, `sessions/20261020214713_pophood-define-reqs-confidence/long_term_memory.md`, `sessions/20261021071727_pophood-oq1-oq2-closeout/long_term_memory.md`, `sessions/20261021102214_pophood-v010-techspec/long_term_memory.md`; restated per ADR 0004.
- **Owner approval gate:** the owner approves the `AGENTS.md` text before it is committed. Do not add the draft's "commit to main" line; branching is left to the owner (techspec § Compliance with AGENTS.md and Rules).
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: the method `audit-network.ps1` implements. Python isn't installed; the script is pwsh.

## Requirements

- `AGENTS.md` covers everything in the techspec `AGENTS.md` row: the trust invariants (never changes hardware state, the allow-list, `IsControllerEnabled` off and `IsPowerMonitorEnabled` on, no persisting `ISettings`, no file writes, `SetDefaultDllDirectories(System32)` first, `pophood.exe` refuses to run elevated, both pipe ends verify, `BROWSER_ARGS` only in `webview.rs`, the network audit after any Tauri/wry/WebView2 bump, the P1/P6 and `BannedSymbols.txt` re-checks after any LHM bump), the LHM threading facts and the per-tick exception policy, the HWiNFO mutex risk (techspec § Known risks), build notes (vswhere, MSVC Build Tools; ATL with v0.6.0), and conventions (one minor version per slice, specs layout, sessions, verbatim decisions). It also carries the regression rule from `tasks.md` (any helper change re-runs the bans, the tests and the elevated AOT smoke, per C10).
- `README.md` per techspec § Implementation map → Docs (`README.md` before/after).
- `scripts/audit-network.ps1` per the techspec row, including every port change listed there: no hard-coded profile deletion; opt-in `-FreshProfile` limited to `%LOCALAPPDATA%\dev.pophood\EBWebView`; force-kill limited to the `-ExePath` folder's `pophood.exe` and `pophood-sensors.exe`; system-wide DNS listing for the four hosts; the browser command-line check for `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1`; `-Quick` mode with no capture and no admin.

## Files involved

| Path | Action |
|---|---|
| `AGENTS.md` | Create |
| `README.md` | Modify (pre-existing) |
| `scripts/audit-network.ps1` | Create |
| `sessions/*/long_term_memory.md` | Read |
| `C:\Users\jimmy\pophood-probes\probe-net\pktmon-capture-unelev.ps1` | Read (source of the port) |

## Implementation steps

1. Draft `AGENTS.md` from the four `long_term_memory.md` files and the techspec `AGENTS.md` row; point at `helper/WRITE-ALLOWLIST.md`, `helper/BannedSymbols.txt`, `src-tauri/src/webview.rs` and `scripts/audit-network.ps1` by path.
2. Show the draft to the owner and apply their edits; commit only after approval.
3. Edit `README.md`: replace the status line and add the "Build from source" section exactly as in the techspec's "After" block; check the prerequisite versions against what T1/T2 actually used (`dotnet --version`, `rustc --version`, `node --version`).
4. Port `pktmon-capture-unelev.ps1` to `scripts/audit-network.ps1` per the techspec row. Diff it against the source and list each port change in the script's header comment.
5. Run `-Quick` against a running `npm run tauri dev`.

## Acceptance Criteria

- The owner has approved the `AGENTS.md` text (their explicit confirmation in the session).
- Every invariant listed in the techspec `AGENTS.md` row appears in `AGENTS.md` (checklist in the session summary, one line per invariant).
- Every path named in `AGENTS.md` exists in the repo at the time of writing, or is marked as arriving in a named task (`Test-Path` output).
- `README.md`'s status line matches the techspec "After" block, and its prerequisite versions match the locally installed toolchain (command output).
- `scripts/audit-network.ps1 -Quick`, unelevated, against the `tauri dev` app reports `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1` present on the browser process (script output).
- The script contains no `Remove-Item` outside the `-FreshProfile` branch, and that branch's only target is `%LOCALAPPDATA%\dev.pophood\EBWebView`; its `Stop-Process` calls target only processes whose path is under `-ExePath`'s folder (`rg -n "Remove-Item|Stop-Process" scripts/audit-network.ps1` output, reviewed line by line).

## Testing

- No automated tests: these are documents and one owner-run script. Reason: `AGENTS.md`'s correctness is the owner's approval, the README's is the build steps working, and the script's capture mode needs an elevated session.
- The README build steps are executed from a fresh `git clone --recurse-submodules` in **Task 13**. `-Quick` runs again on the release build in **Task 13**; the full elevated capture is E2E-15 in **Task 14**.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Implementation map → Docs and `scripts/audit-network.ps1` row, § Compliance with AGENTS.md and Rules, § Known risks
- `sessions/20261020214713_pophood-define-reqs-confidence/decisions/0004-helper-never-changes-hardware-state.md`
- `sessions/20261021102214_pophood-v010-techspec/decisions/0009-one-minor-version-per-slice.md`
- `C:\Users\jimmy\pophood-probes\probe-net\` (P5 captures and scripts)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 85% for the task as a whole: the `-Quick` mode and the documents are done and checked; **the owner has not approved `AGENTS.md`** (an acceptance criterion, so this task is not fully closed), and the full elevated capture mode has not been run (T14 / E2E-15).
- **Evidence:**
  - `scripts/audit-network.ps1 -Quick -ExePath src-tauri\target\debug\pophood.exe` (unelevated): started the app, found the browser process, all five checks PASS (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,msOneAuthWAM`, `--disable-background-networking`, `--disable-component-update`, `--no-proxy-server`, `--edge-webview-disable-crash-reporting=1`), exit 0, app closed afterwards (no `pophood` or `pophood-sensors` left). The script parses with 0 errors. It read `BROWSER_ARGS` from `src-tauri/src/webview.rs`.
  - Review of the script's destructive calls (`Select-String "Remove-Item|Stop-Process"`): line 131 `Stop-Process` over `Get-AppProcesses` only (pophood.exe / pophood-sensors.exe whose image is under `-ExePath`'s folder); line 135 `Remove-Item` inside `if ($FreshProfile)`, target `%LOCALAPPDATA%\dev.pophood\EBWebView` only. Quick mode closes the app with `CloseMainWindow`.
  - README: status line as in the techspec "After" block; prerequisites checked against this PC: .NET SDK 10.0.402, rustc 1.99.1, node 24.21.0 (README says "Node 22+").
  - Every path named in `AGENTS.md` exists (`Test-Path` all True, listed in the session output): `helper/WRITE-ALLOWLIST.md`, `helper/BannedSymbols.txt`, `helper/Program.cs`, `Sampler.cs`, `Availability.cs`, `helper.Tests/ControlParserTests.cs`, `src-tauri/src/lib.rs`, `webview.rs`, `sensors/machine.rs`, `build.rs`, `tests/helper_pipe.rs`, `scripts/build-helper.ps1`, `scripts/audit-network.ps1`, the smoke script, `THIRD-PARTY-NOTICES.md`.
- **Invariant checklist (techspec `AGENTS.md` row → where it is in `AGENTS.md`):** never changes hardware state ✓ (Trust invariants → helper); the allow-list ✓ (`helper/WRITE-ALLOWLIST.md`); `IsControllerEnabled` off and `IsPowerMonitorEnabled` on ✓; no persisting `ISettings` ✓; no file writes ✓; `SetDefaultDllDirectories(System32)` first ✓; `pophood.exe` refuses to run elevated ✓ (Privilege); both pipe ends verify ✓; `BROWSER_ARGS` only in `webview.rs` ✓; network audit after any Tauri/wry/WebView2 bump ✓; P1 and P6 re-checks and `BannedSymbols.txt` re-check after any LHM bump ✓; LHM threading facts and the per-tick exception policy ✓; HWiNFO mutex risk ✓; build notes (vswhere, MSVC Build Tools, ATL with v0.6.0) ✓; conventions (one minor version per slice, specs layout, sessions, verbatim decisions) ✓; the regression rule from `tasks.md` ✓ (Build notes).
- **Owner approval (T13 session, 2026-10-21):** asked "AGENTS.md is still awaiting your approval from T11 and would be part of this commit. Approve it as-is?", the owner answered: "Approve as-is". It was committed with the v0.1.0 tree on `master` (owner: "Commit on master"). The draft's "commit to main" line was not added.
- **Decisions / gaps:**
  - `AGENTS.md` also records the invariants that came out of the implementation: the four integrity codes block everywhere, navigation is pinned, `-r win-x64` for helper builds, "restart `tauri dev` after a helper rebuild", and the smoke script path. The machine-wide git-identity fact from the first session draft is not repo content and was left out.
  - The `audit-network.ps1` capture mode is a port that has not been executed here (it needs elevation); `-OutDir` defaults to `audit-out\` in the repo, which I added to `.gitignore`. The script prints the E2E-15 cues at 60/90/120 s and watches DNS for the four watch-list hosts system-wide in addition to the app tree. It reports `NO NON-LOOPBACK FLOW`, `NO WATCH-LIST DNS` and `BROWSER COMMAND LINE` lines plus an overall PASS/FAIL (exit code).
  - The elevated helper is matched into the tracked process tree by image name, since `ShellExecuteExW` parents it to the shell rather than to `pophood.exe`.
  - README mentions the three test commands and what the app never does; the "Build from source" block is the techspec's, with the `vswhere` path spelled out (it isn't on PATH by default on this PC).
