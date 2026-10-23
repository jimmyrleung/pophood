# Task 6 - Owner session: full sensors, PERF-02 and the network audit

## Description

The owner half of Sequence step 4, on T5's two builds. These checks need the owner: a UAC prompt (full sensors) or an elevated capture (E2E-15). The agent prepares the scripts and `RUNBOOK.md` first. Then, in one session of about 45–60 minutes, the owner accepts three UAC prompts and runs one elevated command, while the agent's scripts do the checks. At the end, the owner signs off v0.1.1.

- Status: Done (2026-10-23). The owner session ran; every part passed or is recorded; the owner signed off v0.1.1 (answer quoted in `tasks.md`). Report: `sessions/20261023055425_pophood-v011-release/qa.md`
- Complexity: M
- Estimated time: 2–3h (about 1h of the owner's time)
- Depends on: T5 (the builds, `e2e27-layout.ps1`, the passed "A" parts)
- Can run in parallel with: —

## AI guidance

- `qa-execution`: this task completes the QA report that T5 started (`$S\qa.md`).
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: what E2E-15's capture checks, and how to read its summary.
- `AGENTS.md` "No network", the known exception (ADR 0024): a `login.live.com` lookup by `wlidsvc` is disclosed, not a failure, when the tree's WAM and OnlineId loads are on record. Any flow or DNS from the tree fails.
- `AGENTS.md` "Conventions", who runs what: the owner runs anything that needs a UAC prompt or an elevated capture, and pastes the output back. The agent prepares the exact commands and the pass criteria.
- ADR 0019: the agent drives the builds through UI Automation and CDP; the owner only clicks **Enable full sensors** and accepts UAC.

## Requirements

- E2E-15 runs on the **release** exe only, never on the devtools variant, with the working tree's `scripts/audit-network.ps1`.
- **The 30-min idle run** (`-Seconds 1800`) is added only if the WebView2 runtime, Tauri, wry or `BROWSER_ARGS` changed since the follow-ups capture. That capture ran on runtime `155.0.4283.62` (its browser command line, in `sessions/20261022132420_pophood-v010-followups/evidences/audit-network-180s-run2.txt`).
- PERF-02 is recorded and compared with the v0.1.0 record (CPU drill-down p95 8.6 ms, longest task 4.1 ms; Dashboard p95 3.7 ms). There is no pass/fail threshold, and none is invented. It runs when the history is full (10 min or more after Enable), as in the v0.1.0 record, so the chart draws a full 10-minute line.
- E2E-22 passes only when its negative control shows a focused row under the panel with the rule switched off.
- The owner's PawnIO link is never clicked during a capture.
- Every item passes, or is fixed (the fix rule in `tasks.md`), or carries the owner's waiver, quoted verbatim. Then the owner signs off v0.1.1.

## Files involved

| Path | Action |
|---|---|
| `$S` (T5's session folder) | Create: `t6-release.ps1`, `t6-devtools.ps1`, `RUNBOOK.md`; Modify: `qa.md`; Create: `evidences/` files |
| `$S\e2e27-layout.ps1` | Run (`-Mode full`; created in T5) |
| `sessions/20261021181500_pophood-v010-owner-e2e/perf-cdp.ps1` | Read (template: its `Trace` function and its PERF-02 block) |
| `sessions/20261021181500_pophood-v010-owner-e2e/t14.psm1` | Read and use (`Wait-PhElevated`, `Get-PhStatus`; not `Start-PhFresh` or `Assert-ReleaseHelper`, which have the v0.1.0 path hard-coded) |
| `scripts/audit-network.ps1` (working tree) | Run (owner, elevated) |
| `C:\Users\jimmy\pophood-e2e\v011-raw\` | Create (raw capture files, about 300 MB; outside the repo) |
| `specs/v0.1.1/README.md`, `specs/v0.1.1/techspec.md` (the "Next" line), `specs/v0.1.1/tasks.md` | Modify (sign-off) |

## Implementation steps

**Agent, before the owner joins:**

1. **Check for a change since the follow-ups capture:**
   - the WebView2 runtime folder under `C:\Program Files (x86)\Microsoft\EdgeWebView\Application\` (`155.0.4283.62`?);
   - `git -C C:\Users\jimmy\pophood-e2e\pophood-followups diff 1a51df2 -- src-tauri/Cargo.lock` (only the `pophood` entry, so no Tauri or wry change);
   - `git … diff 1a51df2 -- src-tauri/src/webview.rs` (empty).
   - Any change adds step C2 below.
2. **Write `t6-release.ps1`** (UI Automation on `C:\Users\jimmy\pophood-e2e\target-v011\release\pophood.exe`):
   - start the exe unelevated at a client size of 1024×800, open the CPU page with a card click (a fresh page: no row clicked) and print `READY`;
   - wait for the elevated frame (`Wait-PhElevated`), then check the E2E-12 (O) and E2E-21 (O) parts (pass criteria below) and print `DONE`.
3. **Write `t6-devtools.ps1`** (CDP on `C:\Users\jimmy\pophood-e2e\target-v011-devtools\release\pophood.exe`, started with `devtools-start.ps1 -Exe …`):
   - hash its `pophood-sensors.exe` and print `READY`; wait for the elevated frame;
   - at 1917×1029: E2E-22 (O) with its negative control, then `e2e27-layout.ps1 -Mode full`;
   - wait until 10 minutes after elevation, then the PERF-02 traces: the `Trace` function and the PERF-02 block of `perf-cdp.ps1` (30 s on the Dashboard, then 30 s in the CPU drill-down via "All sensors"), with the raw traces in `C:\Users\jimmy\pophood-e2e\v011-raw\`;
   - print `DONE`.
   - Give it a `-DryRun` switch, as in `perf-cdp.ps1`: no wait for elevation, and short traces.
4. Dry-run both scripts unelevated. Fix them until they reach `DONE`.
5. **Write `$S\RUNBOOK.md`:** the owner steps A–C below, with the paths filled in.

**Owner session (three UAC prompts and one elevated command; close every Pophood first):**

- **A. Release exe (about 10 min).** The agent runs `t6-release.ps1`. At `READY`, the owner clicks **Enable full sensors** in the drill-down's banner and accepts UAC. The owner doesn't touch the window again until `DONE`.
- **B. Devtools variant (about 15 min).** The agent runs `t6-devtools.ps1`. At `READY`, the owner clicks **Enable full sensors** and accepts UAC. Until `DONE`, the owner keeps the Pophood window visible (not covered, not minimized) and the PC idle: WebView2 stops painting a covered window, and the traces would then mean nothing.
- **C. Network audit, release exe (about 4 min),** from an **elevated** pwsh 7:

  ```powershell
  $S = '<T5 session folder: C:\Users\jimmy\projects\pophood\sessions\<yyyyMMddHHmmss>_pophood-v011-release>'
  $Rel = 'C:\Users\jimmy\pophood-e2e\target-v011\release\pophood.exe'
  pwsh -NoProfile -File C:\Users\jimmy\projects\pophood\scripts\audit-network.ps1 -ExePath $Rel -OutDir C:\Users\jimmy\pophood-e2e\v011-raw\audit-network-180s *>&1 |
    Tee-Object "$S\evidences\audit-network-180s.txt"
  ```

  Follow the `CUE` lines it prints:
  - at 60 s, click **Enable full sensors** and accept UAC;
  - at 90 s, open a drill-down (click a card), then switch the theme;
  - at 120 s, leave the app idle.

  Don't click the PawnIO link. The script closes the app at 180 s.
- **C2. Only if step 1 found a change:** the same command with `-Seconds 1800`, `-OutDir C:\Users\jimmy\pophood-e2e\v011-raw\audit-network-1800s` and `audit-network-1800s.txt`. After the cues, leave the PC idle.

**Agent, after:**

6. Copy the captures' `summary.txt` and CSVs into `$S\evidences\audit-network-180s\` (the raw files stay in `v011-raw`). Complete `$S\qa.md`, with one line per T6 part and its build.
7. Report PERF-02 next to the v0.1.0 record, and tell the owner the change.
8. Ask the owner to sign off v0.1.1, and quote the answer verbatim. Then update `specs/v0.1.1/README.md` (Status), the techspec's "Next" line, this file and `tasks.md`.

## Acceptance Criteria

**A. Release exe** (`t6-release.ps1` log and screenshots):
- **E2E-12 (O):**
  - the locks go away without leaving the page;
  - with no click, the panel moves to "Core (Tctl/Tdie)";
  - after a click on a Clock row, that row stays selected;
  - the Motherboard page shows "Controls · 6" as rows of "—".
- **E2E-21 (O),** in both themes:
  - at 1917×1029, the CPU page has 5 columns and is about 1.2 screens long, and the panel sticks while it scrolls;
  - at 1280×860, the CPU page has 3 columns, and the panel sticks;
  - the 3 split cards keep their border and have no title in their next column.

**B. Devtools variant** (`t6-devtools.ps1` log):
- **E2E-22 (O),** at 1917×1029:
  - with the rule on, each row that Shift+Tab focuses is fully below the panel;
  - **negative control:** with `document.documentElement.style.scrollPaddingTop = "0px"`, the same steps leave at least one focused row under the panel. The inline style is removed afterwards.
- **E2E-27 (O):**
  - the sampler first reports exactly 3 split cards;
  - over the 60 s run, with the 20 s load, no card changes columns and no card's fragment count changes.
- **PERF-02:** the CPU drill-down's p95 busy time per frame and its longest task, and the Dashboard's p95, are recorded next to the v0.1.0 values. The devtools helper hash is `553A7F49…`.

**C. Network audit** (the owner's pasted output, or `audit-network-180s.txt`):
- the result line is `OVERALL: PASS`, with:
  - ETW read;
  - browser command line PASS;
  - **APP CLOSED BY THE SCRIPT: PASS**;
  - no non-loopback flow from the tree;
  - no watch-list DNS other than ADR 0024's disclosed `wlidsvc` lookup.
- The summary's "Windows-account DLLs" section shows WAM in the browser near t 0.5 s and OnlineId in the crashpad handler near t 30 s.
- If `login.live.com` appears, its row names `svchost.exe` with `wlidsvc` (or Dnscache) and `Disclosed=True`.
- The browser command line in the summary has `--webview-exe-version=0.1.1`, so the capture ran on the v0.1.1 exe.
- **C2 (only if run):** the same criteria.

**Close:**
- `qa.md` records every T5 and T6 item as passed, fixed and re-run, or waived (the owner's words, verbatim).
- The owner's sign-off answer is quoted in `tasks.md`.

## Testing

The owner-assisted ("O") items of techspec § [E2E Tests](techspec.md#e2e-tests) and § Perf:

- **release:** E2E-12 (O), E2E-21 (O: 1917×1029 and 1280×860, both themes), E2E-15 (and C2 if step 1 calls for it);
- **devtools:** E2E-22 (O, with its negative control), E2E-27 (O), PERF-02.
- The reduced "A" parts passed in T5.

## Additional relevant files

- `sessions/20261022132420_pophood-v010-followups/RUNBOOK.md` (the last owner runbook on this clone: the format and the E2E-15 pass criteria)
- `sessions/20261021181500_pophood-v010-owner-e2e/qa.md` (the PERF-02 v0.1.0 record)
- `sessions/20261022093210_pophood-v010-t14-oq13-close/decisions/0024-oq13-disclosed-exception.md` (ADR 0024, the disclosed exception)
- `specs/v0.1.1/techspec.md` § Integration points, § E2E Tests, § Perf (manual)

## Task notes (2026-10-23)

Session folder `$S` = `sessions/20261023055425_pophood-v011-release/`; report `$S/qa.md`.

- **Step 1:** no change since the follow-ups capture (runtime 155.0.4283.62, `Cargo.lock` only the `pophood` version, `webview.rs` unchanged, no Tauri line in `package-lock.json`), so C2 was not run.
- **A, B:** `t6-release.ps1` and `t6-devtools.ps1` passed every check; the E2E-22 negative control put 13 rows under the panel. PERF-02: CPU drill-down p95 5.53 ms and longest task 3.06 ms (v0.1.0: 8.6 and 4.1); Dashboard p95 4.53 ms (v0.1.0: 3.7; not investigated).
- **C:** run 1 of `audit-network.ps1` reported `OVERALL: FAIL` on `substrate.office.com` from a user `msedge.exe` that started about 10 s after the app closed (not in the app tree). The owner chose a re-run; run 2 passed. Run 1 stays in `$S\evidences\audit-network-180s-run1-edge-false-alarm\`.
- **Deviation:** part B's window was maximized (1920×1009 viewport instead of 1917×1029). Accepted by the owner's sign-off.
- **Lessons for the harness:**
  - `Wait-PhElevated` (`t14.psm1`) needs the Dashboard's "Total load" text, so on a drill-down wait on "Elevated · read-only".
  - Un-maximize before `Set-PhSize`: a maximized window ignores it (check `Get-PhSize`).
  - `audit-network.ps1` counts any non-disclosed watch-list DNS in the capture, even from a process outside the tree: don't open Edge until it prints `OVERALL` (30 s linger). A possible follow-up: print the requester's tree membership next to the verdict.
