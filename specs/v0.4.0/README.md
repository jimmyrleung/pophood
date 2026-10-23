# Pophood v0.4.0: memory benchmark (slice 4)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 4 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.3.0](../v0.3.0/README.md): the test-runner seam, SQLite and traces.

## Goal

The owner runs the memory benchmark: read, write and copy bandwidth, plus latency.

## Requirements delivered

- **RF16**, with two variants (answer #31):
  - **quick:** all threads plus a 1 GiB latency test, about 3–4 s, used by "Run all";
  - **full:** adds per-CCD, single-thread and a latency ladder, about 17–19 s, used when run alone.
- **Budget:** ≤ 30 s (answer #32).

## Inherited from earlier versions

- **The P3 precedent:** `C:\Users\jimmy\pophood-probes\probe-bench\src\mem.rs`.
- **STREAM sizing:** each array ≥ 4× the total LLC (the 9900X has 2 × 32 MB L3).
- **Correctness pitfalls** (requirements, not tips):
  - use `black_box`, or the compiler deletes the loops;
  - take the timestamp from the last thread to reach the barrier;
  - `copy_from_slice` is not STREAM-conformant.

## Open questions for this techspec

- **Page size:** are the results 4 KB-page numbers? Large pages need SeLockMemoryPrivilege, which the app doesn't have.
- **Reporting:** all-core versus per-CCD. Record thread count and placement with each result.
- **Labelling** non-conformant results, in the UI and in the database.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 4 first.
- Every release re-runs the network audit (P5 method).
