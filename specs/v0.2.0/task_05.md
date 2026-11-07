# Task 5 - Version 0.2.0, the README status line, the AGENTS.md line

## Description

Bump the app to 0.2.0 (the helper stays 0.1.0), update the README status line and the notices line, and add the AGENTS.md trust line for the new data file. This is Sequence step 5, the last code step, so that T4's `tauri dev` runs keep one version.

- Status: Done
- Complexity: S
- Estimated time: 1h
- Depends on: T4 (order only)
- Can run in parallel with: —

## AI guidance

- `implement-task`: this task's flow.
- `AGENTS.md` "Build notes": `helper/PophoodSensors.csproj` stays `<Version>0.1.0</Version>`; a helper rebuild would change its hash.
- `AGENTS.md` "Spec & doc updates" (global rules): keep the sibling docs consistent.

## Requirements

- 0.2.0 in `package.json`, `package-lock.json` (`npm version 0.2.0 --no-git-tag-version`), `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` (`cargo check` in `src-tauri` updates the lock: only the `pophood` entry changes).
- `THIRD-PARTY-NOTICES.md` line 3: "Pophood 0.2.0 is built from source…".
- The About test (`SensorList.test.tsx`, ≈:249, per the review) expects 0.2.0.
- `README.md` line 5 per techspec "`README.md`" (re-read the line first; if it differs, change only the version, the description and the link).
- **AGENTS.md**, a new bullet under trust invariants → **Privilege**, with the owner-approved L7 wording ("Accept all three (Recommended)"):

  ```markdown
  - The core writes one data file, `labels.json` (with `labels.json.tmp` and `labels.json.bad`), in `%LOCALAPPDATA%\dev.pophood`, at a fixed path (`src-tauri/src/labels.rs`). No command takes a path or file name from the UI.
  ```

- No other place says 0.1.1 after the change (the review's grep list: `package.json:4`, `package-lock.json:3,9`, `Cargo.toml:3`, `Cargo.lock`, `tauri.conf.json:4`, `THIRD-PARTY-NOTICES.md:3`, `SensorList.test.tsx`, `README.md:5`).

## Files involved

| Path | Action |
|---|---|
| `package.json`, `package-lock.json` | Modify (`npm version`) |
| `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | Modify |
| `THIRD-PARTY-NOTICES.md` | Modify (line 3) |
| `src/pages/SensorList.test.tsx` | Modify (the About version) |
| `README.md` | Modify (line 5) |
| `AGENTS.md` | Modify (one bullet) |
| `helper/PophoodSensors.csproj` | Read (stays 0.1.0) |

## Implementation steps

1. `npm version 0.2.0 --no-git-tag-version`.
2. `tauri.conf.json` and `Cargo.toml` to 0.2.0; `cargo check` in `src-tauri`.
3. The notices line, the About test, the README line, the AGENTS.md bullet.
4. `git grep -n "0\.1\.1" -- src src-tauri scripts package.json package-lock.json README.md THIRD-PARTY-NOTICES.md ':!src-tauri/Cargo.lock'` (the lock holds third-party crates at 0.1.1; its `pophood` entry is checked by the `git diff` AC) → every remaining hit names v0.1.1 as history (for example the `app.css` heading "v0.1.1 UI proposal"), never as the current version.
5. Run `npm test` and `npm run build`.
6. Update this file's Status and task notes, and the T5 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes, with the About test expecting 0.2.0 (vitest output).
- `npm run build` and `cargo check` pass.
- `git diff src-tauri/Cargo.lock` changes only the `pophood` package version.
- The step 4 grep shows no hit that states the current version.
- `helper/PophoodSensors.csproj` still has `<Version>0.1.0</Version>` (`git diff --stat helper` is empty).

## Testing

- The About test (updated). E2E-23 (T7) checks the built files' versions and the About page.
- No new test: the rest is text in docs and version fields.

## Additional relevant files

- `specs/v0.1.1/task_03.md` (the v0.1.1 bump)
- `specs/v0.2.0/tasks.md` § Review findings (L7)

## Task notes (2026-10-23)

- 0.2.0 in `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`; `cargo check` changed only the `pophood` entry of `Cargo.lock` (`git diff -U0` shows one line pair).
- `THIRD-PARTY-NOTICES.md` line 3, `README.md` line 5, the About test and the `AGENTS.md` bullet (L7 wording) are done.
- The step 4 grep: the only 0.1.1 hits are `app.css:302`, `app.css:309` and `tokens.css:1`, all history references.
- `npm test` (277), `npm run build` and `cargo check` pass. `git status --short -- helper src-tauri/src/sensors` is empty; `helper/PophoodSensors.csproj` is untouched.
