# Task 13 - Release build and agent-run E2E

## Description

Produce the v0.1.0 release build from a fresh clone using the README steps, and run every E2E item the agent can run ("A") against that build, fixing what fails. The owner-only items (UAC, PawnIO uninstall, elevated capture) follow in T14 on the same build.

- Status: Completed (2026-10-21); the owner's elevated AOT smoke on the final helper passed (task_04.md); T14 follows
- Complexity: **L** — kept whole because it is one verification sweep on one release build; splitting it would mean rebuilding and re-establishing the baseline twice.
- Estimated time: 5–7h
- Depends on: T12 (reviewed code; transitively every code task)
- Can run in parallel with: —

## AI guidance

- `qa-execution`: this task is the agent half of QA for v0.1.0; follow its build/test/live-validation flow and evidence report. The code review ran before, in T12.
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: what `audit-network.ps1 -Quick` checks.
- `AGENTS.md` (from T11) applies to every fix made here.
- Fixes found here are made in the owning task's files; record each one with the E2E ID that found it, and apply the regression rule in `tasks.md`.

## Requirements

- The build comes from a commit the owner approved: `git clone --recurse-submodules` of that commit, then `npm ci`, `npm run build:helper`, `npm run tauri build -- --no-bundle`, exactly as the README says.
- Every "A" item below passes. A failure is either fixed (then the item is re-run) or waived by the owner, with the waiver quoted verbatim in the evidence report. The task doesn't close with an unwaived failure.
- The regression rule in `tasks.md`: any change under `helper/` or `src-tauri/src/sensors/` re-runs the build, the test suites, E2E-19, E2E-24's `dumpbin /imports` check and T4's elevated smoke (owner) before the sweep continues, and invalidates evidence already collected for items that exercise the changed code.

## Files involved

| Path | Action |
|---|---|
| `scripts/audit-network.ps1` | Run (`-Quick`; created in T11) |
| Any file from T1–T11 | Modify only to fix a failing check |

## Implementation steps

