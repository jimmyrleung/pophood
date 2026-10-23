# Task 14 - Owner-run E2E, perf baselines, OQ13 sign-off

## Description

With the owner at the keyboard, run the checks that need UAC, an elevated capture, Task Manager or a PawnIO uninstall, on T13's release build; record the perf baselines; and run the network sign-off (E2E-15) with the OQ13 fallback ladder. v0.1.0 is signed off when every item passes, or the owner takes the OQ13 decision (#33).

- Status: **Completed 2026-10-22.** Every O item passes. E2E-15 passes with a disclosed exception: WebView2's Windows-account lookups can make `wlidsvc` contact `login.live.com` (OQ13 rung 3; owner: "Disclosed exception (Recommended)"). **v0.1.0 is not signed off: BUG-T14-01 → [T15](task_15.md)** (owner: "New fix task T15 (Recommended)").
- Complexity: **L** — kept whole because it is one owner session on one release build; about 15 owner-run items plus the perf traces. The OQ13 ladder can add up to 6 rebuild-and-capture rounds, and the PawnIO uninstall and reinstall may need a reboot.
- Estimated time: 4–6h, plus up to 6 OQ13 ladder rounds (a rebuild and a 180 s capture each) and one 30-min idle capture
- Depends on: T13
- Can run in parallel with: —

## AI guidance

- `qa-execution`: the owner half of QA for v0.1.0; the agent prepares each step (pre-armed scripts, commands to paste with `!`), the owner performs the UAC/elevated actions, the agent records the evidence.
- Session skill draft `sessions/20261021102214_pophood-v010-techspec/skills/webview2-network-audit.md`: E2E-15.
- Session skill draft `sessions/20261020214713_pophood-define-reqs-confidence/skills/lhm-write-path-audit.md`: E2E-16 interpretation.
- Owner memory: the 90% bar — report the outcome of each "lowering event" in the techspec § Confidence score against its stated point cost.
- `AGENTS.md` applies to any fix.

## Requirements

- Every "O" item below passes on the release build, with evidence.
- The first runs named in techspec § Confidence score ("Next checks") are reported explicitly: `ShellExecuteExW` under the file lock (first run in T6; signed off here by E2E-02), the GPU DLLs under the System32-only search (first run in T4; signed off here by E2E-02), and OQ13 (E2E-15). Each failure is told to the owner before its written fallback is applied.
- PawnIO is reinstalled after E2E-14.
- The OQ13 ladder is followed rung by rung, rebuilding and re-capturing after each; rung 3 stops and goes back to the owner.
- The regression rule in `tasks.md`: a fallback or fix under `helper/` or `src-tauri/src/sensors/` re-runs the build, the test suites, E2E-19, E2E-24's `dumpbin /imports` check and T4's elevated smoke, then every O item that exercises the changed code. An OQ13 ladder change to `BROWSER_ARGS` re-runs E2E-15 and `audit-network.ps1 -Quick`.

## Files involved

| Path | Action |
|---|---|
| `src-tauri/src/webview.rs` | Modify (created in T2) only for the OQ13 ladder (adding features to `BROWSER_ARGS`, one at a time) |
| `src-tauri/src/sensors/helper.rs` | Modify (created in T5) only if the `ShellExecuteExW`-under-lock fallback is needed (owner-approved) |
| `helper/Program.cs` | Modify (created in T1, rewritten in T3 and T4) only if the vendor-DLL preload fallback is needed (owner-approved) |
| `scripts/audit-network.ps1` | Run (created in T11) |
| `specs/v0.1.0/requirements.md` | Modify: tick the slice 1 done-when boxes that passed (owner confirms) |

## Implementation steps

