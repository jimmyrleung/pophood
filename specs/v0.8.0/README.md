# Pophood v0.8.0: Runs page (slice 8, completes the agreed v1)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 8 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** v0.3.0–v0.7.0, the saved runs.

## Goal

The owner compares 2 or more runs on the Runs page, and can relabel, delete or export a run (G4).

## Requirements delivered

- **RF23:** relabel and delete; deleting removes the trace too.
- **RF24:** export to JSON or CSV through a save dialog. Serial numbers are stripped by default (answer #23).
- **RF28:** a run list with flags, multi-select, per-test bar charts with % difference, and overlaid traces matched by `sensor_key`.

## Inherited from earlier versions

- **Mockup E3** (`ui-proposal/mockups/runs.dc.html`):
  - the first ticked run is the baseline;
  - differences within ±1% show as "≈ same";
  - bars point right for "better", including lower-is-better metrics;
  - the disk section lists all 8 profiles;
  - reduced and partial flags are told apart by border style.
- **`sensor_key`** (v0.1.0) matches sensors across runs. Elevated-only sensors have no trace in unprivileged runs (ADR 0008).

## Open questions for this techspec

- **Comparing 3 or more runs:** extra value columns, or one table per pair against the baseline (UI proposal, open question 3).
- **The save dialog:** a Tauri dialog plugin (a new capability) or a Win32 dialog.
- **The relabel, delete-confirm and export flows**, which weren't mocked.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 8 first.
- Every release re-runs the network audit (P5 method).
