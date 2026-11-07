# Tasks summary - Pophood v0.2.0 (rename any sensor, slice 2)

- **Source:** [techspec.md](techspec.md) Rev 1.1 (94%), with the adversarial review `sessions/20261023112712_pophood-v020-techspec-review/review.md` (0 High, 4 Medium, 11 Low; re-scored 92%). The review's verdict allows two ways to fix M1–M4: a Rev 1.2, or "each one as an explicit task with its pass rule". These tasks take the second way. The techspec stays at Rev 1.1; [Changes to the techspec](#changes-to-the-techspec) lists each change these tasks make to it.
- **Approved:** 2026-10-23, in this tasks-breakdown session. The owner went to `tasks-breakdown` with no Rev 1.2 ("let's do the tasks-breakdown"). Owner answers, verbatim:
  - the breakdown, with the Dashboard (T3) before the drill-down (T4): "Approve, 8 tasks (Recommended)";
  - L1, a 40-character label with no space overflows the Motherboard card's fan row: "Add the 2 CSS rules (Recommended)";
  - M4, how the agent clears the label files: "Move aside, never delete (Recommended)";
  - L2 (drop the 40-character E2E-27 pass), L3 (the long load-problem note becomes an accepted Known Risk), L7 (the AGENTS.md wording): "Accept all three (Recommended)";
  - tasks review L11, a one-time OK for `devtools-start.ps1:7` (`Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, which clears one env var in the script's process and deletes no file) in every v0.2.0 run: "OK for v0.2.0 (Recommended)".
- **Tasks review:** `sessions/20261023130205_pophood-v020-tasks-review/review.md` (2026-10-23; 1 High, 4 Medium, 11 Low; 89%). Every finding is fixed in these files (H1 → the M1 rule; M1 → `SetValue` and the 40 cut in T7; M2 → the form-fits check; M3 → the Dashboard (O) section; M4 → the `release-build.ps1` row; L1–L11 in place). The fixes are test-method and text changes; no design value changes.
- **Repo:** single repo (`pophood`). Code changes in `src/` (React UI) and `src-tauri/src/` (`labels.rs`, `commands.rs`, `lib.rs`), plus the version files and docs. **Nothing under `helper/` or `src-tauri/src/sensors/` changes.**

## Tasks overview

| Task | Title | Complexity | Est. Time | Depends On | Status |
| ---- | ----- | ---------- | --------- | ---------- | ------ |
| [#1](task_01.md) | Core label store: `labels.rs`, two commands, `setup` | M | 3–4h | — | Done |
| [#2](task_02.md) | UI label store: `labels.ts`, the wrappers, `main.tsx` | S | 2h | — | Done |
| [#3](task_03.md) | Dashboard: the fan-row label, "Name your fans", the fan-name CSS | S | 1–2h | T2 | Done |
| [#4](task_04.md) | Drill-down rename form and styles, then an early `tauri dev` render | M | 5–7h | T1, T2, T3 | Done |
| [#5](task_05.md) | Version 0.2.0, the README status line, the AGENTS.md line | S | 1h | T4 (order only) | Done |
| [#6](task_06.md) | Code review of T1–T5, then the owner's commit | S | 1–2h | T1–T5 | Done (`e4e6a94`) |
| [#7](task_07.md) | Release builds, harness updates and agent-run checks | L | 5–7h | T6 (and the owner's commit) | Done |
| [#8](task_08.md) | Owner session: full sensors, the reboot, PERF-02 and the network audit | M | 3h (about 1h15 of the owner's time) | T7 | Not started |

**Overall Progress**: 7/8 tasks completed (88%). The owner committed `e4e6a94` on `master`. T7 built both variants from it and every agent ("A") part passed (`sessions/20261023163100_pophood-v020-release/qa.md`). Next: T8 (the owner's session)

**Last Updated**: 2026-10-23

## Implementation order

The order follows the techspec [Sequence](techspec.md#sequence): step 1 → T1, step 2 → T2, step 4 → T3, step 3 → T4, step 5 → T5, step 6 → T6, step 7 → T7, step 8 → T8. These reallocations change no design:

| Change | Why |
|---|---|
| The Dashboard (step 4) comes before the drill-down (step 3) | Owner: "Approve, 8 tasks (Recommended)". Step 3's early render then has the fan row, the link and the form in one run |
| The review's M1–M4 and Lows go into the tasks, not into a Rev 1.2 | Owner: "let's do the tasks-breakdown". Each one has a task and a pass rule ([Review findings](#review-findings-disposition)) |
| PERF-02 moves from step 7 to T8 (L8) | It needs full sensors, so the owner's UAC |
| E2E-28 runs entirely in T8 | Every part but one needs full sensors or a reboot. The one reduced part ("CPU Total" in reduced mode) follows the reboot in the same script |
| E2E-29 runs entirely in T7 | Reduced mode is enough (a CPU sensor), and no part needs the owner |
| T8's owner session runs B (devtools) → A (release) → C (audit) → D (reboot) | B saves nothing, so E2E-22 and E2E-27 (O) run with no `labels.json` (tasks review L1) |
| E2E-28's 45 → 40 cut moves to T7 (E2E-22 A, CDP) | UIA `SetValue` doesn't apply `maxLength`, and the release exe has no other text input under ADR 0019 (tasks review M1) |
| E2E-15 uses E2E-28's saved label for its hash check | The label file then exists during the capture (M4); see [Label file state](#label-file-state) |
| Doc updates go with the tasks: each task updates its task file and this file; T5 does the README status line and the AGENTS.md line; T8 does the `specs/v0.2.0/README.md` status and the techspec's "Next" line at sign-off | There is no separate docs task |

```text
T1 ──────────────┐
T2 ─> T3 ────────┴─> T4 ─> T5 ─> T6 ─> [owner commit] ─> T7 (agent) ─> T8 (owner)
```

**Parallelism:** T1 and T2 share no file and can run in parallel. T3 needs T2's store. T4 needs all three (its render needs the commands, the store and the Dashboard). T5 comes after T4 so that T4's `tauri dev` runs keep one version. T7 and T8 share the builds, the PC and the label file.

**The owner's commit (after T6):** the v0.2.0 tree on `master` (or a branch the owner names to T7), together with the v0.2.0 spec and session files. T7 pulls it with `--ff-only`. Branching and commits stay with the owner.

**Fix rule after the commit (T7, T8):** a fix found in T7 or T8 goes into the owning task's files. The owner commits it, T7 rebuilds both variants, and the checks the fix touches run again: earlier evidence for those checks no longer counts. The helper regression rule (AGENTS.md) applies only if a fix touches `helper/` or `src-tauri/src/sensors/`, and none should.

## Builds and paths (T7, T8)

| Name | Path | What |
|---|---|---|
| Clone | `C:\Users\jimmy\pophood-e2e\pophood-followups` | At `e4e6a94` (v0.2.0) on `master` since T7 (fast-forward from `0861d8f`, 2026-10-23) |
| Helper of record | `src-tauri\binaries\pophood-sensors-x86_64-pc-windows-msvc.exe` in the clone | SHA-256 `553A7F496E4F2DC2CD1590D6BD127F47384351F5FB7B25B2C05615937B357936` (checked 2026-10-23). Neither build rebuilds it |
| **release** | `C:\Users\jimmy\pophood-e2e\target-v020\release\pophood.exe` | A `CARGO_TARGET_DIR` build with `beforeBuildCommand = npm run build` (template `sessions/20261023055425_pophood-v011-release/release-build.ps1`). Driven through UI Automation (`ui.psm1`) |
| **devtools** | `C:\Users\jimmy\pophood-e2e\target-v020-devtools\release\pophood.exe` | The same command plus `--features tauri/devtools`. Started with `devtools-start.ps1 -Exe …`, driven through CDP on 127.0.0.1 (`cdp.psm1`). Test instrumentation, never the product (ADR 0019) |
| The v0.1.1 builds | `C:\Users\jimmy\pophood-e2e\target-v011\release\pophood.exe`, `…\target-v011-devtools\…` | Kept unchanged: E2E-23's negative control (a 0.1.1 exe) |
| Raw captures | `C:\Users\jimmy\pophood-e2e\v020-raw\` | Raw traces and network captures (outside the repo) |
| Session (`$S`) | `sessions/20261023163100_pophood-v020-release/` | Created by T7: the scripts, `qa.md` and `evidences/` for T7 and T8, and T8's `RUNBOOK.md`. Builds: release `064A1A17…`, devtools `77CDAAC5…` |

## Label file state

`%LOCALAPPDATA%\dev.pophood` (the identifier `dev.pophood`, `src-tauri/tauri.conf.json:5`) is **one folder for every build**: `npm run tauri dev`, the release exe and the devtools variant all read and write the same `labels.json` (review M4). On 2026-10-23 the folder holds only `EBWebView` (no `labels.json`).

**Rule: move aside, never delete** (owner: "Move aside, never delete (Recommended)"). The agent never deletes a label file. To clear one, it moves the file (or folder) with `Move-Item` into the running task's `evidences\label-files\<step>\`, where it stays as evidence. No delete command is needed in any task.

| When | Start state | What happens | End state |
|---|---|---|---|
| T4, the `tauri dev` render | No `labels.json`. If one exists, move it to `evidences\label-files\before-render\` and write its path in the task notes | The render saves labels | Reset every label in the UI, then move `labels.json` to `evidences\label-files\after-render\`: no file |
| T7, start | No file. If one exists, move it to `$S\evidences\label-files\t7-start\` | — | — |
| T7, E2E-12, 21, 22, 23, 27 (A) | No file | E2E-22's "Enter saves" step saves one label; **E2E-22 ends with a Reset** of it | Move `labels.json` to `$S\evidences\label-files\e2e22\` |
| T7, E2E-29 (last in T7) | No file | (a) writes `{`; (b) creates a `labels.json.tmp` folder, then moves it aside (not removed) and saves again | Move `labels.json`, `labels.json.bad` and the `.tmp` folder to `$S\evidences\label-files\e2e29\`: no file |
| T8, dry runs (before the owner joins) | No file | `e2e28.ps1 -Part reboot` may save and reset in reduced mode | Move any `labels.json` to `$S\evidences\label-files\t8-dry-run\`: no file |
| T8, B (devtools; runs first) | No file | E2E-22 (O), M1, E2E-27 (O), PERF-02: typing, no save | No file (checked) |
| T8, A: E2E-12 and 21 (O), then E2E-28 | No file (E2E-28's negative control checks it) | E2E-28 saves "CPU fan" on Fan #1 | `labels.json` holds "CPU fan" |
| T8, E2E-15 | `labels.json` holds "CPU fan" (checked: the file exists) | `Get-FileHash` before and after the capture | Unchanged |
| T8, after the reboot | "CPU fan" | E2E-28's last parts, ending with a Reset of every label (`labels` is `{}`) | Move `labels.json` to `$S\evidences\label-files\e2e28\`. Then move back any file that T4 or T7 found at its start (none on 2026-10-23) |

## Harness changes (T7, T8)

Replaces the techspec's [E2E harness updates](techspec.md#e2e-harness-updates) table, which the review found incomplete (M2). Copy each v0.1.1 script from `sessions/20261023055425_pophood-v011-release/` into `$S`, then change:

| Script | Change | Why |
|---|---|---|
| `release-build.ps1` | `target-v011` → `target-v020`, `target-v011-devtools` → `target-v020-devtools` (`:11-12`). `$ExpectedCommit` (`:5`) gets **no default**: pass T6's hash (`-ExpectedCommit <hash>`), because the clone is already at `0861d8f` and the HEAD check (`:34`) would pass with no pull. The diff check (`:35`) becomes `git diff --stat 0861d8f -- helper src-tauri/src/sensors` (must be empty). Add the v0.1.1 release and devtools `pophood.exe` to the hashes before (`:23`) and after (`:68-71`), with a STOP if one changes | Paths are hard-coded; the core changes outside `sensors/`; the v0.1.1 exes are E2E-23's control |
| `release-tests.ps1` | Paths only, if any | — |
| `e2e12.ps1`, `e2e21.ps1`, `e2e22-cdp.ps1`, `e2e27-layout.ps1` | No hard-coded `target-v011` path (grep, 2026-10-23); they take `[0]` (CPU) or `[1]` (Memory in `e2e22-cdp.ps1:107`), never the Motherboard card. In `e2e21.ps1 → DashboardColumns` (≈:47-54) match `All sensors` **or** `Name your fans` (UIA `OrCondition`) | The Motherboard card's link is "Name your fans" |
| `e2e21.ps1` | Add the **form-fits check** (AC-10): at 1024×800, both themes, scrolled to 100 %: the "Sensor detail" region's height + 12 ≤ 508 px and its bottom is inside the window; **Reset**'s top is below **Save name**'s bottom (2 lines). Negative control: at 1917×1029 both buttons have the same top (1 line) | AC-10 on the release build, not only in T4's preview |
| `e2e22-cdp.ps1` | Add the form steps (Tab reaches the input, Save name, Reset; Enter saves; Shift+Tab into the stuck form), the 40 cut, and the M1 check with two new helpers written **in this script** (`cdp.psm1` is not edited): a CDP mouse click (`Input.dispatchMouseEvent` moved / pressed / released; pattern `sessions/20261021165812_pophood-v010-e2e/verifier-followups.ps1:15-17`) and a letter key (`Input.dispatchKeyEvent` `keyDown` with `text`, then `keyUp`; `Send-CdpKey` knows only Tab, Enter, Space, Escape, F5). End with a Reset | New in v0.2.0 |
| `e2e23.ps1` | The paths (`:4-5`); "0.1.1" → "0.2.0" (`:11`, `:26-27`); the negative control (`:13-15`) uses the v0.1.1 release exe (must **not** start with 0.2.0) | It wasn't in the techspec's table |
| `t6-release.ps1` → `t8-release.ps1` | The paths (`:8`, `:94`). The E2E-12 (O) Motherboard step (≈:137-148) invokes the button named **`Name your fans` only** (FAIL if absent), so the log shows that this link opened the page. Add a **Dashboard (O)** section after E2E-21 (O): at 1280×860, the card buttons named `All sensors` **or** `Name your fans` (`OrCondition`) number exactly one more than `All sensors` alone (negative control: the v0.1.1 match misses the Motherboard card), and the Dashboard has 3 columns | The link name; `t6-release.ps1` has no Dashboard count |
| `t6-devtools.ps1` → `t8-devtools.ps1` | The paths (`:11`), the raw folder `v011-raw` → `v020-raw` (`:6`); `'360px'` → `'520px'` (`:70`, `:82`); the M1 check at 1917×1029 (the helpers from `e2e22-cdp.ps1`); restore the window before `Set-PhSize` (`:30`) and check `innerWidth × innerHeight` = 1917×1029 before E2E-22 (O); PERF-02 (`:139`) is logged next to **v0.1.1** (drill-down p95 5.53 ms, longest task 3.06 ms; Dashboard p95 4.53 ms) | Both padding checks FAIL at 520 px without it; v0.1.1's part B ran maximized (1920×1009) |
| New: `e2e28.ps1` (`-Part main`, `-Part reboot`) and `e2e29.ps1` | Written in T8 and T7. On the release exe, text goes in with UIA `ValuePattern.SetValue` and is saved by invoking **Save name**: UIA has no paste and no Enter, and `Send-PhKeys` (SendKeys) is ruled out by ADR 0019. `SetValue` doesn't apply `maxLength`, so the 40 cut is T7's (`e2e22-cdp.ps1`, CDP `Input.insertText`). E2E-29 in T7 is the first use of `SetValue`: if the saved name is wrong there, stop and ask the owner | New rows |

Every changed or new script gets a dry run before it counts, and the v0.1.0-era scripts stay as records (techspec Q&A #7).

## Test ownership

Every scenario in the techspec [Test plan](techspec.md#test-plan) has an owner.

| Task | Unit | Integration | E2E / Perf / live |
|---|---|---|---|
| T1 | UT-40 (new) | `cargo test` (IT-01…IT-17 keep passing) | — |
| T2 | UT-41 (new) | — | — |
| T3 | UT-43 (new) | — | — |
| T4 | UT-42 (new); the Motherboard subline expectation; every v0.1.x `SensorList` test | — | Early `tauri dev` render (reduced): both themes, 1917×1029, 1280×860, 1024×800, 1024×680; the form; a renamed row and a 40-character heading; the save-failure line; the sticky panel; E2E-22's Shift+Tab step and the **M1 typing check** at 1024×800. A preview: the E2E rows close in T7 and T8 |
| T5 | About (shows 0.2.0) | `cargo check` (the lock file) | — |
| T6 | — (a review; every suite is green after the fixes) | — | — |
| T7 | `npm test` on the clone | `cargo test` and `cargo test -- --ignored` on the clone | **release:** E2E-12 (A), E2E-21 (A, with the form-fits check), E2E-23 (files), E2E-29. **devtools:** E2E-22 (A, with the form steps, the 40 cut and the M1 rule), E2E-23 (About page), E2E-27 (A) |
| T8 | — | — | **release:** E2E-12 (O), E2E-21 (O), Dashboard (O), E2E-28, E2E-15. **devtools:** E2E-22 (O, with its negative control and the M1 rule at 1917×1029), E2E-27 (O), PERF-02 |

- **Split on purpose:** E2E-12, E2E-21, E2E-22 and E2E-27 (T7 has the reduced "A" parts, T8 the full-sensors "O" parts).
- **E2E-22 passes only after T8**, because its negative control runs there.
- **Not run (helper unchanged, so the helper regression rule doesn't apply):** `dotnet test`, E2E-19, E2E-24, the DLL plant check, the elevated smoke.
- **Dropped:** the requirements' "E2E-27 with a 40-character label on the CPU page" (`requirements.md`, risk table). A label is fixed, so it can't move cards between columns over time, which is what E2E-27 measures; the wrap is E2E-28's 40-character step (owner: "Accept all three (Recommended)", L2).

## Acceptance criteria coverage

| AC (techspec § Test plan) | Tasks |
|---|---|
| AC-01 save, row, heading, chart name, fan row | T3 (UT-43 a), T4 (UT-42 a, b; render), T8 (E2E-28) |
| AC-02 reset, empty, default, Reset disabled | T1 (UT-40 b), T2 (UT-41 d), T4 (UT-42 b, c), T8 (E2E-28) |
| AC-03 text rules, core checks, text only | T1 (UT-40 c), T2 (UT-41 c), T4 (UT-42 c, i), T7 (E2E-22 A: the 45-character cut to 40), T8 (E2E-28: a 40-character label saved) |
| AC-04 exact key, absent sensors | T4 (UT-42 h), T8 (E2E-28) |
| AC-05 the draft rule | T4 (UT-42 d, e, m), T7 (E2E-22 A) |
| AC-06 survives restart, reboot, reduced ↔ full; version 1 | T1 (UT-40 a), T8 (E2E-28) |
| AC-07 visible failures | T1 (UT-40 d–g), T2 (UT-41 b, e), T4 (UT-42 f, g; render), T7 (E2E-29) |
| AC-08 display only | T3 (UT-43 c), T4 (UT-42 l), T7 (E2E-12 A), T8 (E2E-12 O) |
| AC-09 "Name your fans", the subline | T3 (UT-43 a, b), T4 (UT-42 k), T7 (E2E-12 A), T8 (E2E-12 O, E2E-28) |
| AC-10 sticky panel, focus never hidden, 1024×800, stale | T4 (UT-42 j; render, M1), T7 (E2E-21 A, E2E-22 A, E2E-27 A), T8 (E2E-21 O, E2E-22 O, E2E-27 O) |
| AC-11 versions, helper hash, no network | T5 (About test), T6 (no diff under `helper/` or `src-tauri/src/sensors/`), T7 (helper hash before and after both builds; E2E-23), T8 (E2E-15) |

## Review findings: disposition

| Finding | Task | Pass rule |
|---|---|---|
| **M1** typing in the stuck form may scroll the page | T4 (render, 1024×800), T7 (E2E-22 A, 1024×800), T8 (E2E-22 O, 1917×1029) | **The M1 rule.** With the panel stuck (scrolled to the bottom): click a row, then the input, with CDP `Input.dispatchMouseEvent` (moved, pressed, released). Type 10 letters, one `Input.dispatchKeyEvent` `keyDown` (with `text`) and one `keyUp` per letter (helpers written in the script; `Send-CdpKey` can't type letters). **Precondition** (else the run counts as failed): `document.activeElement` is `#rename-input` and its `value` is the 10 letters. **Pass:** `scrollY` and the panel's `getBoundingClientRect().top` are the same before and after. **Negative control** (must show a change; owner, T7, 2026-10-23: "Inject old rule (Recommended)"): `app.css` ships the fallback selector `html:has(.drill__detail):not(:has(.rename :focus))` since T4, so the padding is off while the form has focus and the `blur()` / `focus()` control can't show a change: run it and record it. Then set the pre-fix padding with `document.documentElement.style.scrollPaddingTop = "520px"` (CSSOM: the CSP blocks an injected `<style>`), check the computed padding is `520px` with the form focused, repeat the same clicks and typing → `scrollY` changes; then clear the inline style. The scroll-0 run and the Shift+Tab-into-form run stay as records. **If the pass fails, stop and ask the owner** |
| **M2** the harness table | T7, T8 | [Harness changes](#harness-changes-t7-t8); each script passes a dry run |
| **M3** mock history | T2, T3, T4 | `afterEach(() => vi.clearAllMocks())` in each test file that mocks `../sensors/commands`; each save step checks `toHaveBeenLastCalledWith` and `toHaveBeenCalledTimes` |
| **M4** the shared label file | T4, T7, T8 | [Label file state](#label-file-state) |
| L1 fan row overflow | T3 | `className="fan__name"` on the fan name, `.fan__name { min-width: 0; overflow-wrap: anywhere; }` (owner: "Add the 2 CSS rules (Recommended)"); E2E-28 uses a **one-word** 40-character label, so its screenshot can fail |
| L2 E2E-27 with a label | — | Dropped (see Test ownership) |
| L3 long load-problem note at 1024×800 | — | Accepted Known Risk (owner: "Accept all three (Recommended)"): only after a bad file, until restart |
| L4 file open at rename | T1 | The temp file's handle is closed before `fs::rename` |
| L5 old test folders | T1 | Each test clears its folder first (`remove_dir_all`, error ignored), then creates it |
| L6 two more stale comments | T6 | Listed for the owner with the techspec's two (four in all); not edited |
| L7 AGENTS.md wording | T5 | "The core writes one data file, `labels.json` (with `labels.json.tmp` and `labels.json.bad`), in `%LOCALAPPDATA%\dev.pophood`, at a fixed path (`src-tauri/src/labels.rs`). No command takes a path or file name from the UI." |
| L8 PERF-02 needs UAC | T8 | — |
| L9 a delete inside E2E-29 | T7 | The `.tmp` folder is moved aside, not removed |
| L10 Edge profile in the render-check evidence | Owner | Reported 2026-10-23; leave `evidences/render-check/prototype/edge-profile/` out of the commit |
| L11 "one `SensorDetail` per key" wording | T4 | Don't add a `key` to `SensorDetail` (it would remount the chart); the form's `key` does the remount |

## Changes to the techspec

The techspec stays at Rev 1.1. Where these tasks differ from it, the tasks win:

- **Order:** steps 3 and 4 swap (T3 Dashboard, T4 drill-down).
- **Step 3's render:** `tauri dev` runs unelevated (reduced), where the Motherboard card is a placeholder and its page has no sensors. So the render's "40-character label in a Dashboard fan row" moves to E2E-28 (T8). The render adds the M1 typing check.
- **CSS:** a `fan__name` class and rule on the Motherboard card's fan name (L1). The 520 px focus padding uses the M1 fallback selector `html:has(.drill__detail):not(:has(.rename :focus))`: T4's typing check failed with the plain selector (owner: "Use the fallback selector (Recommended)"; see [task_04.md](task_04.md) notes).
- **Rust:** in `LabelStore::write`, the temp file is closed before the rename (L4); UT-40 clears its folder first (L5). `LabelStore::open` reads with `fs::read` + `serde_json::from_slice`, so a file that is not valid UTF-8 is moved aside like any bad file (T6 review F1, owner: "Apply now (Recommended)"); UT-40 has one more test for it.
- **Tests:** mocks cleared after each test; last-call checks (M3).
- **AGENTS.md line:** the L7 wording above.
- **E2E:** the harness table above (M2); the label-file plan (M4); the M1 typing check in E2E-22; PERF-02 in T8; E2E-28's 40-character fan label is one word; the 40-character E2E-27 pass is dropped (L2). E2E-28's 45-character cut runs on the devtools variant in T7 (CDP `Input.insertText`); on the release exe, E2E-28 and E2E-29 enter text with UIA `SetValue` and save with **Save name** (Enter is E2E-22 A). E2E-21 checks that the form fits at 1024×800 on the release build. T8 runs part B (devtools) before part A, so E2E-22 and E2E-27 run with no `labels.json`. M1's negative control is the pre-fix padding set inline, with the `blur()` / `focus()` run kept as a record (T7, owner: "Inject old rule (Recommended)").
- **Known Risks:** the long load-problem note at 1024×800 (L3).

## Confidence

After the tasks review (89%) and its fixes:

```
Confidence: 92% - Fidelity 93 · Dependency closure 93 · Test ownership 91 · Boundaries 93
Remaining uncertainty: the order change and the review fixes live in the tasks, not in a techspec
Rev 1.2. M1 is unverified: its blur()/focus() control and UIA SetValue reaching React are
engine knowledge, not runs (both have a stop-and-ask rule, and SetValue is proven in T7 before
the owner session). E2E-28, E2E-29 and the new E2E-22 steps are new harness code. T7 is L. T8
needs the owner's reboot in the middle of E2E-28.
```

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Fidelity to approved design / locked decisions and requirement coverage | 35% | 93 | The 8 Sequence steps map onto T1–T8 (steps 3 and 4 swapped, owner-approved). Every techspec-review and tasks-review finding has a task and a pass rule; the five owner answers are quoted. AC-01…AC-11 each map to a task; the umbrella version map links the techspec and the tasks. −7: the changes live in the tasks, not in a techspec revision; the L1 CSS is a design addition (owner-approved); E2E-28's 40 cut moved to T7. |
| Dependency, lifecycle and resource closure | 25% | 93 | T1 ∥ T2 → T3 → T4 → T5 → T6 → commit → T7 (`pull --ff-only`, HEAD = T6's hash with no default) → T8 (the same builds). The shared `labels.json` has a start and end state for each step, dry runs and part B included, with no delete. The helper and the v0.1.1 exes are hashed before and after both builds. −7: T7 and T8 need the owner's commit and presence; the reboot splits T8. |
| Test/AC ownership and executable checks | 25% | 91 | Every UT, E2E and PERF ID has an owner. The M1 check now has a precondition (focus and value) and a control that must show a change; the form fits (AC-10) and the Dashboard count are scripted on the release build; the M3 control has a fixed test order. Negative controls: UT-40 (c)(g), UT-41 (d), UT-43 (a), UT-42 (e1), E2E-21 (one line at 1917), E2E-22 (rule off), E2E-23 (the 0.1.1 exe), E2E-27 (split cards), E2E-28 (no file, "Fan #1"), E2E-29 (b) first save, Dashboard (O) (the v0.1.1 match), E2E-15 (the file exists). −9: M1's control and `SetValue` are unrun; E2E-28/29 scripts are new. |
| Task boundaries, sizing and path grounding | 15% | 93 | Every path was read on 2026-10-23 (and re-checked by the tasks review): `MotherboardCard.tsx`, `CardParts.tsx:101-127`, `app.css:291-309, 501-519, 797-801`, `tauri.conf.json:5`, `src/theme/theme.ts`, `cdp.psm1:67-75`, `devtools-start.ps1:7`, `release-build.ps1:5-71`, `verifier-followups.ps1:15-17`, the clone (`0861d8f`, helper `553A7F49…`), `%LOCALAPPDATA%\dev.pophood` (no `labels.json`). −7: T7 is L (one sweep on one pair of builds, as v0.1.1's T5); the `target-v020*` folders are new. |
| **Total** | | **92** | 0.35·93 + 0.25·93 + 0.25·91 + 0.15·93 = 32.55 + 23.25 + 22.75 + 13.95 = **92.5** |