1. Prepare the pre-armed helpers the techspec names: the exclusive-open/rename loop and screen recording (E2E-02), the elevated suspend loop (E2E-04), the timed `Stop-Process` (E2E-10, E2E-25), Process Monitor filter (E2E-16). Build the `devtools`-feature variant of the release build for PERF-01 and PERF-02 (the same build E2E-20 used in T13).
2. Run the items in Testing with the owner, in this order: E2E-26 → E2E-02 → E2E-18 (elevated part) → E2E-03 → E2E-04 → E2E-25 (runs A and B) → E2E-08 → E2E-09 (O) → E2E-10 (O) → E2E-17 (O part) → E2E-16 → PERF-01…PERF-05 → E2E-14 (PawnIO uninstalled; reinstall after) → E2E-15 (180 s scripted run, then the 30-min idle run).
3. If E2E-15 shows `substrate.office.com`, `odc.officeapps.live.com` or `hrd.svc.cloud.microsoft`: walk the OQ13 ladder (techspec § Sequence → OQ13 ladder).
4. Record PERF baselines in a table in the session evidence report. Per techspec § Perf baselines these are records for v0.3.0 to compare against; a value outside a row's stated threshold is flagged to the owner, who decides whether it blocks sign-off.
5. With the owner, tick the slice 1 done-when boxes in `requirements.md` that the evidence supports.

## Acceptance Criteria

- Each "O" item in Testing is recorded pass with its evidence (recording timestamp, Task Manager screenshot, `Get-Process` output, Process Monitor export, pktmon summary) in the evidence report.
- E2E-02 evidence shows the UAC prompt in the foreground, "Connecting to sensors…" ≤ ~3 s on the recording, 258 sensors on this PC, both GPUs with sensors while elevated, sharing violations logged up to the elevated launch, and Elevated = No for `pophood.exe` and `msedgewebview2.exe`.
- E2E-15: `audit-network.ps1` output shows no non-loopback flow from the process tree and no system-wide DNS for the four hosts during the window, for both the 180 s run and the 30-min idle run — or the OQ13 ladder reached rung 3 and the owner's decision is recorded verbatim.
- PERF-01…PERF-05 values are recorded (devtools trace, React Profiler, heap snapshots, the elevated IT-03/IT-04 run, `Get-Counter` output), each next to its stated threshold where the techspec gives one (PERF-01 p95 < 16 ms and no task > 50 ms; PERF-03 heap flat ±10 %; PERF-04 no skipped ticks at 1000 ms); any value outside it carries the owner's decision verbatim.
- PawnIO is reinstalled (`Get-ItemProperty` of its Uninstall key, or the trust panel showing "PawnIO 2.2.0").
- The owner confirms the done-when ticks in `requirements.md`.

## Testing

Owner-run ("O") items from techspec § E2E Tests and § Perf baselines, on T13's release build:

- **E2E-02** Enable full sensors, AOT smoke, privilege checks, DLL search, file lock.
- **E2E-03** UAC cancelled. **E2E-04** elevated helper never connects (terminated through the `ShellExecuteExW` handle). **E2E-08** elevated helper dies → `full_sensors_lost`.
- **E2E-09 (O)** normal close elevated and during "Connecting…" while two helpers run (that close moved here from T13 by the owner: "Move both to T14"). **E2E-10 (O)** app killed elevated, and during the UAC prompt.
- **E2E-21 (elevated part, moved from T13)** at 1024×680, open the Motherboard drill-down: list and detail side by side, nothing clipped. The card is a placeholder until elevated, so T13 couldn't open it.
- **E2E-14** PawnIO missing (unprivileged and elevated). **E2E-15** network sign-off and the OQ13 ladder. **E2E-16** elevated helper writes and installs nothing.
- **E2E-17 (O part)** Enable full sensors with a swapped helper → no UAC prompt, hash-mismatch panel.
- **E2E-18 (elevated part)** reload keeps the elevated session with no new prompt.
- **E2E-25** unprivileged helper dies during the UAC prompt (runs A and B). **E2E-26** refuses to run elevated.
- **PERF-01…PERF-05** baselines (PERF-01 and PERF-02 on the `devtools` variant).

## Additional relevant files

