# Task 4 - Code review of T1–T3, then the owner's commit

## Description

Review the v0.1.1 working-tree diff against techspec Rev 1.3 with `review-implementation` before the owner commits, so that a defect never reaches the release builds. Then the owner commits the v0.1.1 tree, and T5 builds from that commit. This task is not in the Sequence; the owner added it ("Approve, 6 tasks (Recommended)").

- Status: Done (review 2026-10-22; the owner committed `0861d8f`)
- Complexity: S
- Estimated time: 1–2h
- Depends on: T1, T2, T3
- Can run in parallel with: —

## AI guidance

- `review-implementation`: this task's flow. Its description asks for a session apart from the implementation, so run it in a fresh session.
- Global rules, "Git branches and commits": the agent never stages or commits. It gives the owner the file list.
- Global rules, anti-overengineering: report a finding only with a concrete failure scenario. Each fix needs the owner's OK.
- `AGENTS.md` trust invariants: check that the diff keeps them (below).

## Requirements

- **Scope:** the T1–T3 diff: `src/cards/fields.ts`, `src/cards/fields.test.ts`, `src/pages/SensorList.tsx`, `src/pages/SensorList.test.tsx`, `src/styles/app.css`, `src/theme/tokens.css`, the version files, `README.md`, `THIRD-PARTY-NOTICES.md` and the `AGENTS.md` line.
- **Check against:**
  - techspec § Design (the snippets and the CSS table) and § Data models;
  - techspec § Test plan: UT-34, UT-38 and UT-39 test what their rows say, and each can fail;
  - the trust invariants: no change under `helper/` or `src-tauri/src/`; no `<a href>` and no `style` prop; a lock never hides a live value; the UI never rewrites a value (RF3).
- After every approved fix, `npm test`, `npm run build` and `cargo check` pass again. A CSS fix also re-runs the part of T2's render it affects.
- The owner gets the commit file list (step 5).

## Files involved

| Path | Action |
|---|---|
| The T1–T3 files listed in Scope | Read; Modify only for an owner-approved fix |
| `specs/v0.1.1/task_04.md` | Modify (the findings and their dispositions) |
| `specs/v0.1.1/tasks.md` | Modify (the T4 row; the commit hash) |

## Implementation steps

1. `git status --short` and `git diff --stat`. Confirm that nothing under `helper/` or `src-tauri/src/` changed.
2. Run `review-implementation` on the scope, against techspec Rev 1.3.
3. Show the owner the findings: severity, `file:line`, failure scenario and the proposed fix. Apply the fixes the owner approves, and quote each answer verbatim in this file.
4. Re-run `npm test`, `npm run build` and `cargo check`, and the T2 render part a CSS fix affects.
5. Give the owner the commit list:
   - **v0.1.1:** the T1–T4 files; `specs/v0.1.1/`; the v0.1.1 session folders (`sessions/20261022163940_pophood-v011-drilldown-design/`, `sessions/20261022171503_pophood-v011-techspec/`, `sessions/20261022184039_pophood-v011-techspec-review/`, this breakdown's session folder and the T1–T4 session folders); the edits to `specs/v0.1.0/requirements.md`, `specs/v0.1.0/techspec.md`, `specs/v0.1.0/ui-proposal/ui-proposal.md` and `specs/v0.2.0/README.md`; `AGENTS.md`;
   - **not v0.1.1** (the owner decides where they go): `scripts/audit-network.ps1`, `sessions/20261022132420_pophood-v010-followups/`, `specs/v0.1.0/task_15.md`, `specs/v0.1.0/tasks.md`;
   - **never:** `untitled.md`.
   - **Where:** on `master`, or on a branch the owner names to T5. T5 pulls it into the follow-ups clone with `--ff-only`.
6. Record the owner's commit hash (`git log --oneline -1`) here and in `tasks.md`.

## Acceptance Criteria

- The review report in this file lists every finding with its severity, location, disposition and the owner's answer, verbatim.
- `git diff --stat -- helper src-tauri/src` is empty (output).
- `npm test`, `npm run build` and `cargo check` pass after the fixes (output).
- The owner's commit hash is recorded, and `git status --short` no longer lists the v0.1.1 files (output).

## Testing

Not applicable: this is a review. Its check is that every suite passes again after the fixes (Acceptance Criteria). The release-build tests are in T5 and T6.

## Additional relevant files

- `specs/v0.1.1/techspec.md` (Rev 1.3)
- `sessions/20261022184039_pophood-v011-techspec-review/review.md` (the techspec review: what was already checked)
- `specs/v0.1.0/task_12.md` (the v0.1.0 review task, as a precedent)

## Task notes (2026-10-22)

**Review:** an independent Opus agent (high effort) ran `review-implementation` over the T1–T3 working tree against techspec Rev 1.3. It read every file in scope, ran `npm test` (250) and `npm run build`, and mutation-tested a scratch copy. Verdict: no Critical, High or Medium code defect. It wrote no review file; the report is in the session transcript, summarised here.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| P1 | Medium (process) | T2's `tauri dev` render had no evidence | **Fixed.** The owner's answer to "Do you want me to add the two small tests (L1 and L2) and then run the `tauri dev` render (P1)?": "yes". Evidence: `sessions/20261022204727_pophood-v011-implementation/evidences/tauri-dev-render/` (README) |
| L1 | Low (test gap) | A CPU `Load` group with all-`null` values wasn't tested, so the `groupNeeds` Load branch could break unseen | **Fixed.** UT-38 "(c) also" case; fails with `Load` needing PawnIO |
| L2 | Low (test gap) | No test that the header count includes locked sensors | **Fixed.** UT-39 (b) checks `.page-sub`; fails when the count skips locked groups |
| N1 | Info | `untitled.md` (empty) at the repo root | **Not committed.** It stays out of the commit list |

**After the fixes:** `npm test` 251 passed; `npm run build` passed; `cargo test` passed (T3); `git diff --stat -- helper src-tauri/src` is empty. The render covered the CSS, and the review found nothing in it.

**Commit list for the owner** (branch `master`; T5 pulls it with `--ff-only`):
- **v0.1.1 code and docs:** `AGENTS.md`, `README.md`, `THIRD-PARTY-NOTICES.md`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `src/cards/fields.ts`, `src/cards/fields.test.ts`, `src/pages/SensorList.tsx`, `src/pages/SensorList.test.tsx`, `src/styles/app.css`, `src/theme/tokens.css`, `specs/v0.1.1/`;
- **v0.1.1 spec edits to older docs:** `specs/v0.1.0/requirements.md`, `specs/v0.1.0/techspec.md`, `specs/v0.1.0/ui-proposal/ui-proposal.md`, `specs/v0.2.0/README.md`;
- **v0.1.1 sessions:** `sessions/20261022163940_pophood-v011-drilldown-design/`, `sessions/20261022171503_pophood-v011-techspec/`, `sessions/20261022184039_pophood-v011-techspec-review/`, `sessions/20261022193957_pophood-v011-tasks-breakdown/`, `sessions/20261022204727_pophood-v011-implementation/`;
- **not v0.1.1** (the owner decides): `scripts/audit-network.ps1`, `sessions/20261022132420_pophood-v010-followups/` (modified and new files), `specs/v0.1.0/task_15.md`, `specs/v0.1.0/tasks.md`;
- **never:** `untitled.md`.

**Owner's commit hash:** `0861d8f` (`0861d8f804ee87849e7860d3750959b9f3c330a9`, "v0.1.1", on `master`, parent `1a51df2`). `git diff --stat 1a51df2 -- helper src-tauri/src` is empty (checked 2026-10-23 and again in the clone by T5).
