# Requirements - Pophood v0.2.0: rename any sensor (slice 2)

- **Date:** 2026-10-23 · **Mode:** feature integration (owner: "Feature integration (Recommended)")
- **Umbrella:** [v0.1.0/requirements.md](../v0.1.0/requirements.md) (RF13, RF26, G5, slice 2). This doc details slice 2 only; the umbrella stays the source for everything else.
- **Scope stub:** [README.md](README.md). **Builds on:** v0.1.0 ([techspec](../v0.1.0/techspec.md)) and v0.1.1 ([techspec](../v0.1.1/techspec.md), the drill-down layout).
- **Next:** techspec written ([techspec.md](techspec.md), 2026-10-23); it closes OQ-A to OQ-E (ADR 0036). Tasks written ([tasks.md](tasks.md), 2026-10-23); its test plan drops the "E2E-27 with a 40-character label" mitigation (owner, L2).
- **Rev 2 (2026-10-23):** an adversarial review (separate Opus agent) scored Rev 1 at ≈89% and found 14 items (F1–F14); the owner accepted all of them (Q&A #10, #11). The fixes are in place below.

## Overview

LHM gives the motherboard's sensors generic names ("Fan #1", "Voltage #3"; spike F3), so the owner can't tell which fan is the CPU fan. v0.2.0 lets the owner give any sensor a display name in the drill-down, keeps it on this PC across restarts, and shows it in the drill-down and on the Motherboard card's fan rows. "Reset to the default name" undoes it. The audience is the owner (G5); the value is a dashboard that speaks the owner's words without changing what Pophood reads.

## Goals

- **G5 met:** the owner names the motherboard fans once, and the names are still there after an app restart, a reboot and an elevation change.
- **Success criteria (slice done-when):**
  - [ ] In any drill-down, the owner selects a sensor, types a name and saves it (button or Enter). The row shows "{label} · {default}", the detail panel shows the label, and the Motherboard card's fan row shows the label.
  - [ ] "Reset to “{default}”" removes the name everywhere. Saving an empty name or the default name does the same.
  - [ ] Names survive an app restart, a reboot, and a switch between reduced and full sensors.
  - [ ] A name applies only to the sensor with exactly the same `sensor_key`. A sensor that is absent (reduced mode, removed hardware, renamed by an LHM bump) keeps its name stored and shows it on nothing else.
  - [ ] The Motherboard card's header link reads "Name your fans"; the Motherboard drill-down subline ends with "· generic names until you rename them".
  - [ ] The sticky detail panel, now taller, still never hides a focused row (v0.1.1 AC-03 holds after the re-measure), and at 1024×800 the stuck panel, form included, fits in the window.
  - [ ] Trust baseline unchanged: no helper change, no new network flow (E2E-15 re-run), the app still never runs elevated.
- **Metrics:** a save or reset shows on the next render on both pages, without waiting for a frame. PERF-02 is recorded again and compared with v0.1.1 (drill-down p95 5.53 ms, Dashboard p95 4.53 ms); as in v0.1.1 it has no pass threshold, and a rise above v0.1.1 is explained in the QA report.
- **Business goal:** the second vertical slice of the agreed v1; it also gives v0.3.0 (traces) and v0.8.0 (Runs page) the label data they will show.

## Confidence score

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Requirements clarity | 40% | 94 | RF13, RF26, G5 and slice 2 in the umbrella; the scope stub; mockups E1, E2 and the v0.1.1 rename row; 11 owner answers this session (Q&A below); the review's gaps (F1 draft safety, F3 store version, F4 over-40 rule, F6 umbrella wording, F11 edge cases) are now requirements. −6: the persistence mechanism and the save-failure copy are left to the techspec. |
| Codebase understanding | 40% | 93 | Read end to end: `SensorList.tsx`, `SensorList.test.tsx`, `fields.ts`, `CardParts.tsx`, `MotherboardCard.tsx`, `DashboardCard.tsx`, `store.ts`, `StoreProvider.tsx`, `protocol.ts`, `commands.ts`, `theme.ts`, `App.tsx`, `commands.rs`, `lib.rs`, `events.rs`, `webview.rs`, `Cargo.toml`, `tauri.conf.json`, `package.json`, ADR 0008. The review re-checked every `file:line` and re-ran the caller counts (all matched) and added the missed consumers (F2, F5, F8, F9, F10). −7: `app.css` read only around the drill-down rules; `LineChart.tsx` and the E2E scripts read in part; nothing was run. |
| Change-path clarity | 20% | 90 | Every touch point below has a `file:line` and a caller count. −10: two valid paths (UI-owned vs core-owned labels) until the techspec picks one; they touch different files. |
| **Total** | | **93%** | 0.4 × 94 + 0.4 × 93 + 0.2 × 90 = 92.8. Rev 1 was 93.2 by the author and ≈89.2 by the review; Rev 2 closes the review's items. |

- **Effective threshold:** 90% to advance a phase (AGENTS.md, memory note). 93% ≥ 90%: the techspec can start.
- **What the uncertainty blocks:** nothing in this doc. The techspec must close the persistence choice (OQ-A) before tasks.
- **Next checks (techspec):** read the rest of `app.css` and `history.ts`; measure the panel with the form at 1917×1029 and 1024×680; decide OQ-A to OQ-D.

## Similar features / examples

| Need | Example to follow | Where |
|---|---|---|
| A small per-machine preference with guarded storage | The theme override: `localStorage` key `pophood.theme`, every access in `try/catch`, in-memory fallback | `src/theme/theme.ts:5-33` |
| A `useSyncExternalStore` store with listeners | The sensor store; the theme's `useTheme` | `src/sensors/store.ts:27-125`, `src/theme/theme.ts:51-97` |
| A UI → core command | `enable_full_sensors`, `retry_sensors`, `open_pawnio_site` (thin wrappers, no capability files) | `src/sensors/commands.ts:3-6`, `src-tauri/src/commands.rs:13-38`, `src-tauri/src/lib.rs:79-84` |
| The label key | `sensor_key(id, name)` = `"{id}\|{name}"`; already on every `UiSensor` as `key` | `src-tauri/src/sensors/protocol.rs:151-155`, `src-tauri/src/sensors/events.rs:78-79,108`, `src/sensors/protocol.ts:65-66` |
| The app's local data folder | `app.path().app_local_data_dir()` = `%LOCALAPPDATA%\dev.pophood` (created at start) | `src-tauri/src/webview.rs:34,75` |
| The rename form layout and copy | One row at the bottom of the top panel: label, input, Save name, Reset to “{default}”, caption | `specs/v0.1.1/ui-proposal/mockups/Main.dc.html:96-104` |
| Renamed row: "{label} · {default}" | Muted 12 px default after the label | `specs/v0.1.1/ui-proposal/mockups/Main.dc.html:123` |
| Fan row on the Motherboard card | `FanRow.name` | `src/cards/fields.ts:42-48,490,502`, `src/cards/MotherboardCard.tsx:18` |
| Drill-down tests (store + render + frames) | `setup()`, `send()`, the `pressedRow`/`detail` helpers | `src/pages/SensorList.test.tsx:14-42` |
| LHM's own rename store (precedent only, never used: the helper has no persisting `ISettings`) | `{sensorId}/name` | LHM `Sensor.cs#L63,L96-L104` (umbrella "Similar features") |

## Entrypoints

| Entry | Where | What changes |
|---|---|---|
| Drill-down page | `src/pages/SensorList.tsx:81` (`SensorList`), `:31` (`SensorDetail`) | Rename form in the detail panel; label in rows and heading; Motherboard subline |
| Motherboard card | `src/cards/MotherboardCard.tsx:10`, model `src/cards/fields.ts:448` (`motherboardCard`) | Fan rows show the label; header link text |
| Card header link | `src/cards/CardParts.tsx:105-127` (`Card`, the "All sensors" button) | Per-card link text ("Name your fans" on the Motherboard card) |
| UI → core commands (if the core owns labels) | `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs:79-84` | New commands to read, save and clear labels |
| App start | `src/sensors/StoreProvider.tsx:4-21`, `src/App.tsx:32-38` | Labels load once at start (mechanism per OQ-A) |

## Execution flow

**Today (v0.1.1):** core → `UiFrame` (each sensor with `name` and `key`) → `store.ts` → `SensorList` shows `sensor.name` in rows (`SensorList.tsx:165`), the heading (`:49`) and the chart label (`:75`); `buildDashboard` puts `f.name` on fan rows (`fields.ts:490,502`). Names are LHM's, always: the helper keeps LHM's in-memory default settings, so LHM never renames anything.

**Expected (v0.2.0):**
1. **Start:** the labels (a map `sensor_key → label`) load once from the label store on this PC (mechanism: OQ-A). A read failure leaves the map empty and the app usable (see RF13.8).
2. **Every frame:** nothing new crosses the pipe. For display, the UI looks up each sensor's `key` in the map: a hit shows the label; a miss shows LHM's name. Values, keys, history and selection never change.
3. **Rename:** the owner selects a row → the panel shows the form (input = current label, placeholder = default name) → types → Save name or Enter → the label is trimmed and checked (RF13.4) → stored under the key the text was typed for (RF26.2) → the map updates → rows, heading and fan rows re-render.
4. **Reset:** "Reset to “{default}”" (or saving empty / the default) removes the entry → LHM's name shows again.
5. **Absent sensor:** its entry stays in the map and is shown nowhere. When the exact same key comes back (for example after "Enable full sensors"), the label shows again.

## Scope

**In scope:**
- RF13 (labels per machine, reset, no silent re-attach) and RF26's inline rename, as detailed below.
- The two items handed over from v0.1.0: the "Name your fans" link and the Motherboard subline.
- The re-measure of the sticky panel (800 px threshold, 360 px focus padding) with the form in it.
- The version bump to 0.2.0 and the release checks (E2E-15 and the drill-down E2E rows).

**Out of scope:**

| Item | Why |
|---|---|
| Labels on fixed card role labels ("Package temperature", "Load") and in the history legend | Owner: "Fan rows only (Recommended)". Role labels name a role, not a sensor. |
| Any UI for orphaned labels (absent sensors) | Owner: "Keep, no UI yet (Recommended)". Amends ADR 0008's "shown as orphaned" for v0.2.0. |
| Labels in run traces | No runs until v0.3.0; the caption drops "run traces" (owner: "Drop \"run traces\" for now (Recommended)"). |
| Hiding or reordering sensors | Umbrella answer #6: "Rename any sensor" (no hiding or reordering); Q6b is v2. |
| Unique labels | Owner: "Trim, max 40, dupes OK (Recommended)". |
| A confirm before discarding a typed name | Owner: "Discard silently (Recommended)". |
| Any helper or pipe-schema change | The key is already on every `UiSensor`; labels never reach the helper. |
| SQLite | Arrives in v0.3.0, unless the techspec brings it forward (OQ-A). |
| Export or import of labels | Not asked for; RF24 export is v0.8.0. |

## User experience

- **Audience:** the owner, who tunes the PC and wants to know which fan header is which (G5, workflow "name the motherboard fans").
- **Workflow:** Dashboard → Motherboard card "Name your fans" → Motherboard drill-down (subline says the names are generic) → click "Fan #1" → type "CPU fan" → Enter → the row reads "CPU fan · Fan #1" → back on the Dashboard the fan row reads "CPU fan".
- **UI/UX requirements:**
  - The form is one row along the bottom of the full-width detail panel (v0.1.1 mockup `MotherboardTop.dc.html`), on every drill-down, not only the Motherboard.
  - Copy (mockup E2, with the owner's caption change): "Display name"; the input's placeholder is the default name; **Save name**; **Reset to “{default}”**; caption "Shows on the dashboard and in this list. Saved on this PC only."
  - Rows: "{label} · {default}", the default in the muted 12 px style. Unrenamed rows are unchanged.
  - The detail heading shows the label; the default stays visible in the Reset button and the row. The chart's accessible name uses the shown name.
  - Motherboard card: fan rows show the label alone (mockup E1: "CPU fan"); the header link reads "Name your fans"; other cards keep "All sensors".
  - Motherboard drill-down subline: "{board} · {chip} · {n} sensors · generic names until you rename them". Other drill-downs unchanged.
- **Accessibility (umbrella basics):**
  - A real `<label for>` on the input; Save, Reset and the input reachable with Tab; the 2 px focus ring.
  - The result of a save or reset is visible as text (the row and heading change), not by colour alone. A save failure is shown as text next to the form.
  - The sticky panel never hides the focused row or the input (v0.1.1 AC-03).

## Summary of the work to be done

**A. Labels (RF13).** Why: G5. A small per-machine map from `sensor_key` to a display name, owned by the unprivileged app.
- **RF13.1 Store:** one label per `sensor_key`, on this PC (under `%LOCALAPPDATA%\dev.pophood`, C7), for the current Windows user. It survives app restarts, reboots and elevation changes.
- **RF13.2 Apply:** the label replaces the sensor's name in exactly these places: drill-down rows ("{label} · {default}"), the detail heading, the detail chart's accessible name, and the Motherboard card's fan rows (label alone). Everything else keeps LHM's names, including fixed role labels, card titles, the header summary, the history legend, and the CPU card's "Hottest CCD" / "Hottest core" suffix (`fields.ts:258,264`, which shows an LHM sensor name). Sensor matching in `fields.ts` always uses LHM's names, never labels.
- **RF13.3 Reset:** "Reset to “{default}”" removes the label. Saving an empty name, or one equal to the default name, also removes it (no entry is stored for it).
- **RF13.4 Text rules:** leading and trailing white space is removed before saving; 1 to 40 characters after trimming (the techspec says how characters are counted); two sensors may share a label; a label is always rendered as text, never as markup.
  - The input is a single line and accepts at most 40 characters; a longer paste is cut at 40 (owner: "Input stops at 40 (Recommended)").
  - The label store also refuses a label over 40 characters or an empty key, so a bad call never writes one.
- **RF13.5 No silent re-attach (ADR 0008):** a label applies only to the sensor whose `sensor_key` is exactly the stored key. A changed name, type or identifier gives a new key, so the label doesn't follow.
- **RF13.6 Absent sensors:** a label whose sensor is not in the current frame is kept and shown nowhere. No orphan list in v0.2.0. The label shows again when the exact key comes back (the normal case: fans and other elevated-only sensors are absent in every reduced session).
- **RF13.7 Display only:** a label never changes a value, a `key`, the 10-minute history, the selected row, the card order or the lock labels. It is never sent to the helper.
- **RF13.8 Failures are visible, never silent:** if the labels can't be read at start, the app shows default names and stays usable; if a save or reset fails, the form says so and the shown name doesn't change. (Exact copy and the corrupt-store behaviour: OQ-C.)
- **RF13.9 Migratable from day one:** the stored labels carry a format version, so v0.3.0 can read them and move them into SQLite (umbrella "Database Changes": "The DB must be migratable from day one").

**B. Inline rename (RF26).** Why: the drill-down is where the owner sees which sensor is which (live value, chart).
- **RF26.1 Form:** in the detail panel of every drill-down, for the selected sensor, with the copy in [User experience](#user-experience).
- **RF26.2 A draft belongs to one sensor:** Enter in the input saves, like Save name. A save always writes to the key the text was typed for, never to whichever sensor is selected at the moment of saving. Frames that leave the selected sensor in place never reset the typed text or move focus.
- **RF26.3 Draft discarded on any selection change:** unsaved text is discarded without asking whenever the selected sensor changes, whatever the cause: the owner selects another row or leaves the page; the selected sensor leaves the frame or its group locks and the page falls back to the first row (`SensorList.tsx:103-105`); reduced → full sensors moves the first row (UT-39 b); full sensors are lost; the frame becomes empty. The input then shows the newly selected sensor's label.
- **RF26.4 Rows:** renamed rows read "{label} · {default}".
- **RF26.5 Panel size:** re-measure the panel with the form at the v0.1.1 sizes (1917×1029, 1024×800, 1024×680) and adjust the sticky threshold (800 px) and the focus padding (360 px) if needed.
- **RF26.6 What can be renamed:** any sensor that has a row, that is any sensor in an unlocked group. A locked group shows no rows (`SensorList.tsx:104,149-152`), so its sensors can be renamed once they unlock; their stored labels are kept. Each `sensor_key` is separate: the Fan "Fan #1" (`…/fan/0`) and the Control "Fan #1" (`…/control/0`) are two sensors with two labels.

**C. Handed over from v0.1.0.**
- **H1:** the Motherboard card's header link reads "Name your fans" (same target as "All sensors"). Owner: "Header link renamed (Recommended)". Only the normal Motherboard card has it: the reduced, no-PawnIO and empty Motherboard cards are placeholders with no link (`fields.ts:452-481`).
- **H2:** the Motherboard drill-down subline (today every hardware name in scope, then the count, `SensorList.tsx:106-118`) ends with "· generic names until you rename them". Owner: "Motherboard page only (Recommended)".

**D. Release.** Version 0.2.0 in the version files (see Files to Modify); the helper stays 0.1.0 with hash `553a7f49…` if nothing under `helper/` or `src-tauri/src/sensors/` changes; E2E-15 (network audit) on the release exe; the drill-down E2E rows (E2E-12, 21, 22, 27) and PERF-02 again because the panel changes.

### Files to Modify

Caller counts are from `rg` over `src/` and `src-tauri/` on 2026-10-23 (commands in [Observations](#observations)).

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `src/pages/SensorList.tsx` | Drill-down page | Rows `:165`, heading `:49`, chart label `:75` show the label; the rename form in `SensorDetail` (`:31-78`); the Motherboard subline `:116-118` |
| `src/cards/fields.ts` | Dashboard model | Fan row names `:490`, `:502` (`FanRow.name`, `:42-48`), or the label is applied in `MotherboardCard`; techspec decides. `buildDashboard` has 1 caller besides tests (`Dashboard.tsx`) |
| `src/pages/Dashboard.tsx` | Dashboard page | If labels enter `buildDashboard`, its `useMemo` deps `[frame, status, stale]` (`:17`) must include the labels, or a save shows only on the next frame |
| `src/cards/CardParts.tsx` | Shared card shell | The header link text `:122` becomes per card (only the Motherboard card differs) |
| `src/cards/MotherboardCard.tsx` | Fan list card | Passes the Motherboard link text; shows the label `:18` |
| `src/sensors/store.ts` or a new labels module | UI state | Holds the label map and notifies on change (pattern: `store.ts` / `theme.ts`) |
| `src/sensors/commands.ts` | IPC wrappers | New wrappers, only if the core owns labels (OQ-A) |
| `src/styles/app.css` | Styles | The form row in `.detail` (`:811-870`); the sticky rule and `scroll-padding-top` (`:299-307`) after the re-measure |
| `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs:79-84` | Core commands | New label commands, only if the core owns labels (OQ-A) |
| `src/pages/SensorList.test.tsx`, `src/cards/Cards.test.tsx`, `src/pages/Dashboard.test.tsx`, `src/App.test.tsx`, `src/cards/fields.test.ts` | Tests | New rename cases (including RF26.2/26.3: a draft across a fallback, an elevation and a lost frame). The 5 test lines that click "All sensors" target the CPU card (`[0]`) or render the GPU card alone (`Cards.test.tsx:75-79`), so they keep passing. **Breaks:** `SensorList.test.tsx:55` anchors the Motherboard subline at `\d+ sensors$` (H2) |
| `package.json:4`, `package-lock.json:3,9`, `src-tauri/Cargo.toml:3`, `src-tauri/Cargo.lock:2516`, `src-tauri/tauri.conf.json:4`, `THIRD-PARTY-NOTICES.md:3`, `src/pages/SensorList.test.tsx:249` | Version | 0.1.1 → 0.2.0 (the v0.1.1 bump `0861d8f` touched both lock files) |
| `README.md:5` | Status line | v0.2.0 |
| `specs/v0.2.0/README.md`, `specs/v0.1.0/requirements.md` (version map `:265`; "everywhere" `:144`; slice 2 row `:249`) | Specs | Link this doc; status; narrow "the label shows everywhere / on the cards" to the Motherboard fan rows (Q&A #2) |
| `sessions/20261021071727_pophood-oq1-oq2-closeout/decisions/0008-sensor-label-key-basis.md` | ADR | Amendment: no orphan UI in v0.2.0 (owner answer); the Consequences line on what the techspec owns |

**Not to modify unless the techspec chooses it:** `src-tauri/src/sensors/events.rs` (`UiFrame::from_frame`, `:96-118`). Putting labels into `UiFrame` there is a change under `src-tauri/src/sensors/`, which triggers the full helper regression rule (AGENTS.md: helper build, E2E-19, E2E-24, the DLL plant check, the elevated smoke) for a display feature.

### Files to Create

| File | Purpose | Type (Component/Service/Util) |
| ---- | ------- | ----------------------------- |
| A UI labels module (+ test); the techspec picks its folder | Load, hold, save and clear labels; apply the RF13.4 rules | Util / store |
| A core labels module (+ tests), only if the core owns labels; outside `src-tauri/src/sensors/`, so it doesn't trigger the helper regression rule | Read and write the label store under `app_local_data_dir` | Service |
| `specs/v0.2.0/techspec.md` | Design | Doc (next phase) |

### APIs Affected

| Endpoint | Method | Changes |
| -------- | ------ | ------- |
| Tauri IPC: UI → core | Commands | New only if the core owns labels: read all labels; save one; clear one (umbrella "APIs Affected": "rename and reset a sensor"). Inputs are bounded (key and label length) before anything is written. |
| Named pipe (helper ↔ app) | Schema v1 | **No change.** |
| Tauri IPC: core → UI Channel (`SensorEvent`) | Events | No change in the UI-owned path; a change in `events.rs` only if labels ride on `UiFrame` (see above). |

### Database Changes

| Table | Change Type | Details |
| ----- | ----------- | ------- |
| — | None in v0.2.0 | SQLite arrives in v0.3.0. The umbrella's "Sensor labels" entity (per machine, keyed per RF13) is stored outside SQLite now, unless the techspec brings SQLite forward (OQ-A). If stored outside, v0.3.0 owns the move into SQLite. |

## Key components & responsibilities

| Component | Responsibility in v0.2.0 | Privilege |
|---|---|---|
| UI (React) | Form, validation copy, applying labels for display, the label map in memory | WebView2 sandbox |
| App core (Rust) | Only if chosen (OQ-A): reading and writing the label store under `%LOCALAPPDATA%\dev.pophood` | Unprivileged (C1) |
| Sensor helper | Nothing new. Never sees a label. | Unchanged |

## High-level technical constraints

- **C1:** only the unprivileged app reads or writes labels. The elevated helper writes no files (RF5) and is not involved.
- **C5 / RF29:** no network. Every release re-runs E2E-15 (`scripts/audit-network.ps1`).
- **C7:** labels stay under `%LOCALAPPDATA%\dev.pophood`, on this PC only.
- **CSP:** `tauri.conf.json:27` has `form-action 'none'`: a `<form>` must never submit by navigation (the save is handled in script).
- **No capability files:** app commands need none (`commands.rs:1-2`); adding a Tauri plugin (fs, store, sql) would add a capability surface and needs a stated reason.
- **Regression rule:** a change under `helper/` or `src-tauri/src/sensors/` re-runs the full helper suite (AGENTS.md). v0.2.0 should not need one.
- **No external `<a href>`:** "Name your fans" stays a `<button>` (navigation is pinned; `webview.rs:88-102`).
- **Untrusted text:** a label is user text; it is rendered as text (React escapes it), never as HTML, and bounded before storage (RF13.4).
- **Fixed location:** if the core writes the store, the location is fixed in Rust under `app_local_data_dir`; no command takes a path or file name from the UI (the same pattern as `open_pawnio_site`'s hard-coded URL).

## Architecture insights

- **The key is ready.** `UiSensor.key` = `id|name` is on every sensor today (`events.rs:108`); the history map already uses it (`history.ts:32-35`). Labels are a lookup on top; no schema change. `|` can't occur in `id` (URI-escaped, `protocol.rs:151-152`), so a name with `|` keeps the key unambiguous.
- **Two places own names today:** `SensorList.tsx` (3 uses of `sensor.name`) and `fields.ts` (fan rows). The other `.name` uses in `fields.ts` (`:138,197,257-264`) *match* LHM names to pick sensors, and `:258,264` also *display* part of one (the Hottest suffix). All of them keep LHM's name (RF13.2).
- **The theme is the only persisted state so far** (`localStorage`, `theme.ts`). It lives in the WebView2 profile `%LOCALAPPDATA%\dev.pophood\EBWebView`, which `scripts/audit-network.ps1 -FreshProfile` deletes. Labels stored the same way would be lost by that flag.
- **Pattern consistency:** high (one store pattern, one command pattern, tests per page). **Docs:** high. **Clarity:** high.

## Dependencies

| Dependency | Version | Note |
|---|---|---|
| Tauri | 2.12.4 | Commands only; no new plugin expected |
| serde / serde_json | 1 | Already in `Cargo.toml:21-22`, if the core writes JSON |
| React / `@tauri-apps/api` | 19.3.1 / 2.12.4 (`package.json:16-18`) | `useSyncExternalStore` and `invoke` patterns already in use |
| WebView2 runtime | 155.0.4283.62 | `localStorage` (if chosen) lives in its profile |
| LHM | 0.9.6 @ `3d331e3` | Its sensor names are part of the key; an LHM bump re-runs P1 (`sensor-id-stability-check`) |

## Observations

- **Strength:** the umbrella planned for this slice (key chosen in v0.1.0, form place chosen in v0.1.1), so v0.2.0 is UI-sized.
- **Gap fixed here:** the scope stub didn't list the "generic names until you rename them" subline (v0.1.0 techspec, mockup corrections `techspec.md:1026`); now H2.
- **Conflict resolved here:** the stub said "change the link"; mockup E1 kept "All sensors" and added a footer link. Owner chose the header link.
- **Copy change:** the mockup caption promised "run traces"; dropped until v0.3.0.
- **Harness impact** (`rg "All sensors"` over `sessions/` and `scripts/` `*.ps1`/`*.psm1`; markdown runbooks not searched):
  - Scripts that loop over every "All sensors" button to reach each drill-down will no longer reach the Motherboard: `sessions/20261023055425_pophood-v011-release/t6-release.ps1:136-146` (the E2E-12 (O) "Controls · 6" step, re-run in v0.2.0), `sessions/20261022204727_pophood-v011-implementation/render-check.ps1:16-18`, `sessions/20261021165812_pophood-v010-e2e/e2e20.ps1:19-21`, `sessions/20261021181500_pophood-v010-owner-e2e/cards-walk.ps1:14-31`.
  - Scripts that count dashboard columns from the X positions of the "All sensors" buttons can count one column fewer: `sessions/20261023055425_pophood-v011-release/e2e21.ps1:47-52` (`DashboardColumns`), `sessions/20261021165812_pophood-v010-e2e/e2e21.ps1:9-14`.
  - Scripts that take `[0]` or `[1]` (CPU, GPU) are not affected.
- **ADR numbering:** two ADRs carry 0033 (`0033-public-repo-publishing.md` and `adr-0033-publish-fast-forward.md`); 0035 is this session's scope ADR (`sessions/20261023084459_pophood-v020-define-reqs/decisions/0035-v020-rename-scope.md`), so the next free number is 0036.
- **Caller-closure commands (2026-10-23):**
  - `rg -n "\b(sensor|s|f|row|selected|source)\.name\b" src --glob '!*.test.*'` → 12 lines: `SensorList.tsx` 3, `fields.ts` 8, `MotherboardCard.tsx` 1.
  - `rg -n "All sensors" src --glob '!*.test.*'` → `CardParts.tsx:122` (+ a comment `:102`); `rg -c` in tests → `App.test.tsx` 1, `Cards.test.tsx` 2, `Dashboard.test.tsx` 2.
  - `rg -n "sensor_key\(" src-tauri` → `events.rs:108`, `tests/helper_pipe.rs:173`, and the definition and tests in `protocol.rs`.
  - `rg -n "invoke\(" src --glob '!*.test.*'` → `commands.ts` 3, `store.ts:75`.
  - `rg -n "page-sub" src --glob '!*.test.*'` → `SensorList.tsx:92,116`, `Dashboard.tsx:25`, `About.tsx:30`, `app.css:183`; in tests → `SensorList.test.tsx:49,55,176`, `Dashboard.test.tsx:71`.

## Side effects / impact

- **A new file (or profile entry) under `%LOCALAPPDATA%\dev.pophood`:** the first user data the app persists besides the theme. Deleting the folder resets the names.
- **"Saved on this PC only"** means per Windows user on this PC (`%LOCALAPPDATA%`); another user on the same PC has no labels.
- **The panel gets taller** (one form row): fewer card rows are visible while it sticks; the threshold and padding may move.
- **E2E scripts** that walk every card need the new link text (see Observations).
- **Labels can outlive their sensor** with no way to remove them in the UI in v0.2.0 (owner's choice). They are small; the stored count grows only by renames.

## Risks & considerations

| Severity | Risk | Mitigation / next probe |
|---|---|---|
| **High** | A label shows on the wrong sensor (ADR 0008, R2): an LHM bump or hardware change reuses an identifier with the same name. | Exact-key match only (RF13.5); LHM stays pinned; P1 re-run on every LHM bump. Residual: the same `id\|name` on a different physical sensor can't be detected, accepted in ADR 0008. |
| **High** | A typed name is saved on the wrong sensor because the page changed the selection by itself (fallback, elevation, lost frame) while the owner typed. | RF26.2 and RF26.3; tests that type, then trigger each automatic selection change, then save. |
| **Mid** | Labels stored in the WebView2 profile are lost by `audit-network.ps1 -FreshProfile` or a profile reset. | OQ-A weighs it; if `localStorage` is chosen, the audit runbook says so. |
| **Mid** | A crash during a save leaves a half-written store, and the next start loses every name. | OQ-C: the techspec picks an atomic write (if file-based) and the corrupt-store behaviour (RF13.8). |
| **Mid** | Live frames re-render the panel every second and reset the input or steal focus while the owner types. | RF26.2; a test that types, applies frames, and checks the text and focus. |
| **Low** | The taller sticky panel hides a focused row or the input at 1024×800. | RF26.5 re-measure; E2E-22's Shift+Tab step. |
| **Low** | A long label (40 characters) wraps in a fan row or the heading and breaks the layout. | E2E-27 with a 40-character label on the CPU page; a render check of a 40-character label in a Motherboard card fan row. |
| **Low** | The theme and the labels drift into two storage patterns. | OQ-A states the reason if they differ. |

## Open questions for the techspec

| # | Question | Notes |
|---|---|---|
| OQ-A | **Where labels persist:** a JSON file written by the core under `app_local_data_dir`; WebView2 `localStorage` like the theme; or SQLite brought forward from v0.3.0. | Scope stub question. Weigh: the `-FreshProfile` wipe, v0.3.0's migration into SQLite, a new command surface vs none, atomic writes. |
| OQ-B | **Who applies labels:** the UI (lookup by `key` at render) or the core (in `UiFrame`). | A core path in `events.rs` triggers the helper regression rule; v0.3.0 traces store keys, so labels can still be applied at display time. |
| OQ-C | **Failure handling:** the copy for a failed save, and what happens to a store that can't be parsed (start empty and keep the file aside, or refuse to overwrite). | RF13.8. |
| OQ-D | **Reset when there's no label:** hidden, disabled, or a no-op. | The mockup always shows it. |
| OQ-E | **Rename while stale or disconnected:** allowed (labels are by key) or disabled. | The panel keeps the last frame while stale. |

## Q&A (owner answers, verbatim)

| # | Question (short) | Answer |
|---|---|---|
| 1 | Mode: feature integration? | "Feature integration (Recommended)" |
| 2 | Where does a renamed sensor show its label on the Dashboard? | "Fan rows only (Recommended)" |
| 3 | Orphaned labels (absent sensors) in v0.2.0? | "Keep, no UI yet (Recommended)" |
| 4 | "Name your fans": header link, mockup E1 footer, or both? | "Header link renamed (Recommended)" |
| 5 | Keep "in run traces" in the caption? | "Drop \"run traces\" for now (Recommended)" |
| 6 | Label text rules? | "Trim, max 40, dupes OK (Recommended)" |
| 7 | Where does "· generic names until you rename them" show? | "Motherboard page only (Recommended)" |
| 8 | Unsaved typed name when switching rows? | "Discard silently (Recommended)" |
| 9 | Exploration: inline or fan-out? | "Inline, no subagents (Recommended)" |
| 10 | Which review fixes to apply? | "F1 draft safety (Recommended), Reference fixes (Recommended), New rules (Recommended), Umbrella + ADR wording (Recommended)" |
| 11 | F4: more than 40 characters typed or pasted? | "Input stops at 40 (Recommended)" |
