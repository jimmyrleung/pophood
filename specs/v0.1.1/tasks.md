# Tasks summary - Pophood v0.1.1 (drill-down layout, patch)

- **Source:** [techspec.md](techspec.md) Rev 1.3 (Rev 1.2 reviewed at 94%; Rev 1.3 adds one file to the version bump, Q&A #7), [README.md](README.md) (scope stub), [UI proposal](ui-proposal/ui-proposal.md) variant B
- **Approved:** 2026-10-22, in the tasks-breakdown session (`sessions/20261022193957_pophood-v011-tasks-breakdown/`, ADR 0032). Owner answers, verbatim:
  - the breakdown: "Approve, 6 tasks (Recommended)" (with the T4 review before the commit);
  - E2E-21's 1280×860 check: "T6, full sensors (Recommended)";
  - `THIRD-PARTY-NOTICES.md` line 3 ("Pophood 0.1.0 is built from source…"): "Bump it to 0.1.1 (Recommended)".
- **Repo:** single repo (`pophood`). Code changes only in `src/` (React UI), plus the version files and docs. Nothing under `helper/` or `src-tauri/src/` changes.

## Tasks overview

| Task | Title | Complexity | Est. Time | Depends On | Status |
| ---- | ----- | ---------- | --------- | ---------- | ------ |
| [#1](task_01.md) | Drill-down model: group locks in `fields.ts`, and the AGENTS.md `groupNeeds` line | S | 2–3h | — | Done |
| [#2](task_02.md) | Drill-down page and styles, then an early `tauri dev` render | M | 4–6h | T1 | Done |
| [#3](task_03.md) | Version 0.1.1, the README status line and the notices line | S | 1h | T2 (order only) | Done |
| [#4](task_04.md) | Code review of T1–T3, then the owner's commit | S | 1–2h | T1, T2, T3 | Done (commit `0861d8f`) |
| [#5](task_05.md) | Release builds and agent-run checks | L | 4–6h | T4 (and the owner's commit) | Done |
| [#6](task_06.md) | Owner session: full sensors, PERF-02 and the network audit | M | 2–3h (about 1h of the owner's time) | T5 | Done (signed off 2026-10-23) |

**Overall Progress**: 6/6 tasks completed (100%); v0.1.1 signed off by the owner on 2026-10-23 (commit `0861d8f`; report `sessions/20261023055425_pophood-v011-release/qa.md`).

**Owner's sign-off** (answer to "Do you sign off v0.1.1? Every A and O check passed (E2E-12, 21, 22, 23, 27, E2E-15 run 2) and PERF-02 is recorded. One deviation: E2E-22 and E2E-27 (full) ran in a maximized window, 1920×1009 instead of 1917×1029. The Dashboard p95 is 0.8 ms higher than in v0.1.0, and the cause is unknown."): "Sign off v0.1.1 (Recommended)"

**Last Updated**: 2026-10-23

## Implementation order

The order follows the techspec [Sequence](techspec.md#sequence): step 1 → T1, step 2 → T2, step 3 → T3, step 4 → T5 and T6. These reallocations change no design:

| Change | Why |
|---|---|
| T4 (code review) added between step 3 and the owner's commit | Owner: "Approve, 6 tasks (Recommended)". A defect found after T5 costs two rebuilds, a new sweep and another owner session |
| The owner's commit moves from "after step 3" to "after T4" | The review fixes go into the same commit, and T5 builds from it |
| `SensorList.tsx`'s `drillSections` call site (the `useSensorStatus()` hook, with the other hooks) moves into T1 | `npm run build` runs `tsc -b` over `src`, so the new signature would break the build until T2 |
| Step 4 split into T5 (agent, "A") and T6 (owner, "O") | The handoff asked for the owner steps in their own owner-facing task (as in v0.1.0, T13/T14) |
| E2E-12, E2E-21, E2E-22 and E2E-27: reduced parts in T5, full-sensors parts in T6 | The full-sensors parts need the owner's UAC click |
| E2E-21's 1280×860 check in T6 | Owner: "T6, full sensors (Recommended)". "The panel sticks" shows only when the page scrolls, and only the full CPU page scrolls there |
| E2E-22 closes in T6 | Its negative control runs at 1917×1029 with full sensors |
| T6 writes its PERF-02 script and `RUNBOOK.md` before the owner joins | `perf-cdp.ps1` has the v0.1.0 devtools folder hard-coded and runs PERF-01/03 for about 36 min; v0.1.1 re-runs PERF-02 only |
| `THIRD-PARTY-NOTICES.md` joins the version bump (T3) | Owner: "Bump it to 0.1.1 (Recommended)". The About page shows the file, and its line 3 names the app version |
| Doc updates go with the tasks: each task updates its task file and this file; T3 does the README status line; T6 does the `specs/v0.1.1/README.md` status at sign-off | There is no separate docs task |

```text
T1 ─> T2 ─> T3 ─> T4 ─> [owner commit] ─> T5 (agent) ─> T6 (owner)
```

**Parallelism:** none worth taking. T3 has no code dependency and could run beside T1, but the Sequence puts it after T2 so that T2's `tauri dev` runs keep one version. T5 and T6 share the builds and the PC.

**The owner's commit (after T4):** the v0.1.1 tree on `master` (or a branch the owner names to T5), together with the v0.1.1 spec and session files from step 1 of `sessions/20261022184039_pophood-v011-techspec-review/LOGS.md`. T5 pulls it with `--ff-only`. Branching and commits stay with the owner.

**Fix rule after the commit (T5, T6):** a fix found in T5 or T6 goes into the owning task's files. The owner commits it, T5 rebuilds both variants, and the checks the fix touches run again: earlier evidence for those checks no longer counts. The helper regression rule (AGENTS.md) applies only if a fix touches `helper/` or `src-tauri/src/sensors/`, and none should.

## Builds and paths (T5, T6)

| Name | Path | What |
|---|---|---|
| Clone | `C:\Users\jimmy\pophood-e2e\pophood-followups` | The v0.1.0 build of record (`1a51df2`). T5 pulls the owner's v0.1.1 commit into it. Its `src-tauri\target\release` (v0.1.0) is never touched |
| Helper of record | `src-tauri\binaries\pophood-sensors-x86_64-pc-windows-msvc.exe` in the clone | SHA-256 `553A7F496E4F2DC2CD1590D6BD127F47384351F5FB7B25B2C05615937B357936` (checked 2026-10-22). Neither build rebuilds it |
| **release** | `C:\Users\jimmy\pophood-e2e\target-v011\release\pophood.exe` | A `CARGO_TARGET_DIR` build with `beforeBuildCommand = npm run build` (template `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1`). Driven through UI Automation (`ui.psm1`) |
| **devtools** | `C:\Users\jimmy\pophood-e2e\target-v011-devtools\release\pophood.exe` | The same command plus `--features tauri/devtools` (template `sessions/20261021165812_pophood-v010-e2e/pass2-build.ps1`). Started with `devtools-start.ps1 -Exe …` and driven through CDP on 127.0.0.1 (`cdp.psm1`). Test instrumentation, never the product (ADR 0019) |
| Session (`$S`) | `sessions/<yyyyMMddHHmmss>_pophood-v011-release/` | Created by T5: the scripts, `qa.md` and `evidences/` for T5 and T6, and T6's `RUNBOOK.md` |

## Test ownership

Every scenario in the techspec [Test plan](techspec.md#test-plan) has an owner.

| Task | Unit | Integration | E2E / Perf / live |
|---|---|---|---|
| T1 | UT-31 (unchanged; the refactor's regression check), UT-34 (updated), UT-38 (new) | — | — |
| T2 | UT-39 (new); the v0.1.0 `SensorList` tests (with the new `setup`) | — | Early `tauri dev` render: reduced, both themes, 1917×1029 and 1024×680, the sticky panel and the Shift+Tab step at 1024×800. It is a preview: the E2E rows close in T5 and T6 |
| T3 | About (shows 0.1.1) | — (`cargo check` only; reason in the task) | — |
| T4 | — (a review; every suite is green after the fixes) | — | — |
| T5 | `npm test` on the clone | `cargo test` (IT-01…IT-17) and `cargo test -- --ignored` (IT-10) on the clone | **release:** E2E-12 (A), E2E-21 (A), E2E-23 (file versions). **devtools:** E2E-22 (A), E2E-23 (About page), E2E-27 (A, with its negative control) |
| T6 | — | — | **release:** E2E-12 (O), E2E-21 (O: 1917×1029, 1280×860), E2E-15. **devtools:** E2E-22 (O, with its negative control), E2E-27 (O), PERF-02 |

- **Split on purpose:** E2E-12, E2E-21, E2E-22 and E2E-27 (T5 has the reduced "A" parts, T6 the full-sensors "O" parts).
- **E2E-22 passes only after T6**, because its negative control runs there.
- **Not run (helper unchanged, so the helper regression rule doesn't apply):** `dotnet test`, E2E-19, E2E-24, the DLL plant check, the elevated smoke. `audit-network.ps1 -Quick` is not run either: it isn't in the techspec, and E2E-15's capture checks the browser command line too.

## Acceptance criteria coverage

| AC (techspec § Test plan) | Tasks |
|---|---|
| AC-01 groups, order, labels, counts, Memory headings | T1 (UT-34), T2 (UT-39 a), T5 (E2E-12 A) |
| AC-02 columns, split cards | T2 (UT-39 d, render), T5 (E2E-21 A, E2E-27 A), T6 (E2E-21 O, E2E-27 O) |
| AC-03 panel, sticky, focus never hidden | T2 (render), T5 (E2E-12 A, E2E-21 A, E2E-22 A), T6 (E2E-21 O, E2E-22 O with its negative control) |
| AC-04 selection | T2 (UT-39 b, c), T5 (E2E-12 A), T6 (E2E-12 O) |
| AC-05 banner, group locks, RF3 | T1 (UT-31, UT-38), T2 (UT-39 b, f), T5 (E2E-12 A), T6 (E2E-12 O) |
| AC-06 the v0.1.0 states | T2 (UT-39 e, f, g, and the v0.1.0 tests) |
| AC-07 versions | T3 (About test), T5 (E2E-23) |
| AC-08 trust invariants | T4 (no diff under `helper/` or `src-tauri/src/`), T5 (helper hash before and after both builds), T6 (E2E-15) |
| RF26 (layout revised), UX "Reduced mode has to look intentional" | T1, T2, T5, T6 |

## Confidence

```
Confidence: 93% - Fidelity 95 · Dependency closure 93 · Test ownership 92 · Boundaries 93
Remaining uncertainty: T4, the A/O split of step 4, the 1280×860 placement and the notices line
are reallocations or gap fixes (each one owner-approved). T5 and T6 depend on the owner's commit
and the owner being present, and the follow-ups clone moves from 1a51df2 to v0.1.1. The E2E-27
sampler and the PERF-02 script are new harness code, written in T5 and T6. T5 is an L task.
```

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Fidelity to approved design / locked decisions and requirement coverage | 35% | 95 | The 4 Sequence steps map onto T1, T2, T3 and T5 + T6 in order. Every reallocation is in the table above, with the owner's answer where one was needed. No behaviour, constant or copy changes, except the notices line (owner-approved, Q&A #7). AC-01…AC-08, RF26 and the UX line each map to a task. −5: T4 and the A/O split are reallocations; 1280×860 was an interpretation (now the owner's choice). |
| Dependency, lifecycle and resource closure | 25% | 93 | T1 → T2 (the `drillSections` signature and `SensorGroup.lock`), T2 → T3 (order only), T1–T3 → T4 → commit → T5 (`pull --ff-only`) → T6 (the same builds). The build stays green after T1 (the call site moves with it). The helper hash is checked before and after both builds; the v0.1.0 release folder stays. −7: T5 and T6 need the owner's commit and presence; T2's render needs the working tree's staged helper (present 2026-10-22). |
| Test/AC ownership and executable checks | 25% | 92 | Every UT, E2E and PERF ID has an owner; the splits are listed. Each AC points at command output, a live file, a screenshot or the owner's confirmation. Negative controls: UT-38 (d) and UT-39 (g) mutation runs, E2E-22 (the rule switched off), E2E-27 (the known split cards), E2E-15 (the v0.1.0 criteria). −8: the E2E-27 sampler and the PERF-02 script are new; the "O" items are manual. |
| Task boundaries, sizing and path grounding | 15% | 93 | Every path and symbol was read in the tree on 2026-10-22: `fields.ts` (`lockFor`, `buildDashboard`, `groupByType`, `drillSections`), both test files (`fullStatus`, `custom`, `hw`, `setup`), `app.css` (the `.drill`, `.list*`, `.row`, `.detail*`, `.stats*` rules), `tokens.css`, the version strings, the clone, the helper hash, the v0.1.0 harness scripts. One L task (T5), with the reason it isn't split. −7: T5 is L, and the two target folders are new. |
| **Total** | | **93** | 0.35·95 + 0.25·93 + 0.25·92 + 0.15·93 = 33.25 + 23.25 + 23 + 13.95 = **93.45** |
