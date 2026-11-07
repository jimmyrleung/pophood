# Task 6 - Code review of T1–T5, then the owner's commit

## Description

Review the T1–T5 change set before the owner commits it, because a defect found after T7 costs two rebuilds, a new sweep and another owner session. Fix what the review finds, then give the owner the list of files to commit. This is Sequence step 6.

- Status: Done. Owner's commit `e4e6a94` ("v0.2.0 implementation", 2026-10-23)
- Complexity: S
- Estimated time: 1–2h
- Depends on: T1, T2, T3, T4, T5
- Can run in parallel with: —

## AI guidance

- `review-implementation`: this task's flow (a batched review of T1–T5).
- Global rules: branches and commits are the owner's; the agent never runs `git add` or `git commit`. Flag stale comments; never edit them.
- `AGENTS.md` trust invariants and "No network": the review checks them.

## Requirements

- The review covers every file in T1–T5's `git diff`, against the techspec (Rev 1.1) and `tasks.md` § [Changes to the techspec](tasks.md#changes-to-the-techspec).
- It checks, at least:
  - nothing under `helper/` or `src-tauri/src/sensors/` changed (`git diff --stat -- helper src-tauri/src/sensors` is empty);
  - no `<a href>`, no `style=` (other than the existing bar width), no `dangerouslySetInnerHTML`, no new URL;
  - no command takes a path; `labels.json` is built from `app_local_data_dir` only;
  - no new code comment and no test ID in code;
  - the M3 clear and the last-call checks are in each test file that mocks `../sensors/commands`;
  - the L4 close-before-rename and the L5 folder reset in `labels.rs`.
- Each finding is fixed in its task's files, or the owner decides it.
- **Stale comments for the owner** (not edited; the owner decides at review):
  1. `src-tauri/src/commands.rs:1` "The four Tauri commands" (six now);
  2. `src/styles/app.css:305` "at most ~350 px tall" (the padding is 520 px);
  3. `src/styles/app.css:298` "leave the cards about 450 px" (about 331 px at 1024×800 now; review L6);
  4. `src/cards/CardParts.tsx:101-104` "'All sensors' is the keyboard target" (the Motherboard card's link is "Name your fans"; review L6).
- The owner gets the commit list, built from `git status --short`: T1–T5's files, the v0.2.0 spec files, the session folders, and the files modified before T1 (on 2026-10-23: `specs/v0.1.0/requirements.md`, `specs/v0.2.0/README.md`, `specs/v0.3.0/README.md`, `sessions/20261021071727_pophood-oq1-oq2-closeout/decisions/0008-sensor-label-key-basis.md`). **Leave out** `sessions/20261023085728_pophood-v020-techspec/evidences/render-check/prototype/edge-profile/` (a headless Edge profile with `Login Data`; review L10).

## Files involved

| Path | Action |
|---|---|
| Every file in T1–T5's diff | Read; Modify only to fix a finding |
| `sessions/<yyyyMMddHHmmss>_pophood-v020-implementation-review/review.md` | Create (the review report) |
| `specs/v0.2.0/tasks.md`, this file | Modify (status, the commit hash) |

## Implementation steps

1. Run `review-implementation` on T1–T5 with the requirements above.
2. Fix the findings; re-run `npm test`, `npm run build` and `cargo test` after the fixes.
3. Give the owner the four stale comments and the commit list (with the left-out folder).
4. After the owner commits, record the commit hash in this file and in `tasks.md`.

## Acceptance Criteria

- `review.md` lists each finding with its fix or the owner's decision, quoted.
- After the fixes: `npm test`, `npm run build` and `cargo test` pass (output in `review.md`).
- `git diff --stat -- helper src-tauri/src/sensors` is empty (command output).
- The owner has the stale-comment list and the commit list; the commit hash is in `tasks.md`.

## Testing

- Not a test task: it re-runs the T1–T5 suites after the fixes. The release checks are T7 and T8.

## Additional relevant files

- `specs/v0.1.1/task_04.md` (the v0.1.1 review before the commit)
- `sessions/20261023112712_pophood-v020-techspec-review/review.md` (the techspec review: what was already checked)

## Task notes (2026-10-23)

- Report: `sessions/20261023150524_pophood-v020-implementation-review/review.md`. It has the checks, the 4 findings with the owner's answers, the stale comments, the suite output and the commit list.
- No Critical, High or Medium findings. Four Low findings:
  - **F1** (`labels.rs`: a file that is not valid UTF-8 was never moved aside, and saves were refused). Owner: "Apply now (Recommended)". **Applied** in T1's file.
  - **F2** (`tasks.md` didn't list the M1 fallback selector). Owner: "Apply now (Recommended)". **Applied.**
  - **F3** (a keyboard Reset probably drops the focus to `<body>`). Owner: "Proceed as-is (Recommended)". T7's E2E-22 records it.
  - **F4** (clippy `collapsible_if`, the same as the existing code). Owner: "Proceed as-is (Recommended)".
- After the fixes: `npm test` 277 pass, `npm run build` passes, `cargo test` 82 lib + 1 + 18 integration tests pass (1 ignored), and `git diff --stat -- helper src-tauri/src/sensors` is empty.
- Confidence: 94% before the fixes, 95% after.
- The owner has the stale-comment list and the commit list.
- The owner committed `e4e6a94e6ef3249056538a651c80d9899ada0f51` on `master` ("v0.2.0 implementation"): 37 files, with the F1 fix (`labels.rs` reads with `fs::read` + `serde_json::from_slice`). `git diff --stat 0861d8f e4e6a94 -- helper src-tauri/src/sensors` is empty. The `sessions/` folders are not in the commit (gitignored, as for v0.1.1); T7 uses them from the working tree.
