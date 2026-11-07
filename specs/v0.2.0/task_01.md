# Task 1 - Core label store: `labels.rs`, two commands, `setup`

## Description

Add the core's label store: `src-tauri/src/labels.rs` keeps the labels in `%LOCALAPPDATA%\dev.pophood\labels.json` (a versioned JSON file at a fixed path, written atomically). Add the `load_labels` and `set_label` commands, and let `setup` manage the store. This is Sequence step 1.

- Status: Done
- Complexity: M
- Estimated time: 3–4h
- Depends on: —
- Can run in parallel with: T2

## AI guidance

- `implement-task`: this task's flow.
- `AGENTS.md` trust invariants: the app never runs elevated and the helper never sees labels. The new file sits in the app's own folder at a path fixed in Rust; no command takes a path from the UI. Nothing under `src-tauri/src/sensors/` changes, so the helper regression rule doesn't apply.
- Global rules: no code comments in new code; no test IDs in code. Keep the existing comment above `SensorService::start` in `lib.rs`. `commands.rs` line 1 ("The four Tauri commands") becomes wrong: don't edit it, T6 lists it for the owner.
- `AGENTS.md` "Conventions", Evidence: each pass/fail check has a negative control.

## Requirements

- `LabelStore` as in techspec § [Implementation map](techspec.md#implementation-map), "`src-tauri/src/labels.rs` (new)": the file format (`version` 1), load with move-aside to `labels.json.bad`, `writable: false` for an unreadable file or a failed move-aside, the key check (1–512 UTF-16 units) and the label check (1–40 UTF-16 units, no space at either end), the atomic write (`labels.json.tmp`, `sync_all`, `rename`), and the memory map changed only after the write succeeds.
- **Change from the techspec snippet (review L4):** in `write`, close the temp file before `fs::rename` (for example, write and `sync_all` inside a block, or `drop(out)`), so the rename never runs on an open handle.
- `load_labels` never fails; `set_label` returns `Result<(), String>` (techspec § Endpoints mapping).
- `setup` opens the store after `webview::build_main_window` (which creates the folder) and before `SensorService::start`.
- No capability file (app commands need none, `build.rs` has no app manifest).

## Files involved

| Path | Action |
|---|---|
| `src-tauri/src/labels.rs` | Create (the store and its tests) |
| `src-tauri/src/commands.rs` | Modify (two commands, one `use`) |
| `src-tauri/src/lib.rs` | Modify (`mod labels;`, `setup`, `generate_handler!`) |
| `src-tauri/src/webview.rs` (`app_local_data_dir`), `src-tauri/src/sensors/helper.rs` (`tests::temp_file`) | Read (patterns) |
| `src-tauri/Cargo.toml` | Read (`serde`, `serde_json` already there; `panic = "abort"` in release) |

## Implementation steps

1. Write `labels.rs` per techspec "`src-tauri/src/labels.rs` (new)", with the L4 change.
2. Add the two commands after `open_pawnio_site` per techspec "`src-tauri/src/commands.rs`".
3. `lib.rs`: `mod labels;`, the `setup` change and the two `generate_handler!` entries per techspec "`src-tauri/src/lib.rs`".
4. UT-40 in `labels.rs` (`#[cfg(test)] mod tests`). Each test has its own folder under `std::env::temp_dir()` named by the process id and the test name (the `helper.rs` pattern). **Review L5:** at the start of each test, remove that folder (`fs::remove_dir_all`, error ignored), then create it, so a folder left by an earlier run can't change the result.
5. Run `cargo test` and `cargo build` in `src-tauri`.
6. Update this file's Status and task notes, and the T1 row in `tasks.md`.

## Acceptance Criteria

- `cargo test` passes in `src-tauri`: UT-40 (a)–(g) and every existing test, IT-01…IT-17 included (test output).
- `cargo build` shows no new warning (build output).
- **Negative control:** remove the `!state.writable` check once → UT-40 (f) fails (the directory case writes or returns a different error). Revert. Record the output in the task notes.
- `git status --short` after the task shows no new path outside `labels.rs`, `commands.rs`, `lib.rs` and docs (compare with the list at the start of the task; nothing is committed before T6). `git status --short -- helper src-tauri/src/sensors` is empty.
- No code comment in `labels.rs` and no test ID anywhere in the code (`git grep -n "UT-4" -- src-tauri` is empty).

## Testing

- **UT-40** (techspec § Unit Tests): (a) no file, save, reopen; (b) clear; (c) the checks, with 40 × `a` and 20 × `😀` accepted as the negative control; (d) a bad file moved to `.bad` with the original bytes, then a save works; (e) `"version": 2`; (f) `labels.json` is a directory: refused saves, nothing moved; (g) `labels.json.tmp` is a directory: "could not write …", memory and file unchanged, after one successful save first.
- The IPC round trip (`invoke` → command → file) is E2E-28 (T8) and E2E-29 (T7).

## Additional relevant files

- `specs/v0.2.0/techspec.md` § Data models (`labels.json`, `LoadedLabels`), § Endpoints mapping, § Known Risks
- `sessions/20261023085728_pophood-v020-techspec/decisions/0036-v020-label-store.md` (ADR 0036)
- `sessions/20261023112712_pophood-v020-techspec-review/review.md` (L4, L5)

## Task notes (2026-10-23)

- `labels.rs`, `load_labels`, `set_label` and the `setup` change are in as the techspec shows them, with the L4 change (the temp file closes in an inner block before `fs::rename`).
- UT-40 is seven tests in `labels.rs` (a, b, c, d, e, f, g). Each starts with `remove_dir_all` (error ignored) then `create_dir_all` on its own folder (L5). Test names describe the behaviour; no test IDs in code.
- `cargo test`: 81 lib tests (7 new) and the integration tests pass (IT-01…IT-17, 18 run + 1 ignored). `cargo build`: no warning.
- **Negative control:** `if !state.writable` changed to `if false && !state.writable` → `never_overwrites_an_unreadable_file` FAILED (6 passed, 1 failed). Reverted; 7/7 pass.
- `git status --short -- helper src-tauri/src/sensors` is empty. No comment in `labels.rs`.
- **T6 review fix (F1, owner: "Apply now (Recommended)"):** `open` reads the file with `fs::read` + `serde_json::from_slice`. Before, `fs::read_to_string` sent a file that is not valid UTF-8 to the "could not read" path, so the app refused every save. Now that file is moved aside like any bad file. New test `moves_a_non_utf8_file_aside` (8 tests in all). It FAILED on the old code and passes now; `cargo test`: 82 lib tests and the integration tests pass.