- `specs/v0.1.0/techspec.md` § E2E Tests, § Perf baselines, § Confidence score (lowering events and fallbacks), § Sequence (OQ13 ladder), § Known risks
- `specs/v0.1.0/requirements.md` § Slice requirement (done-when lists)
- `specs/v0.1.0/tasks.md` (regression rule)
- `C:\Users\jimmy\pophood-probes\probe-net\pktmon-capture-unelev.ps1` and the P5 runs

## Task notes (2026-10-21, owner session 18:30–22:45)

**Result:** every O item passes on T13's release build (`73fdb0f`, `pophood.exe` `A054A894…`, helper `11a0ed2b…`; both hashes re-checked at the end, unchanged). The report, with each number and file, is in [`sessions/20261021181500_pophood-v010-owner-e2e/qa.md`](../../sessions/20261021181500_pophood-v010-owner-e2e/qa.md), and the owner's answers are verbatim in `owner-decisions.md` next to it.

**Techspec "Next checks" and lowering events, each against its stated cost:**

| Check | Outcome | Cost applied |
|---|---|---|
| `ShellExecuteExW` under the file lock (−2 on patterns if it fails) | Works. The lock loop logged sharing violations exactly while the prompt was up, and the elevated launch succeeded (E2E-02, two runs). | none; fallback not needed |
| The GPU DLLs under `SetDefaultDllDirectories(System32)` (−2) | Both GPUs live while elevated (RTX, Radeon) | none; fallback not needed |
| E2E-15 still showing `substrate.office.com` after the ladder (−3 on cross-system) | `substrate.office.com` never appeared: `msOneAuthWAM` holds on runtime 155.0.4283.62. **But the analogous event happened (2026-10-22):** `login.live.com`, from `wlidsvc` after WebView2's own WAM / OnlineId calls, survived the whole ladder and the extended search, and went back to the owner (#33): "Disclosed exception (Recommended)". | **−3 applied** on the techspec's cross-system factor (85 → 82; total 90.15 → 89.85), noted in the techspec's Confidence score. The written fallback, the owner's decision, is in, so it no longer blocks anything. |
| Environment creation in `setup()` (−2) | Settled in T2 | — |

**Decisions and deviations:**
- **E2E-02 timing.** ffmpeg's `gdigrab` stalls on the UAC secure desktop, so the recording stops at the prompt. "Connecting…" was timed with a ~30–80 ms UI Automation poll instead: 2.68 s. Run 1's slow poll (~250 ms per sample) read 3.30 s.
- **PERF-02** uses a trace proxy (owner: "Trace proxy (Recommended)"). The devtools variant ships React's production build, which records no Profiler timings.
- **PERF-03** also recorded per-process private bytes (owner: "Yes, add it (Recommended)").
- **E2E-16.** AMD's ADL library writes 2 REG_DWORDs under `HKCU\Software\ATI\ACE\Settings\ADL\MaxCofuncPaths` when the elevated helper starts. Owner: "Accept and document (Recommended)". The documentation lines in `helper/WRITE-ALLOWLIST.md` and `AGENTS.md` are an approved follow-up, not done here.
- **`scripts/audit-network.ps1` (Run → Modify; owner: "Fix it now (Recommended)").** Kernel-Network addresses and ports are now decoded before the loopback test. Without it, 127.0.0.1:80 and [::1]:80 read as non-loopback. `-Quick` re-passed. This touches no product code and no `BROWSER_ARGS`, so the regression rule doesn't apply.
- **E2E-15 run 2.** The system-wide watch-list DNS came from `Windows365.exe` (and its own WebView2) and `msedge.exe`, attributed by PID; none came from Pophood's tree.
- **Done-when ticks** (owner: "Tick all 25 (Recommended)"). L224, L226 and L227 rest on automated tests only (UT-17; IT-09 + UT-29; UT-07 + UT-29), with a note on each box.
- **E2E-10, killed during the prompt.** Accepting the prompt after Pophood is gone launches no helper at all, so there's no orphan to time.

