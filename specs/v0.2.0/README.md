# Pophood v0.2.0: rename any sensor (slice 2)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 2 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.1.0](../v0.1.0/techspec.md) and [v0.1.1](../v0.1.1/README.md) (the drill-down layout).

## Goal

The owner can rename any sensor in the full list and see the label on the cards and in the full list (G5). Renames persist per machine across restarts. "Reset to the default name" is included.

## Requirements delivered

- **RF13:** labels per machine, reset to default, no silent re-attach.
- **RF26:** inline rename in the drill-down.

## Inherited from earlier versions

- **The label key is `sensor_key = "{identifier}|{name}"`** (v0.1.0 `src-tauri/src/sensors/protocol.rs`; ADR 0008). It is unique in all 6 P1 dumps.
- **The drill-down screen** (`src/pages/SensorList.tsx`, v0.1.1 layout) has the space for the rename form: one row along the bottom of the full-width detail panel (v0.1.1 mockup `specs/v0.1.1/ui-proposal/mockups/MotherboardTop.dc.html`). The copy is from mockup E2 (`specs/v0.1.0/ui-proposal/mockups/sensors-motherboard.dc.html`): "Display name", "Save name", "Reset to “Fan #2”", and the caption "Shows on the dashboard, in this list and in run traces. Saved on this PC only." Saving an empty name, or the default name, clears the rename.
- **The detail panel sticks at the top** in windows at least 800 px tall, with a 360 px focus scroll padding sized for the v0.1.1 panel (273–348 px, [v0.1.1 techspec](../v0.1.1/techspec.md)). The form adds a row to it: re-measure the panel and adjust the threshold and the padding.

## Handed over from v0.1.0

- **The motherboard card footer:** change the link from "All sensors" to "Name your fans" (mockup E1).
- **Renamed rows** show "{label} · {default}" ("CPU fan · Fan #1").

## Open questions for this techspec

- **Where labels persist.** SQLite only arrives in v0.3.0. Choose between a small JSON file in `%LOCALAPPDATA%\dev.pophood` (migrated in v0.3.0) and bringing SQLite forward.
- **Orphaned labels (ADR 0008):** how a label whose sensor disappeared, or changed name or type, is shown and cleared.
- **Who applies labels:** the core, in `UiFrame`, or the UI. v0.3.0 traces need labels too.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 2 first.
- Every release re-runs the network audit (`scripts/audit-network.ps1`, P5 method).
