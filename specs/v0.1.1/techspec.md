# Techspec - Pophood v0.1.1: drill-down layout (patch)

- **Date:** 2026-10-22
- **Mode:** feature integration. A patch: it changes the existing drill-down (RF26) and adds no capability ([version map](../v0.1.0/requirements.md#version-map)).
- **Inputs:**
  - [README.md](README.md) (scope stub) and the [UI proposal](ui-proposal/ui-proposal.md), variant B (ADR 0030);
  - the umbrella [requirements](../v0.1.0/requirements.md): RF26 and the UX line "Reduced mode has to look intentional";
  - the [v0.1.0 techspec](../v0.1.0/techspec.md): its drill-down rows, the RF3 table and the lock labels;
  - the render check in this session: [`evidences/render-check/`](../../sessions/20261022171503_pophood-v011-techspec/evidences/render-check/measurements.txt).
- **Owner answers:** Q&A #1–#5 in this techspec session, #6 in its review and #7 in the tasks breakdown, verbatim in the [Q&A record](#qa-record) and in `owner-decisions.md` of `sessions/20261022171503_pophood-v011-techspec/`, `sessions/20261022184039_pophood-v011-techspec-review/` and `sessions/20261022193957_pophood-v011-tasks-breakdown/`.
- **Next:** none for v0.1.1: implemented, checked and signed off by the owner on 2026-10-23 (commit `0861d8f`; report `sessions/20261023055425_pophood-v011-release/qa.md`). The next slice is v0.2.0.

## Summary

The drill-down page (`src/pages/SensorList.tsx`) changes from one list column with a side panel to the chosen variant B:
- the selected sensor's panel goes full width at the top, and sticks there while the page scrolls (in windows at least 800 px tall);
- below it, one card per sensor type flows down, then across, in CSS columns;
- the dashboard's `StatusBanner` shows under the header;
- a group whose values are all `null`, and which needs more than the helper has, shows only its title and "Needs full sensors" or "Needs PawnIO".

The lock rule reuses the dashboard's `lockFor`. A small table next to `drillSections` says which groups need PawnIO; it mirrors `helper/Availability.cs`.

**Blast radius:** UI only. Four source files (`fields.ts`, `SensorList.tsx`, `app.css`, `tokens.css`), their two test files, the version bump (app 0.1.1, helper stays 0.1.0), the README status line, the notices line, one AGENTS.md checklist line and the spec docs. No change under `helper/` or `src-tauri/src/`, so the helper regression rule (AGENTS.md) doesn't apply. The release keeps the helper of record (`553a7f49…`).

## Approach

**Chosen approach: pragmatic-balance** (the feature-integration guidance). It is a layout change with two small model changes, so the design reuses what exists and adds only what the chosen design needs.

**Reused, unchanged:**
- `componentScope`, the group order and labels, LHM `index` order and the Memory per-hardware sections (UT-34);
- `lockFor` and its label rule, `LockedValue`, and `StatusBanner` / `bannerFor` with every state (Q&A #2);
- `DetailChart` (viewBox 600×160; only its CSS height changes);
- the row markup, `aria-pressed` selection and the muted rule (null and 0 RPM);
- the history store: 10 minutes for every sensor already, so the panel needs no new data.

**Net-new:**
- `SensorGroup.lock` and a `status` parameter on `drillSections`;
- `groupNeeds`, the drill-down's copy of the RF3 table;
- `accessOf`, the lock inputs that the dashboard and the drill-down now build in one place;
- the column, card, sticky and panel CSS, and one token (`--shadow`).

**Explicitly not built** (owner: "Accept as proposed (Recommended)", Q&A #4; details in the [Anti-overengineering breakdown](#anti-overengineering-breakdown)):
- special copy when every group is locked;
- a value `min-width` against re-wrap jitter, unless E2E-27 shows cards moving;
- a Storage ("admin") group lock;
- the blocking panel on the drill-down;
- new test files;
- any helper or core change.

## Confidence score

**History:** Rev 1 scored 94%. The QA-scenario pass found two High errors in the spec text (the hook order in the `SensorList` snippet; the claim that an unclicked selection stays after an unlock). Both are fixed in Rev 1.1 and locked by UT-39 (g) and (b). Neither changes the design, so the scores stand. Rev 1.2: an adversarial review re-scored 93.5% (one Medium: the release plan had no devtools variant for the CDP checks; nine Lows, listed in the [Revision history](#revision-history)). All are fixed here (owner: "fix everything", Q&A #6), so the scores stand.

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| API/docs and requirements clarity | 30% | 95% | Design chosen by the owner on a canvas with real data (ADR 0030). Every open question in the scope stub and the UI proposal is answered (Q&A #1–#5). The "not mocked" states each have a rule ([Data models](#data-models)). **Gap:** the "Needs PawnIO" state is specified, not mocked (the copy already exists on the dashboard). |
| Suitable inspected patterns | 25% | 95% | Every change follows code read in this session: `lockFor`, `cell`, `drillSections`, `LockedValue`, `StatusBanner`, the `SensorList.test.tsx` and `fields.test.ts` builders. The CSS was rendered with the app's own `app.css`, tokens and fonts in Edge 155.0.4283.62, the WebView2 runtime's build: split cards, sticky and focus scrolling all measured. |
| Data-flow/dependency understanding | 20% | 94% | Store → `SensorList` → `drillSections(frame, scope, status)`. Privilege comes from `frame.elevated`, PawnIO from `status.pawnIo` (as on the dashboard). The three fixtures cover each lock state (reduced, elevated without PawnIO, full with the all-`null` Controls · 6). |
| Complexity understood and controlled | 15% | 93% | Small diff. CSS fragmentation (columns + `box-decoration-break: clone`) works in the render. **Not seen yet:** live values that change length every second could re-wrap a long name and move cards between columns (E2E-27). |
| Cross-system impact understood and bounded | 10% | 92% | UI only. The version bump touches `Cargo.toml` and `tauri.conf.json`, so `pophood.exe` is rebuilt; the release keeps the helper of record, so its elevated evidence stays valid; the CDP checks run on a devtools variant built from the same commit with the same staged helper (ADR 0019). The network audit re-runs (E2E-15). **Residual:** headless Edge isn't the app's WebView2 environment (Tauri, CSP, the owner's display scale). |
| **Total** | | **94%** | 0.30·95 + 0.25·95 + 0.20·94 + 0.15·93 + 0.10·92 = 28.5 + 23.75 + 18.8 + 13.95 + 9.2 = **94.2** |

- **Effective threshold:** 90% (the owner's bar). 94% ≥ 90%, so `tasks-breakdown` can start, with the uncertainties below noted.
- **What would lower it:**
  - cards moving between columns as values change (E2E-27): −2 on complexity. Fallback: `min-width` on `.row__value` (sized to the longest unit, about 10 ch);
  - the real app's panel taller than the 360 px focus padding (a long name that wraps, or a display scale above 100 %): −1. Fallback: raise the padding;
  - a CSP or WebView2 difference that breaks `:has()` or the column fragmentation: −3. Fallback: drop the focus rule (keyboard only), or set `break-inside: avoid` on every card.
- **Checks, done:** task 2's render in `npm run tauri dev`, then E2E-21, E2E-22 and E2E-27 on the release and devtools builds (T5 reduced, T6 full sensors): all passed, no `min-width` fallback was needed (2026-10-23).

## Out-of-scope

| Item | Why | Revisit |
|---|---|---|
| The rename form | v0.2.0; its place is one row along the bottom of the panel | [v0.2.0](../v0.2.0/README.md) |
| A sparkline on every row | ~95 SVG paths redrawn every second (PERF-02) | Not planned |
| Collapsible groups, remembered state | Not asked for | When it bothers the owner |
| Any Dashboard change | Not asked for | — |
| The blocking panel on the drill-down | After a blocking stop the frame is `null`, so the page shows "No sensor data yet." as in v0.1.0 | When it bothers the owner |
| Special copy when every group is locked | Not reachable on known hardware: the CPU always has Loads; in reduced mode the Disk, SuperIO and DIMM hardware leave the frame, and `/motherboard` stays with no sensors (the no-sensors caption shows) | If it is ever seen |
| A live "Needs PawnIO" run (uninstalling PawnIO) | UT-38 (b) covers it with the v0.1.0 fixture, as UT-16 did for the dashboard; the banner is `StatusBanner.test.tsx`'s; E2E-14 stays the v0.1.0 record | Next PawnIO-related change |
| Bumping the helper to 0.1.1 | The helper is unchanged; a rebuild changes its hash and re-opens the helper regression rule (Q&A #3) | Next helper change |

## Architecture

```
 SensorStore ── useFrame() ─────────────┐   useSensorStatus()
      │                                  ▼          │
      │                  SensorList (cardId)  ◄─────┘
      │                    ├─ Breadcrumb, header (unchanged)
      │                    ├─ StatusBanner (reused, every state)
      │                    ├─ .drill__detail   ← sticky at ≥ 800 px tall
      │                    │    └─ SensorDetail: group · name · id | value | Min · Max · Unit
      │                    │                     DetailChart (130 px)
      │                    └─ section "Sensor list"
      │                         └─ per hardware section: [h2 heading] .drill__columns
      │                              └─ per group: div.group
      │                                   ├─ h2 "{LABEL} · {n}" (h3 under a hardware h2)
      │                                   └─ rows (buttons)  |  LockedValue (locked)
      └─ useSeriesList([key]) → SensorDetail, DetailChart (unchanged)

 cards/fields.ts:  drillSections(frame, scope, status)
                     └─ groupByType(hardware, sensors, accessOf(frame, status))
                          └─ lock = every value null ? lockFor(access, groupNeeds(hw.type, type)) : null
```

**Components:**

| Component | Path | Change |
|---|---|---|
| Drill-down model | `src/cards/fields.ts` | `drillSections` takes `status`; each `SensorGroup` gets `lock`; `accessOf` and `groupNeeds` are new and private; `lockFor`'s parameter type narrows |
| Drill-down page | `src/pages/SensorList.tsx` | New layout; `StatusBanner`; locked cards; selection over unlocked rows; card title levels |
| Styles | `src/styles/app.css`, `src/theme/tokens.css` | The drill-down rules are replaced; `--shadow` is new |
| Version | `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `README.md`, `THIRD-PARTY-NOTICES.md` | 0.1.0 → 0.1.1 (the app only) |

**Workflow: open a drill-down.**
1. A card click or "All sensors" sets the page (`App.tsx`, unchanged), and the page opens at the top (`window.scrollTo(0, 0)`, T13 BUG-01).
2. `SensorList` builds the sections with `drillSections(frame, scope, status)`. The selectable rows are the sensors of the unlocked groups, in display order.
3. The first selectable row is selected. The panel shows it; the banner shows whatever `bannerFor` picks.
4. A click on any row selects it. In a window at least 800 px tall the panel is stuck at the top, so the chart the owner just picked stays in view.

**Workflow: reduced → full sensors from the drill-down.**
1. The banner's **Enable full sensors** calls `enable_full_sensors` (unchanged).
2. The banner goes through "Waiting for the UAC prompt…" and "Connecting to sensors…" while the unprivileged frames keep coming.
3. The first elevated frame has values for the locked groups, so `lock` becomes `null` and their rows appear.
4. **The selection:** a row the owner clicked stays selected. If nothing was clicked, the selection is still "the first unlocked row", which is now the first Temperature ("Core (Tctl/Tdie)") instead of "CPU Total". That is the v0.1.0 rule (no stored selection until a click), kept on purpose: it needs no extra state, and after elevation it lands on the package temperature.

**Workflow: full sensors lost while viewing a CPU clock.** The frame becomes unprivileged, the Clocks group locks, the selected key is no longer among the selectable rows, so the selection falls back to the first one ("CPU Total"). The banner shows the `full_sensors_lost` line. The clicked key stays in state, so after the next **Enable full sensors** the same clock is selected again.

**Data flow, per frame:** unchanged up to the store. `SensorList` re-renders every frame (one store version counter, PERF-02); `drillSections` re-groups the scope's sensors and computes each lock (a few hundred comparisons for the CPU's 95 sensors).

## Design

### Patterns reused

Every citation was read in this session. Line numbers are hints; the anchor is the symbol.

| Pattern | Source | Usage here |
|---|---|---|
| Lock labels: "Needs full sensors" when not elevated; "Needs PawnIO" when elevated and PawnIO isn't installed or `loaded === false` | `src/cards/fields.ts → lockFor (≈:162)`; v0.1.0 techspec "Lock labels" | The group lock label. Only the parameter type changes. |
| A `null` value plus a need is a lock; a value always shows | `fields.ts → cell (≈:170)` | The group locks only when **every** value is `null` |
| The PawnIO defaulting before the first hello: `status.pawnIo ?? { installed: true, version: null, loaded: null }`, privilege from `frame.elevated` | `fields.ts → buildDashboard (≈:579-587)` | Moved into `accessOf`, shared by both pages |
| RF3: without a usable PawnIO, `Cpu` keeps only Load; `Motherboard`, `SuperIO`, `EmbeddedController` keep nothing; `GpuIntel` loses Power | `helper/Availability.cs → IsTrustworthy (≈:24-38)`; v0.1.0 techspec "Availability classification (RF3)" | `groupNeeds`. The helper owns validity; the UI owns copy (v0.1.0 "Keep both, with separate owners"). |
| Grouping by SensorType, `GROUP_ORDER`, plural labels, `index` order, per-hardware sections when more than one item has sensors | `fields.ts → groupByType (≈:728-743)`, `drillSections (≈:750-758)` | Kept; `groupByType` also gets the hardware and the lock inputs |
| `LockedValue`: lock icon (13 px) and label, `.locked` (12 px, `muted`) | `src/cards/CardParts.tsx → LockedValue (≈:6-13)` | The locked card's body |
| One banner, the highest-priority row of the "UI states not mocked" table | `src/shell/StatusBanner.tsx → bannerFor (≈:62)`, `StatusBanner (≈:117)` | Rendered as-is under the drill-down header (Q&A #2) |
| Selection: the first row on open, and again when the selected key leaves the list | `src/pages/SensorList.tsx → SensorList` (`all.find(…) ?? all[0]`, ≈:93-95) | Kept, over the unlocked groups' rows |
| Variant B: sticky wrapper with a `bg` strip (`margin-top: -8px; padding: 8px 0 4px`), the panel (`padding: 16px 20px`, `gap: 12px`, shadow), top row `flex-wrap` with gaps 12/28 px, name 22 px with the id inline, value 40 px, Min / Max / Unit boxes (min-width 120/120/80 px), chart 130 px; `columns: 270px` with a 16 px gap; card `padding: 4px 6px 6px`, `margin-bottom: 16px`; title `break-after: avoid`; rows at least 36 px, `padding: 6px 8px`; `break-inside: avoid` for groups of 8 or fewer | `specs/v0.1.1/ui-proposal/mockups/Main.dc.html` (sticky wrapper ≈:72, panel ≈:73-95, columns ≈:114, card ≈:116-117, row ≈:122-124, split rule ≈:309) | `app.css` |
| Shadow colours: dark `rgba(0, 0, 0, 0.45)`, light `rgba(14, 22, 38, 0.18)` | `Main.dc.html → renderVals` DARK / LIGHT (≈:195-196) | `tokens.css → --shadow` |
| `box-decoration-break: clone` on column fragments, Chromium 130 and later | https://developer.chrome.com/blog/box-decoration-break; rendered in Edge 155.0.4283.62 (`measurements.txt`) | `.group` |
| Layout lives in `app.css` classes, not in `style` props. The one `style` prop in the UI (the VRAM bar's width) passes the CSP (`style-src 'self'`) because React sets it through CSSOM | `app.css` header comment; `src/cards/CardParts.tsx → Field (≈:77)`; v0.1.0 techspec "Fixed source parameters" (CSP) | `group--split` is a class |
| The whole document scrolls (no inner scroll container) | `App.tsx → Shell` (`window.scrollTo`, ≈:15-18); `app.css → .app`, `.main` (no `overflow`) | `position: sticky; top: 0` against the viewport; `scroll-padding-top` on `html` |
| Test setup: a store, a status event, a frame, then render | `SensorList.test.tsx → setup (≈:12-22)`; `fields.test.ts → custom (≈:33-35)`, `hw (≈:28)`; `src/test/builders.ts → sensor, liveReduced, liveElevated` | UT-34, UT-38, UT-39 |

### Interfaces

```ts
// src/cards/fields.ts (exported)
export interface SensorGroup {
  type: string;
  label: string;
  sensors: UiSensor[];
  lock: LockLabel | null;                                     // new
}
export function drillSections(frame: UiFrame, scope: string[], status: SensorStatus): DrillSection[];  // + status

// src/cards/fields.ts (private)
type Access = Pick<Ctx, "elevated" | "pawnInstalled" | "pawnLoaded">;
function accessOf(frame: UiFrame, status: SensorStatus): Access;
function lockFor(ctx: Access, needs: Needs): LockLabel | null;      // was (ctx: Ctx, …); body unchanged
function groupNeeds(hardwareType: string, sensorType: string): Needs;
function groupByType(hardware: UiHardware, sensors: UiSensor[], access: Access): SensorGroup[];
```

### Implementation map

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `src/cards/fields.ts` | M | `accessOf`, `groupNeeds`, `SensorGroup.lock`, `drillSections(…, status)`; `buildDashboard` uses `accessOf`. The drill-down needs the dashboard's lock rule, and one place builds its inputs. | `lockFor`, `cell`, RF3 | UT-31 (unchanged: the refactor's regression check), UT-34, UT-38 |
| `src/pages/SensorList.tsx` | M | Variant B markup, `StatusBanner`, locked cards, selection over unlocked rows, the split class, card titles one level under the nearest heading | Selection rule, `LockedValue`, `StatusBanner` | UT-39, E2E-12, E2E-21, E2E-22, E2E-27 |
| `src/styles/app.css` | M | Replaces the `.drill`, `.list`, `.list__heading`, `.list__group` rules; changes `.row`, `.detail*`, `.stats*`, `.chart__svg--detail` | Variant B CSS | E2E-21, E2E-22, E2E-27 |
| `src/theme/tokens.css` | M | `--shadow` in both themes | Mockup tokens | E2E-21 (both themes) |
| `src/cards/fields.test.ts` | M | UT-34 calls pass a status, plus one "no lock in full mode" case; UT-38 | builders | — |
| `src/pages/SensorList.test.tsx` | M | `setup` takes a status; UT-39; About expects 0.1.1 | `setup` | — |
| `package.json`, `package-lock.json` | M | `"version": "0.1.1"` (both places in the lock: the root and `packages[""]`); `npm version 0.1.1 --no-git-tag-version` does both | — | E2E-23 |
| `src-tauri/tauri.conf.json` | M | `"version": "0.1.1"` | — | — |
| `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | M | `version = "0.1.1"`; then `cargo check` in `src-tauri`, so the lock's `pophood` entry says 0.1.1 before the owner's commit | — | `cargo test` |
| `helper/PophoodSensors.csproj` | — | **Unchanged:** `<Version>0.1.0</Version>` stays (Q&A #3) | — | E2E-23 (the helper's hash of record and its file version) |
| `README.md` | M | The status line (below) | — | — |
| `THIRD-PARTY-NOTICES.md` | M | Line 3: "Pophood 0.1.0 is built from source…" → "Pophood 0.1.1 …" (Q&A #7). The About page shows this file; the bundled components don't change | — | E2E-23 |
| `AGENTS.md` | M | Trust invariants → "After any LHM or dependency bump": add "re-check `src/cards/fields.ts → groupNeeds` and the card fields' `needs` against `helper/Availability.cs` (the UI's copy of the RF3 table, for lock labels)". It lands with `groupNeeds` (step 1), so AGENTS.md never names code that doesn't exist yet | — | — |

**`src/cards/fields.ts`, the lock inputs.** Before (`buildDashboard`, ≈:579):
```ts
  const pawn = status.pawnIo ?? { installed: true, version: null, loaded: null };
  const ctx: Ctx = {
    frame,
    elevated: frame.elevated,
    pawnInstalled: pawn.installed,
    pawnLoaded: pawn.loaded,
    stale: options.stale === true,
    byHw,
  };
```
After, with the two helpers placed after `pawnIoUsable` (≈:160):
```ts
/** What the lock labels depend on. Both the dashboard and the drill-down build it with `accessOf`. */
type Access = Pick<Ctx, "elevated" | "pawnInstalled" | "pawnLoaded">;

/** Privilege from the frame, PawnIO from the hello. Before the first hello, PawnIO counts as installed. */
function accessOf(frame: UiFrame, status: SensorStatus): Access {
  const pawn = status.pawnIo ?? { installed: true, version: null, loaded: null };
  return { elevated: frame.elevated, pawnInstalled: pawn.installed, pawnLoaded: pawn.loaded };
}

function lockFor(ctx: Access, needs: Needs): LockLabel | null {
  // body unchanged
}
```
```ts
  const ctx: Ctx = { frame, ...accessOf(frame, status), stale: options.stale === true, byHw };
```

**`src/cards/fields.ts`, the drill-down.** Before (≈:716-758):
```ts
export interface SensorGroup {
  type: string;
  label: string;
  sensors: UiSensor[];
}
…
function groupByType(sensors: UiSensor[]): SensorGroup[] {
  …
    .map((type) => ({ type, label: groupLabel(type), sensors: [...byType.get(type)!].sort((a, b) => a.index - b.index) }));
}

export function drillSections(frame: UiFrame, scope: string[]): DrillSection[] {
  const withSensors = …;
  if (withSensors.length <= 1) {
    return [{ heading: null, groups: groupByType(withSensors.flatMap((entry) => entry.sensors)) }];
  }
  return withSensors.map((entry) => ({ heading: cleanName(entry.hardware.name), groups: groupByType(entry.sensors) }));
}
```
After:
```ts
export interface SensorGroup {
  type: string;
  label: string;
  sensors: UiSensor[];
  /** Set when the group needs more than the helper has and none of its values is live: the card shows no rows. */
  lock: LockLabel | null;
}

/**
 * Which drill-down groups PawnIO serves: the UI's copy of the helper's RF3 table (`helper/Availability.cs`). The helper
 * owns validity (it sends `null`); this only picks the lock label for a group whose values are all `null`.
 */
function groupNeeds(hardwareType: string, sensorType: string): Needs {
  switch (hardwareType) {
    case "Cpu":
      return sensorType === "Load" ? "none" : "pawnio";
    case "Motherboard":
    case "SuperIO":
    case "EmbeddedController":
      return "pawnio";
    case "GpuIntel":
      return sensorType === "Power" ? "pawnio" : "none";
    default:
      return "none";
  }
}

function groupByType(hardware: UiHardware, sensors: UiSensor[], access: Access): SensorGroup[] {
  …
    // Rows keep LHM's `index` order (the sort is stable, so equal indices keep frame order).
    .map((type) => {
      const rows = [...byType.get(type)!].sort((a, b) => a.index - b.index);
      const lock = rows.every((s) => s.value === null) ? lockFor(access, groupNeeds(hardware.type, type)) : null;
      return { type, label: groupLabel(type), sensors: rows, lock };
    });
}

export function drillSections(frame: UiFrame, scope: string[], status: SensorStatus): DrillSection[] {
  const access = accessOf(frame, status);
  const withSensors = …; // unchanged
  if (withSensors.length <= 1) {
    return [{ heading: null, groups: withSensors.flatMap((entry) => groupByType(entry.hardware, entry.sensors, access)) }];
  }
  return withSensors.map((entry) => ({ heading: cleanName(entry.hardware.name), groups: groupByType(entry.hardware, entry.sensors, access) }));
}
```
The lock reads the frame's values, not the stale-nulled ones. While stale, a locked group stays locked and every other value shows "—", which is what the dashboard shows too.

**`src/pages/SensorList.tsx`.** `SensorDetail` keeps its logic; its markup moves the Min / Max / Unit list into the top row, puts the id next to the name, and keeps the chart last:
```tsx
    <section className="detail" aria-label="Sensor detail">
      <div className="detail__top">
        <div className="detail__title">
          <div className="detail__group">{groupLabel(sensor.type)}</div>
          <div className="detail__heading">
            <h2 className="detail__name">{sensor.name}</h2>
            <span className="detail__id">{sensor.id}</span>
          </div>
        </div>
        <div className="detail__now">{/* unchanged: value, unit, "now · refreshes every second" */}</div>
        <dl className="stats">{/* unchanged: Min (10 min), Max (10 min), Unit */}</dl>
      </div>
      <DetailChart seriesKey={sensor.key} label={`${sensor.name} over the last 10 minutes`} nowMs={frame.t} />
    </section>
```
`SensorList`. The new hook goes with the other hooks, **before** the `frame === null` early return (rules of hooks: the page re-renders when the first frame arrives, and when a blocking stop clears the frame):
```tsx
/** A group of more than this many rows may continue in the next column; a smaller one never splits. */
const SPLIT_ABOVE = 8;
…
export function SensorList({ cardId, onBack }: Props) {
  const { frame, stale } = useFrame();
  const status = useSensorStatus();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (frame === null) {
    // unchanged: "No sensor data yet."
  }
  …
  const sections = drillSections(frame, scope, status);
  const groups = sections.flatMap((section) => section.groups);
  const count = groups.reduce((n, group) => n + group.sensors.length, 0);
  // The first row is selected on open, and again if the selected sensor leaves the frame or its group locks.
  const rows = groups.filter((group) => group.lock === null).flatMap((group) => group.sensors);
  const selected = rows.find((s) => s.key === selectedKey) ?? rows[0];
  …
  return (
    <>
      <Breadcrumb name={name} onBack={onBack} />
      <header>{/* unchanged, with `count` in place of `all.length` */}</header>
      <StatusBanner />
      <div className="drill__detail">
        {selected ? (
          <SensorDetail sensor={selected} frame={frame} stale={stale} />
        ) : (
          <section className="detail" aria-label="Sensor detail">
            <p className="detail__caption">This component has no sensors in the current frame.</p>
          </section>
        )}
      </div>
      <section className="drill__list" aria-label="Sensor list">
        {sections.map((section, index) => {
          // A card title sits one level under the nearest heading: the page's h1, or the hardware's h2 (Memory).
          const Title = section.heading === null ? "h2" : "h3";
          return (
            <div key={section.heading ?? index} className="drill__section">
              {section.heading !== null && <h2 className="drill__heading">{section.heading}</h2>}
              <div className="drill__columns">
                {section.groups.map((group) => (
                  <div
                    key={group.type}
                    className={group.lock === null && group.sensors.length > SPLIT_ABOVE ? "group group--split" : "group"}
                  >
                    <Title className="group__title">
                      {group.label} · {group.sensors.length}
                    </Title>
                    {group.lock !== null ? (
                      <div className="group__lock">
                        <LockedValue label={group.lock} />
                      </div>
                    ) : (
                      group.sensors.map((sensor) => /* the row button, unchanged */)
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
```
The old `div.drill` wrapper goes; the "Sensor list" and "Sensor detail" landmarks stay (E2E-22). Heading levels: `h1` title; `h2` the panel's sensor name and the hardware headings; a card title is `h2` on a page with one hardware item and `h3` under a hardware heading (Memory). With a fixed `h3`, a heading list on the CPU page would read the cards as parts of the selected sensor ("CPU Total › Temperatures · 5"). A card is a `div` with a heading, not a named `section` as in the mockup: a region per card would repeat landmark names on the Memory page ("Data", "Temperatures" and "Timings" for each DIMM), and the headings already give screen-reader navigation.

**`src/styles/app.css`.** Replace the block under `/* ---- Drill-down: the list and detail panes share a row … */` (`.drill`, `.drill__list`, `.drill__detail`) with:
```css
/* ---- Drill-down: the detail panel on top, the group cards below in columns (v0.1.1 UI proposal, variant B) ---- */

.drill__detail {
  margin-top: -8px;
  padding: 8px 0 4px;
  background: var(--bg);
}
/* The panel sticks only in a window tall enough to leave the cards about 450 px (v0.1.1 techspec, Q&A #1). */
@media (min-height: 800px) {
  .drill__detail {
    position: sticky;
    top: 0;
    z-index: 1;
  }
  /* Keyboard focus scrolls a row out from under the panel (at most ~350 px tall) instead of hiding it (Q&A #5). */
  html:has(.drill__detail) {
    scroll-padding-top: 360px;
  }
}
.drill__list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.drill__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drill__columns {
  columns: 270px;
  column-gap: 16px;
}
```
In the "Drill-down and About" block, replace `.list`, `.list__heading` and `.list__group` with:
```css
.drill__heading {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 600;
}
.group {
  break-inside: avoid;
  box-decoration-break: clone;
  margin: 0 0 16px;
  padding: 4px 6px 6px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.group--split {
  break-inside: auto;
}
.group__title {
  break-after: avoid;
  margin: 0;
  padding: 8px 8px 6px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.group__lock {
  padding: 2px 8px 8px;
}
```
and change these existing rules (only the listed properties):

| Rule | Change |
|---|---|
| `.row` | `min-height: 36px` (was 40), `padding: 6px 8px` (was `0 10px`), add `break-inside: avoid` |
| `.row__name` | add `overflow-wrap: anywhere` (long DIMM timing names wrap) |
| `.row__value` | add `white-space: nowrap` |
| `.detail` | `gap: 12px` (was 18), `padding: 16px 20px` (was 22), add `box-shadow: 0 10px 24px -14px var(--shadow)` |
| `.detail__top` | `gap: 12px 28px` (was `12px 24px`) |
| `.detail__title` (new) | `flex: 1 1 320px; min-width: 0` |
| `.detail__heading` (new) | `display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px` |
| `.detail__name` | `font-size: 22px` (was 26), add `overflow-wrap: anywhere` |
| `.detail__id` | drop `margin-top: 4px` (it sits next to the name now) |
| `.detail__value` | `font-size: 40px` (was 44) |
| `.detail__value .unit` (new) | `font-size: 16px` (the mockup's unit next to the big value) |
| `.stats` | `display: flex; flex-wrap: wrap; gap: 10px` (was a 3-column grid) |
| `.stats__box` | add `min-width: 120px`; `padding: 10px 12px` (was `12px 14px`) |
| `.stats__box:last-child` (new) | `min-width: 80px` (Unit) |
| `.stats__box dd` | `margin: 2px 0 0` (was `4px 0 0`), `font-size: 16px` (was 18) |
| `.chart__svg--detail` | `height: 130px` (was 200) |

**`src/theme/tokens.css`:** add `--shadow: rgba(0, 0, 0, 0.45);` to `:root[data-theme="dark"]` and `--shadow: rgba(14, 22, 38, 0.18);` to `:root[data-theme="light"]`, with "`--shadow` from the v0.1.1 UI proposal" added to the header comment.

**`README.md`.** Before:
```markdown
Status: v0.1.0, live dashboard (see [specs/v0.1.0/techspec.md](specs/v0.1.0/techspec.md)). Specs for every version: [specs/](specs/).
```
After:
```markdown
Status: v0.1.1, live dashboard with the new sensor drill-down (see [specs/v0.1.1/techspec.md](specs/v0.1.1/techspec.md)). Specs for every version: [specs/](specs/).
```

**Spec docs (this session):** `specs/v0.1.1/README.md` (status, open questions answered), `specs/v0.1.1/ui-proposal/ui-proposal.md` (measured sizes, open UI questions answered, the new token), the v0.1.1 row of the [version map](../v0.1.0/requirements.md#version-map), a revision line in the v0.1.0 techspec (its drill-down rows are superseded here), and `specs/v0.2.0/README.md` (the form makes the sticky panel taller).

### Anti-overengineering breakdown

Owner: "Accept as proposed (Recommended)" (Q&A #4); the focus rule was added after it, with its own answer (Q&A #5).

| Candidate | Verdict | Why |
|---|---|---|
| `--shadow` token (2 lines) and the panel shadow | **Keep** | In the chosen mockup; separates the sticky panel from the cards that scroll under it |
| A group locks only when **every** value is `null` | **Keep** | It is the dashboard's rule ("a `null` value plus a need is a lock") at group level. A lock never hides a live value, even if the UI table and `Availability.cs` drift apart after an LHM bump. |
| `accessOf`, one function for the lock inputs | **Keep** | About 5 lines; both pages read privilege and PawnIO the same way. Their needs can still differ (see [Group needs](#group-needs-groupneeds-the-copy-of-rf3)) |
| `scroll-padding-top` while the panel sticks | **Keep** (Q&A #5) | Measured: at 1917×1029 a focused row can sit under the panel with no scroll; one rule fixes it |
| Special copy when every group is locked | **Cut** | Not reachable on known hardware (see Out-of-scope) |
| `min-width` on values against re-wrap jitter | **Cut** | Add it only if E2E-27 shows cards moving |
| A Storage ("admin") group lock | **Cut** | Unprivileged, no Storage hardware is in the frame, so no Disk group can be locked |
| The blocking panel on the drill-down | **Cut** | Not asked for; unchanged from v0.1.0 |
| New test files | **Cut** | The tests extend `fields.test.ts` and `SensorList.test.tsx` |
| Exporting `lockFor`, or a separate drill-down lock helper | **Cut** | `drillSections` returns the lock with the group, so nothing outside `fields.ts` needs the rule |
| Helper or core changes, a helper version bump | **Cut** (Q&A #3) | UI-only; a helper rebuild re-opens the helper regression rule for nothing |

### Data models

#### `SensorGroup`: one card of the drill-down (UI model)

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | yes | LHM `SensorType` name (`"Clock"`) |
| `label` | string | yes | Plural label (`"Clocks"`); unknown types get an "s" |
| `sensors` | `UiSensor[]` | yes | Every sensor of that type in the section, in LHM `index` order, locked or not (the title counts them) |
| `lock` | `"Needs full sensors" \| "Needs PawnIO" \| null` | yes | **New.** Set only when every `value` is `null` and `lockFor(access, groupNeeds(hardware.type, type))` returns a label |

```text
{ "type": "Clock", "label": "Clocks", "sensors": [ /* 3 UiSensor, all value: null */ ], "lock": "Needs full sensors" }
```

> **Full sensors, all values `null` (Motherboard Controls · 6):** `groupNeeds` is `pawnio`, but PawnIO is usable, so `lockFor` returns `null`: six rows reading "—", as in v0.1.0.

```text
{ "type": "Control", "label": "Controls", "sensors": [ /* 6, all value: null */ ], "lock": null }
```

#### Group needs (`groupNeeds`), the copy of RF3

| Hardware type | Sensor types that need PawnIO | Everything else |
|---|---|---|
| `Cpu` | all except `Load` | `none` |
| `Motherboard`, `SuperIO`, `EmbeddedController` | all | — |
| `GpuIntel` | `Power` | `none` |
| `Memory`, `Storage`, `GpuNvidia`, `GpuAmd`, others | none | `none` |

> **Differs from the dashboard (accepted, no Dashboard change):** the v0.1.0 card rules give every GPU field `needs: none`, so a `null` Intel GPU power reads "—" on the dashboard, while its drill-down Power group locks ("Needs full sensors" or "Needs PawnIO"). Not seen on hardware (no Intel GPU here); UT-38 (c) covers the drill-down side.

**Lock label** (`lockFor`, unchanged): not elevated → "Needs full sensors"; elevated, and PawnIO not installed or `loaded === false` → "Needs PawnIO"; otherwise none.

| Frame and status | CPU Loads | CPU Clocks, Power, Voltages, Temperatures, Factors | GPU (NVIDIA, AMD) groups |
|---|---|---|---|
| Reduced (`frame-reduced.json`, `liveReduced`) | rows | "Needs full sensors" | rows |
| Elevated, PawnIO missing (`frame-elevated-no-pawnio.json`) | rows | "Needs PawnIO" | rows |
| Elevated, PawnIO installed, driver not running (`loaded: false`) | rows | "Needs PawnIO" | rows |
| Full sensors | rows | rows | rows |

#### UI states on the drill-down

| State | Shows |
|---|---|
| Full sensors | Cards and rows with values; no banner |
| Reduced | The "Reduced sensors" banner (with its notice or PawnIO line when there is one); locked cards with no rows |
| Elevated without a usable PawnIO | The "Full sensors are on, but PawnIO isn't installed" (or "…driver isn't running") banner; CPU cards "Needs PawnIO" |
| Elevation in flight | The "Waiting for the UAC prompt…" or "Connecting to sensors…" banner; the page stays usable |
| Stale (reconnecting, or no frame for 3 periods) | Every value "—" in rows and panel; the reconnecting banner (none for the watchdog case, as on the dashboard); locked cards stay locked |
| No frame yet, or stopped with a blocking notice | "No sensor data yet." (unchanged) |
| A scope with no sensors | The caption "This component has no sensors in the current frame." in the panel's place |
| The selected sensor's value is `null` | The panel shows "—" and an empty chart |
| No row clicked yet | The first unlocked row is selected; it can change when groups unlock or lock (v0.1.0 rule) |

#### Fixed layout parameters

| Parameter | Value | Source |
|---|---|---|
| Column width / gap | at least 270 px / 16 px | Mockup B, ADR 0030 |
| Card bottom margin, padding | 16 px; 4 / 6 / 6 px | Mockup B |
| A card never splits when it has | 8 rows or fewer, or a lock | UI proposal |
| Row height, padding | at least 36 px; 6 px 8 px | Mockup B |
| Panel chart height | 130 px (viewBox 600×160) | Mockup B |
| Sticky from window height | 800 px | Q&A #1 |
| Focus scroll padding while sticky | 360 px | Q&A #5; the panel measured 273–348 px |

#### Measured sizes (render check)

Headless Edge 155.0.4283.62, the WebView2 runtime's build; not the app.

| Page | 1917×1029 | 1024×680 |
|---|---|---|
| CPU, full | 1,266 px = 1.23 screens; 5 columns; 3 split cards | 2,444 px = 3.59 screens; 2 columns |
| CPU, reduced | 1 screen | 2.06 screens |
| GPU, Disk, Motherboard | 1 screen each (Disk balances into 4 columns) | — |
| Memory | 1.39 screens | 3.01 screens |
| Panel wrapper | 273 px (756 px left for cards) | 348 px; Min / Max / Unit wrap to a second line. At 1024×800 it sticks and leaves 452 px. |

### Endpoints mapping

Not applicable: no Tauri command or Channel message changes. The banner calls `enable_full_sensors` and `open_pawnio_site` exactly as on the dashboard.

## Sequence

| # | Step | Why here | Depends on |
|---|---|---|---|
| 1 | **Model:** `fields.ts` (`accessOf`, `groupNeeds`, `SensorGroup.lock`, `drillSections(…, status)`), plus UT-34 updates and UT-38, and the AGENTS.md checklist line | Pure logic with fixtures; the page needs it; UT-31 proves the `lockFor` refactor didn't change the dashboard | — |
| 2 | **Page and styles:** `SensorList.tsx`, `app.css`, `tokens.css`, plus UT-39. **Then, early:** render in `npm run tauri dev`, reduced mode, both themes: the layout at 1917×1029 and 1024×680, and the sticky panel and E2E-22's Shift+Tab step at 1024×800 (the reduced CPU page only scrolls in the narrow window) | CSS is where the risk is; seeing it in the real WebView2 before the release saves a rebuild | 1 |
| 3 | **Version bump and README:** `npm version 0.1.1 --no-git-tag-version`, `tauri.conf.json`, `Cargo.toml`, then `cargo check` in `src-tauri` (so `Cargo.lock` says 0.1.1 before the owner's commit), the About test, the README status line | Independent; last, so the dev runs in step 2 don't mix versions. The owner commits after it: step 4 builds from that commit | — |
| 4 | **Release build and checks:** in the follow-ups clone, build `pophood.exe` only, keeping the helper of record, then the devtools variant for the CDP checks (ADR 0019; see [Integration points](#integration-points-external)); `npm test`, `cargo test` (with the integration tests); on the release exe E2E-12, E2E-21, E2E-23's file checks and E2E-15 (the network audit, owner); on the devtools variant E2E-22, E2E-23's About page, E2E-27 and PERF-02 | Last: it needs everything. The owner runs the UAC step and the elevated capture. | 2, 3 |

Each step ships with its tests. The steps map onto `tasks-breakdown` tasks; step 4 may be one owner-facing task.

## Integration points [external]

| Integration | Availability | Notes |
|---|---|---|
| **WebView2 runtime 155** (Evergreen) | System | Needs CSS multi-column fragmentation with `box-decoration-break: clone` (Chromium 130+), `position: sticky`, `:has()` (Chromium 105+) and `scroll-padding-top`. All were rendered on Edge 155.0.4283.62, the runtime's build. A runtime bump re-runs E2E-15 anyway (AGENTS.md). |
| **The helper of record** | `C:\Users\jimmy\pophood-e2e\pophood-followups`, helper `553a7f49…` | v0.1.1 doesn't change the helper. Rebuild only `pophood.exe` in that clone after the owner's v0.1.1 commit (pulled with `--ff-only`), with a short separate `CARGO_TARGET_DIR` and `npm run tauri build -- --no-bundle --config '{"build":{"beforeBuildCommand":"npm run build"}}'` (AGENTS.md "Build notes"; template `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1`). Then build the **devtools variant** from the same clone into its own `CARGO_TARGET_DIR`: the same command plus `--features tauri/devtools` (template `sessions/20261021165812_pophood-v010-e2e/pass2-build.ps1`); start it with `devtools-start.ps1` from that folder (CDP on 127.0.0.1 only: test instrumentation, never the product). Check the staged helper's SHA-256 before and after both builds, and on the About page. Run `npm ci` first (the lock changed). Use the working tree's `scripts/audit-network.ps1`: the clone's copy predates the cue fix. |
| **No network** | — | Unchanged. No new URL, no `<a href>`, no command. E2E-15 re-runs because every release does. It runs on the release exe, never on the devtools variant. |

## Test plan

**Acceptance criteria** (from the scope stub, the UI proposal and the answers):

| AC | Criterion |
|---|---|
| AC-01 | One card per SensorType, in the v0.1.0 order and labels, titled "{LABEL} · {n}" (n counts locked sensors too); rows in LHM `index` order; Memory grouped by hardware with a heading per item (RF26) |
| AC-02 | Cards flow down, then across, in columns at least 270 px wide with a 16 px gap: 5 columns at 1917 px, 2 at 1024 px. A card of 8 rows or fewer, or a locked one, never splits; a larger one may continue at the top of the next column, keeping its border, with no title |
| AC-03 | The panel is full width on top: group, name, identifier (mono), value (40 px), "now · refreshes every second", Min (10 min), Max (10 min), Unit, and the 10-minute chart (130 px). In a window at least 800 px tall it stays at the top while the page scrolls; below that it scrolls with the page. A focused row is never hidden under it |
| AC-04 | The first row of the first unlocked group is selected on open, and stays "the first unlocked row" until a click; a click selects a row (`aria-pressed`, `raised` background, `accent` border); when the clicked sensor leaves the frame or its group locks, the first unlocked row shows, and the clicked one comes back when it is selectable again |
| AC-05 | The dashboard's status banner, with every state, shows under the header. A group whose values are all `null` and that needs more than the helper has shows only its title and "Needs full sensors" or "Needs PawnIO", and no rows. A live value is never hidden or rewritten (RF3) |
| AC-06 | The v0.1.0 states stay: stale values "—"; "No sensor data yet."; the no-sensors caption (now in the panel's place); a `null` selected value shows "—" and an empty chart; values `null` and fans at 0 RPM are muted |
| AC-07 | The app reports 0.1.1 (About, bundle metadata); the helper stays 0.1.0 with the hash of record |
| AC-08 | The trust invariants hold: no network from the tree (E2E-15); no change under `helper/` or `src-tauri/src/` |

### Unit Tests

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| UT-31 | Lock-label matrix (v0.1.0, unchanged) | AC-05 | Still passes after `lockFor`'s parameter type and `accessOf` change: the dashboard's labels are the same |
| UT-34 | Card scopes and drill-down groups (updated) | AC-01 | Every existing expectation holds with `drillSections(…, fullStatus())`. **Added:** in the full fixture every group has `lock: null`, including the all-`null` Motherboard "Controls · 6" |
| UT-38 | Drill-down group locks (new, `fields.test.ts`) | AC-05 | (a) Reduced fixture + `liveReduced()`: the CPU's Temperature, Voltage, Clock and Power groups are "Needs full sensors", Load is `null`. (b) Elevated-without-PawnIO fixture + its status: the same four CPU groups are "Needs PawnIO". (c) A custom reduced frame with a `GpuIntel` item: Power (all `null`) is "Needs full sensors"; a Clock group whose values are all `null` is **not** locked (it needs nothing). (d) A custom reduced frame where a CPU Clock group has one live value: `lock` is `null` (a value is never hidden). The `loaded: false` label is UT-31's row, through the same `lockFor`. |
| UT-39 | Drill-down page (new, `SensorList.test.tsx`; a small helper finds a card by its title heading) | AC-01…AC-06 | (a) Full Motherboard: inside "Sensor list", one card per group titled "Fans · 6", "Temperatures · 3", "Voltages · 2", "Controls · 6"; clicking a Controls row shows "—" in the panel; the card titles are level-2 headings, and on the Memory page level 3 under each hardware heading. (b) Reduced CPU: the "Reduced sensors" region with **Enable full sensors**; the "Clocks · 3" card holds "Needs full sensors" and no button; "CPU Total" (the first Load by `index`; frame order starts with "CPU Core #1") is the only pressed row and the panel's name. **Then** apply `liveElevated()` and a clone of the full frame whose `t` is after the reduced frame's (the reduced fixture is 100 s after the full one), with no click: the panel shows "Core (Tctl/Tdie)", the first unlocked row now. (c) Full CPU, click "Cores (Average)", then apply `liveReduced()` and the reduced frame: the panel shows "CPU Total" and no Clock row exists; apply `liveElevated()` and a later clone of the full frame: "Cores (Average)" is selected again. (d) A custom elevated frame with 9 Load and 8 Clock sensors: the Loads card has `group--split`, the Clocks card doesn't; a custom reduced frame with 9 `null` CPU Clock sensors: the locked card doesn't. (e) Full Motherboard, then `liveReduced()` and the reduced frame (the only way to reach it: the reduced Motherboard card is a placeholder): the scope is `/motherboard` with no sensors, so the caption shows in the "Sensor detail" region. (f) Reduced CPU, then `reconnecting`: the `status` role named "Sensor status" says "Sensors disconnected"; the "Clocks · 3" card is still locked; every Load row ends with "—". (g) Open with no frame ("No sensor data yet."), apply a frame (the page renders), then a blocking stop (`stopped` with `helper_missing`): "No sensor data yet." again, no React error (the hook order). The v0.1.0 tests in the file keep passing; `setup` gets a status parameter, and the "Controls · 6" query reads the card's heading. |
| About | About and versions (updated) | AC-07 | Shows `0.1.1` |

**Strategy:** vitest + jsdom against the v0.1.0 fixtures and small custom frames (`custom`, `hw`, `sensor`). No mocks: `StatusBanner` renders from the store's status; its buttons aren't clicked. CSS isn't applied in jsdom, so layout is checked by E2E-21, E2E-22 and E2E-27.

### Integration Tests

Not applicable: no change under `helper/` or `src-tauri/src/`. `cargo test` (with IT-01…IT-17) still runs in step 4, because `Cargo.toml` changed and the release is rebuilt.

### E2E Tests

On the step-4 builds, as in v0.1.0 (ADR 0019): **release** = the release `pophood.exe`, driven through UI Automation (`ui.psm1`); **devtools** = the devtools variant, driven through CDP (`cdp.psm1`). **A** = the agent runs it; **O** = the owner (UAC, elevated capture). The v0.1.0 rows E2E-12, E2E-21, E2E-22 and E2E-23 are replaced by these; each keeps the v0.1.0 checks this patch doesn't change.

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| E2E-12 (A, O; release) | Drill-down, revised | AC-01, AC-03, AC-04, AC-05 | **Reduced, at 1024×800 (A; the reduced CPU page fits one screen at 1917×1029, so it can't scroll there):** a card click and "All sensors" open the page with live values; the banner; Loads with values and the locked CPU cards (five on this PC: Temperatures, Voltages, Clocks, Power, Factors); "CPU Total" selected; a click on a row far down updates the stuck panel; Min/Max change over time; Memory grouped by hardware; the breadcrumb goes back. **Then open the CPU page again with a card click (a fresh page: no row clicked), and O clicks Enable on its banner and accepts UAC; A checks:** the locks go away without leaving the page; the panel moves to "Core (Tctl/Tdie)"; after a click on a Clock row it stays; the Motherboard page shows "Controls · 6" as rows of "—" |
| E2E-21 (A, O; release) | Window sizes, revised | AC-02, AC-03 | **1024×680, reduced:** 2 columns; nothing clipped; no horizontal scroll; the panel scrolls with the page. **1024×800, reduced:** the panel sticks while the CPU page scrolls. **Full sensors (O clicks Enable), 1917×1029:** CPU in 5 columns, about 1.2 screens; the panel sticks while scrolling. **1280×860 (the default window):** CPU in 3 columns; the panel sticks. Both themes. Split cards keep their border and have no title. The Dashboard is unchanged (2 columns at 1024, 3 at 1280; the history legend may sit below the chart at 1024, as accepted in v0.1.0) |
| E2E-22 (A, O; devtools) | Keyboard and focus, revised | AC-03, AC-04 | Every row reachable with Tab; the 2 px focus ring; the landmarks "Main", "Reduced sensors", "Sensor detail" and "Sensor list" (cards are headings, not landmarks: `h2` on the CPU page, `h3` under each hardware heading on the Memory page). **Shift+Tab under the stuck panel:** scrolled to the bottom, Shift+Tab back through the first rows of each column; each focused row is fully visible below the panel. Run it at 1024×800 reduced (A) and at 1917×1029 with full sensors (O clicks Enable). **Negative control:** in the same session, switch the rule off with `document.documentElement.style.scrollPaddingTop = "0px"` through CDP (CSSOM, which the CSP allows; the inline value beats the stylesheet rule); the same steps at 1917×1029 then leave a focused row under the panel (as measured in the render check). **Dashboard, as in v0.1.0:** every action reachable with Tab, the theme toggle's `aria-label`, and the "History" landmark |
| E2E-23 (A; devtools for the page, release for the files) | About page and versions, revised | AC-07 | The About page shows 0.1.1 and LHM 0.9.6 @ `3d331e3`; the SHA-256 equals `Get-FileHash` of the shipped helper, `553a7f49…`; every Dependencies-table component and the LHM source location are listed, and URLs appear as text (v0.1.0). In the release folder: `(Get-Item pophood.exe).VersionInfo.ProductVersion` starts with 0.1.1; the helper's is still 0.1.0 |
| E2E-27 (A, O; devtools) | Live layout stability (new) | AC-02 | At 1917×1029, 60 s per run, sampling each card's fragment rectangles every second (the v0.1.0 CDP harness, `sessions/20261021165812_pophood-v010-e2e/cdp.psm1`): the CPU page reduced (A), then with full sensors (O clicks Enable). During each run a 20 s CPU load (a pwsh busy loop on every core) pushes the loads from under 10 % to 100 %, so value widths change. The GPU page isn't sampled: the load is CPU-only, so its values hardly change and the run couldn't fail. **Negative control:** the sampler first reports the known split cards (CPU full: 3; CPU reduced: 1, Loads). **Pass:** no card changes columns and no card's fragment count changes. **Fail:** apply the `min-width` fallback (Confidence score) and re-run |
| E2E-15 (O; release) | Network sign-off, re-run | AC-08 | The P5 method: one 180 s scripted run of `scripts/audit-network.ps1` from the working tree (its cues include opening a drill-down), as the v0.1.0 follow-ups release check did. The v0.1.0 30-min idle run repeats only if the WebView2 runtime, Tauri, wry or `BROWSER_ARGS` changed since that check (AGENTS.md). Never on the devtools variant. The v0.1.0 E2E-15 pass criteria; the disclosed `login.live.com` exception applies as before |

### Perf (manual)

The repo has no perf/regression skill (the gap is recorded in the v0.1.0 techspec).

| ID | Surface | Manual scenario |
|---|---|---|
| PERF-02 (re-run) | The drill-down re-renders every frame; the multi-column layout re-flows when text changes | The v0.1.0 trace proxy on the `devtools` variant (owner: "Trace proxy (Recommended)"): busy time per frame on the CPU drill-down, full sensors. **Record and compare** with the v0.1.0 record (p95 8.6 ms, longest task 4.1 ms) and report the change to the owner. Like v0.1.0, it has no pass/fail threshold, and none is invented here |

### QA-scenario pass

- **Who and how:** one independent worker. It wrote its own scenario list from the Design sections and the current code before it read this plan, then compared.
- **Fixed in the design (Rev 1.1):**
  - **High:** the snippet called `useSensorStatus()` after the `frame === null` early return, which breaks React's hook order when the first frame arrives or a blocking stop clears it. It now sits with the other hooks; UT-39 (g) locks it.
  - **High:** the "reduced → full" workflow said the selected row stays. Without a click, the v0.1.0 rule moves the selection to the first unlocked row ("Core (Tctl/Tdie)"). The text now says so, the rule is kept on purpose (Key Decisions), and UT-39 (b) locks it.
  - **Low:** cards were named `section`s, which repeated landmark names on the Memory page; they are now `div` + `h3` (Rev 1.2: `h2`, or `h3` under a hardware heading).
  - **Low:** the helper's version check is E2E-23, not UT-13 (UT-13 passes for any staged helper).
- **Strengthened:** UT-39 (b) (the first Load is "CPU Total" by `index`, not by frame order), (c) (the clicked row comes back after re-elevation), (e) (the only real path to an empty Motherboard scope), (f) (stale on a locked page; the reconnecting banner is a `status`, not a region); E2E-12, E2E-21 and E2E-22 (the reduced CPU page fits one screen at 1917×1029, so the sticky and focus checks run at 1024×800 reduced and at 1917×1029 with full sensors); E2E-22's negative control; E2E-23 (file versions); E2E-27 (a load step and the split-card negative control).
- **Cut:** UT-38's GPU and NVMe parts (the fixtures have no `null` there, so they couldn't fail), UT-38's `loaded: false` case (UT-31 covers it through the same `lockFor`), UT-39's elevated-without-PawnIO render (UT-38 (b) and `StatusBanner.test.tsx` cover it), and the GPU page from E2E-27's full-sensors run (GPU values don't change with elevation).
- **Verdict:** every committed behaviour maps to at least one scenario. The worker checked every "before" snippet, line hint and "was" CSS value against the files and found them correct.

## Monitoring and observability

Not applicable: no new events. The drill-down now shows the same `SensorStatus` banner as the dashboard, so the health signal is visible on both pages.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Rejected alternatives |
|---|---|---|
| The lock comes with the group from `drillSections` | One owner of the rule (`fields.ts`); the page only renders | Exporting `lockFor` (the page would rebuild the inputs); a separate helper next to `drillSections` (two calls for one model) |
| The group needs table mirrors `Availability.cs`, and a lock needs every value `null` | The label is exact: a GPU group that is `null` for another reason shows "—", not a false "Needs full sensors". The `null` condition keeps "never hide a value" true if the table drifts | A value-only rule (all `null` and not elevated → lock): it would label groups the helper doesn't null |
| Sticky only at ≥ 800 px window height (Q&A #1) | At 1024×680 a stuck 348 px panel leaves 332 px; from 800 px the cards keep ≥ 452 px | Always sticky; a compact panel; never sticky |
| `scroll-padding-top: 360px`, only while sticky and only on the drill-down (`:has`) (Q&A #5) | The browser counts a row under the panel as visible and doesn't scroll to it; the padding makes it scroll. `:has` keeps the Dashboard and About untouched | A JS measurement of the panel (more code for a few pixels); nothing (keyboard focus hidden) |
| `StatusBanner` reused with every state (Q&A #2) | No new code; the other states explain "Needs PawnIO" and the dashes | Only the reduced state (a prop or filter) |
| App 0.1.1, helper stays 0.1.0 (Q&A #3) | The helper binary, its hash and its elevated evidence stay valid; only `pophood.exe` is rebuilt | Bumping the helper (re-opens the helper regression rule) |
| A CSS class for splitting (`group--split`) | Layout stays in `app.css`, and jsdom can see a class (UT-39 (d)) | A `style` prop: the CSP would allow it (React sets it through CSSOM), but it puts layout in the markup |
| A card is a `div` with a heading: `h2` on a page with one hardware item, `h3` under a hardware heading | The mockup's `section aria-label` makes each card a landmark, and the Memory page would repeat names ("Timings" per DIMM); headings give the navigation. The level keeps the outline right: on the CPU page the cards sit next to the panel's sensor name, not under it | A region per card; `role="group"` with `aria-labelledby` (more markup, same duplicates); always `h3` (a heading list reads the cards as parts of the selected sensor) |
| No stored selection until a click (v0.1.0 rule kept) | No extra state. After **Enable full sensors**, a page with no click moves to the package temperature, which elevation has just unlocked | Storing the first row on open (an effect, and it would keep "CPU Total" after elevation) |

### Known Risks

| Risk | Likelihood / impact | Mitigation / next check |
|---|---|---|
| A value whose text changes length every second re-wraps a long name, so the column balance moves cards between columns | Medium / Low (visible jitter) | E2E-27; fallback `min-width` on `.row__value` |
| The real panel is taller than 360 px (a long name wrapping at 1024 px, a display scale above 100 %), so a focused row is partly hidden | Low / Low | E2E-22's Shift+Tab step; raise the padding |
| Headless Edge differs from the app's WebView2 (CSP, Tauri, scale) | Low / Medium | Step 2 renders in `tauri dev` before the release |
| The UI's needs table drifts from `Availability.cs` after an LHM bump | Low / Low | The `null` condition keeps values visible; the label could be "—" instead of a lock. AGENTS.md's LHM-bump checklist names `groupNeeds` from step 1 on (implementation map) |
| The sticky panel covers part of the page while the owner reads cards near the top | — / Low | Accepted with variant B; the panel is 273 px at the owner's window |
| v0.2.0's rename form makes the panel taller | Certain in v0.2.0 / Low | v0.2.0 re-measures the panel, the 800 px threshold and the 360 px padding (noted in its scope stub) |

### Compliance with AGENTS.md and Rules

- **Trust invariants:** none touched. No helper or core change; no URL or `<a href>`; no new command; the UI owns copy only and never rewrites a value (RF3): the lock needs every value `null`. The LHM-bump checklist gains `groupNeeds` (step 1), so the UI's copy of the RF3 table is re-checked with `Availability.cs`.
- **Regression rule:** it covers changes under `helper/` or `src-tauri/src/sensors/`; neither changes. `npm test` and `cargo test` still run, and E2E-15 re-runs for the release.
- **Build notes:** the helper's hash depends on the build folder, so the release keeps the helper of record and rebuilds only `pophood.exe` (the AGENTS.md recipe). The devtools variant for the CDP checks is built the same way (ADR 0019), so neither build touches the helper.
- **Conventions:** a patch gets `specs/v0.1.1/` with a scope stub and a techspec; owner answers are verbatim (Q&A record and the session's `owner-decisions.md`); evidence has its source and limits (`measurements.txt`). Branching and commits stay with the owner.
- **Evidence rule:** each new pass/fail check has a negative control: E2E-22 (the focus rule switched off), E2E-27 (the known split cards), UT-38 (d) and the full fixture's unlocked "Controls · 6" (UT-34) for the lock rule.

### Compliance with Skills

There are no project skills (`.agents/skills`). These session skill drafts apply:
- **`webview2-network-audit`:** E2E-15 for the release.
- **`pophood-design-canvas-mockup`** (`sessions/20261022163940_pophood-v011-drilldown-design/skills/`): its "plan a WebView2 render check early" step is done here (`evidences/render-check/`).

### Relevant and Dependent Files

- **Specs:** `specs/v0.1.1/README.md`, `specs/v0.1.1/ui-proposal/ui-proposal.md`, `specs/v0.1.1/ui-proposal/mockups/Main.dc.html`, `specs/v0.1.0/techspec.md` (lock labels, RF3, the drill-down rows, E2E-12/15/21/22/23, PERF-02), `specs/v0.1.0/requirements.md` (RF26, UX), `specs/v0.2.0/README.md`
- **ADRs:** `sessions/20261022163940_pophood-v011-drilldown-design/decisions/0030-v011-drilldown-layout.md`
- **Code:** `src/pages/SensorList.tsx`, `src/cards/fields.ts`, `src/cards/CardParts.tsx`, `src/shell/StatusBanner.tsx`, `src/charts/LineChart.tsx`, `src/sensors/store.ts`, `src/sensors/protocol.ts`, `src/styles/app.css`, `src/theme/tokens.css`, `src/App.tsx`, `src/pages/About.tsx`, `helper/Availability.cs` (read only)
- **Tests and fixtures:** `src/cards/fields.test.ts`, `src/pages/SensorList.test.tsx`, `src/test/builders.ts`, `src/test/fixtures/frame-{full,reduced,elevated-no-pawnio}.json`
- **Evidence:** `sessions/20261022171503_pophood-v011-techspec/evidences/render-check/` (measurements, prototype, screenshots); P1 dumps `C:\Users\jimmy\pophood-probes\probe-ids\ids-{elev,unpriv}-1.json`
- **Release:** `C:\Users\jimmy\pophood-e2e\pophood-followups` (helper of record), `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1`, `sessions/20261021165812_pophood-v010-e2e/{pass2-build.ps1,devtools-start.ps1,cdp.psm1,ui.psm1}` and its ADR 0019 (`decisions/0019-agent-e2e-uia-and-cdp.md`), `scripts/audit-network.ps1`
- **Repo rules:** `AGENTS.md` (the LHM-bump checklist line, step 1)

## Open questions from the scope stub: disposition

| Question | Disposition |
|---|---|
| The sticky panel in a short window | Sticky from 800 px tall (Q&A #1), plus the focus padding (Q&A #5) |
| The banner on the drill-down | `StatusBanner` with every state (Q&A #2) |
| The lock rule | `drillSections` returns `lock` per group, through `lockFor` and `groupNeeds`; `lockFor` stays private |
| The version bump | App 0.1.1 in `package.json` (+ lock), `tauri.conf.json`, `Cargo.toml` (+ lock), the README, `THIRD-PARTY-NOTICES.md` line 3 (Q&A #7) and the About test; the helper stays 0.1.0 (Q&A #3) |
| Verify the estimates (UI proposal #4) | Rendered in Edge 155.0.4283.62 ([measured sizes](#measured-sizes-render-check)); the app check is E2E-21 |

## Q&A record

Answers given in this techspec session (#1–#5), in its review (#6) and in the tasks breakdown (#7), 2026-10-22, quoted verbatim.

| # | Question | Answer |
|---|---|---|
| 1 | How should the sticky detail panel behave in short windows? (Measured: 273 px at 1917×1029, leaving 756 px for cards; 348 px at 1024×680, leaving 332 px.) | "Sticky from 800 px tall (Recommended)" |
| 2 | Which status banners should the drill-down show? | "All states, same banner (Recommended)" |
| 3 | Version bump for v0.1.1? | "App 0.1.1, helper stays (Recommended)" |
| 4 | The anti-overengineering list: accept it? | "Accept as proposed (Recommended)" |
| 5 | Add one CSS rule so keyboard focus never hides under the sticky panel? | "Add the rule (Recommended)" |
| 6 | The adversarial review found one Medium and nine Lows ([`review.md`](../../sessions/20261022184039_pophood-v011-techspec-review/review.md)). Which to fix? | "fix everything" |
| 7 | (Tasks breakdown) `THIRD-PARTY-NOTICES.md` line 3 says "Pophood 0.1.0 is built from source…", and the version bump leaves it out. What should T3 do? | "Bump it to 0.1.1 (Recommended)" |

## Revision history

- **Rev 1 (2026-10-22):** first version, with the render check.
- **Rev 1.1 (2026-10-22):** the independent QA-scenario pass is merged: the hook order in `SensorList`, the selection after an unlock (the text now matches the v0.1.0 rule, kept on purpose), cards as `div` + `h3`, the helper's version check, and the test rows listed in the [QA-scenario pass](#qa-scenario-pass).
- **Rev 1.2 (2026-10-22):** the adversarial review ([`review.md`](../../sessions/20261022184039_pophood-v011-techspec-review/review.md)) is merged (owner: "fix everything", Q&A #6).
  - **Medium:** the CDP checks (E2E-22, E2E-23's page, E2E-27, PERF-02) run on a devtools variant built with the release (ADR 0019); step 4 builds it, and each E2E row names its build.
  - **Low:** E2E-27 drops the GPU run (it couldn't fail); the Intel GPU power difference from the dashboard is written down and accepted; the `groupNeeds` line goes into AGENTS.md with the code (step 1); the E2E-21, E2E-22 and E2E-23 rows keep their v0.1.0 checks; `cargo check` in step 3 updates `Cargo.lock` before the commit; E2E-12 opens the CPU page again before Enable; E2E-15 is one 180 s run unless a runtime, Tauri, wry or flag change calls for the 30-min run; card titles are `h2`, or `h3` under a hardware heading; text fixes (the reason for `group--split`, the reduced Motherboard frame), and E2E-21 adds the default window. AGENTS.md now names the patch folder (`specs/v0.N.1/`).
- **Rev 1.3 (2026-10-22, tasks breakdown):** `THIRD-PARTY-NOTICES.md` joins the version bump: its line 3 names the app version, and the About page shows it (Q&A #7). [tasks.md](tasks.md) is written: 6 tasks, with a code review (T4) before the owner's commit, and step 4 split into T5 (agent) and T6 (owner). No design change, so the scores stand.