1. Ask the owner to approve a commit of the v0.1.0 tree, on a branch they name (branching is the owner's call; techspec § Compliance with AGENTS.md and Rules). Clone that commit into a scratch folder.
2. Run the README steps there; note every deviation and fix README (T11's file) if a step is wrong.
3. Run `scripts/audit-network.ps1 -Quick` against the release `pophood.exe`.
4. Run the E2E items in Testing, in this order: E2E-24 (shipped files) → E2E-19 (re-run on the final helper) → E2E-01 → E2E-11 → E2E-12 → E2E-13 → E2E-18 → E2E-20 → E2E-21 → E2E-22 → E2E-23 → E2E-05 → E2E-06 → E2E-17 (A part) → E2E-07 → E2E-09 (A) → E2E-10 (A). Destructive ones (rename/replace the helper, kill processes) last, restoring the build after each. E2E-13's OS theme switch is restored to the owner's setting afterwards.
5. Write the evidence report (qa-execution format) under the session folder, one line per E2E ID with pass/fail and the evidence.

## Acceptance Criteria

- Fresh-clone build succeeds by following README verbatim (command log), and `src-tauri/target/release/` holds `pophood.exe` and `pophood-sensors.exe`, with no Mono.Posix DLLs (directory listing).
- `scripts/audit-network.ps1 -Quick` reports `BROWSER_ARGS` and `--edge-webview-disable-crash-reporting=1` present on the release build's browser process (script output).
- Every E2E item listed in Testing is recorded pass with evidence (screenshot, command output or log line), or carries an owner waiver quoted verbatim.
- `cargo test`, `cargo test -- --ignored`, `dotnet test helper.Tests` and `npm test` all pass on the fresh clone (command output).

## Testing

Agent-run ("A") items from techspec § E2E Tests, on the release build:

- **E2E-01** reduced mode at first launch.
- **E2E-05** helper missing. **E2E-06** hash mismatch. **E2E-17 (A part)**: swap the helper, then end the running helper → the restart hits the mismatch (blocking panel, nothing launched); then restore the helper and Retry → live. The "Enable full sensors → no UAC" part needs the owner's UAC observation and is in T14.
- **E2E-07** helper dies and recovers through attempts 1–3, then "Sensors stopped".
- **E2E-09 (A)** normal close, unprivileged. **E2E-10 (A)** app killed, unprivileged.
- **E2E-11** second launch. **E2E-12** drill-down. **E2E-13** theme across restarts and an OS theme switch. **E2E-18** webview reload (unprivileged part; the elevated part is checked in T14).
- **E2E-19** banned-API negatives, re-run on the final helper.
- **E2E-20** CSP and navigation pin (release build with the `devtools` feature).
- **E2E-21** minimum window size, including the drill-downs at 1024. **E2E-22** keyboard and focus.
- **E2E-23** About and notices. **E2E-24** supply-chain pins and shipped files, in full (lock tamper, submodule, release folder, `rerun-if-changed`, `dumpbin /imports` shows only KnownDLLs and `api-ms-win-*`).

## Additional relevant files

- `specs/v0.1.0/techspec.md` § E2E Tests, § Sequence (OQ13 ladder, for T14)
- `specs/v0.1.0/tasks.md` (test-ownership table, regression rule)
- `C:\Users\jimmy\pophood-probes\probe-net\` (P5 captures and scripts)

## Task notes (2026-10-21)

- **Report:** `sessions/20261021165812_pophood-v010-e2e/qa.md` (qa-execution format). It covers every E2E ID with its evidence file, the bug, the observations and the verbatim owner answers. The scripts are in the same folder; `sweep.ps1` re-runs the whole agent sweep.
- **Commits (owner-approved, on `master`):** `920b1e2` holds the v0.1.0 tree (pass 1); `73fdb0f` holds the BUG-01 fix and the pass-1 evidence (pass 2, the final build). Owner answers: "Commit on master", "Approve as-is" (AGENTS.md), "Commit + full rebuild (Recommended)".
- **Final build:** a fresh clone of `73fdb0f` in `C:\Users\jimmy\pophood-e2e\pophood`, built with the README steps verbatim. No README step was wrong.
  - Helper SHA-256: `11a0ed2b9722d85332607308c7879495ebdd5eb76344d5445e0480123deab6f4`.
  - Release folder: `pophood.exe` and `pophood-sensors.exe`, with no DLLs.
  - The pass-1 clone and devtools target are kept as `pophood-pass1` and `target-devtools-pass1`.
- **AC results:**
  - README build: pass.
  - `-Quick`: pass.
  - Every "A" E2E item: pass.
  - Suites on the clone: npm 237, dotnet 66, cargo 74 + UT-13 + 18 ITs, and IT-10 with `--ignored`.
- **Bug found and fixed:**
  - **BUG-01 (E2E-12, Low):** a new page kept the previous page's scroll offset. The fix is in `src/App.tsx` (T7's file): `useLayoutEffect` → `scrollTo(0, 0)` on every page change.
  - Regression test: `src/App.test.tsx`. It fails without the fix.
  - Re-verified live in pass 2: scroll 0 %, breadcrumb on screen.
  - No helper or `sensors/` change, so the regression rule did not trigger. The rebuild still changed the helper hash (OQ14), so the owner's elevated smoke must use the final helper.
- **Owner decisions:**
  - The "Sensors stopped" copy stays as specified ("Keep as specified").
  - Two sub-parts that need elevation move to T14 ("Move both to T14"), and `task_14.md` was updated:
    - E2E-21's Motherboard drill-down at 1024×680;
    - E2E-09's close during "Connecting…" while two helpers run.
- **How the agent drove the app (test instrumentation, never in the product):**
  - **UI Automation, `PrintWindow` and Win32** on the release build: tree, Invoke/Toggle, resize, screenshots, `WM_CLOSE` to the `Tauri Window`.
  - **CDP on a devtools variant** for E2E-20, 22 and 23. The variant is built from the same commit into `target-devtools`, with the same helper. `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` adds a remote-debugging port on 127.0.0.1 and repeats every `BROWSER_ARGS` flag; the browser command line was checked.
  - **Keyboard:** CDP key events carry the keyboard checks, so no keystroke can land in the owner's apps. E2E-18's F5 needs a real keystroke and is sent only after a foreground check.
- **Harness dead ends (recorded so they aren't repeated):**
  - `Process.MainWindowHandle` can return tao's "Tao Thread Event Target" window, so close by window class.
  - Cancelling a pending `ClientWebSocket.ReceiveAsync` aborts the socket.
  - A WM_KEYDOWN F5 posted to `Chrome_RenderWidgetHostHWND` doesn't reload.
  - In PowerShell, `$h` and `$H` are the same variable.
  - One UIA toggle right after a restart was lost once in the sweep and 0 times in 5 dedicated tries (E2E-13 passed on re-run).
- **Observations (no change):**
  - The trust panel sits below the fold; this matches the mockup.
  - The PawnIO row reads "Not checked yet" under a blocking panel.
  - The CPU drill-down opens on a "—" row in reduced mode.
  - `audit-network.ps1` closes the app with `CloseMainWindow()`, which can miss when the window is minimized. Follow-up candidate.
- **Open (owner):**
  - The elevated AOT smoke on the final helper; the command is in `tasks.md` → Open owner steps.
  - T14 on this build.
- **Confidence:** I didn't record a plan score before starting (a process gap in this session). Done: **92%**, with the breakdown in `qa.md`. Remaining uncertainty:
  - the two sub-parts moved to T14;
  - the owner's elevated smoke on helper `11a0ed2b…`;
  - E2E-20, 22 and 23 ran on the devtools variant, not the plain release exe (same commit and helper).
- **Independent verification (read-only agent):** no High findings; 2 Medium and 7 Low, each resolved with new evidence or a corrected row. The table is in `qa.md` § Independent verification.
  - E2E-13's failed sweep run was traced to dropped UIA Invokes. Evidence: 30/30 real-input toggles applied, and the override persisted in 12/12 fast closes.
  - The owner's theme has no stored override (`localStorage` read as `null`).
  - E2E-18's reload proof stays visual (the sparkline reset). A marker check needs a real keystroke, and that is refused while the owner uses the PC.
