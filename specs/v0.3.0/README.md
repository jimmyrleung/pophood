# Pophood v0.3.0: CPU benchmark, saved runs (slice 3)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 3 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.1.0](../v0.1.0/techspec.md) and [v0.2.0](../v0.2.0/README.md).

## Goal

The owner runs the CPU benchmark and sees the 7-Zip multi-thread and single-thread ratings. The result is saved as a run with a 250 ms sensor trace and appears in a basic run list.

## Requirements delivered

- **RF4 caller:** 250 ms sampling during a run.
- **RF14:** `7za.exe` is hash-verified before every run, against a hash kept in the repo.
- **RF15:** `7za b` and `7za b -mmt1`; the `Tot:` MIPS line.
- **RF19:** the single-test path.
- **RF20:** the reduced-sensors warning and flag.
- **RF21:** cancel, and partial runs.
- **RF22:** SQLite run storage, a subset.
- **RF27:** the benchmark screen, partly.
- **This slice introduces:** SQLite persistence, tool hash verification, the reduced-sensors warning, and cancel.

## Inherited from earlier versions

- **`set_period`** is already in pipe schema v1 (v0.1.0, answer #40). `SensorService` gains a `set_period` caller. No schema change is needed.
- **Frames carry their own `t`** and `sensor_key`, which is what the trace needs.
- **The CPU timing precedent:** 7-Zip takes about 32 s (spike F9).
- **Sensor labels** live in `%LOCALAPPDATA%\dev.pophood\labels.json` (`{"version": 1, "labels": {sensor_key: label}}`), written by the core's `src-tauri/src/labels.rs` (v0.2.0, ADR 0036). Traces store keys, so labels can still be applied at display time.

## Handed over from v0.1.0

- Show the "Run one test" button (and later "Run all") on the Dashboard header, and the **Runs** nav item. v0.1.0 hides them.

## Open questions for this techspec

- **The test-runner seam** (C8, the second of the two seams): "run, report progress, return a result".
- **Who owns the database:** rusqlite, sqlx or tauri-plugin-sql. Plus the schema and migrations from day one (requirements "Database Changes"). The DB lives under `%LOCALAPPDATA%\dev.pophood`. It also decides whether `labels.json` moves into the DB (read version 1, then retire or keep the file).
- **The benchmark setup screen** behind "Run one test". It wasn't mocked; see the UI proposal's "Not mocked" list.
- **Where 7-Zip lives:** `7za.exe` 26.04 as a sidecar or as a resource; its hash goes in the repo (answer #21).
- **Recording bytes written** with each run (requirements Side effects): an option only.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 3 first.
- Every release re-runs the network audit (P5 method).
