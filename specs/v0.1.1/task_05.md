# Task 5 - Release builds and agent-run checks

## Description

In the follow-ups clone, build the v0.1.1 release `pophood.exe` and the devtools variant from the owner's commit, with the helper of record. Then run the suites and every agent ("A") E2E part, which runs in reduced mode. This is the agent half of Sequence step 4. The owner half (full sensors, PERF-02, the network audit) is T6, on the same two builds.

- Status: Done (2026-10-23). Every A part passed; report: `sessions/20261023055425_pophood-v011-release/qa.md`
- Complexity: **L**. It stays one task because it is one test sweep on one pair of builds: a split would set up the builds and the hash baseline twice.
- Estimated time: 4–6h
- Depends on: T4 (and the owner's commit)
- Can run in parallel with: —

## AI guidance

- `qa-execution`: this task's flow (build, tests, live validation, the evidence report `qa.md`).
- ADR 0019 (`sessions/20261021165812_pophood-v010-e2e/decisions/0019-agent-e2e-uia-and-cdp.md`): UI Automation on the release exe, CDP on the devtools variant, never OS keystrokes.
- `AGENTS.md` "Build notes": the helper's hash depends on the build folder. Rebuild only `pophood.exe`, with a separate `CARGO_TARGET_DIR` and the `--config` override, and put `vswhere` on `PATH`.
- `AGENTS.md` "No network": the CDP port is 127.0.0.1 only and is test instrumentation. Product flags live only in `BROWSER_ARGS`, and the env var must repeat every one of them.
- `AGENTS.md` "Conventions": every pass/fail check has a negative control. Remember the pwsh traps (case-insensitive variable names; `Tee-Object` inside a function adds to its return value).
- The T13 harness dead ends (`specs/v0.1.0/task_13.md` § Task notes): close by window class; a dropped UIA Invoke must be re-checked before it counts as a bug.
- `sessions/20261021181500_pophood-v010-owner-e2e/t14.psm1`: `Start-PhFresh` and `Assert-ReleaseHelper` have the v0.1.0 release folder hard-coded, so don't use them for v0.1.1. `Get-PhStatus` and `Wait-PhStatus` don't depend on a path.

## Requirements

- Both builds come from the owner's commit. `git -C C:\Users\jimmy\pophood-e2e\pophood-followups pull --ff-only` (on `master`, or the branch the owner named), and `git log --oneline -1` equals the hash recorded in T4.
- `git -C <clone> diff --stat 1a51df2 -- helper src-tauri/src` is empty: the commit changes no helper or core code.
- The staged helper is `553A7F496E4F2DC2CD1590D6BD127F47384351F5FB7B25B2C05615937B357936` before and after both builds, and `pophood-sensors.exe` next to each built `pophood.exe` has the same hash. Any other value stops the task.
- `npm ci` runs first (the lock changed). Neither build runs `build:helper`: the override is `beforeBuildCommand = npm run build`.
- The clone's v0.1.0 `src-tauri\target\release\pophood.exe` keeps its hash (checked before and after).
- The flags in `devtools-start.ps1` equal the `BROWSER_ARGS` in the clone's `src-tauri/src/webview.rs` (exact match of the flag set).
- Every "A" part passes. If one fails, either fix it (the fix rule in `tasks.md`: the owner commits, both variants are rebuilt, and the affected checks run again) or get the owner's waiver, quoted verbatim in `qa.md`.
- **If E2E-27 fails:** stop and ask the owner before you apply the `min-width` fallback (techspec § Confidence score).

## Files involved

| Path | Action |
|---|---|
| `C:\Users\jimmy\pophood-e2e\pophood-followups` | Pull, `npm ci`, build (outside the repo) |
| `C:\Users\jimmy\pophood-e2e\target-v011`, `C:\Users\jimmy\pophood-e2e\target-v011-devtools` | Create (the build output) |
| `sessions/<yyyyMMddHHmmss>_pophood-v011-release/` (`$S`) | Create: `release-build.ps1`, `e2e12.ps1`, `e2e21.ps1`, `e2e22-cdp.ps1`, `e2e23.ps1`, `e2e27-layout.ps1`, `qa.md`, `evidences/` |
| `sessions/20261021165812_pophood-v010-e2e/ui.psm1`, `cdp.psm1`, `devtools-start.ps1` | Read and use (import the modules; pass `-Exe` to `devtools-start.ps1`; don't edit them) |
| `sessions/20261021165812_pophood-v010-e2e/pass2-build.ps1`, `fresh-tests.ps1`, `e2e12.ps1`, `e2e21.ps1`, `e2e22-cdp.ps1`, `e2e23.ps1` | Read (templates) |
| `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1` | Read (template) |
| Any T1–T3 file | Modify only to fix a failing check |

## Implementation steps

1. Create `$S`. Write `release-build.ps1` (templates `oq13-build.ps1` and `pass2-build.ps1`), and log everything to `$S\evidences\release-build-log.txt`:
   1. hash the staged helper and the v0.1.0 `pophood.exe`;
   2. `pull --ff-only`, `git log --oneline -1`, and the `diff --stat 1a51df2 -- helper src-tauri/src` check;
   3. `npm ci`;
   4. the release build: `CARGO_TARGET_DIR=C:\Users\jimmy\pophood-e2e\target-v011`, `npm run tauri build -- --no-bundle --config '{"build":{"beforeBuildCommand":"npm run build"}}'`;
   5. the devtools build: `CARGO_TARGET_DIR=C:\Users\jimmy\pophood-e2e\target-v011-devtools`, the same command plus `--features tauri/devtools`;
   6. hash both `pophood.exe` files, both `pophood-sensors.exe` files next to them, the staged helper and the v0.1.0 `pophood.exe` again.
2. Suites in the clone, logged to `$S\evidences\test-log.txt`: `npm test`, then `cargo test` and `cargo test -- --ignored` in `src-tauri`, with `POPHOOD_OWNER_PC=1` (as in `fresh-tests.ps1`; `dotnet test` isn't needed, because the helper is unchanged).
3. **Release exe** (`target-v011\release\pophood.exe`, UI Automation, `Set-PhSize -Client`). Adapt the v0.1.0 scripts:
   - `e2e23.ps1`, the files part: `(Get-Item pophood.exe).VersionInfo.ProductVersion` starts with 0.1.1; the helper's starts with 0.1.0.
   - `e2e12.ps1`, the reduced part at 1024×800, as in the techspec E2E-12 row: a card click and "All sensors" open the page with live values; the banner; Loads with values and the five locked CPU cards; "CPU Total" selected; a click on a row far down updates the stuck panel; Min/Max change over time; Memory grouped by hardware; the breadcrumb goes back.
   - `e2e21.ps1`, the reduced parts, in both themes:
     - at 1024×680: 2 columns, nothing clipped, no horizontal scroll, the panel scrolls with the page;
     - at 1024×800: the panel sticks while the CPU page scrolls;
     - at 1917×1029: the split Loads card keeps its border and has no title in its next column;
     - the Dashboard: 2 columns at 1024, 3 at 1280 (the history legend may sit below the chart at 1024).
     - Count columns from the card titles' UIA bounding rectangles, as v0.1.0's `Columns` did with the card buttons.
4. **Devtools variant** (`devtools-start.ps1 -Exe C:\Users\jimmy\pophood-e2e\target-v011-devtools\release\pophood.exe`, CDP). First check the browser command line it prints.
   - `e2e23.ps1`, the page part: About shows 0.1.1 and "LHM 0.9.6 @ 3d331e3"; the SHA-256 shown equals `Get-FileHash` of the shipped helper (`553A7F49…`); every Dependencies-table component and the LHM source location are listed; URLs are text (no `a[href]`); the notices line says "Pophood 0.1.1".
   - `e2e22-cdp.ps1`, the reduced part at 1024×800:
     - every row is reachable with Tab, and the focus ring is 2 px;
     - the landmarks "Main", "Reduced sensors", "Sensor detail" and "Sensor list";
     - card titles are `h2` on the CPU page and `h3` under each hardware heading on the Memory page;
     - Shift+Tab under the stuck panel: scroll to the bottom, Shift+Tab back through the first rows of each column, and each focused row is fully below the panel;
     - the Dashboard, as in v0.1.0: every action reachable with Tab, the theme toggle's `aria-label`, the "History" landmark.
     - The negative control is T6's.
   - `e2e27-layout.ps1 -Mode reduced` at 1917×1029, on the CPU page. Write it so that T6 can run it with `-Mode full`:
     - **Sampling:** every second for 60 s, for each `.group`, its `getClientRects()` fragments and a column index for each fragment (from its left edge relative to `.drill__columns`).
     - **Load:** from second 20 to second 40, a CPU load: one pwsh busy-loop job per logical core (`[Environment]::ProcessorCount`). Log "CPU Total" before and during the load, so the log shows that the values changed width.
     - **Negative control, first:** report the split cards. Reduced: 1 (Loads). Full: 3.
     - **Pass:** no card changes columns and no card's fragment count changes.
5. Write `$S\qa.md` (the `qa-execution` format): one line per E2E part, with its build (release or devtools), pass or fail, and the evidence file. Copy the build and test logs' key lines into it.
6. Update this file's Status and task notes, and the T5 row in `tasks.md`. Tell the owner that T6 is ready.

## Acceptance Criteria

- `release-build-log.txt` shows:
  - a fast-forward to T4's hash, and an empty `diff --stat 1a51df2 -- helper src-tauri/src`;
  - `npm ci` and both builds exit 0;
  - the staged helper is `553A7F49…` before and after;
  - `pophood-sensors.exe` is `553A7F49…` next to both new exes;
  - the v0.1.0 `pophood.exe` hash is unchanged.
- `test-log.txt`: `npm test`, `cargo test` and `cargo test -- --ignored` all pass.
- The devtools browser command line has every `BROWSER_ARGS` flag and `--remote-debugging-address=127.0.0.1`, and CDP listens on 127.0.0.1 only (the `devtools-start.ps1` output).
- `qa.md` records each A part as passed, with evidence (a screenshot, a script log or a command output), or as fixed and re-run, or with the owner's waiver quoted verbatim. The A parts are: E2E-12 (A), E2E-21 (A), E2E-22 (A), E2E-23 (page and files) and E2E-27 (A).
- **E2E-27 negative control:** before the run, the sampler reports exactly 1 split card (Loads) on the reduced CPU page. Without it, the run counts as failed.
- E2E-23: `ProductVersion` starts with 0.1.1 for `pophood.exe` and with 0.1.0 for `pophood-sensors.exe` (command output).

## Testing

The agent-run ("A") items of techspec § [E2E Tests](techspec.md#e2e-tests), in reduced mode:

- **release:** E2E-12 (A), E2E-21 (A), E2E-23 (the files);
- **devtools:** E2E-22 (A), E2E-23 (the About page), E2E-27 (A).
- **On the clone:** `npm test`, `cargo test` (IT-01…IT-17) and `cargo test -- --ignored` (IT-10).
- The full-sensors parts, E2E-22's negative control, PERF-02 and E2E-15 are in T6.

## Additional relevant files

- `specs/v0.1.1/techspec.md` § Integration points, § E2E Tests, § Measured sizes
- `specs/v0.1.0/task_13.md` (the v0.1.0 agent sweep: order, harness notes)
- `sessions/20261021165812_pophood-v010-e2e/qa.md` (the v0.1.0 report format)
- `sessions/20261022132420_pophood-v010-followups/RUNBOOK.md` and `release-build.ps1` (the last release run on this clone)

## Task notes (2026-10-23)

Session folder `$S` = `sessions/20261023055425_pophood-v011-release/`. Report: `$S/qa.md`. Everything below is in `$S/evidences/`.

- **Builds, from `0861d8f`:** release `C:\Users\jimmy\pophood-e2e\target-v011\release\pophood.exe` (`3DE07C6F…B4D`), devtools `C:\Users\jimmy\pophood-e2e\target-v011-devtools\release\pophood.exe` (`48D79DF8…C7B1`). The helper stayed `553A7F49…` before and after both builds and sits next to both exes. The v0.1.0 exe (`79FC35F9…`) is unchanged (`release-build-log.txt`, `final-hashes.txt`).
- **Suites:** `npm test` 251, `cargo test` and `cargo test -- --ignored` pass (`test-log.txt`).
- **A parts:** E2E-12, E2E-21 (both themes), E2E-22, E2E-23 (files and page) and E2E-27 (reduced, negative control: 1 split card, "Loads · 26") all passed.
- **For T6:**
  - `e2e27-layout.ps1 -Mode full` is ready (expects 3 split cards as its negative control). Start the devtools variant with `devtools-start.ps1 -Exe …\target-v011-devtools\release\pophood.exe` (v0.1.0 folder), let the owner click Enable, then run it at 1917×1029.
  - `e2e12.ps1`, `e2e21.ps1` and `e2e22-cdp.ps1` are the reduced versions. T6's full-sensors parts need their own checks (Core (Tctl/Tdie) selected after Enable, 5 columns, 3 split cards, "Controls · 6").
  - Harness lessons: UIA lags a scroll by about 0.4 s (wait, then require equal reads); match focusables by element, not by label (rows carry live values); don't pipe a script through `Select-Object -First n` (the script keeps running); start the app fresh before a Min/Max check.
- **Nothing needed a fix or a waiver.** No file under T1–T3 changed.
