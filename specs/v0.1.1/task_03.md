# Task 3 - Version 0.1.1, the README status line and the notices line

## Description

The app goes to 0.1.1. The helper stays 0.1.0, so its hash and its elevated evidence stay valid (Q&A #3). This is Sequence step 3. It comes last of the code tasks, so that T2's `tauri dev` runs keep one version. After T4's review, the owner commits.

- Status: Done (2026-10-22)
- Complexity: S
- Estimated time: 1h
- Depends on: T2 (order only: no code dependency)
- Can run in parallel with: —

## AI guidance

- `implement-task`: this task's flow.
- `AGENTS.md` "Build notes": rebuilding the helper changes the hash compiled into `pophood.exe`. This task never runs `npm run build:helper`.
- Global rules, "Git branches and commits": `npm version` runs with `--no-git-tag-version`, so it makes no commit and no tag.

## Requirements

- The app's version is `0.1.1` in `package.json`, both places in `package-lock.json` (the root and `packages[""]`), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and the `pophood` entry of `src-tauri/Cargo.lock`.
- `THIRD-PARTY-NOTICES.md` line 3 says "Pophood 0.1.1 is built from source…" (owner: "Bump it to 0.1.1 (Recommended)", techspec Q&A #7). The rest of the file doesn't change.
- `README.md` has the techspec's new status line.
- The About test expects `0.1.1`.
- `helper/PophoodSensors.csproj` keeps `<Version>0.1.0</Version>`. Nothing under `helper/` changes.

## Files involved

| Path | Action |
|---|---|
| `package.json`, `package-lock.json` | Modify (`npm version 0.1.1 --no-git-tag-version`) |
| `src-tauri/tauri.conf.json` | Modify |
| `src-tauri/Cargo.toml` | Modify |
| `src-tauri/Cargo.lock` | Modify (by `cargo check`) |
| `THIRD-PARTY-NOTICES.md` | Modify (line 3 only) |
| `README.md` | Modify (the status line) |
| `src/pages/SensorList.test.tsx` | Modify (the About test) |
| `src/pages/About.tsx` | Read (it shows `pkg.version` and the notices file) |
| `helper/PophoodSensors.csproj` | Read only |

## Implementation steps

1. `npm version 0.1.1 --no-git-tag-version` in the repo root (techspec § Implementation map, the `package.json` row).
2. `"version": "0.1.1"` in `src-tauri/tauri.conf.json`, and `version = "0.1.1"` in `src-tauri/Cargo.toml`.
3. `cargo check` in `src-tauri`, so `Cargo.lock` says 0.1.1 before the commit.
4. `THIRD-PARTY-NOTICES.md` line 3: "Pophood 0.1.0" → "Pophood 0.1.1".
5. `README.md`: the status line from techspec § Implementation map ("`README.md`", Before / After).
6. `src/pages/SensorList.test.tsx`, the About test: `toContain("0.1.1")`.
7. Run `npm test` and `npm run build`.
8. Update this file's Status and task notes, and the T3 row in `tasks.md`.

## Acceptance Criteria

- `git diff` of `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` shows only `0.1.0` → `0.1.1` lines: one in `package.json`, two in `package-lock.json`, one in `tauri.conf.json`, one in `Cargo.toml`, and the `pophood` entry in `Cargo.lock`.
- `git diff THIRD-PARTY-NOTICES.md` changes only "Pophood 0.1.0" to "Pophood 0.1.1".
- `git diff -- helper` is empty, and `helper/PophoodSensors.csproj` still has `<Version>0.1.0</Version>`.
- `npm test` passes (the About test finds 0.1.1); `npm run build` passes; `cargo check` exits 0 (output).
- `README.md` line 5 equals the techspec's "After" line.

## Testing

- **About** (updated): the "Versions" region contains `0.1.1`.
- **No integration test here:** nothing under `src-tauri/src/` changes, and `cargo check` proves the manifest and the lock. `cargo test` with the ITs runs on the release clone in T5, because `Cargo.toml` changed.
- The release file versions (`ProductVersion` 0.1.1 for the app, 0.1.0 for the helper) are E2E-23 in T5.

## Additional relevant files

- `specs/v0.1.1/techspec.md` § Implementation map (the version rows), § Key Decisions ("App 0.1.1, helper stays 0.1.0")
- `sessions/20261022171503_pophood-v011-techspec/owner-decisions.md` (Q&A #3)

## Task notes (2026-10-22)

- Done: `npm version 0.1.1 --no-git-tag-version`; `tauri.conf.json`; `Cargo.toml`; `cargo check` updated `Cargo.lock`; `THIRD-PARTY-NOTICES.md` line 3; the README status line; the About test expects 0.1.1.
- `git diff --stat` for the version files: 8 changed lines in 7 files, all 0.1.0 → 0.1.1 or the README line. Nothing under `helper/` or `src-tauri/src/` changed.
- `npm test`: 13 files, 250 tests passed. `npm run build`: passed. `cargo test` in `src-tauri`: passed (74 + 1 + 18 tests; 1 ignored, which is IT-10 and runs in T5).