**BUG-T14-01 (High, found in verification):**
- **Who and how:** the independent verifier spotted the elevated helper probing its own folder for `DPAPI.DLL`, `setupapi.dll`, `cfgmgr32.dll`, `user32.dll` and `ntdll.dll` in the E2E-16 capture. `dll-plant-check.ps1` confirmed it: genuine System32 copies planted next to an unelevated helper copy are loaded from that folder (`user32` crashes it).
- **Impact:** a planted DLL would run elevated, and the exe hash check doesn't cover it.
- **Disposition:** owner: "New fix task T15 (Recommended)". No code change in T14.

**Verifier corrections applied to `qa.md`:**
- the AC-5 and hash evidence file (`ac5-pawnio-and-hashes.txt`);
- the E2E-15 attribution wording (PID 36448 is confirmed as Windows365's WebView2; PID 32408 is unnamed; the 1 s tree poll);
- E2E-10 round 4 marked as a deviation (the 30 s rule rests on IT-10);
- E2E-16's device and Perflib wording;
- E2E-02's pass rests on run 2.

**E2E-15 gap (found at close-out):** the audit's tracked process tree shows only the unprivileged helper in both captures (run 1: PID 40000; run 2: PID 372). So the scripted flow's "Enable full sensors → accept UAC" didn't happen inside either window. Run 2 still serves as the idle run. Run 2's app was also never closed: `CloseMainWindow()` missed it (T13's follow-up), and the app was found still running at 22:57. Requirements L230 is unticked until the re-run passes.

## Task notes (2026-10-22, resumed session 06:40–08:00)

**Result:** E2E-15 is done. The owner's answers are #9–#11 in `owner-decisions.md`, and the report rows are E2E-15 and AC-3 in `qa.md`.

**Run 3** (the scripted 180 s capture, `73fdb0f` build, both hashes re-checked first):
- The elevated helper ran inside the window: 39284 from t 79.4 s. The new unelevated side watcher (`e2e15-run3-watch.ps1`) records each helper's elevation, which `processes.csv` can't.
- The app closed by itself at 180.5 s.
- Pophood's tree: 0 flows, 0 DNS.
- **System-wide: `login.live.com` from `wlidsvc`**, 1.67 s after the UAC prompt closed. Run 3 had no Process Monitor, so it's attributed to Pophood's WebView2 by analogy with rung 2a. E2E-16's capture is consistent but ambiguous: Pophood's browser process called WAM 0.60 s before `wlidsvc` started, and so did `taskhostw`, which loaded the Microsoft Account WAM extension 35 ms before the start.

**OQ13 ladder** (owner #9: "Rung 2 one at a time (Recommended)"):
- **Rung 2a:** an elevated round with Process Monitor, and the direct attribution:
  - the browser process called WAM at t 0.3 s;
  - the crashpad handler called `OnlineIdSystemAuthenticator` at t 30.2 s;
  - `services.exe` started `wlidsvc` 41 ms later, and `wlidsvc` read the negative cache for the same application id the handler had queried;
  - `login.live.com` followed, and no other client was active.
- **Rungs 2b–2e:** pre-screened unelevated instead of four more UAC rounds. The rung build is watched for the WAM and OnlineId DLL loads, which the 2a build reproduced exactly as a positive control. Every rung still loads both.
- **Extended search** (owner #10: "Extend the search (Recommended)"), through `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, so no rebuild:
  - 25 more `msedge.dll` identity features, `msWebView2EnableFamilySafety` (`EmbeddedBrowserWebView.dll`), `--enable-features=msDiagnosticDataForceOff` and `--disable-breakpad`;
  - all still not clean, and it also happens on a normal launch (existing profile).
- **Rung 3 → owner #11:** "Disclosed exception (Recommended)". `BROWSER_ARGS` reverted to rung 1, so `webview.rs` equals `73fdb0f` and run 3's build is the build of record.
- The regression rule for a `BROWSER_ARGS` change was run for every trial build: `cargo test --lib webview` (5/5 at 2a and after the revert), `-Quick` on the 2a build, and the browser command line checked in every pre-screen.

**Decisions and deviations:**
- **Pre-screening rungs 2b–2e** without an elevated capture each: a rung that still loads WAM or OnlineId would fail the round anyway. The owner was told before the extended search (#10).
- **Enable was clicked at t ≈ 78 s in run 3 and t ≈ 70 s in rung 2a** (cue: 60 s). The theme switch can't be seen by UI Automation; it rests on the owner following the cue.
- **Spec records of the exception:** `requirements.md` (L230 ticked with its note, RF29, C5, the WebView2 risk row) and `techspec.md` (the E2E-15 pass criterion, the `wlidsvc` risk row, research areas, the OQ13 disposition).
- **The rung 2a Process Monitor files (9.8 GB: PML 4,656 + 2,941 MB, CSV 2,189 MB) were deleted** after the identity rows were extracted (`evidences/e2e15-oq13-2a/identity-events.csv`), as approved in #9.
- `audit-network.ps1` itself is unchanged. Its pktmon text parse produced some malformed addresses in rung 2a (qa observation 8).
- **The independent verifier** (a separate agent, after the docs were first written) found 12 issues, all applied:
  - the E2E-16 attribution was overclaimed (`taskhostw` is a second candidate);
  - "and after a UAC prompt" was stated as fact;
  - "no substrate in any capture" needed "from the tree";
  - 39 → 41 ms;
  - X1's `wlidsvc` start can't be attributed;
  - my "empty pktmon list" was a misread;
  - live-query numbers had no file, now `session-2026-10-22-checks.txt`;
  - "every launch" → "every launch observed", and `wlidsvc` in 3 of 11.

**Confidence:**
- **Resume baseline:** 83 % = 0.30·90 + 0.35·80 + 0.20·85 + 0.15·75. Scored afterwards from the handoff state (one AC open, nothing yet known about the attribution); it wasn't computed at the start of the session.
- **Done:** **88 %** = 0.30·93 + 0.35·90 + 0.20·88 + 0.15·72 = 27.9 + 31.5 + 17.6 + 10.8. Unchanged from yesterday's 88 %: coverage rose, and risk fell by the same weight.

| Factor | Done score | Why |
|---|---|---|
| Coverage | 93 | Every AC met; AC-3 through the route the AC names (the ladder reached rung 3, the owner's decision recorded verbatim); the scripted run now includes the elevation |
| Evidence | 90 | Direct Process Monitor attribution in 2a; nine reproducible pre-screens. −10 as before, plus run 3's own attribution resting on timing (2a shows it directly) and the theme switch not machine-checked |
| Environment | 88 | `wlidsvc` also starts on its own here, and whether it goes online depends on Windows' token cache; attributed by module loads, not by DNS alone |
| Risk | 72 | BUG-T14-01 still blocks sign-off (T15); the exception isn't disclosed in the product yet; runtime 157 may change both behaviours |

**Follow-ups (not done):**
- **Approved (owner #11):** disclosure copy for the exception in the README and the trust panel;
- the ADL documentation lines (approved; now part of T15);
- an `AGENTS.md` "No network" line on the exception (proposed);
- `audit-network.ps1`: WAM / OnlineId module loads as an attribution signal, per-requester process trees, the close by window class (T13's follow-up), and its pktmon text parse (malformed addresses in rung 2a);
- re-check the exception and `msOneAuthWAM` on every runtime bump, 157 especially;
- a longer helper memory soak (private bytes 50.7 → 62.2 MB over 31 min, growing in steps);
- the WebView2 browser process at 251 MB once, in the shared profile;
- the Motherboard "All sensors" label wrapping at 1280 px;
- delete `C:\Users\jimmy\pophood-e2e\target-oq13` (the ladder builds).
