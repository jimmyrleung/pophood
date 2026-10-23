# Pophood v0.1.1: drill-down layout (a patch before slice 2)

- **Status:** design chosen ([UI proposal](ui-proposal/ui-proposal.md)); [techspec](techspec.md) written and reviewed 2026-10-22 (Rev 1.3); [tasks](tasks.md) written 2026-10-22 (6 tasks); **signed off by the owner 2026-10-23** at commit `0861d8f`. T1–T6 are done: `npm test` (251), `cargo test` (with `--ignored`) green; every agent and owner E2E part passed (E2E-12, 21, 22, 23, 27, and E2E-15 run 2 `OVERALL: PASS`); PERF-02 recorded (CPU drill-down p95 5.53 ms against 8.6 ms in v0.1.0). The helper stays `553A7F49…`. Report: `sessions/20261023055425_pophood-v011-release/qa.md`. Next: v0.2.0.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md) and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.1.0](../v0.1.0/techspec.md).
- **Owner decisions:** verbatim in [sessions/20261022163940_pophood-v011-drilldown-design/owner-decisions.md](../../sessions/20261022163940_pophood-v011-drilldown-design/owner-decisions.md).
- **Why a patch, and why now:** it adds no capability, so it is a patch, not a slice. It goes before v0.2.0 because v0.2.0 puts the rename form into the drill-down; changing the drill-down after that would build the form twice.

## Goal

The owner opens a drill-down and sees every sensor of the component with little scrolling and no unused space: one card per sensor type, flowing in columns across the window, with the selected sensor's 10-minute chart full width at the top. In reduced mode, the page says why values are missing.

## Requirements delivered

- **RF26 (layout revised):** the full sensor list for a component, with live values. The inline rename stays in v0.2.0.
- **UX "Reduced mode has to look intentional"**, now on the drill-down too: the reduced-sensors banner, and locked groups that say "Needs full sensors" or "Needs PawnIO" instead of a column of "—". The UI owns that copy and never rewrites a value (RF3; AGENTS.md).

## Design

The [v0.1.1 UI proposal](ui-proposal/ui-proposal.md), variant B. It replaces mockup E2's list-and-detail layout.

## Inherited from v0.1.0

- `src/pages/SensorList.tsx` (the page), `src/charts/LineChart.tsx` (`DetailChart`), `src/styles/app.css` (the `.drill`, `.list`, `.row`, `.detail` and `.stats` rules).
- `src/cards/fields.ts`: `componentScope`, `drillSections`, the group order and labels (UT-34), and `lockFor`, the lock rule the dashboard cards use. `lockFor` is private today.
- `src/shell/StatusBanner.tsx`: the reduced-sensors banner, shown on the Dashboard only today.
- The history store already keeps 10 minutes for every sensor (`src/sensors/history.ts`), so the chart needs no new data.
- Techspec rows that change: `SensorList.tsx` and `app.css` (drill-down), E2E-12 (drill-down), E2E-21 (minimum window: "list and detail side by side" no longer applies), E2E-22 (the "Sensor list" and "Sensor detail" landmarks stay).

## Handed over to v0.2.0

- The rename form goes in one row along the bottom of the detail panel (mockup `MotherboardTop.dc.html`). Its copy is unchanged from mockup E2.
- The form makes the sticky panel taller: v0.2.0 re-measures the panel against the 800 px sticky threshold and the 360 px focus padding ([techspec](techspec.md), Known Risks).

## Out of scope

- A sparkline on every row: the CPU page would redraw 95 SVG paths every second (PERF-02).
- Groups that collapse, and remembering that state.
- Any change to the Dashboard.

## Open questions for this techspec (answered)

Answered in the [techspec](techspec.md#open-questions-from-the-scope-stub-disposition) (owner answers in its Q&A record):
- **The sticky panel in a short window:** sticky only when the window is at least 800 px tall (measured: 348 px panel at 1024×680, 273 px at 1917×1029), plus a scroll padding so keyboard focus never hides under it.
- **The banner on the drill-down:** `StatusBanner` with all its states.
- **The lock rule:** neither: `drillSections` returns a `lock` per group, through the private `lockFor` and a needs table that mirrors `helper/Availability.cs`.
- **The version bump:** the app goes to 0.1.1 (`package.json` and its lock, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock`, the README status line, line 3 of `THIRD-PARTY-NOTICES.md`, the About test). The helper stays 0.1.0, so its hash and elevated evidence stay valid.

## Before the techspec

- The umbrella requirements cover this patch through RF26 and the UX section; no `define-reqs` run is needed unless the techspec finds a gap.
- The change is UI-only, so the helper regression rule (AGENTS.md: changes under `helper/` or `src-tauri/src/sensors/`) doesn't apply.
- Every release re-runs the network audit (P5 method, `scripts/audit-network.ps1`).
