# Task 8 - Owner session: full sensors, the reboot, PERF-02 and the network audit

## Description

The owner half of Sequence step 8, on T7's two builds. These checks need the owner: a UAC prompt (full sensors), a reboot (E2E-28) or an elevated capture (E2E-15). The agent first writes the scripts and `RUNBOOK.md`. Then, in one session of about 1h15, the owner accepts about five UAC prompts, runs one elevated command and reboots once, while the agent's scripts do the checks. At the end, the owner signs off v0.2.0.

- Status: Not started
- Complexity: M
- Estimated time: 3h (about 1h15 of the owner's time)
- Depends on: T7 (the builds, the changed scripts, the passed "A" parts, no label file left)
- Can run in parallel with: —

## AI guidance

- `qa-execution`: this task completes T7's report (`$S\qa.md`).
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: E2E-15's capture and summary.
- `AGENTS.md` "No network", the known exception (ADR 0024): a `login.live.com` lookup by `wlidsvc` is disclosed, not a failure, when the tree's WAM and OnlineId loads are on record.
- `AGENTS.md` "Conventions", who runs what: the owner runs UAC, the reboot and the elevated capture, and pastes the output back; the agent prepares the exact commands and the pass criteria.
- `specs/v0.1.1/task_06.md` § Task notes, the harness lessons: on a drill-down, wait on "Elevated · read-only" (not the Dashboard's "Total load"); un-maximize before `Set-PhSize`; don't open Edge until `audit-network.ps1` prints `OVERALL`.
- Global rules, risky commands: **no delete command**; label files are moved aside (`tasks.md` § [Label file state](tasks.md#label-file-state)). `devtools-start.ps1:7` clears one env var with `Remove-Item Env:\…` and deletes no file; the owner gave a one-time OK for every v0.2.0 run on 2026-10-23: "OK for v0.2.0 (Recommended)".

## Requirements

- E2E-15 runs on the **release** exe only, with the working tree's `scripts/audit-network.ps1`.
- **The 30-min idle run** (`-Seconds 1800`) is added only if the WebView2 runtime, Tauri, wry or `BROWSER_ARGS` changed since the v0.1.1 capture (runtime `155.0.4283.62`; `sessions/20261023055425_pophood-v011-release/evidences/`).
- PERF-02 is recorded next to the v0.1.1 record (CPU drill-down p95 5.53 ms, longest task 3.06 ms; Dashboard p95 4.53 ms). No pass threshold; a rise is explained in `qa.md`. It runs 10 min or more after Enable (a full 10-minute history).
- E2E-22 passes only when its negative control shows a focused row under the panel with the rule switched off.
- **M1 at 1917×1029:** the M1 rule in `tasks.md` § [Review findings](tasks.md#review-findings-disposition) (precondition, pass, and the control as T7 ran it: the `blur()` / `focus()` control recorded, then the pre-fix padding set inline must make the same typing move the page; `$S\e2e22-cdp.ps1` has the code). If the pass fails, stop and ask the owner.
- **Text entry on the release exe:** UIA `ValuePattern.SetValue`, then `InvokePattern` on **Save name** (UIA has no paste and no Enter; `Send-PhKeys` is ruled out by ADR 0019; T7's E2E-29 proved `SetValue` reaches React). `SetValue` doesn't apply `maxLength`, so the 45-character cut is T7's (E2E-22 A).
- E2E-28 uses a **one-word** 40-character label on Fan #1, so the Dashboard screenshot can show an overflow (review L1).
- **Owner session order: B → A → C → D.** B (devtools) saves nothing, so E2E-22 and E2E-27 run with no `labels.json` (techspec: "Run E2E-12, 21, 22 and 27 with no `labels.json`").
- The label file follows `tasks.md` § Label file state: none at the start (E2E-28's negative control); "CPU fan" during E2E-15; every label reset at the end; files moved aside, never deleted.
- The owner's PawnIO link is never clicked during a capture.
- Every item passes, is fixed (the fix rule in `tasks.md`), or carries the owner's waiver, quoted verbatim. Then the owner signs off v0.2.0.

## Files involved

| Path | Action |
|---|---|
| `$S` (T7's session folder) | Create: `t8-release.ps1`, `t8-devtools.ps1`, `e2e28.ps1`, `RUNBOOK.md`; Modify: `qa.md`; Create: `evidences/` files |
| `$S\e2e27-layout.ps1` | Run (`-Mode full`) |
| `sessions/20261023055425_pophood-v011-release/t6-release.ps1`, `t6-devtools.ps1`, `RUNBOOK.md` | Read (templates; the changes in `tasks.md` § Harness changes) |
| `sessions/20261021181500_pophood-v010-owner-e2e/t14.psm1` | Read and use (`Wait-PhElevated`, `Get-PhStatus`; not `Start-PhFresh` or `Assert-ReleaseHelper`) |
| `scripts/audit-network.ps1` (working tree) | Run (owner, elevated) |
| `C:\Users\jimmy\pophood-e2e\v020-raw\` | Create (raw traces and captures, outside the repo) |
| `%LOCALAPPDATA%\dev.pophood\labels.json` | Written by the app; moved aside at the end |
| `specs/v0.2.0/README.md`, `specs/v0.2.0/techspec.md` (the "Next" line), `specs/v0.2.0/tasks.md` | Modify (sign-off) |

## Implementation steps

**Agent, before the owner joins:**

1. **Check for a change since the v0.1.1 capture:** the WebView2 runtime folder under `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\` (`155.0.4283.62`?); `git -C <clone> diff 0861d8f -- src-tauri/Cargo.lock` (only the `pophood` entry); `git … diff 0861d8f -- src-tauri/src/webview.rs` (empty). Any change adds step C2.
2. **Write `t8-release.ps1`** from `t6-release.ps1` (`tasks.md` § Harness changes): start the release exe unelevated at 1024×800 client, open the CPU page with a card click, print `READY`; wait for the elevated frame; check E2E-12 (O) (the Motherboard page through `Name your fans` only), E2E-21 (O) and the new Dashboard (O) section; print `DONE`.
3. **Write `e2e28.ps1`** with two parts:
   - `-Part main` (after `t8-release.ps1`, on the same elevated run): the negative control, the first save, the file, the restart and the second Enable (criteria below).
   - `-Part reboot` (after the reboot): the label after the reboot, a label on a sensor in both modes, the 40-character label, then a Reset of every label.
   - Text goes in with UIA `SetValue` and is saved with **Save name** (Requirements). The 40-character label is one word (for example `Abcdefghij` repeated four times).
4. **Write `t8-devtools.ps1`** from `t6-devtools.ps1` (`tasks.md` § Harness changes: `'520px'`, the paths, `v020-raw`, restore the window before `Set-PhSize`, the 1917×1029 viewport check, PERF-02 next to v0.1.1): hash its `pophood-sensors.exe`, print `READY`, wait for the elevated frame; at 1917×1029 E2E-22 (O) with its negative control and the M1 rule; then `e2e27-layout.ps1 -Mode full`; 10 min after elevation, the PERF-02 traces; print `DONE`. Keep its `-DryRun` switch.
5. Dry-run the three scripts unelevated. Fix them until they reach `DONE` (the elevated parts are skipped in a dry run). Then move any `labels.json` the dry runs left to `$S\evidences\label-files\t8-dry-run\`, and check that `%LOCALAPPDATA%\dev.pophood` holds no label file.
6. **Write `$S\RUNBOOK.md`:** the owner steps B, A, C, D below (in that order), with the paths filled in, and the line to resume after the reboot (a new agent session reads `RUNBOOK.md` and runs `e2e28.ps1 -Part reboot`).

**Owner session, in the order B → A → C → D (close every Pophood first):**

- **B. Devtools variant (about 20 min, 1 UAC).** The agent runs `t8-devtools.ps1`. At `READY`, the owner clicks **Enable** and accepts UAC; until `DONE`, the window stays visible (not covered, not maximized) and the PC idle. After `DONE`, the agent checks that no `labels.json` exists.
- **A. Release exe (about 20 min, 2 UAC).** The agent runs `t8-release.ps1`. At `READY`, the owner clicks **Enable full sensors** and accepts UAC, then doesn't touch the window until `DONE`. The agent runs `e2e28.ps1 -Part main`; when it asks, the owner clicks **Enable full sensors** again after the restart.
- **C. Network audit, release exe (about 4 min, 1 UAC),** from an **elevated** pwsh 7. **Close both builds first.** Then the agent records `Get-FileHash` of `%LOCALAPPDATA%\dev.pophood\labels.json` (it must exist and hold "CPU fan"):

  ```powershell
  $S = '<T7 session folder: C:\Users\jimmy\projects\pophood\sessions\<yyyyMMddHHmmss>_pophood-v020-release>'
  $Rel = 'C:\Users\jimmy\pophood-e2e\target-v020\release\pophood.exe'
  pwsh -NoProfile -File C:\Users\jimmy\projects\pophood\scripts\audit-network.ps1 -ExePath $Rel -OutDir C:\Users\jimmy\pophood-e2e\v020-raw\audit-network-180s *>&1 |
    Tee-Object "$S\evidences\audit-network-180s.txt"
  ```

  Follow the `CUE` lines (60 s: Enable and UAC; 90 s: open a drill-down, switch the theme; 120 s: idle). Don't click the PawnIO link. After `OVERALL`, the agent records the hash again.
- **C2. Only if step 1 found a change:** the same command with `-Seconds 1800`, `-OutDir …\audit-network-1800s` and `audit-network-1800s.txt`.
- **D. Reboot (about 15 min, 1 UAC).** The owner reboots, then starts an agent session from `RUNBOOK.md`. The agent runs `e2e28.ps1 -Part reboot`; when it asks, the owner clicks **Enable** and accepts UAC.

**Agent, after:**

7. Copy the capture's `summary.txt` and CSVs into `$S\evidences\audit-network-180s\`. Move `labels.json` to `$S\evidences\label-files\e2e28\`; move back any file T4 or T7 found at its start (none on 2026-10-23). Complete `$S\qa.md`, one line per T8 part with its build.
8. Report PERF-02 next to the v0.1.1 record.
9. Ask the owner to sign off v0.2.0 and quote the answer verbatim. Then update `specs/v0.2.0/README.md` (Status), the techspec's "Next" line, this file and `tasks.md`.

## Acceptance Criteria

**A. Release exe** (`t8-release.ps1` and `e2e28.ps1 -Part main` logs and screenshots):
- **E2E-12 (O):** the locks go away without leaving the page; with no click the panel moves to "Core (Tctl/Tdie)"; a clicked Clock row stays selected; the Motherboard page, opened by invoking the button named **"Name your fans"** (FAIL if absent), shows "Controls · 6" as rows of "—".
- **E2E-21 (O),** both themes: at 1917×1029 the CPU page has 5 columns, is about 1.3 screens long (accepted 1.1–1.4) and the panel sticks; at 1280×860 3 columns and the panel sticks; the 3 split cards keep their border with no title in their next column.
- **Dashboard (O),** at 1280×860: the card buttons named `All sensors` or `Name your fans` number exactly one more than `All sensors` alone (negative control: the v0.1.1 match misses the Motherboard card), and the Dashboard has 3 columns.
- **E2E-28, main:**
  - **negative control first:** `labels.json` doesn't exist, and the Dashboard fan row reads "Fan #1";
  - "Name your fans" opens the Motherboard page; the subline ends "· generic names until you rename them";
  - Fan #1 (in the Fans card), set "CPU fan" (`SetValue`), invoke **Save name** → the row reads "CPU fan · Fan #1", the heading "CPU fan" (Enter is E2E-22 A);
  - `labels.json` parses to `{"version": 1, "labels": {"/lpc/it8696e/0/fan/0|Fan #1": "CPU fan"}}` (key and value compared exactly);
  - back on the Dashboard, the fan row reads "CPU fan";
  - restart (reduced): the Motherboard card is a placeholder and the file still holds the label; after Enable, the fan row reads "CPU fan".

**B. Devtools variant** (`t8-devtools.ps1` log):
- **E2E-22 (O),** at a checked 1917×1029 viewport (`innerWidth × innerHeight`): the computed `scroll-padding-top` is `520px`; each row Shift+Tab focuses is fully below the panel; **negative control:** with `scrollPaddingTop = "0px"`, at least one focused row ends under the panel, and the inline style is removed afterwards (computed `520px` again); **M1:** the precondition holds (the input is focused and holds the 10 letters), `scrollY` and the panel top are unchanged; the `blur()` / `focus()` control is recorded, and with the pre-fix padding (`scrollPaddingTop = "520px"` inline, computed `520px` with the form focused) the same typing changes `scrollY`.
- After part B, `%LOCALAPPDATA%\dev.pophood` holds no `labels.json` (`Test-Path`).
- **E2E-27 (O):** the sampler first reports exactly 3 split cards; over 60 s with the 20 s load, no card changes columns or fragment count.
- **PERF-02:** the CPU drill-down p95 and longest task, and the Dashboard p95, next to the v0.1.1 values. The devtools helper hash is `553A7F49…`.

**C. Network audit** (`audit-network-180s.txt`):
- `OVERALL: PASS`, with ETW read, browser command line PASS, **APP CLOSED BY THE SCRIPT: PASS**, no non-loopback flow from the tree, and no watch-list DNS other than ADR 0024's disclosed `wlidsvc` lookup.
- "Windows-account DLLs": WAM in the browser near t 0.5 s and OnlineId in the crashpad handler near t 30 s.
- The browser command line has `--webview-exe-version=0.2.0`.
- **`labels.json`:** it exists before the capture, and `Get-FileHash` before = after.
- C2 (only if run): the same criteria.

**D. After the reboot** (`e2e28.ps1 -Part reboot` log and screenshots):
- after the reboot, in reduced mode: `labels.json` still holds "CPU fan";
- **a sensor in both modes:** still in reduced mode, label "CPU Total" as "All cores" on the CPU page; then Enable (the one UAC of part D) → the fan row still reads "CPU fan", and the CPU row reads "All cores · CPU Total";
- **the 40-character label:** set a 40-character one-word label on a CPU row and save → the row wraps without clipping and the file holds those 40 characters (the 45 → 40 cut is T7's E2E-22 A); the same label on Fan #1 → the Dashboard fan row shows it inside its card (the `.fan__name` rectangle is inside the card's rectangle) with no horizontal scroll (screenshot);
- Reset the 40-character labels (full sensors); restart (reduced) → the CPU row still reads "All cores · CPU Total";
- **Reset** of the last label → the default names everywhere; the file's `labels` is `{}`.

**Close:**
- `%LOCALAPPDATA%\dev.pophood` holds no label file; the moved files are under `$S\evidences\label-files\`.
- `qa.md` records every T7 and T8 item as passed, fixed and re-run, or waived (the owner's words).
- The owner's sign-off answer is quoted in `tasks.md`.

## Testing

The owner-assisted ("O") items of techspec § [E2E Tests](techspec.md#e2e-tests) and § Perf:

- **release:** E2E-12 (O), E2E-21 (O: 1917×1029 and 1280×860, both themes), E2E-28 (all parts), E2E-15 (and C2 if step 1 calls for it);
- **devtools:** E2E-22 (O, with its negative control and M1), E2E-27 (O), PERF-02.
- The reduced "A" parts passed in T7.

## Additional relevant files

- `sessions/20261023055425_pophood-v011-release/RUNBOOK.md` and `qa.md` (the last owner runbook and report)
- `sessions/20261022093210_pophood-v010-t14-oq13-close/decisions/0024-oq13-disclosed-exception.md` (ADR 0024)
- `specs/v0.2.0/techspec.md` § Integration points, § E2E Tests, § Perf (manual)
- `specs/v0.2.0/tasks.md` § Label file state, § Harness changes
