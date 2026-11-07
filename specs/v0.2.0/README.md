# Pophood v0.2.0: rename any sensor (slice 2)

- **Status:** requirements written ([requirements.md](requirements.md), 2026-10-23, 93%) and techspec written ([techspec.md](techspec.md), 2026-10-23, 94%; reviewed at 92%); tasks written ([tasks.md](tasks.md), 8 tasks, 2026-10-23, 92%). Implementation (T1) comes next. Where they differ from this stub, the techspec and the requirements win: they hold the owner's answers.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 2 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.1.0](../v0.1.0/techspec.md) and [v0.1.1](../v0.1.1/README.md) (the drill-down layout).

## Goal

The owner can rename any sensor in the full list and see the label on the Motherboard card's fan rows and in the full list (G5). Renames persist per machine across restarts. "Reset to the default name" is included.

## Requirements delivered

- **RF13:** labels per machine, reset to default, no silent re-attach.
- **RF26:** inline rename in the drill-down.

## Inherited from earlier versions

- **The label key is `sensor_key = "{identifier}|{name}"`** (v0.1.0 `src-tauri/src/sensors/protocol.rs`; ADR 0008). It is unique in all 6 P1 dumps.
- **The drill-down screen** (`src/pages/SensorList.tsx`, v0.1.1 layout) has the space for the rename form: one row along the bottom of the full-width detail panel (v0.1.1 mockup `specs/v0.1.1/ui-proposal/mockups/MotherboardTop.dc.html`). The copy is from mockup E2 (`specs/v0.1.0/ui-proposal/mockups/sensors-motherboard.dc.html`): "Display name", "Save name", "Reset to “Fan #2”", and the caption "Shows on the dashboard and in this list. Saved on this PC only." ("in run traces" is dropped until v0.3.0; owner, requirements Q&A #5). Saving an empty name, or the default name, clears the rename.
- **The detail panel sticks at the top** in windows at least 800 px tall, with a 360 px focus scroll padding sized for the v0.1.1 panel (273–348 px, [v0.1.1 techspec](../v0.1.1/techspec.md)). The form adds a row to it: re-measure the panel and adjust the threshold and the padding.

## Handed over from v0.1.0

- **The motherboard card header link** reads "Name your fans" instead of "All sensors" (owner, requirements Q&A #4; mockup E1's footer link is not used).
- **Renamed rows** show "{label} · {default}" ("CPU fan · Fan #1").
- **The Motherboard drill-down subline** ends with "· generic names until you rename them" (v0.1.0 techspec, mockup corrections; owner, Q&A #7).

## Open questions for this techspec

All closed in the [techspec](techspec.md#open-questions-from-the-requirements-disposition) (ADR 0036):

- **Where labels persist** (OQ-A): `%LOCALAPPDATA%\dev.pophood\labels.json`, a versioned JSON file written by the core; v0.3.0 owns its move into SQLite.
- **Who applies labels** (OQ-B): the UI, at render. Nothing under `src-tauri/src/sensors/` changes.
- **A bad file** (OQ-C) is moved aside to `labels.json.bad`; **Reset** with no label is shown but disabled (OQ-D); **renaming while stale** is allowed (OQ-E).
- **The sticky panel:** still from 800 px tall; the focus padding grows to 520 px.
- **Orphaned labels:** kept and shown nowhere in v0.2.0 (owner, requirements Q&A #3; amends ADR 0008).

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 2 first.
- Every release re-runs the network audit (`scripts/audit-network.ps1`, P5 method).
