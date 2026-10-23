# Pophood v0.7.0: "Run all" (slice 7)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 7 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** v0.3.0–v0.6.0, the four benchmarks.

## Goal

The owner clicks "Run all" and gets one saved run covering CPU → memory (quick) → GPU → disk, in about 5 minutes (G3).

## Requirements delivered

- **RF19:** "Run all", with a budget of ≤ 5 min. The estimate is about 4.2 min (answer #32).
- **Pre-run background-load check:** it warns but never blocks.
- **RF21:** partial runs are kept and marked, and the failed or cancelled test records its reason.

## Inherited from earlier versions

- **The run-all progress panel** was mocked in E1 (`runAll: true`). It shows the step, sub-step, time left, a progress bar, completed steps, and Cancel.
- **The header button** reads "Run all · about 4 min".

## Open questions for this techspec

- **The load check:** what counts as background load, and the threshold.
- **The time-left estimate:** how it's computed while tests run.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 7 first.
- Every release re-runs the network audit (P5 method).
