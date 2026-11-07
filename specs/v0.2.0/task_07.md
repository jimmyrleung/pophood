# Task 7 - Release builds, harness updates and agent-run checks

## Description

In the follow-ups clone, build the v0.2.0 release `pophood.exe` and the devtools variant from the owner's commit, with the helper of record. Update the v0.1.1 harness scripts for v0.2.0 (review M2), then run the suites and every agent ("A") E2E part, in reduced mode, including the new E2E-29 and the form steps of E2E-22. This is the agent half of Sequence step 7. The owner half is T8, on the same two builds.

- Status: Done (2026-10-23; every A part passed, `sessions/20261023163100_pophood-v020-release/qa.md`)
- Complexity: **L**. It stays one task because it is one test sweep on one pair of builds: a split would set up the builds, the hash baseline and the label-file state twice (as v0.1.1's T5).
- Estimated time: 5–7h
- Depends on: T6 (and the owner's commit)
- Can run in parallel with: —

## AI guidance

- `qa-execution`: this task's flow (build, tests, live validation, the evidence report `qa.md`).
- ADR 0019: UI Automation on the release exe, CDP on the devtools variant, never OS keystrokes.
- `AGENTS.md` "Build notes": rebuild only `pophood.exe`, with a separate `CARGO_TARGET_DIR` and the `--config` override, and `vswhere` on `PATH`.
- `AGENTS.md` "No network": the CDP port is 127.0.0.1 only and is test instrumentation; the env var must repeat every `BROWSER_ARGS` flag.
- `AGENTS.md` "Conventions": every pass/fail check has a negative control; the pwsh traps.
- `specs/v0.1.1/task_05.md` § Task notes: the harness lessons (UIA lags a scroll by about 0.4 s; match focusables by element, not by label; don't pipe a script through `Select-Object -First n`; start the app fresh before a Min/Max check).
- Global rules, risky commands: **no delete command**. Label files are moved aside (`tasks.md` § [Label file state](tasks.md#label-file-state)). `devtools-start.ps1:7` clears one env var with `Remove-Item Env:\…` and deletes no file; the owner gave a one-time OK for every v0.2.0 run on 2026-10-23: "OK for v0.2.0 (Recommended)".

## Requirements

- Both builds come from the owner's commit: `git -C C:\Users\jimmy\pophood-e2e\pophood-followups pull --ff-only` (on `master`, or the branch the owner named), and `git log --oneline -1` equals the hash recorded in T6.
- `git -C <clone> diff --stat 0861d8f -- helper src-tauri/src/sensors` is empty.
- The staged helper is `553A7F496E4F2DC2CD1590D6BD127F47384351F5FB7B25B2C05615937B357936` before and after both builds, and `pophood-sensors.exe` next to each built `pophood.exe` has the same hash. Any other value stops the task.
- `npm ci` runs first. Neither build runs `build:helper` (the override is `beforeBuildCommand = npm run build`).
- The v0.1.1 builds (`target-v011`, `target-v011-devtools`) keep their hashes (checked before and after): E2E-23 uses the v0.1.1 release exe as its negative control.
- The flags in `devtools-start.ps1` equal the `BROWSER_ARGS` in the clone's `src-tauri/src/webview.rs` (exact set match).
- The harness scripts change as in `tasks.md` § [Harness changes](tasks.md#harness-changes-t7-t8), and each one passes a dry run before its result counts.
- The label file follows `tasks.md` § Label file state: no `labels.json` at the start, E2E-22 ends with a Reset, E2E-29 runs last, and nothing is deleted.
- Every "A" part passes. If one fails, fix it (the fix rule in `tasks.md`) or get the owner's waiver, quoted verbatim in `qa.md`.
- **If the M1 typing check fails:** stop and ask the owner before using the fallback selector. **If E2E-27 fails:** stop and ask the owner.

## Files involved

| Path | Action |
|---|---|
| `C:\Users\jimmy\pophood-e2e\pophood-followups` | Pull, `npm ci`, build (outside the repo) |
| `C:\Users\jimmy\pophood-e2e\target-v020`, `C:\Users\jimmy\pophood-e2e\target-v020-devtools` | Create (build output) |
| `sessions/<yyyyMMddHHmmss>_pophood-v020-release/` (`$S`) | Create: the copied and changed scripts (`release-build.ps1`, `release-tests.ps1`, `e2e12.ps1`, `e2e21.ps1`, `e2e22-cdp.ps1`, `e2e23.ps1`, `e2e27-layout.ps1`, `load.psm1`), the new `e2e29.ps1`, `qa.md`, `evidences/` (with `evidences/label-files/`) |
| `sessions/20261023055425_pophood-v011-release/*` | Read (the scripts to copy) |
| `sessions/20261021165812_pophood-v010-e2e/ui.psm1`, `cdp.psm1`, `devtools-start.ps1` | Read and use (import, pass `-Exe`; don't edit) |
| `%LOCALAPPDATA%\dev.pophood\labels.json` (and `.bad`, `.tmp`) | Written by the app; moved aside by the scripts |
| Any T1–T5 file | Modify only to fix a failing check |

## Implementation steps

1. **Create `$S`.** Copy the v0.1.1 scripts and apply `tasks.md` § Harness changes. Run `release-build.ps1 -ExpectedCommit <T6's hash>` (no default: the clone is already at `0861d8f`). Log the builds to `$S\evidences\release-build-log.txt`:
   1. hash the staged helper and the v0.1.1 release and devtools `pophood.exe`;
   2. `pull --ff-only`, `git log --oneline -1` (must start with T6's hash), the `diff --stat 0861d8f -- helper src-tauri/src/sensors` check;
   3. `npm ci`;
   4. the release build into `target-v020`, then the devtools build into `target-v020-devtools` (`--features tauri/devtools`);
   5. hash both new `pophood.exe`, both `pophood-sensors.exe` next to them, the staged helper and the v0.1.1 exes again.
2. **Suites** in the clone, logged to `$S\evidences\test-log.txt`: `npm test`, then `cargo test` and `cargo test -- --ignored` in `src-tauri`, with `POPHOOD_OWNER_PC=1` (as `release-tests.ps1`).
3. **Label file, start:** `Test-Path` on `%LOCALAPPDATA%\dev.pophood\labels.json` (and `.bad`, `.tmp`). If any exists, move it to `$S\evidences\label-files\t7-start\` and write its name in `qa.md`.
4. **Release exe** (`target-v020\release\pophood.exe`, UI Automation, `Set-PhSize -Client`):
   - `e2e23.ps1`, the files part: `pophood.exe` ProductVersion starts with 0.2.0, the helper's with 0.1.0; **negative control:** the v0.1.1 release exe does **not** start with 0.2.0.
   - `e2e12.ps1`, the reduced part at 1024×800 (the v0.1.1 row; the CPU card's "All sensors").
   - `e2e21.ps1`, the reduced parts, both themes: 1024×680 (not sticky), 1024×800 (sticky, and **the form-fits check** in `tasks.md` § Harness changes: the panel height + 12 ≤ 508 px, Reset below Save name; control: one line at 1917×1029), 1917×1029; the Dashboard columns with the `OrCondition` (the Motherboard card is a placeholder in reduced mode, so the count shows the change only with full sensors: T8).
5. **Devtools variant** (`devtools-start.ps1 -Exe C:\Users\jimmy\pophood-e2e\target-v020-devtools\release\pophood.exe`, CDP). First check the browser command line it prints.
   - `e2e23.ps1`, the page part: About shows 0.2.0 and the helper hash `553A7F49…`; the notices line says "Pophood 0.2.0"; URLs are text.
   - `e2e22-cdp.ps1`, the reduced part at 1024×800:
     - the v0.1.1 steps (Tab to every row, the 2 px ring, the landmarks, the card title levels, the Dashboard actions);
     - **the form:** Tab reaches the input, then Save name; Reset is skipped while disabled; type a name and press Enter (CDP key events) → the row reads "{label} · {default}"; Tab now reaches Reset; Reset → the default name; record `document.activeElement` after a keyboard Reset (the button becomes disabled; T6 review F3, recorded, not failed);
     - Shift+Tab under the stuck panel: each focused row is fully below the panel;
     - **Shift+Tab into the stuck form:** scrolled down, focus the first row of the first column, then Shift+Tab to **Save name** (and **Reset** when enabled) and to the input; each is visible with its ring; record `scrollY` before and after each step (recorded, not failed);
     - **the 40 cut (AC-03, moved from E2E-28):** on a CPU row, focus the input, CDP `Input.insertText` with a 45-character word → `input.value.length` is 40; then select another row (the draft is discarded, nothing is saved; `setLabel` is never reached, so `labels.json` doesn't change);
     - **M1:** **the M1 rule** in `tasks.md` § Review findings at 1024×800 (precondition, pass, the `blur()` / `focus()` control that must show a change; the scroll-0 run as a record);
     - the negative control (rule off) is T8's;
     - end: no label saved (`labels.json` holds `"labels": {}`); move it to `$S\evidences\label-files\e2e22\`.
   - `e2e27-layout.ps1 -Mode reduced` at 1917×1029 on the CPU page; its negative control first (1 split card, Loads).
6. **E2E-29, last** (release exe, reduced; new `e2e29.ps1`):
   - **Text entry on the release exe:** UIA `ValuePattern.SetValue` on the input, then `InvokePattern` on **Save name** (UIA has no paste and no Enter; `Send-PhKeys` is ruled out by ADR 0019). This is the first use of `SetValue`: if the saved name in `labels.json` isn't the text that was set, stop and ask the owner (T8 depends on it).
   - (a) write `{` into `labels.json`, start → the form shows "Names saved earlier couldn't be read: …kept as …labels.json.bad"; `labels.json.bad` holds `{`; set a name on a CPU sensor and invoke Save name → `labels.json` is valid JSON with `"version": 1` and that name.
   - (b) **Negative control first:** one save succeeds. Then, with the app running, create a **folder** `labels.json.tmp` → save → "The name wasn't saved: could not write …", and the heading keeps the old name; move the folder to `$S\evidences\label-files\e2e29\tmp-folder\`; save again → it works.
   - Close the app; move `labels.json` and `labels.json.bad` to `$S\evidences\label-files\e2e29\`. `%LOCALAPPDATA%\dev.pophood` holds no label file.
7. Write `$S\qa.md` (the `qa-execution` format): one line per E2E part, with its build, pass or fail, and the evidence file; the key lines of the build and test logs.
8. Update this file's Status and task notes, and the T7 row in `tasks.md`. Tell the owner T8 is ready.

## Acceptance Criteria

- `release-build-log.txt` shows: a fast-forward to T6's hash; an empty `diff --stat 0861d8f -- helper src-tauri/src/sensors`; `npm ci` and both builds exit 0; the staged helper `553A7F49…` before and after; `pophood-sensors.exe` `553A7F49…` next to both new exes; the v0.1.1 exe hashes unchanged.
- `test-log.txt`: `npm test`, `cargo test` and `cargo test -- --ignored` pass.
- The devtools browser command line has every `BROWSER_ARGS` flag and `--remote-debugging-address=127.0.0.1`.
- Each changed script's dry run is in `evidences/` before its real run.
- `qa.md` records each A part as passed (with a screenshot, script log or command output), fixed and re-run, or waived (the owner's words): E2E-12 (A), E2E-21 (A), E2E-22 (A, with the form steps and M1), E2E-23 (files and page), E2E-27 (A), E2E-29.
- E2E-23: `pophood.exe` 0.2.0, `pophood-sensors.exe` 0.1.0, and the v0.1.1 exe not 0.2.0 (command output).
- E2E-27: the sampler first reports exactly 1 split card; without it, the run counts as failed.
- E2E-29 (b): the first save succeeds before the failure (log). E2E-29 (a): the name in `labels.json` equals the text set with `SetValue` (so `SetValue` reaches React).
- E2E-21: at 1024×800 the panel height + 12 ≤ 508 px and Reset's top is below Save name's bottom; at 1917×1029 both buttons share one top (the control).
- E2E-22 (A): the 45-character `insertText` leaves 40 characters; M1's precondition holds, the pass holds, and the `blur()` / `focus()` control shows a scroll change. (Changed on 2026-10-23, owner: "Inject old rule (Recommended)": the `blur()` / `focus()` control is recorded, and the pre-fix padding set inline must make the same typing move the page; see `tasks.md` § Review findings, M1.)
- At the end, `%LOCALAPPDATA%\dev.pophood` holds no `labels.json`, `.bad` or `.tmp` (`Test-Path` output), and every moved file is under `$S\evidences\label-files\`.

## Testing

The agent-run items of techspec § [E2E Tests](techspec.md#e2e-tests), in reduced mode:

- **release:** E2E-12 (A), E2E-21 (A), E2E-23 (files), E2E-29;
- **devtools:** E2E-22 (A, with the form steps and the M1 check), E2E-23 (About page), E2E-27 (A);
- **on the clone:** `npm test`, `cargo test` (IT-01…IT-17) and `cargo test -- --ignored`.
- The full-sensors parts, E2E-22's negative control, E2E-28, PERF-02 and E2E-15 are T8.

## Additional relevant files

- `specs/v0.1.1/task_05.md` (the v0.1.1 agent sweep, its notes)
- `sessions/20261023055425_pophood-v011-release/qa.md` (the report format)
- `specs/v0.2.0/techspec.md` § Integration points, § E2E Tests
- `specs/v0.2.0/tasks.md` § Builds and paths, § Label file state, § Harness changes

## Task notes (2026-10-23)

Session folder `$S` = `sessions/20261023163100_pophood-v020-release/`. Report: `$S/qa.md`. Evidence is in `$S/evidences/` (dry runs in `dry-run/`, moved label files in `label-files/`).

- **Builds, from `e4e6a94`:** release `C:\Users\jimmy\pophood-e2e\target-v020\release\pophood.exe` (`064A1A17…6949`), devtools `C:\Users\jimmy\pophood-e2e\target-v020-devtools\release\pophood.exe` (`77CDAAC5…3F9D`). The helper stayed `553A7F49…` before and after both builds and sits next to both exes. The v0.1.0 and v0.1.1 exes are unchanged (`release-build-log.txt`, `final-hashes.txt`). The fast-forward `0861d8f..e4e6a94` is in `release-build-log-run1-stop.txt`: that first run stopped on a harness fault (it compared a short hash with the full one), and the fixed script's run is the build of record. `git diff --stat 0861d8f -- helper src-tauri/src/sensors` exits 0 with no output, while the same command on `src-tauri/src` lists the 3 changed files (`diff-check-exitcode.txt`).
- **Suites:** `npm test` 277, `cargo test` 82 + 1 + 18 (1 ignored), `cargo test -- --ignored` 1, all pass (`test-log.txt`).
- **A parts, all passed:** E2E-23 (files and page), E2E-12 (15 checks), E2E-21 (25 checks, with the form fits: panel 457 + 12 = 469 ≤ 508, 2 lines at 1024×800, 1 line at 1917×1029), E2E-22 (38 checks), E2E-27 (1 split card first) and E2E-29 (9 checks).
- **UIA `SetValue` reaches React:** E2E-29 (a) saved exactly the text set ("Probe A"). T8 can use it.
- **M1:** typing in the stuck form doesn't move the page (738 → 738, panel top 0 → 0). Owner decision for the control: "Inject old rule (Recommended)". The `blur()` / `focus()` control shows no change (the fallback selector turns the padding off while the form has focus), as expected. With the pre-fix padding set inline (computed `520px`), the same typing moved scrollY 738 → 127 and the panel top 0 → 156, the same values as T4's run before the fix. `tasks.md` (M1 rule) and `task_08.md` now describe this control for T8.
- **Records (not pass/fail):** after a keyboard Reset the focus is on `<body>` (T6 review F3). Shift+Tab into the stuck form doesn't scroll (scrollY 427 at each stop). Typing at scroll 0 doesn't scroll.
- **Harness faults found by the dry runs (fixed, re-run):** E2E-29 read only half of the load-problem note (UIA splits the text into two elements); E2E-22's first control used an injected `<style>` element, which the CSP (`style-src 'self'`) blocks. Its check now also requires a computed `520px`.
- **Label files:** none at the start; nothing deleted; every file the runs left is under `$S/evidences/label-files/`; none at the end.
- **Independent review** (a separate agent, read-only): no failing A part. It found that the M1 owner decision wasn't yet in `tasks.md` / `task_08.md` (fixed) and that the diff check would pass on a git error (`diff-check-exitcode.txt` records exit 0 and a control). It also said the E2E-23 dry-run files were copies. They are not: both runs are in the session's command output, and the output is deterministic.
- **No product file changed.** Nothing needed a fix or a waiver.
- **Confidence:** 90% at the plan, 95% after (see the summary in the session reply).
