# Tasks summary - Pophood v0.1.0 (slice 1)

- **Source:** [techspec.md](techspec.md) Rev 1.3 (90%), [requirements.md](requirements.md) slice 1, [ui-proposal.md](ui-proposal/ui-proposal.md)
- **Approved:** 2026-10-21 (owner: "approve"). Revised the same day after the adversarial review (owner: "apply"): every finding applied, and the verification step split into T12–T14.
- **Repo:** single repo (`pophood`); three code trees inside it: `helper/` (.NET), `src-tauri/` (Rust), `src/` (React)

## Tasks overview

| Task | Title | Complexity | Est. Time | Depends On | Status |
| ---- | ----- | ---------- | --------- | ---------- | ------ |
| [#1](task_01.md) | Helper build chain: LHM submodule, lock file, bans, `build-helper.ps1` | M | 4–6h | — | Completed |
| [#2](task_02.md) | App shell and WebView2 lockdown | M | 5–7h | T1 | Completed (C1 dry run pending) |
| [#3](task_03.md) | Helper protocol, control parser and pipe server | M | 4–6h | T1 | Completed |
| [#4](task_04.md) | Helper sensors: reader, RF3 availability, deadline sampler, elevated smoke | M | 5–7h | T3 | Completed (owner elevated smoke passed on the final helper) |
| [#5](task_05.md) | Core connection layer and pipe integration tests | L | 6–8h | T2, T4 | Completed |
| [#6](task_06.md) | Core supervisor, UI contract and commands | L | 8–10h | T5, T7 | Code complete (owner UAC accept pending) |
| [#7](task_07.md) | UI foundation: theme, shell, store, banners | L | 6–8h | T2 | Completed |
| [#8](task_08.md) | Card model: formats, field rules, fixtures | L | 6–8h | T7 | Completed |
| [#9](task_09.md) | Charts, cards and Dashboard | M | 5–7h | T8 | Completed |
| [#10](task_10.md) | Drill-down, About and third-party notices | M | 3–5h | T9 | Completed |
| [#11](task_11.md) | AGENTS.md, README and the network audit script | M | 3–4h | T1, T2 | Completed (AGENTS.md approved in T13) |
| [#12](task_12.md) | Code review of the v0.1.0 changes | M | 3–5h | T6, T10, T11 | Completed |
| [#13](task_13.md) | Release build and agent-run E2E | L | 5–7h | T12 | Completed (BUG-01 fixed; owner elevated smoke passed) |
| [#14](task_14.md) | Owner-run E2E, perf baselines, OQ13 sign-off | L | 4–6h, plus up to 6 OQ13 ladder rounds and one 30-min idle capture | T13 | Completed 2026-10-22. E2E-15 passes with a disclosed exception (OQ13 rung 3, owner: "Disclosed exception (Recommended)"); BUG-T14-01 → T15 |
| [#15](task_15.md) | Confine the helper's P/Invoke DLL loads to System32 (BUG-T14-01) | M | 3–4h (about 1h with the owner) | T14 | Completed 2026-10-22 (resolver + CRYPT32 delay load + build guard; every AC passes on the fresh-clone release build) |

**Overall Progress**: 15/15 tasks done (T1–T15). **v0.1.0 is signed off (2026-10-22)**; see [v0.1.0 sign-off](#v010-sign-off-2026-10-22)

**Last Updated**: 2026-10-22

## Implementation order

The order follows the techspec [Sequence](techspec.md#sequence) step for step, with these reallocations (no design change):

| Change | Why |
|---|---|
| Step 2 stays one task (T2) | With `create: false`, only `webview.rs` builds the window, so the scaffold can't run without the lockdown code |
| Step 8 split into T8 (pure card model) and T9 (rendering) | `fields.ts` is one rule table with its own fixtures; the SVG and React work is separable |
| Step 11 split into T12 (code review), T13 (agent-run, "A") and T14 (owner-run, "O") | The `review-implementation` skill runs before QA, in a separate session; T13/T14 split by who acts (T14 needs UAC, PawnIO uninstall and elevated captures) |
| `events.rs` moved from step 5 to step 6 (T6) | It is the UI contract the supervisor emits |
| `src/test/fixtures/event-frame.json` created in T7 | Lets the UI track run in parallel with T3–T6; T6 asserts the Rust half of UT-28 against it, and may correct the fixture (then re-runs the TS half) |
| UT-13 moved to T2 | It tests `build.rs`, which T2 creates |
| E2E-19 and part of E2E-24 moved up to T1 | The bans and the lock file are created in T1; techspec "Next checks" lists E2E-19 first |
| `scripts/audit-network.ps1` in T11 | The Sequence places it in no step. T11 is the small scripts-and-docs task; T13 runs `-Quick`, T14 runs the capture (E2E-15) |
| Placeholder `src/main.tsx` and `src/App.tsx` in T2; T7 replaces them | The scaffold needs an entry point before the UI tasks |
| `src/pages/Dashboard.tsx` created as a stub in T7; T9 fills it | The banner and blocking panels need a host page in T7 |
| `src/cards/fields.ts` created in T8; T10 adds `componentScope`, the drill-down grouping and UT-34 | Its only consumer is the drill-down |
| `src-tauri/src/lib.rs` gains `pub mod sensors;` in T5; `sensors/mod.rs` is a module stub in T5, filled in T6 | The ITs reach `pophood_lib::sensors::{helper, pipe, protocol}` |
| UT-12 (T2), UT-29 (T6), UT-33 and UT-36 (T4), UT-34 (T10) | The Sequence lists no step for these; each goes with the file it tests |
| An owner-run elevated AOT smoke in T4 and one UAC accept in T6 | C10 and ADR 0002 require an elevated AOT smoke after every helper change. It also moves the first runs of the GPU DLLs under the System32-only search and of `ShellExecuteExW` under the file lock ahead of the release build. E2E-02 in T14 stays the sign-off check. |

```text
Helper → core:  T1 ─> T3 ─> T4 ─> T5 ─> T6 ──────────────┐
Shell → UI:     T1 ─> T2 ─> T7 ─> T8 ─> T9 ─> T10 ───────┤
Docs, script:         T2 ─> T11 ─────────────────────────┤
                                                         └─> T12 ─> T13 ─> T14
Cross edges:  T2 ─> T5 (the Rust crate)    T7 ─> T6 (event-frame.json fixture)
```

**Parallelism:** once T1 is done, T2 and T3 run in parallel. Once T2 is done, T7 → T8 → T9 → T10 and T11 run alongside T3 → T4 → T5. T6 joins the helper and UI tracks. The UI tasks' live `tauri dev` checks that need a running supervisor (T9, T10) move to T13's E2E items if T6 isn't merged yet. T12 needs every code task; T13 and T14 run on one release build.

**Ordering inside the repo:** build chain and config (T1, T2) → helper back end (T3, T4) → core (T5, T6) → UI (T7–T10) → docs and scripts (T11) → review (T12) → verification (T13, T14). The UI track starts early on fixtures, which is the techspec's own allowance for step 7.

**Regression rule (T12–T14):** any change under `helper/` or `src-tauri/src/sensors/` after T6 re-runs `npm run build:helper`, `dotnet test helper.Tests`, `cargo test` (with the ITs), E2E-19, E2E-24's `dumpbin /imports` check and T4's elevated smoke before verification continues. Earlier evidence for those checks no longer counts. **From T15:** E2E-24 is the import walk (`sessions/20261022100556_pophood-v010-t15-dll-confine/e2e24-static.ps1`), and the DLL plant check (`dll-plant-check.ps1` there) runs unelevated, then elevated.

## Test ownership

Every scenario in the techspec [Test plan](techspec.md#test-plan) has an owner.
- **Split by side or by who runs it:** UT-25 (T7 rows, T9 Dashboard parts), UT-28 (T6 Rust, T7 TS), E2E-09, E2E-10, E2E-17 and E2E-18 (T13 "A" parts, T14 "O" parts).
- **Run twice on purpose:** E2E-19 (T1, re-run in T13), E2E-24 (part in T1, in full in T13), E2E-26 (debug dry run in T2, release in T14).

| Task | Unit | Integration | E2E / Perf / smoke |
|---|---|---|---|
| T1 | — (build-time checks; reason in task) | — | E2E-19; E2E-24 (lock tamper, submodule, only the exe staged) |
| T2 | UT-12, UT-13 | — | First `tauri dev` run; browser command-line check; E2E-26 dry run |
| T3 | UT-01, UT-02, UT-03, UT-06 | — | — |
| T4 | UT-04, UT-05, UT-33, UT-36 | — | Unprivileged GPU DLL check; owner-run elevated AOT smoke (C10) |
| T5 | UT-07, UT-08, UT-09, UT-11 | IT-01…IT-17 | — |
| T6 | UT-10, UT-29, UT-28 (Rust half) | — | Owner UAC accept in `tauri dev` (`ShellExecuteExW` under the lock) |
| T7 | UT-21, UT-25 (banner and panel rows), UT-26, UT-27, UT-28 (TS half) | — | — |
| T8 | UT-14…UT-20, UT-23, UT-30, UT-31, UT-32, UT-35, UT-37 | — | — |
| T9 | UT-22, UT-24, UT-25 (Dashboard parts) | — | — |
| T10 | UT-34 | — | — |
| T11 | — (docs and a script; reason in task) | — | `audit-network.ps1 -Quick` on the `tauri dev` build |
| T12 | — (review; reason in task) | — | Every suite green after the review fixes |
| T13 | — | — | E2E-01, 05, 06, 07, 09 (A), 10 (A), 11, 12, 13, 17 (A, including restore + Retry), 18 (unprivileged), 19 (re-run), 20, 21, 22, 23, 24 (full); fresh-clone README build |
| T14 | — | — | E2E-02, 03, 04, 08, 09 (O), 10 (O), 14, 15, 16, 17 (O), 18 (elevated), 25, 26; PERF-01…PERF-05; OQ13 ladder |

## Requirement coverage

| Requirement | Tasks |
|---|---|
| RF1 (never change hardware state; mechanical check) | T1 (bans, allow-list), T4 (toggles, UT-33), T14 (E2E-16) |
| RF2 (user-only pipe, versioned schema) | T3, T5 (IT-14, UT-07), T6 (`schema_mismatch`) |
| RF3 (stable ids, availability, helper classifies fake zeros) | T4 (classification; IT-02 in T5), T5 (`sensor_key`), T8 (lock labels), T14 (E2E-14) |
| RF4 (1 s / 250 ms, no drift, frame timestamp) | T3 (`set_period`), T4 (deadline sampler), T5 (IT-03, IT-04), T7 (history keyed on `t`), T9 (charts plot `t`) |
| RF5 (exit on disconnect / 30 s; gone in 5 s; elevated helper writes no files) | T1 (file-API bans), T3 (exit rules), T5 (IT-06, IT-10), T6 (shutdown), T13 (E2E-09A, 10A), T14 (E2E-09O, 10O, 16) |
| RF6 (never installs a driver) | T1 (`Process` ban), T14 (E2E-16) |
| RF7 (single instance) | T2, T13 (E2E-11) |
| RF8 (hidden spawn, UAC relaunch, fallback, reconnect) | T5 (`launch_*`), T6 (state machine, UAC smoke), T13 (E2E-07), T14 (E2E-02, 03, 04, 08, 25) |
| RF9 (server is the bundled helper) | T5 (`connect_verified`, IT-09), T6 (`pipe_squatter`) |
| RF10 (10-min memory-only history; in the UI per #38) | T7 |
| RF11 (UI knows PawnIO state) | T3 (`hello.pawnIo`), T4 (`loaded`), T7 (trust panel, banners), T14 (E2E-14) |
| RF12 (configured speed; OC inference full-only) | T4 (SMBIOS memory facts; IT-11 in T5), T8 (UT-18) |
| RF13 basis (`sensor_key`, no schema change in v0.2.0) | T5 (UT-08) |
| RF14 (verify by SHA-256 before every launch) | T2 (`build.rs`), T5 (UT-09, IT-12), T6 (verify at every launch), T13 (E2E-05, 06, 17A), T14 (E2E-17O) |
| RF25 (dashboard cards, sparklines, placeholders, Enable action) | T7 (Enable action in the banner), T8, T9 |
| RF26 (drill-down; inline rename is v0.2.0) | T10 |
| RF29 (no network; strict CSP) | T2, T11 (`audit-network.ps1`), T13 (E2E-20), T14 (E2E-15) |
| RF30 (licence notices, LHM source location) | T10, T13 (E2E-23) |
| RF31 (untrusted client input, 22-case corpus) | T3 (UT-01…03), T5 (IT-05, IT-07, IT-13, IT-15, IT-16) |
| C1 (app never elevated) | T2, T14 (E2E-02, E2E-26) |
| C2 (no hardware changes) | As RF1: T1, T4, T14 (E2E-16) |
| C3 (never installs a driver; detects PawnIO and links to pawnio.eu) | T4 (detection in `hello`), T6 (`open_pawnio_site`), T7 (PawnIO banner lines), T14 (E2E-14) |
| C4 (pinned source and lock-pinned packages) | T1, T13 (E2E-24) |
| C5 (no outbound connections) | As RF29: T2, T13 (E2E-20), T14 (E2E-15) |
| C6 (IPC security: user-only pipe, both ends verify, versioned schema, strict CSP, minimal capabilities) | T2 (CSP, no capability files), T3, T5 (IT-07, IT-09, IT-14), T13 (E2E-20). Over-the-shoulder elevation is out of scope (techspec § Out-of-scope). |
| C7 (data stays local) | T2 (WebView2 data under `%LOCALAPPDATA%\dev.pophood`), T7 (theme in localStorage; history in memory only) |
| C8 (Windows only; two seams) | T3, T5 (schema v1, the only seam v0.1.0 uses); no task adds another |
| C9 (benchmark comparability) | Not applicable to v0.1.0 (no benchmarks) |
| C10 (build tools; AOT smoke after every helper change) | T1 (`vswhere` check), T4 (elevated AOT smoke), T6 (UAC smoke), T13 (E2E-24), T14 (E2E-02); the regression rule re-runs it after any later helper change |
| C11 (hash and lock; DLL planting) | T2, T3, T5 (IT-12), T6 (UAC accept under the lock), T14 (E2E-02) |
| OQ8, OQ15, OQ13 | T1 (OQ8), T2 (OQ15), T14 (OQ13 sign-off) |
| Error and empty-state done-when items | T6 (state machine), T7 (banners, blocking panels), T8 (empty states, UT-17), T9, T13, T14 |

## Confidence

```
Confidence: 91% - Fidelity 93 · Dependency closure 91 · Test ownership 90 · Boundaries 88
Remaining uncertainty: first runs still settle design assumptions — environment creation in setup() and
whether tauri-build accepts no capability files (T2), the GPU DLLs under the System32-only search (T4),
ShellExecuteExW under the file lock (T6). Each has a written fallback in the techspec, applied only after
the owner approves. npm and plugin versions are pinned when T2 runs. OQ13 gates the v0.1.0 sign-off (T14),
not the tasks.
```

**History:** the first version scored 91%. The adversarial review (2026-10-21) re-scored it at 85% (2 high, 9 mid, 13 low): live checks in T7/T9 needed T6, which wasn't upstream; every elevated first run and C10's per-change smoke waited for the last task; T2's fallback skipped the owner; T6 couldn't fix the contract fixture; several ACs couldn't run as written. This revision applies every finding. The scores below come from the review's evidence, not from assertion.

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Fidelity to approved design / locked decisions and requirement coverage | 35% | 93 | The 11 techspec steps map onto 14 tasks. Every reallocation is in the table above, including the ones the review found unlisted. None changes behaviour, constants or copy. Every RF, C1–C11 (C9 marked n/a), done-when item and owner answer #35–#44 maps to a task. Every fallback is applied only after the owner approves. −7: the reallocations are judgement calls the techspec only partly anticipated ("may split steps 2 and 8"), and the T4/T6 smokes add owner steps the Sequence doesn't list (they implement C10). |
| Dependency, lifecycle and resource closure | 25% | 91 | Every edge checked: T1 → T2 (`build.rs` needs the sidecar), T1 → T3, T2 → T5 (the crate), T4 → T5 (IT-01…04 and IT-11 need frames; the other ITs need only T3), T7 → T6 (fixture, which T6 may now correct), T2 → T7. No AC needs a task that isn't upstream: T7's check no longer depends on T6, and T9/T10's live checks move to T13 if T6 isn't merged. Each Modify names the task that created the file. The regression rule covers fixes after T6. T13 gets the owner's OK before it commits for the fresh clone. −9: T4's smoke, T5's ITs and T13/T14 depend on the owner's PC (`POPHOOD_OWNER_PC=1`) and on the owner being present. |
| Test/AC ownership and executable checks | 25% | 90 | Every UT, IT, E2E and PERF ID has an owner; splits and deliberate re-runs are listed, and the E2E-17 halves add up. ACs point at command output, live files or the owner's confirmation, and the review's unrunnable ones are rewritten (the `data:` URI check, the devtools `invoke`, the staged-helper path, CSP checks under `tauri dev`). T13 can't close with a failing check without a waiver the owner approved. −10: most E2E items still run only at the end, and the (O) items are manual. |
| Task boundaries, sizing and path grounding | 15% | 88 | Paths come from the techspec Implementation map; every precedent path under `pophood-probes` and `pc-bench-spike`, and every session ADR and skill draft cited, was checked to exist. Six L tasks (T5, T6, T7, T8, T13, T14), each with the reason it isn't split. −12: T6 stays whole at 8–10h rather than splitting the pure `transition` from the effect runner (option kept in the task), and the repo holds no code yet, so file paths can't be checked against a tree. |
| **Total** | | **91** | 0.35·93 + 0.25·91 + 0.25·90 + 0.15·88 = 32.55 + 22.75 + 22.5 + 13.2 = **91.0** |

## Implementation status (2026-10-21, `/goal` session)

T1–T11 are code complete and every automated suite is green (`dotnet test helper.Tests -r win-x64` 66, `cargo test` 74 lib + UT-13 + 17 ITs (+ IT-10 with `--ignored`), `npm test` 233, `npm run build`). T12 (review), T13 and T14 are left to their own sessions. Nothing is committed.

**Open owner steps (each is recorded in the task's notes):**

| Task | Step |
|---|---|
| T2 | C1 dry run (debug `pophood.exe` from an elevated terminal: message box, exit code 1). The release-build check is T14's E2E-26 |
| T6 | UAC accept (the first `ShellExecuteExW` under the file lock) and "Get PawnIO": now part of T14 (E2E-02, E2E-14) on the release build. Retry after restoring the helper passed in T13 (E2E-05, 06, 17A) |

T4's elevated AOT smoke passed on the final helper (`11a0ed2b…`, 2026-10-21; output in `task_04.md`).

T10's live click-through (open a card and About) passed in T13 on the release build (E2E-12, E2E-23).

## T13 status (2026-10-21, release build and agent-run E2E)

- **Final build:** commit `73fdb0f` on `master` (the owner: "Commit on master", then "Commit + full rebuild (Recommended)"), fresh clone in `C:\Users\jimmy\pophood-e2e\pophood`, README steps verbatim. Helper SHA-256 `11a0ed2b9722d85332607308c7879495ebdd5eb76344d5445e0480123deab6f4`. T14 runs on this build.
- **Result:** every "A" item passes: E2E-01, 05, 06, 07, 09A, 10A, 11, 12, 13, 17A, 18, 19, 20, 21, 22, 23, 24, plus `audit-network.ps1 -Quick`. All four suites pass on the clone (npm 237, dotnet 66, cargo 74 + 1 + 18, IT-10). Report: `sessions/20261021165812_pophood-v010-e2e/qa.md`.
- **Bug fixed:** BUG-01, a new page kept the previous scroll offset (`src/App.tsx`, regression test `src/App.test.tsx`).
- **Moved to T14** (owner: "Move both to T14"): E2E-21's Motherboard drill-down at 1024×680, and E2E-09's close during "Connecting…" while two helpers run.

**Deviations from the techspec worth a look in review (details in the task notes):** the supervisor is split into `machine.rs` (pure) and `mod.rs` (runner); the SMBIOS memory-size rule skips only 0 and 0xFFFF; `build-helper.ps1` forces a locked-mode restore so a tampered lock hash fails with NU1403; `devCsp` in `tauri.conf.json`; elevation notices survive a reconnect; `buildDashboard` takes an optional `{ stale }`.

## T14 status (2026-10-21, owner-run E2E and sign-off)

- **Result:** every O item except E2E-15's elevated scripted re-run passes on T13's release build (`73fdb0f`, helper `11a0ed2b…`):
  - E2E-02, 03, 04, 08, 09 (O), 10 (O), 14, 15 (idle run only), 16, 17 (O), 18 (elevated), 21 (elevated), 25 A/B, 26;
  - PERF-01…05.
- **OQ13:** no flow and no DNS from Pophood's tree in the 180 s and 30-min captures (`msOneAuthWAM` holds on runtime 155). **But neither capture included the elevated helper:** the 180 s scripted run is to be re-run with Enable → UAC inside the window (paused 2026-10-21; handoff in `sessions/20261021181500_pophood-v010-owner-e2e/LOGS.md`).
- **Done-when:** 24 of 25 slice 1 boxes ticked (owner: "Tick all 25 (Recommended)"). L230 (no network) was unticked again at close-out until the elevated re-run passes.
- **Report:** `sessions/20261021181500_pophood-v010-owner-e2e/qa.md`.
- **Blocker:** BUG-T14-01. The helper loads P/Invoke DLLs (setupapi, cfgmgr32, DPAPI, ntdll, user32) from its own user-writable folder, so a planted DLL would run elevated. Owner: "New fix task T15 (Recommended)". **v0.1.0 is signed off when T15 passes.**
- **Changed in T14:** `scripts/audit-network.ps1` now decodes Kernel-Network addresses (owner: "Fix it now (Recommended)") and `requirements.md` has its ticks. Nothing is committed (commits are the owner's call).

## T15 status (2026-10-22, BUG-T14-01)

- **Fix:**
  - `DllSearch.TryConfine()`, right after `SetDefaultDllDirectories`, gives the seven assemblies whose P/Invokes NativeAOT would load from the helper's folder by full path a System32-only resolver (owner: "Resolver (Recommended)").
  - `CRYPT32` is delay-loaded, because its own delay import `DPAPI.dll` was resolved at process start, folder first (owner: "Delay-load CRYPT32 (Recommended)").
  - `build-helper.ps1` fails on an unconfined P/Invoke module in the ILC map (owner: "Guard in build (Recommended)").
  - The `AGENTS.md` text is owner-approved ("Approve as drafted"). The AMD ADL write is in `WRITE-ALLOWLIST.md`.
- **Commits:** `a965782` (T13 tail and T14) and `55d5b2a` (T15), on `master`. Owner: "Two commits (Recommended)".
- **Release build:** fresh clone of `55d5b2a` in `C:\Users\jimmy\pophood-e2e\pophood-t15` (owner: "Fresh clone (T13 standard)"). Helper `5e0ebebe…`.
- **Result:** every check passes:
  - all suites;
  - the plant check unelevated and elevated: nothing loads from the folder, no crash with `user32` planted;
  - the elevated smoke: 258 sensors, both GPUs;
  - E2E-02 (UAC "Foreground"), E2E-16 (0 events on a `.dll` in the helper's folder), E2E-19, E2E-24 and `audit-network.ps1 -Quick`.
- **Details:** [task_15.md](task_15.md); evidence in `sessions/20261022100556_pophood-v010-t15-dll-confine/evidences/`. Final confidence 94%.
- **From T15 on:** the regression rule also runs E2E-24's import walk and the DLL plant check, unelevated then elevated.
- **Review (2026-10-22, `review-implementation`):** no helper defect. Four script, test and doc fixes were applied (owner-approved), including a false PASS in `dll-plant-check.ps1` with a relative work path. The helper and its hash are unchanged. Details: [task_15.md § Review](task_15.md#review-review-implementation-2026-10-22-sessions20261022125650_pophood-v010-t15-review). Confidence 92% → 93%.

## v0.1.0 sign-off (2026-10-22)

**v0.1.0 is signed off.** Owner: "Sign off v0.1.0 (Recommended)".
- T1–T15 are complete.
- Every slice 1 done-when item is ticked. E2E-15 passes with the disclosed `login.live.com` exception (owner #11, ADR 0024).
- BUG-T14-01 is fixed and verified on the fresh-clone release build `55d5b2a`.

**Follow-ups session (2026-10-22, owner: "All v0.1.0 follow-ups"):** every listed follow-up is done; see [task_15.md § Follow-ups session](task_15.md#follow-ups-session-2026-10-22-sessions20261022132420_pophood-v010-followups).
- Done: the disclosure copy (README, trust panel); the `AGENTS.md` lines (T14, T15, review F12); the four `audit-network.ps1` items (ADR 0029); `target-oq13` deleted; one list for `$confined` and `DllSearch.Assemblies` (checked by `DllSearchTests`); the HKCU COM question (closed, not reachable).
- **The NVML `%ProgramW6432%` fallback was a real same-user → elevated path** on PCs whose NVIDIA driver has no `nvml.dll` in System32. Fixed: the helper pins the variable (ADR 0028), with F14. This is a helper change, so the regression rule ran (working tree: every agent check PASS).
- **Release build of record:** fresh clone of `1a51df2` in `C:\Users\jimmy\pophood-e2e\pophood-followups`, helper `553a7f49…`. Every check passes on it: all suites, E2E-19, E2E-24, the plant check unelevated and elevated, the elevated smoke (258 sensors, both GPUs), `env-pin-check.ps1`, `-Quick` and the 180 s E2E-15 capture (OVERALL PASS). The capture's empty cues were a script bug since `920b1e2`, fixed (owner: "Fix cue, re-run (c) (Recommended)"); the re-run followed the scripted flow. Details: [task_15.md § Follow-ups session](task_15.md#follow-ups-session-2026-10-22-sessions20261022132420_pophood-v010-followups).
- Still watched, from T14 and T15: E2E-02's Connecting → live time (2.96 s against ~3 s); `msOneAuthWAM` and the exception on every WebView2 runtime bump (157 especially); the helper memory soak; the WebView2 browser process at 251 MB once; the Motherboard "All sensors" wrap at 1280 px.
