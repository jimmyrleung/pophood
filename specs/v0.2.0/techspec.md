# Techspec - Pophood v0.2.0: rename any sensor (slice 2)

- **Date:** 2026-10-23
- **Mode:** feature integration (requirements Q&A #1). Design approach: **pragmatic-balance** (the feature-integration guidance).
- **Inputs:**
  - [requirements.md](requirements.md) (Rev 2, 93%): RF13.1–13.9, RF26.1–26.6, H1, H2 and the open questions OQ-A to OQ-E;
  - [README.md](README.md) (scope stub) and ADR 0035 (`sessions/20261023084459_pophood-v020-define-reqs/decisions/0035-v020-rename-scope.md`);
  - the [v0.1.1 techspec](../v0.1.1/techspec.md) (the sticky panel, AC-03, the measured sizes) and the [v0.1.0 techspec](../v0.1.0/techspec.md);
  - the render check in this session: [`evidences/render-check/`](../../sessions/20261023085728_pophood-v020-techspec/evidences/render-check/measurements.txt).
- **Owner answers:** Q&A #1–#7 in this session, verbatim in the [Q&A record](#qa-record) and in `sessions/20261023085728_pophood-v020-techspec/owner-decisions.md`. ADR 0036 records the label store.
- **Next:** implementation, from [tasks.md](tasks.md) (2026-10-23). The adversarial review (`sessions/20261023112712_pophood-v020-techspec-review/review.md`, 92%) is folded into the tasks, not into a Rev 1.2; where the tasks differ from this techspec, the tasks win ([Changes to the techspec](tasks.md#changes-to-the-techspec)).

## Summary

The owner can give any sensor a display name in the drill-down. The name is saved on this PC and shows in the drill-down (rows, heading, chart name) and on the Motherboard card's fan rows. The design has three parts:
- **Core (Rust):** a new module `src-tauri/src/labels.rs` keeps the labels in `%LOCALAPPDATA%\dev.pophood\labels.json` (a versioned JSON file, written atomically at a fixed path). Two new commands: `load_labels` and `set_label`.
- **UI (React):** a new label store `src/sensors/labels.ts` loads the map once at start. `SensorList` and `MotherboardCard` look up each sensor's `key` at render. A small `RenameForm` in the detail panel saves and resets; it remounts for each sensor, so a typed name can only go to the sensor it was typed for.
- **Copy and layout:** the Motherboard card's link reads "Name your fans"; the Motherboard drill-down subline ends with "· generic names until you rename them"; the focus scroll padding grows from 360 px to 520 px because the panel is taller.

**Blast radius:** UI files `SensorList.tsx`, `MotherboardCard.tsx`, `CardParts.tsx`, `commands.ts`, `main.tsx`, `app.css`, a new `labels.ts`; core files `lib.rs`, `commands.rs` and a new `labels.rs`; their tests; the version bump (app 0.2.0, helper stays 0.1.0); the README; one AGENTS.md line; the spec docs. **Nothing changes under `helper/` or `src-tauri/src/sensors/`**, so the helper regression rule (AGENTS.md) doesn't apply and the release keeps the helper of record (`553a7f49…`). No pipe or Channel change. No new network flow.

## Approach

**Chosen approach: pragmatic-balance.** The label is a display lookup on `UiSensor.key`, which every sensor already carries. The core owns the file because the file must outlive the WebView2 profile and v0.3.0's SQLite (also in the core) will migrate it. The UI owns everything visible.

**Reused, unchanged:**
- `UiSensor.key` = `"{id}|{name}"` (`events.rs`, ADR 0008) as the label key;
- `buildDashboard` and every name match in `fields.ts`: labels never enter the model, so sensor matching always uses LHM's names (RF13.2);
- the selection rule in `SensorList` (first unlocked row, fallback when the selected row leaves) and the v0.1.1 layout;
- the command pattern (`#[tauri::command]` in `commands.rs`, thin wrappers in `commands.ts`, no capability files);
- the store pattern (`createSensorStore` + context + `useSyncExternalStore`);
- the `.btn` / `.btn--secondary` buttons and the theme tokens (`--accent-fill`, `--on-accent`, `--strong`, `--inset`, `--danger-text`).

**Net-new:**
- `src-tauri/src/labels.rs` (`LabelStore`: load, validate, atomic write) and two commands;
- `src/sensors/labels.ts` (`createLabelStore`, `labelStore`, `LabelStoreContext`, `useLabels`, `useLabelStore`, `MAX_LABEL_LENGTH`);
- `RenameForm` inside `SensorList.tsx`; a `linkText` prop on `Card`;
- CSS: `.rename*`, `.row__default`, `.btn--accent`, `.btn:disabled`; `scroll-padding-top: 520px`.

**Explicitly not built** (owner: "Accept as proposed (Recommended)", Q&A #7; details in the [Anti-overengineering breakdown](#anti-overengineering-breakdown)): an orphan list, label export, labels in `buildDashboard`, a `clear_label` command, disabled-while-saving buttons, load-time validation of entries, size caps on the file, SQLite, any helper or `sensors/` change.

## Confidence score

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| API/docs and requirements clarity | 30% | 95% | Requirements Rev 2 (reviewed, 93%) plus 7 owner answers this session close OQ-A to OQ-E and the sticky numbers. Copy from mockup E2 and the owner's caption. Library facts checked today: `std::fs::rename` replaces an existing file on Windows (`MoveFileExW` / `SetFileInformationByHandle`, doc.rust-lang.org); Tauri 2 sync commands run on the main thread and an `Err` rejects the JS promise (v2.tauri.app "Calling Rust"). **Gap:** `Option<String>` from a JS `null` is standard serde behaviour, not stated on the Tauri page. |
| Suitable inspected patterns | 25% | 95% | Every change follows code read end to end in this session: `SensorList.tsx`, `fields.ts`, `CardParts.tsx`, `MotherboardCard.tsx`, `DashboardCard.tsx`, `Dashboard.tsx`, `store.ts`, `StoreProvider.tsx`, `theme.ts`, `commands.ts`, `main.tsx`, `App.tsx`, `commands.rs`, `lib.rs`, `webview.rs`, `app.css`, `LineChart.tsx`, `history.ts`, `protocol.ts` and the tests (`SensorList`, `Cards`, `Dashboard`, `App`, `theme`). The form CSS was rendered with the app's own `app.css` in Edge 155.0.4283.62. |
| Data-flow/dependency understanding | 20% | 94% | Start: `setup` → `LabelStore::open` → `load_labels` → `labelStore.start()` in `main.tsx`. Render: `useLabels()` → `map.get(sensor.key)`. Save: `RenameForm` → `store.save` → `set_label` → atomic write → map update → re-render on both pages without a frame. `SensorList` keeps one `SensorDetail` instance per selected key, so `key={sensor.key}` on the form gives the draft rule. **Residual:** a save still in flight when the selection moves loses its error message (accepted, Known Risks). |
| Complexity understood and controlled | 15% | 93% | Small diff; one new state machine (the form). **Not seen yet in the app:** the form at 1024 px in the real WebView2 with the CSP (the render check is headless Edge). |
| Cross-system impact understood and bounded | 10% | 93% | No helper, pipe or `sensors/` change; one new file under `app_local_data_dir`, which `audit-network.ps1 -FreshProfile` does not delete (it removes only `EBWebView`). Harness scripts that find the Motherboard page by "All sensors" are listed ([E2E harness updates](#e2e-harness-updates)). v0.3.0 inherits a migration (ADR 0036). |
| **Total** | | **94%** | 0.30·95 + 0.25·95 + 0.20·94 + 0.15·93 + 0.10·93 = 28.5 + 23.75 + 18.8 + 13.95 + 9.3 = **94.3** |

- **Effective threshold:** 90% (the owner's bar, AGENTS.md). 94% ≥ 90%: an adversarial review, then `tasks-breakdown`.
- **What would lower it:**
  - the real panel taller than 520 px at 1024×800 (a display scale above 100 %): −1; fallback: raise the padding (E2E-22 shows it);
  - Tauri passing a missing `label` differently from `null`: −1; UT-42 calls the wrapper with `null`, and E2E-28's reset proves the round trip;
  - `fs::rename` refusing to replace `labels.json` while another process (antivirus, indexer) holds it open: −1; the save fails visibly (RF13.8) and the name doesn't change.
- **Next checks:** the render in `npm run tauri dev` in step 3 (both themes, 1917×1029, 1280×860, 1024×800, 1024×680), then the E2E rows on the release and devtools builds.

## Out-of-scope

| Item | Why | Revisit |
|---|---|---|
| A list or cleanup of labels whose sensor is absent | Owner: "Keep, no UI yet (Recommended)" (requirements Q&A #3) | A later version |
| Labels on fixed role labels, card titles, the header summary, the history legend, the CPU Hottest suffix | Owner: "Fan rows only (Recommended)" (requirements Q&A #2) | — |
| Labels in run traces | No runs before v0.3.0 | v0.3.0 |
| SQLite | v0.3.0's decision; a 1-table map doesn't need it (Q&A #1) | v0.3.0 migrates `labels.json` (ADR 0036) |
| Export or import of labels | Not asked for | v0.8.0 (RF24) |
| Hiding or reordering sensors | Umbrella answer #6 | v2 |
| A compact form or a width-aware sticky rule | Owner: "Keep 800 px, padding 520 (Recommended)" (Q&A #6) | If the owner finds 1024×800 too tight |
| Bumping the helper | The helper is unchanged; a rebuild changes its hash | Next helper change |

## Architecture

```
 setup (lib.rs)                                     main.tsx
   ├─ webview::build_main_window                      ├─ applyTheme(), watchSystemTheme()
   ├─ LabelStore::open(app_local_data_dir) ──┐        ├─ void labelStore.start() ── invoke("load_labels")
   └─ SensorService::start                   │        └─ render <App/>
                                             │
 commands.rs                                 ▼
   load_labels ─────────► LabelStore { path: …\dev.pophood\labels.json, Mutex<State> }
   set_label(key, label) ─► check → clone map → write labels.json.tmp → flush → rename → commit

 UI
   LabelStoreContext (default value: labelStore)
     ├─ useLabels() ─► SensorList: rows "{label} · {default}", heading, chart name
     │                  └─ SensorDetail ─ <RenameForm key={sensor.key} …/> ─► labelStore.save()
     └─ useLabels() ─► MotherboardCard: fan row = label ?? LHM name; link "Name your fans"
   buildDashboard / fields.ts: unchanged (LHM names only)
```

**Components:**

| Component | Path | Change |
|---|---|---|
| Label store (core) | `src-tauri/src/labels.rs` | **New.** Reads `labels.json` at start, moves a bad file aside, checks inputs, writes atomically |
| Commands | `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` | `load_labels`, `set_label`; `mod labels`; `setup` manages the store |
| Label store (UI) | `src/sensors/labels.ts` | **New.** The map in memory, load once, save, subscribe |
| IPC wrappers | `src/sensors/commands.ts` | `loadLabels`, `setLabel` |
| Start | `src/main.tsx` | `void labelStore.start()` before the first render |
| Drill-down | `src/pages/SensorList.tsx` | Labels in rows, heading and chart name; `RenameForm`; the Motherboard subline |
| Card shell | `src/cards/CardParts.tsx` | `Card` takes `linkText` (default "All sensors") |
| Motherboard card | `src/cards/MotherboardCard.tsx` | Fan rows show the label; `linkText="Name your fans"` |
| Styles | `src/styles/app.css` | Form, renamed row, accent button, disabled button; padding 520 px |

**Workflow: start.**
1. `setup` builds the window (which creates `%LOCALAPPDATA%\dev.pophood`), then `LabelStore::open` reads `labels.json` once.
2. `main.tsx` calls `labelStore.start()`, which calls `load_labels`. The answer is the map and, if the file was bad, a problem text.
3. The first frame takes about a second (the Dashboard shows "Starting the sensor helper…"), so the labels are in memory before any sensor name is drawn.

**Workflow: rename (RF26).**
1. The owner selects a row. The panel's form shows the sensor's label (or an empty input whose placeholder is the default name).
2. The owner types and presses Enter or **Save name**. The form calls `store.save(sensor.key, draft, sensor.name)`.
3. The store trims the text. Empty, or equal to the default name → `set_label(key, null)`; otherwise `set_label(key, label)`.
4. The core checks the key and the label, writes the whole map to `labels.json.tmp`, flushes it, renames it over `labels.json`, then commits the map in memory. Any failure returns `Err(text)` and leaves both the file and the memory map unchanged.
5. On success the UI store updates its map and notifies its listeners: rows, heading, chart name and the Dashboard fan row re-render at once, without waiting for a frame.
6. On failure the form shows "The name wasn't saved: {error}" (or "wasn't reset") and nothing else changes (RF13.8).

**Workflow: the selection changes by itself while the owner types (RF26.2, RF26.3).** `SensorDetail` renders `<RenameForm key={sensor.key} …/>`. When the selected sensor changes for any reason (a click, the fallback to the first row, reduced → full, full sensors lost), React unmounts the old form and mounts a new one: the typed text is gone and the input shows the new sensor's label. When the scope has no sensors, the panel shows its caption and no form. A frame that keeps the same sensor selected re-renders the same form instance, so the text and the focus stay. The save reads `sensor.key` from the props of the form instance the owner typed in, so it can't write to another key.

**Workflow: absent sensors (RF13.6).** The map keeps every entry. Rendering only looks up keys that are in the current frame, so an absent sensor's label shows nowhere, and it shows again when the exact key comes back.

**Data flow, per frame:** unchanged. `SensorList` re-renders every frame as before; the label lookup is one `Map.get` per row.

## Design

### Patterns reused

Every citation was read in this session. Line numbers are hints; the anchor is the symbol.

| Pattern | Source | Usage here |
|---|---|---|
| Label key `"{id}\|{name}"` on every `UiSensor` | `src-tauri/src/sensors/events.rs → UiFrame::from_frame (≈:108)`; `src/sensors/protocol.ts → UiSensor.key (≈:65)` | The map's key; the core never parses it |
| A store with listeners, a new snapshot object per change, `useSyncExternalStore` | `src/sensors/store.ts → createSensorStore, publish (≈:27-38)`, `useSnapshot (≈:104)` | `createLabelStore`, `useLabels` |
| A context holding the store | `store.ts → SensorStoreContext (≈:96)` | `LabelStoreContext`, but with the app's instance as its default value, so no provider is needed and the existing card and dashboard tests run unchanged |
| A per-machine preference loaded before the first render | `src/main.tsx → applyTheme() (≈:15)` | `void labelStore.start()` next to it |
| Thin `invoke` wrappers | `src/sensors/commands.ts → enableFullSensors, openPawnIoSite (≈:3-6)` | `loadLabels`, `setLabel` |
| A command returning `Result<(), String>`, no capability file | `src-tauri/src/commands.rs → open_pawnio_site (≈:33)`; `lib.rs → generate_handler! (≈:79)` | `load_labels`, `set_label` |
| Managed state for commands | `lib.rs → setup: app.manage(SensorService::start(…)) (≈:57)`; `commands.rs → State<'_, SensorService>` | `app.manage(LabelStore::open(&dir))`, `State<'_, LabelStore>` |
| The app's folder | `webview.rs → build_main_window: app.path().app_local_data_dir() (≈:75)`, `create_dir_all (≈:34)` | `labels.json` sits next to `EBWebView` |
| Temp files in Rust tests | `src-tauri/src/sensors/helper.rs → tests::temp_file (≈:216)`: `temp_dir()` + process id + name | `labels.rs` tests use a folder per test the same way |
| Local components inside the page file | `SensorList.tsx → Breadcrumb, SensorDetail` | `RenameForm` |
| Buttons | `app.css → .btn, .btn--secondary, .btn--info (≈:190-211)` | Save is `.btn .btn--accent` (new modifier like `.btn--info`); Reset is `.btn .btn--secondary` |
| The renamed row and the form row | `specs/v0.1.1/ui-proposal/mockups/Main.dc.html` (form ≈:96-104, renamed row ≈:123) | `.rename*`, `.row__default`; buttons keep the app's 44 px height instead of the mockup's 40 px |
| Rendering user text | React escapes text children | A label is always a text child, never `dangerouslySetInnerHTML` |
| Command mocks in page tests | `Dashboard.test.tsx`, `App.test.tsx → vi.mock("../sensors/commands", …)` | `SensorList.test.tsx` mocks the same module, now with `loadLabels` and `setLabel` |

### Interfaces

```rust
// src-tauri/src/labels.rs
pub struct LabelStore { /* path, Mutex<State> */ }
#[derive(Serialize)]
pub struct LoadedLabels { pub labels: BTreeMap<String, String>, pub problem: Option<String> }
impl LabelStore {
    pub fn open(dir: &Path) -> LabelStore;                                     // never fails
    pub fn load(&self) -> LoadedLabels;
    pub fn set(&self, key: String, label: Option<String>) -> Result<(), String>;
}

// src-tauri/src/commands.rs
#[tauri::command] pub fn load_labels(labels: State<'_, LabelStore>) -> LoadedLabels;
#[tauri::command] pub fn set_label(labels: State<'_, LabelStore>, key: String, label: Option<String>) -> Result<(), String>;
```

```ts
// src/sensors/labels.ts
export const MAX_LABEL_LENGTH = 40;
export interface Labels { map: ReadonlyMap<string, string>; loadError: string | null }
export interface LabelStore {
  start(): Promise<void>;
  save(key: string, text: string, defaultName: string): Promise<void>; // rejects with the core's text
  getSnapshot(): Labels;
  subscribe(listener: () => void): () => void;
}
export function createLabelStore(): LabelStore;
export const labelStore: LabelStore;
export const LabelStoreContext: React.Context<LabelStore>;            // default value: labelStore
export function useLabelStore(): LabelStore;
export function useLabels(): Labels;

// src/sensors/commands.ts
export const loadLabels = (): Promise<{ labels: Record<string, string>; problem: string | null }> => invoke("load_labels");
export const setLabel = (key: string, label: string | null): Promise<void> => invoke("set_label", { key, label });
```

### Implementation map

**Code comments:** the snippets have none. The owner adds comments at review (global rule). Two existing comments become inaccurate and are left for the owner to decide: `commands.rs` line 1 says "The four Tauri commands" (there are six now), and `app.css` says the panel is "at most ~350 px tall" next to the padding that becomes 520 px. New tests carry no test-ID comments; the mapping is in the [Test plan](#test-plan) by test name.

| Path | C/M | What and why | Pattern | Tests |
|---|---|---|---|---|
| `src-tauri/src/labels.rs` | C | `LabelStore`: the file format, load with move-aside, input checks, atomic write; unit tests | Managed state, `helper.rs` temp files | UT-40 |
| `src-tauri/src/commands.rs` | M | `load_labels`, `set_label` | `open_pawnio_site` | UT-40 (through `LabelStore`), E2E-28 |
| `src-tauri/src/lib.rs` | M | `mod labels;`; `setup` manages `LabelStore::open(&data_dir)` after the window; two handler entries | `setup`, `generate_handler!` | `cargo test`, E2E-28 |
| `src/sensors/commands.ts` | M | `loadLabels`, `setLabel` | Thin wrappers | UT-41 (mocked) |
| `src/sensors/labels.ts` | C | The UI label store | `createSensorStore`, `theme.ts` | UT-41 |
| `src/sensors/labels.test.ts` | C | UT-41 | `store.test.ts` | — |
| `src/main.tsx` | M | `void labelStore.start();` after `watchSystemTheme()` | `applyTheme()` | E2E-28 |
| `src/pages/SensorList.tsx` | M | Labels in rows, heading, chart name; `RenameForm`; Motherboard subline | `SensorDetail`, selection rule | UT-42 |
| `src/pages/SensorList.test.tsx` | M | `vi.mock("../sensors/commands", …)` with all five wrappers (`setLabel` resolves by default); `setup` creates a `createLabelStore()`, wraps `LabelStoreContext.Provider` and returns it as `labels`; UT-42; the Motherboard subline expectation; About shows 0.2.0. `App.test.tsx` needs no change (nothing there calls `start` or `save`; vitest resolves a mocked export only when it is used) | `setup` | — |
| `src/cards/CardParts.tsx` | M | `linkText` prop on `Card` | — | UT-43 |
| `src/cards/MotherboardCard.tsx` | M | Label on fan rows; "Name your fans" | `useLabels` | UT-43 |
| `src/cards/Cards.test.tsx` | M | UT-43 (a), (b). Add `vi.mock("../sensors/commands", …)` with `loadLabels` and `setLabel`; `renderCard` takes an optional label store and wraps `LabelStoreContext.Provider`; seed labels with a mocked `loadLabels` resolving `{ labels, problem: null }`, then `await act(() => labels.start())` | `renderCard` | — |
| `src/pages/Dashboard.test.tsx` | M | UT-43 (c). Extend the existing `vi.mock("../sensors/commands")` factory with `loadLabels` and `setLabel`; `renderDashboard` wraps a fresh `createLabelStore()` in `LabelStoreContext.Provider` and returns it as `labels` (its `store` stays the sensor store) | `renderDashboard` | — |
| `src/styles/app.css` | M | Form rules, renamed row, `.btn--accent`, `.btn:disabled`; `scroll-padding-top: 520px` | Mockup, render check | E2E-21, E2E-22 |
| `package.json`, `package-lock.json` | M | 0.2.0 (`npm version 0.2.0 --no-git-tag-version`) | v0.1.1 bump | E2E-23 |
| `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | M | 0.2.0; `cargo check` in `src-tauri` updates the lock | v0.1.1 bump | E2E-23 |
| `THIRD-PARTY-NOTICES.md` | M | Line 3: "Pophood 0.2.0 is built from source…" | v0.1.1 Q&A #7 | E2E-23 |
| `README.md` | M | Status line (below) | — | — |
| `AGENTS.md` | M | One trust line (below) | — | — |
| `helper/PophoodSensors.csproj` | — | **Unchanged** (`<Version>0.1.0</Version>`) | — | E2E-23 |

**`src-tauri/src/labels.rs` (new).**
```rust
use std::collections::BTreeMap;
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

const FILE_NAME: &str = "labels.json";
const VERSION: u32 = 1;
const MAX_LABEL_UNITS: usize = 40;
const MAX_KEY_UNITS: usize = 512;

#[derive(Serialize, Deserialize)]
struct LabelFile {
    version: u32,
    labels: BTreeMap<String, String>,
}

#[derive(Serialize)]
pub struct LoadedLabels {
    pub labels: BTreeMap<String, String>,
    pub problem: Option<String>,
}

struct State {
    labels: BTreeMap<String, String>,
    problem: Option<String>,
    writable: bool,
}

pub struct LabelStore {
    path: PathBuf,
    state: Mutex<State>,
}

impl LabelStore {
    pub fn open(dir: &Path) -> LabelStore {
        let path = dir.join(FILE_NAME);
        let empty = |problem: Option<String>, writable: bool| State { labels: BTreeMap::new(), problem, writable };
        let state = match fs::read_to_string(&path) {
            Err(e) if e.kind() == ErrorKind::NotFound => empty(None, true),
            Err(e) => empty(Some(format!("could not read {}: {e}", path.display())), false),
            Ok(text) => match serde_json::from_str::<LabelFile>(&text) {
                Ok(file) if file.version == VERSION => State { labels: file.labels, problem: None, writable: true },
                other => {
                    let reason = match other {
                        Ok(file) => format!("format version {} is not supported", file.version),
                        Err(e) => e.to_string(),
                    };
                    let bad = path.with_extension("json.bad");
                    match fs::rename(&path, &bad) {
                        Ok(()) => empty(Some(format!("{} could not be used ({reason}); it was kept as {}", path.display(), bad.display())), true),
                        Err(e) => empty(Some(format!("{} could not be used ({reason}) and could not be moved aside: {e}", path.display())), false),
                    }
                }
            },
        };
        LabelStore { path, state: Mutex::new(state) }
    }

    pub fn load(&self) -> LoadedLabels {
        let state = self.state.lock().unwrap();
        LoadedLabels { labels: state.labels.clone(), problem: state.problem.clone() }
    }

    pub fn set(&self, key: String, label: Option<String>) -> Result<(), String> {
        if key.is_empty() || key.encode_utf16().count() > MAX_KEY_UNITS {
            return Err("the sensor key is empty or too long".to_string());
        }
        if let Some(text) = &label {
            if text.is_empty() || text.trim() != text || text.encode_utf16().count() > MAX_LABEL_UNITS {
                return Err(format!("a name must be 1 to {MAX_LABEL_UNITS} characters, with no space at either end"));
            }
        }
        let mut state = self.state.lock().unwrap();
        if !state.writable {
            return Err(state.problem.clone().unwrap_or_default());
        }
        let mut file = LabelFile { version: VERSION, labels: state.labels.clone() };
        match label {
            Some(label) => file.labels.insert(key, label),
            None => file.labels.remove(&key),
        };
        self.write(&file)?;
        state.labels = file.labels;
        Ok(())
    }

    fn write(&self, file: &LabelFile) -> Result<(), String> {
        let tmp = self.path.with_extension("json.tmp");
        let text = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
        let written = (|| {
            let mut out = fs::File::create(&tmp)?;
            out.write_all(text.as_bytes())?;
            out.sync_all()?;
            fs::rename(&tmp, &self.path)
        })();
        written.map_err(|e| format!("could not write {}: {e}", self.path.display()))
    }
}
```
- **Characters are counted in UTF-16 code units**, as the browser's `maxLength` and JavaScript's `.length` count them. A label the input accepts is never refused by the core.
- **The UI trims; the core only checks.** The core refuses a label that its own `trim()` would change instead of trimming it again, so the stored text always equals the UI's map. (JavaScript and Rust trim slightly different characters: Rust also trims U+0085, JavaScript also trims U+FEFF. A label that ends in one of those gets a visible "wasn't saved" message.)
- **Key bound:** 512 units. The longest key in the P1 dumps is a DIMM timing (well under 100); the bound only stops a bad call from writing a huge entry.
- **`writable: false`** happens in two cases: the file exists but can't be read (for example access denied), or it is bad and can't be moved aside. Then every save is refused with the load problem, so a file Pophood couldn't read is never overwritten (Q&A #3).
- **Atomic write:** `sync_all` before the rename, so a power cut leaves either the old file or the new one, never an empty one. A leftover `labels.json.tmp` is overwritten by the next save.
- **Lock:** `std::sync::Mutex`; a poisoned lock can't happen in a release build (`panic = "abort"`, `Cargo.toml`).

**`src-tauri/src/commands.rs`.** Add, after `open_pawnio_site`:
```rust
#[tauri::command]
pub fn load_labels(labels: State<'_, LabelStore>) -> LoadedLabels {
    labels.load()
}

#[tauri::command]
pub fn set_label(labels: State<'_, LabelStore>, key: String, label: Option<String>) -> Result<(), String> {
    labels.set(key, label)
}
```
with `use crate::labels::{LabelStore, LoadedLabels};`. Both are sync commands: they run on the main thread (Tauri 2), and a write of a few hundred bytes takes milliseconds.

**`src-tauri/src/lib.rs`.** Before / after:
```rust
mod commands;
pub mod sensors;
pub mod webview;
```
```rust
mod commands;
mod labels;
pub mod sensors;
pub mod webview;
```
```rust
fn setup(app: &mut tauri::App) -> Result<(), String> {
    webview::build_main_window(app)?;
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    app.manage(labels::LabelStore::open(&data_dir));
    // `setup` has no tokio context, so the service spawns through `tauri::async_runtime`.
    app.manage(SensorService::start(app.handle().clone()));
    Ok(())
}
```
(The comment above `SensorService::start` is the existing one, kept in place.)
and `commands::load_labels, commands::set_label,` in `generate_handler!`. The store opens after `build_main_window`, which has created the folder.

**`src/sensors/commands.ts`.** Add the two wrappers from [Interfaces](#interfaces).

**`src/sensors/labels.ts` (new).**
```ts
import { createContext, useContext, useSyncExternalStore } from "react";
import { loadLabels, setLabel } from "./commands";

export const MAX_LABEL_LENGTH = 40;

export interface Labels {
  map: ReadonlyMap<string, string>;
  loadError: string | null;
}

export interface LabelStore {
  start(): Promise<void>;
  save(key: string, text: string, defaultName: string): Promise<void>;
  getSnapshot(): Labels;
  subscribe(listener: () => void): () => void;
}

export function createLabelStore(): LabelStore {
  const listeners = new Set<() => void>();
  let snapshot: Labels = { map: new Map(), loadError: null };

  function publish(next: Labels) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  return {
    async start() {
      try {
        const { labels, problem } = await loadLabels();
        publish({ map: new Map(Object.entries(labels)), loadError: problem });
      } catch (error) {
        publish({ map: new Map(), loadError: String(error) });
      }
    },
    async save(key, text, defaultName) {
      const trimmed = text.trim();
      const label = trimmed === "" || trimmed === defaultName ? null : trimmed;
      await setLabel(key, label);
      const map = new Map(snapshot.map);
      if (label === null) map.delete(key);
      else map.set(key, label);
      publish({ ...snapshot, map });
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const labelStore = createLabelStore();
export const LabelStoreContext = createContext<LabelStore>(labelStore);

export function useLabelStore(): LabelStore {
  return useContext(LabelStoreContext);
}

export function useLabels(): Labels {
  const store = useLabelStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
```
The `catch` in `start` covers a rejected `invoke` (no core answered); `load_labels` itself never fails.

**`src/main.tsx`.** After `watchSystemTheme();`:
```ts
void labelStore.start();
```
with `import { labelStore } from "./sensors/labels";`.

**`src/pages/SensorList.tsx`.**
1. Imports: `useLabelStore`, `useLabels`, `MAX_LABEL_LENGTH` from `../sensors/labels`; `type FormEvent` from `react` if needed.
2. `RenameForm`, a new local component placed after `SensorDetail`'s helpers:
```tsx
function RenameForm({ sensor, label }: { sensor: UiSensor; label: string | undefined }) {
  const store = useLabelStore();
  const { loadError } = useLabels();
  const [draft, setDraft] = useState(label ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(text: string, verb: "saved" | "reset") {
    try {
      await store.save(sensor.key, text, sensor.name);
      const trimmed = text.trim();
      setDraft(trimmed === sensor.name ? "" : trimmed);
      setError(null);
    } catch (reason) {
      setError(`The name wasn't ${verb}: ${String(reason)}`);
    }
  }

  return (
    <form
      className="rename"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft, "saved");
      }}
    >
      <label className="rename__label" htmlFor="rename-input">
        Display name
      </label>
      <input
        id="rename-input"
        className="rename__input"
        type="text"
        maxLength={MAX_LABEL_LENGTH}
        value={draft}
        placeholder={sensor.name}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" className="btn btn--accent">
        Save name
      </button>
      <button type="button" className="btn btn--secondary" disabled={label === undefined} onClick={() => void save("", "reset")}>
        Reset to “{sensor.name}”
      </button>
      <span className="rename__caption">Shows on the dashboard and in this list. Saved on this PC only.</span>
      {loadError !== null && <p className="rename__error">Names saved earlier couldn't be read: {loadError}</p>}
      {error !== null && (
        <p className="rename__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
```
3. `SensorDetail` takes `label: string | undefined`. Before (≈:31, :49, :75):
```tsx
function SensorDetail({ sensor, frame, stale }: { sensor: UiSensor; frame: UiFrame; stale: boolean }) {
…
            <h2 className="detail__name">{sensor.name}</h2>
…
      <DetailChart seriesKey={sensor.key} label={`${sensor.name} over the last 10 minutes`} nowMs={frame.t} />
    </section>
```
After:
```tsx
function SensorDetail({ sensor, label, frame, stale }: { sensor: UiSensor; label: string | undefined; frame: UiFrame; stale: boolean }) {
  …
  const shown = label ?? sensor.name;
…
            <h2 className="detail__name">{shown}</h2>
…
      <DetailChart seriesKey={sensor.key} label={`${shown} over the last 10 minutes`} nowMs={frame.t} />
      <RenameForm key={sensor.key} sensor={sensor} label={label} />
    </section>
```
4. `SensorList`: `const labels = useLabels();` with the other hooks, **before** the `frame === null` return (hook order, as UT-39 (g) locks). The subline (≈:116-118). Before:
```tsx
        <p className="page-sub">
          {[...hardwareNames, `${count} ${count === 1 ? "sensor" : "sensors"}`].join(" · ")}
        </p>
```
After:
```tsx
  const subline = [...hardwareNames, `${count} ${count === 1 ? "sensor" : "sensors"}`];
  if (cardId === "motherboard") subline.push("generic names until you rename them");
…
        <p className="page-sub">{subline.join(" · ")}</p>
```
The panel: `<SensorDetail sensor={selected} label={labels.map.get(selected.key)} frame={frame} stale={stale} />`. The row (≈:165). Before:
```tsx
                            <span className="row__name">{sensor.name}</span>
```
After:
```tsx
                            <span className="row__name">
                              {labels.map.get(sensor.key) ?? sensor.name}
                              {labels.map.has(sensor.key) && <span className="row__default"> · {sensor.name}</span>}
                            </span>
```
`SensorDetail` stays one instance while `selected` exists (same element, same position), so the form's `key` alone decides when the draft resets.

**`src/cards/CardParts.tsx`.** `CardProps` gains `linkText?: string`; `Card({ card, onOpen, linkText = "All sensors", children })` renders `{linkText}` in place of the literal "All sensors" (≈:122).

**`src/cards/MotherboardCard.tsx`.**
```tsx
export function MotherboardCard({ card, onOpen }: Props) {
  const fans = card.fans;
  const { map } = useLabels();
  return (
    <Card card={card} onOpen={onOpen} linkText="Name your fans">
…
              <span>{map.get(row.key) ?? row.name}</span>
```
The placeholder and empty Motherboard cards render through `PlaceholderCard` (`DashboardCard.tsx → card.variant !== "normal"`), which has no link (H1).

**`src/styles/app.css`.** In "Buttons", after `.btn--info`:
```css
.btn--accent {
  border: 0;
  padding: 0 18px;
  background: var(--accent-fill);
  color: var(--on-accent);
  font-weight: 600;
}
.btn:disabled {
  cursor: default;
  opacity: 0.5;
}
```
After `.row__value--muted`:
```css
.row__default {
  font-size: 12px;
  color: var(--muted);
}
```
After `.detail__caption`:
```css
.rename {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.rename__label {
  font-weight: 600;
}
.rename__input {
  flex: 0 1 320px;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--strong);
  background: var(--inset);
  color: var(--text);
  font: inherit;
  font-size: 15px;
}
.rename__caption {
  font-size: 12px;
  color: var(--muted);
}
.rename__error {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
  color: var(--danger-text);
}
```
And in the sticky block: `scroll-padding-top: 360px;` → `scroll-padding-top: 520px;` (Q&A #6). These are the exact rules of the render check (`prototype/rename.css`). The input's focus ring comes from the global `:focus-visible` rule.

**`README.md`.** Before:
```markdown
Status: v0.1.1, live dashboard with the new sensor drill-down (see [specs/v0.1.1/techspec.md](specs/v0.1.1/techspec.md)). Specs for every version: [specs/](specs/).
```
After:
```markdown
Status: v0.2.0, live dashboard and sensor drill-down; rename any sensor (see [specs/v0.2.0/techspec.md](specs/v0.2.0/techspec.md)). Specs for every version: [specs/](specs/).
```
(The implementer re-reads line 5 first; if it differs, only the version, the description and the link change.)

**`AGENTS.md`.** Trust invariants, a new bullet under **Privilege** (owner: Q&A #7):
```markdown
- The app's only user data file is `labels.json` in `%LOCALAPPDATA%\dev.pophood`, written by the core (`src-tauri/src/labels.rs`) at a fixed path. No command takes a path or file name from the UI.
```

**Spec docs (this session):** `specs/v0.2.0/README.md` (status, open questions closed), `specs/v0.2.0/requirements.md` ("Next" line), ADR 0036 (new), ADR 0035 (Consequences: the open items are closed by ADR 0036 and this techspec), `specs/v0.3.0/README.md` (the database question inherits the `labels.json` migration).

### Anti-overengineering breakdown

Owner: "Accept as proposed (Recommended)" (Q&A #7).

| Candidate | Verdict | Why |
|---|---|---|
| Core-side checks on key and label length | **Keep** | RF13.4 and the requirements' API rule: a bad call never writes. Two `if`s |
| Atomic write (temp file, flush, rename) | **Keep** | Prevents the requirements' Mid risk: a crash mid-write losing every name |
| Move aside / refuse saves on a bad file | **Keep** (Q&A #3) | Visible failure, and a file Pophood couldn't read is never overwritten |
| `RenameForm key={sensor.key}` | **Keep** | The draft rule (RF26.2, RF26.3) with no extra state or effect |
| A label store with the app instance as the context default | **Keep** | Testable per test; no provider in `App.tsx`; `Cards.test`, `Dashboard.test`, `App.test` keep working |
| One AGENTS.md trust line | **Keep** | The first user data the app writes; it states the fixed path and the no-path rule for future changes |
| Disabling Save when the text didn't change | **Cut** | Saving the same name rewrites the same file; harmless |
| Disabling the buttons while a save runs | **Cut** | A save takes milliseconds; commands run in order on the main thread |
| Checking each entry when loading the file | **Cut** | Only Pophood writes it, and a label is rendered as text |
| File size or entry-count caps | **Cut** | Entries grow only by renames |
| Showing the error of a save that finishes after the selection moved | **Cut** | The save still lands on the right key; only the message is lost, in a window of milliseconds |
| Labels inside `buildDashboard` | **Cut** | `MotherboardCard` looks them up; `fields.ts` and `Dashboard.tsx`'s `useMemo` stay unchanged |
| A separate `clear_label` command | **Cut** | `set_label(key, null)` |
| The `tempfile` crate | **Cut** | `std::env::temp_dir()`, as `helper.rs` tests do |
| Edits to the v0.1.0-era harness scripts | **Cut** | Only the scripts re-run in the v0.2.0 release change (see [E2E harness updates](#e2e-harness-updates)) |

### Data models

#### `labels.json`: the label file (core, on disk)

`%LOCALAPPDATA%\dev.pophood\labels.json`, UTF-8, written with `serde_json::to_string_pretty`.

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer | yes | `1`. Any other value: the file is moved aside (RF13.9: v0.3.0 reads this version to migrate) |
| `labels` | object | yes | `sensor_key` → label. Keys sorted (`BTreeMap`). A label is 1–40 UTF-16 units, trimmed |

```json
{
  "version": 1,
  "labels": {
    "/lpc/it8696e/0/fan/0|Fan #1": "CPU fan",
    "/lpc/it8696e/0/fan/4|Fan #5": "Rear exhaust"
  }
}
```

> **No file:** the normal first start. Empty map, no problem; the first save creates the file.

> **Bad file** (not JSON, missing fields, or `"version": 2`): renamed to `labels.json.bad` (replacing an older one); empty map; `problem` says why and where the old file went; saves work. If the rename fails, saves are refused.

> **Unreadable file** (exists, can't be read): nothing is moved; empty map; `problem` set; every save returns the problem text.

#### `LoadedLabels`: the answer of `load_labels`

| Field | Type | Required | Description |
|---|---|---|---|
| `labels` | `Record<string, string>` | yes | The map in memory (empty after a load problem, then whatever was saved since) |
| `problem` | `string \| null` | yes | Why the file couldn't be used at start; `null` when it could or there was none |

```text
{ "labels": { "/lpc/it8696e/0/fan/0|Fan #1": "CPU fan" }, "problem": null }
```

> **After a bad file:**

```text
{ "labels": {}, "problem": "C:\\Users\\jimmy\\AppData\\Local\\dev.pophood\\labels.json could not be used (expected value at line 1 column 1); it was kept as C:\\Users\\jimmy\\AppData\\Local\\dev.pophood\\labels.json.bad" }
```

#### `Labels`: the UI snapshot

| Field | Type | Required | Description |
|---|---|---|---|
| `map` | `ReadonlyMap<string, string>` | yes | `sensor_key` → label |
| `loadError` | `string \| null` | yes | `problem` from the core, or the rejection text when no core answered |

#### Copy

| Where | Text |
|---|---|
| Form label | Display name |
| Input placeholder | the default (LHM) name |
| Buttons | Save name · Reset to “{default}” (disabled when there is no label) |
| Caption | Shows on the dashboard and in this list. Saved on this PC only. |
| Save failure (`role="alert"`) | The name wasn't saved: {error} |
| Reset failure (`role="alert"`) | The name wasn't reset: {error} |
| Load problem (every form, until restart) | Names saved earlier couldn't be read: {problem} (true even after new saves, unlike "default names show") |
| Renamed row | {label} · {default} (the default in 12 px muted) |
| Detail heading and chart name | {label} (or the default) · "{shown} over the last 10 minutes" |
| Motherboard card fan row | {label} (or the default) |
| Motherboard card link | Name your fans (other cards: All sensors) |
| Motherboard drill-down subline | {board} · {chip} · {n} sensors · generic names until you rename them |

#### Form states

| State | Input | Reset | Message |
|---|---|---|---|
| No label | empty, placeholder = default | disabled | — |
| Labelled | the label | enabled | — |
| Typing (unsaved) | the typed text; kept across frames while the same sensor stays selected | as before typing | — |
| Saved | the trimmed label (empty when it equals the default) | enabled (disabled after a clear) | — |
| Save or reset failed | the typed text | unchanged | "The name wasn't saved/reset: {error}" |
| Load problem | as above | as above | the load note, always |
| Selection changed (any cause) | the new sensor's label | for the new sensor | gone |
| Stale or reconnecting | usable (Q&A #4) | usable | — |
| Scope has no sensors / no frame | no form (the caption or "No sensor data yet.") | — | — |

#### Fixed layout parameters

| Parameter | Value | Source |
|---|---|---|
| Sticky from window height | 800 px (unchanged) | v0.1.1 Q&A #1; this session Q&A #6 |
| Focus scroll padding while sticky | **520 px** (was 360) | Q&A #6; the tallest measured wrapper (panel + its 12 px padding) is 504 px, plus the 4 px focus ring above a row = 508 px, so 12 px of margin |
| Input | flex-basis 320 px, height 44 px, 15 px text | Mockup, app button height |
| Form row | gap 8 / 12 px, 12 px above a 1 px line | Mockup |

#### Measured sizes (render check)

Headless Edge 155.0.4283.62, the app's `app.css`; not the app. "Worst" = a 40-character label and a one-line error.

| Window | Panel v0.1.1 | Panel with form | Worst | Cards visible while stuck |
|---|---|---|---|---|
| 1917×1029 | 273 px | 342 px | 368 px | 687 px (worst 661) |
| 1280×860 | — | 368 px | 434 px | 492 px (worst 426) |
| 1024×800 | 348 px | 469 px (form on 2 lines) | 504 px | 331 px (worst 296) |
| 1024×680 | 348 px | 469 px | 504 px | not sticky |

### Endpoints mapping

#### Overview

| Method | Route | Description |
|---|---|---|
| Tauri command | `load_labels` | The labels in memory and the load problem |
| Tauri command | `set_label` | Save (`label` = text) or clear (`label` = `null`) one label |

---

#### `load_labels`

**Request:** no arguments. `invoke("load_labels")`.

| Result | Body | When |
|---|---|---|
| resolves | `LoadedLabels`, `problem: null` | No file, or a valid version-1 file |
| resolves | `LoadedLabels`, `problem` set | A bad file (moved aside) or an unreadable file |

> It never rejects. The UI calls it once at start; a webview reload calls it again and gets the current map (including saves made after a load problem).

---

#### `set_label`

**Request body:** `invoke("set_label", { key, label })`.

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `key` | string | — | 1 to 512 UTF-16 units; otherwise rejected |
| `label` | string or `null` | — | `null` clears. A string must be 1 to 40 UTF-16 units with no space at either end (the UI trims first); otherwise rejected |

| Result | Body | When |
|---|---|---|
| resolves | `null` | Written: `labels.json` and the memory map now hold the change |
| rejects | `"the sensor key is empty or too long"` | Bad key |
| rejects | `"a name must be 1 to 40 characters, with no space at either end"` | Bad label (the UI never sends one: it trims, clears empty names, and the input stops at 40) |
| rejects | the load problem text | The file couldn't be read at start, or couldn't be moved aside |
| rejects | `"could not write …\labels.json: {os error}"` | The temp file or the rename failed; file and memory unchanged |

**Example: save.** `invoke("set_label", { key: "/lpc/it8696e/0/fan/0|Fan #1", label: "CPU fan" })` → `null`.

**Example: clear.** `invoke("set_label", { key: "/lpc/it8696e/0/fan/0|Fan #1", label: null })` → `null`.

**Example: write failure.**
```text
"could not write C:\\Users\\jimmy\\AppData\\Local\\dev.pophood\\labels.json: Access is denied. (os error 5)"
```
> The UI shows it as "The name wasn't saved: could not write …". The shown name stays the old one.

The named pipe (schema v1) and the core → UI Channel (`SensorEvent`) don't change.

## Sequence

| # | Step | Why here | Depends on |
|---|---|---|---|
| 1 | **Core:** `labels.rs` with UT-40, `commands.rs`, `lib.rs`; `cargo test` | Self-contained; the UI needs the commands for E2E, not for its unit tests | — |
| 2 | **UI store:** `commands.ts`, `labels.ts`, `main.tsx`, UT-41 | The pages read the store | — |
| 3 | **Drill-down:** `SensorList.tsx`, `app.css` (form, row, buttons, padding 520), UT-42 and the subline expectation. **Then, early:** render in `npm run tauri dev` in both themes at 1917×1029, 1280×860, 1024×800 and 1024×680: the form, a renamed row, a 40-character label in the heading, a row and a Dashboard fan row, the save-failure line, the sticky panel, and E2E-22's Shift+Tab step at 1024×800 | The form and the panel height are where the risk is; the real WebView2 with the CSP before the release | 1, 2 |
| 4 | **Dashboard:** `CardParts.tsx`, `MotherboardCard.tsx`, UT-43 | Small; uses the store | 2 |
| 5 | **Version, README, AGENTS.md, specs:** `npm version 0.2.0 --no-git-tag-version`, `tauri.conf.json`, `Cargo.toml`, `cargo check` (lock), `THIRD-PARTY-NOTICES.md`, the About test, README, the AGENTS.md line, and the umbrella / stub status | Last code step, so the dev runs don't mix versions | — |
| 6 | **Code review** of steps 1–5 (`review-implementation`), before the owner's commit | As in v0.1.1 (T4) | 1–5 |
| 7 | **Release build and checks (agent):** in the follow-ups clone, after the owner's commit, build `pophood.exe` only, keeping the helper of record, plus the devtools variant ([Integration points](#integration-points-external)); `npm test`, `cargo test` (with the integration tests); E2E-12, 21, 23, 29; on devtools E2E-22, 23 (page), 27, PERF-02 | Needs everything | 6, owner commit |
| 8 | **Owner checks:** E2E-28 (UAC, a reboot), the full-sensors parts of E2E-12, 21, 22, 27, and E2E-15 (elevated capture) | The owner runs UAC, reboots and elevated captures (AGENTS.md "Who runs what") | 7 |

Each step ships with its tests. Steps map onto `tasks-breakdown` tasks; 7 and 8 match v0.1.1's T5 and T6.

## Integration points [external]

| Integration | Availability | Notes |
|---|---|---|
| **The file system** (`%LOCALAPPDATA%\dev.pophood`) | Per Windows user | Created by `build_main_window`. Writes: `labels.json`, `labels.json.tmp` (short-lived), `labels.json.bad` (only after a bad file). The unprivileged app writes; the helper never sees labels (C1). Not deleted by `audit-network.ps1 -FreshProfile` (it removes only `EBWebView`) |
| **Tauri 2.12.4 commands** | Bundled | Sync commands run on the main thread; `Err(String)` rejects the JS promise (v2.tauri.app "Calling Rust", read 2026-10-23); `label: null` deserialises to `None` (serde). No capability file (app commands need none, `commands.rs` header) |
| **WebView2 runtime 155** | System | `maxLength` counts UTF-16 code units and cuts a longer paste; `:focus-visible`, `:has()`, sticky as in v0.1.1. A runtime bump re-runs E2E-15 anyway |
| **The helper of record** | `C:\Users\jimmy\pophood-e2e\pophood-followups`, helper `553a7f49…` | Unchanged. After the owner's v0.2.0 commit, pull with `--ff-only`, `npm ci`, then rebuild only `pophood.exe` with a short separate `CARGO_TARGET_DIR` and `npm run tauri build -- --no-bundle --config '{"build":{"beforeBuildCommand":"npm run build"}}'` (AGENTS.md "Build notes"; template `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1`), then the devtools variant with `--features tauri/devtools` into its own `CARGO_TARGET_DIR` (template `sessions/20261021165812_pophood-v010-e2e/pass2-build.ps1`). Check the staged helper's SHA-256 before and after both builds. Use the working tree's `scripts/audit-network.ps1` |
| **No network** | — | Unchanged: no URL, no `<a href>`, no flow. E2E-15 re-runs because every release does |

### E2E harness updates

The scripts the v0.2.0 release re-runs find pages by the "All sensors" button name. The Motherboard card's button is now "Name your fans". Copy each script into the v0.2.0 release session folder and change only the name match:

| Script (v0.1.1 release) | Effect without the change | Change |
|---|---|---|
| `sessions/20261023055425_pophood-v011-release/t6-release.ps1` (`E2E-12 (O)` section, ≈:137-148) | Never reaches the Motherboard page, so the "Controls · 6" check fails | Match `All sensors` **or** `Name your fans` (UIA `OrCondition` of two `NameProperty` conditions) |
| `sessions/20261023055425_pophood-v011-release/e2e21.ps1` (`DashboardColumns`, ≈:47-54) | Counts one card fewer; can report one column too few | Same `OrCondition` |
| `e2e21.ps1 → OpenCpu`, `e2e12.ps1`, `e2e22-cdp.ps1`, `e2e27-layout.ps1`, `t6-devtools.ps1` | None: they take `[0]` or `[1]` (CPU, GPU) | None |

The v0.1.0-era scripts (`e2e20.ps1`, `cards-walk.ps1`, `render-check.ps1`, `sticky-focus.ps1`) are records and stay as they are (Q&A #7).

**Run E2E-12, 21, 22 and 27 with no `labels.json`** (or with E2E-28's reset done), so the pages show LHM's names as the scripts expect. E2E-28 and E2E-29 run after them.

## Test plan

**Acceptance criteria** (from the requirements' success criteria and RFs):

| AC | Criterion |
|---|---|
| AC-01 | In any drill-down the owner selects a sensor, types a name and saves it (button or Enter). The row shows "{label} · {default}", the heading and the chart name show the label, and the Motherboard card's fan row shows the label alone (RF13.2, RF26.1, RF26.4) |
| AC-02 | "Reset to “{default}”" removes the label everywhere; saving an empty name or the default name does the same; Reset is disabled when there is no label (RF13.3, OQ-D) |
| AC-03 | Text rules: trimmed; 1–40 UTF-16 units; duplicates allowed; the input stops at 40; the core refuses an empty key, a too-long key and a bad label and writes nothing; a label renders as text (RF13.4) |
| AC-04 | A label applies only to the exact `sensor_key`; an absent sensor's label is kept, shows nowhere, and shows again when the key returns; a Fan and a Control with the same name are two labels (RF13.5, RF13.6, RF26.6) |
| AC-05 | A typed name is saved only to the sensor it was typed for. Frames that keep the selection keep the text and the focus; any selection change (click, fallback, reduced → full, full lost, empty scope) discards the text and shows the new sensor's label (RF26.2, RF26.3) |
| AC-06 | Labels survive an app restart, a reboot and a reduced ↔ full switch; the file holds `"version": 1` (RF13.1, RF13.9) |
| AC-07 | Failures are visible: a bad file is moved aside and the form says so; an unreadable file is never overwritten; a failed save or reset shows its error and the shown name doesn't change (RF13.8, OQ-C) |
| AC-08 | Display only: values, keys, history, selection, card order, lock labels and every name match in `fields.ts` are unchanged; role labels, the Hottest suffix and the history legend keep LHM names (RF13.2, RF13.7) |
| AC-09 | H1: the normal Motherboard card's link reads "Name your fans" and opens the Motherboard drill-down; other cards keep "All sensors". H2: the Motherboard subline ends with "· generic names until you rename them"; other sublines are unchanged |
| AC-10 | The sticky panel with the form still never hides a focused row (v0.1.1 AC-03, padding 520 px); at 1024×800 the stuck panel, form included, fits in the window; renaming works while stale (OQ-E) |
| AC-11 | The app reports 0.2.0; the helper stays 0.1.0 with hash `553a7f49…`; no change under `helper/` or `src-tauri/src/sensors/`; no new network flow (E2E-15) |

### Unit Tests

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| UT-40 | Core label store (`labels.rs` tests; a temp folder per test) | AC-02, AC-03, AC-06, AC-07 | (a) **No file:** `load()` is empty with no problem; `set(k, Some("CPU fan"))` writes `labels.json` with `"version": 1` and `"CPU fan"`; a new `LabelStore::open` on the same folder loads it. (b) **Clear:** `set(k, None)` removes the entry from the file and memory. (c) **Checks:** an empty key, a 513-unit key, `""`, `"   "`, `" CPU fan"`, 41 × `a`, and 21 × `😀` (42 units) are refused and the file is unchanged; 40 × `a` and 20 × `😀` (40 units) are accepted. (d) **Bad file:** `labels.json` = `{` → `load().problem` names `labels.json.bad`; the `.bad` file has the original bytes; `set` then works and writes a valid file. (e) **Newer version:** `{"version":2,"labels":{}}` → same as (d), the problem says "format version 2". (f) **Unreadable:** `labels.json` is a directory → `problem` set, `set` refused with the problem text, the directory still there, no `.bad`. (g) **Write failure:** `labels.json.tmp` is a directory → `set` returns "could not write …"; `load()` and `labels.json` unchanged. **Negative controls:** (c)'s accepted 40-unit cases prove the check isn't refusing everything; (g) first saves one label successfully |
| UT-41 | UI label store (`labels.test.ts`; `../sensors/commands` mocked) | AC-02, AC-03, AC-07 | (a) `start()` with `{ labels: {k: "CPU fan"}, problem: null }` → `map.get(k)` is "CPU fan", a subscriber is called once. (b) `start()` with a problem → empty map, `loadError` = the problem; a rejected `loadLabels` → `loadError` = its text. (c) `save(k, "  Rear  ", "Fan #5")` calls `setLabel(k, "Rear")` and maps it. (d) `save(k, "", d)` and `save(k, d, d)` call `setLabel(k, null)` and remove the entry. (e) `setLabel` rejects → `save` rejects with the text; the map and the snapshot object are unchanged and no subscriber is called |
| UT-42 | Rename on the drill-down (`SensorList.test.tsx`; a fresh `createLabelStore()` per test through `LabelStoreContext`; commands mocked) | AC-01…AC-05, AC-07…AC-10 | (a) **Save by submit** (jsdom can't do Enter's implicit submit; Enter is E2E-22 and E2E-28): Motherboard, Fan #1 selected; change the input to "  CPU fan  ", `fireEvent.submit` the form → `setLabel("/lpc/it8696e/0/fan/0\|Fan #1", "CPU fan")`; the row reads "CPU fan · Fan #1" with `.row__default` " · Fan #1"; heading "CPU fan"; chart img "CPU fan over the last 10 minutes"; input "CPU fan"; Reset enabled. (b) **Save button, reset, default, empty:** click Save name → same; click Reset → `setLabel(key, null)`, heading "Fan #1", Reset disabled; save "Fan #1" → `null`; save "" → `null`. (c) **No label:** Reset disabled; input empty with placeholder "Fan #1"; `maxLength` is 40 (the attribute only: `fireEvent.change` ignores it; the cut paste is E2E-28). (d) **Frames keep the draft:** `input.focus()`, type "abc", check the input is `document.activeElement`, apply two later frames → input "abc" and still `document.activeElement`. (e) **Selection changes discard the draft and never save to the old key:** (e1) select Fan #5, type "X", a frame without `fan/4` → Fan #1 selected, input empty, `setLabel` not called; type "Y", submit → called with the `fan/0` key only. (e2) reduced CPU (no click), type on "CPU Total", then elevated full frame → panel "Core (Tctl/Tdie)", input empty. (e3) full CPU, click "Cores (Average)", type, then reduced frame → "CPU Total", input empty. (e4) Motherboard, type, then reduced frame → the no-sensors caption and no form; then full again → form with an empty input. (f) **Save failure:** `setLabel` rejects "could not write X" → `alert` "The name wasn't saved: could not write X"; heading and row unchanged. Reset failure → "The name wasn't reset: …". (g) **Load problem:** a store started with a problem → the form shows "Names saved earlier couldn't be read: {problem}"; a store started without one shows no such line. (h) **Exact key only:** a label for `/lpc/it8696e/0/control/0\|Fan #1` shows on the Controls row only, not on the Fans "Fan #1"; a label for a key not in the frame shows nowhere; on the reduced → full move a stored `fan/0` label appears once the key is back. (i) **Markup is text:** label `<b>x</b>` renders literally; no `b` element in the row. (j) **Stale:** while `reconnecting`, a save still calls `setLabel` and updates the heading. (k) **Subline:** Motherboard → "Gigabyte B850 EAGLE WIFI6E · ITE IT8696E · 17 sensors · generic names until you rename them" (the existing test's regex at ≈:55 changes to end with the suffix); CPU → no such text. (l) **Display only:** after a rename, first check the row shows the label, then that the pressed row, the row order (by `key`) and the value texts equal those before the rename. (m) **Save in flight across a selection change:** `setLabel` returns a promise the test resolves by hand; select Fan #5, type "Rear", submit; send a frame without `fan/4` (Fan #1 now selected); resolve → `setLabel` was called with the `fan/4` key, `labels.getSnapshot().map` holds it, the Fan #1 heading and its empty input are unchanged, and no alert shows |
| UT-43 | Dashboard labels and the link (`Cards.test.tsx`, `Dashboard.test.tsx`) | AC-01, AC-08, AC-09 | (a) Motherboard card with a store seeded with a `fan/0` label → the first fan row reads "CPU fan" (no " · Fan #1"); the link "Name your fans" calls `onOpen("motherboard")` once; with an empty store the row reads "Fan #1" (negative control). (b) GPU and CPU cards still show "All sensors". (c) Dashboard, full frame: `await act(() => labels.save(fan0Key, "CPU fan", "Fan #1"))` and `labels.save(ccd1Key, "Hot CCD", "CCD1 (Tdie)")` with no new frame → the fan row reads "CPU fan" (the positive check), while the CPU card still shows "62.5 °C · CCD1", "Package temperature" and the legend "CPU package" (display only, RF13.2) |
| About | Versions (updated) | AC-11 | Shows `0.2.0` |
| v0.1.0/v0.1.1 suites | `npm test`, `cargo test` | AC-08, AC-11 | Pass unchanged, except the Motherboard subline regex and the About version. The "All sensors" clicks in `App.test`, `Cards.test`, `Dashboard.test` target the CPU or GPU card, so they keep passing |

**Strategy:** vitest + jsdom with the v0.1.0 fixtures; the only mocks are the IPC wrappers (`../sensors/commands`), as the existing page tests do. Rust tests use real files in temp folders, no mocks. jsdom applies no CSS, so layout is E2E-21/22.

### Integration Tests

Not applicable as new rows: the command layer is two one-line functions over `LabelStore`, which UT-40 tests with real files; the round trip through IPC is E2E-28. `cargo test` still runs IT-01…IT-17 in step 7 (the core is rebuilt).

### E2E Tests

On the step-7 builds, as in v0.1.1 (ADR 0019): **release** = `pophood.exe` through UI Automation; **devtools** = the devtools variant through CDP. **A** = the agent; **O** = the owner.

| ID | Test Case Name | Acceptance Criteria | Expected Result |
|---|---|---|---|
| E2E-28 (A, O; release) | Rename end to end (new) | AC-01, AC-02, AC-04, AC-06, AC-09 | **Start with no `labels.json`.** Full sensors (O clicks Enable): Dashboard → "Name your fans" → the Motherboard page, subline ends "· generic names until you rename them" → select Fan #1 → type "CPU fan", Enter → row "CPU fan · Fan #1", heading "CPU fan" → `labels.json` = `{"version": 1, "labels": {"/lpc/it8696e/0/fan/0\|Fan #1": "CPU fan"}}` → back: the fan row reads "CPU fan". **Restart the app** (reduced): the Motherboard card is a placeholder; the file still holds the label. **Enable full sensors (O):** the fan row reads "CPU fan" again. **Reboot (O), start, Enable:** still "CPU fan". **A sensor in both modes:** in reduced mode label "CPU Total" on the CPU page "All cores"; click Enable (O) → the row still reads "All cores · CPU Total" after elevation, and again after the next reduced start. **The 40 limit:** paste a 45-character text into the input (clipboard set by the script) → the input holds the first 40; save → the row wraps without clipping and the file holds 40 characters; the same 40-character label on Fan #1 → the Dashboard fan row shows it on one card without overflow (screenshot). **Reset** each label in the drill-down → the default names everywhere; the file's `labels` is `{}`. **Negative control:** before the first save the fan row reads "Fan #1" and the file doesn't exist |
| E2E-29 (A; release) | Label file failures (new) | AC-07 | (a) Write `{` into `labels.json`, start → the form shows "Names saved earlier couldn't be read: …kept as …labels.json.bad"; `labels.json.bad` = `{`; save a name on a CPU sensor → a valid `labels.json` with it. (b) With the app running, create a **directory** `labels.json.tmp` → save → "The name wasn't saved: could not write …"; the heading keeps the old name; remove the directory, save again → it works. **Negative control:** (b) first saves once successfully. Clean up: delete `labels.json`, `.bad`, `.tmp` at the end (the owner approves the delete commands) |
| E2E-12 (A, O; release) | Drill-down, re-run | AC-08, AC-09 | The v0.1.1 row, with the harness change above; "Controls · 6" reached through "Name your fans" |
| E2E-21 (A, O; release) | Window sizes, re-run | AC-10 | The v0.1.1 row: 1024×680 (not sticky), 1024×800 (sticky, the form fits; on 2 lines), 1280×860, 1917×1029; both themes; the Dashboard columns with the harness change |
| E2E-22 (A, O; devtools) | Keyboard and focus, re-run | AC-10 | The v0.1.1 row plus: Tab reaches the input, Save name and Reset (Reset skipped while disabled); Enter in the input saves. **Shift+Tab under the stuck panel** at 1024×800 reduced (A) and 1917×1029 full (O): each focused row is fully below the panel. **Into the stuck form:** scrolled down, Tab from the last row of the panel order to the input, Save name and Reset → each is visible with its ring; record the scroll position before and after (the 520 px padding may scroll the page; a jump is recorded, not failed, and reported to the owner). **Negative control:** `scrollPaddingTop = "0px"` through CDP → a focused row ends under the panel |
| E2E-23 (A; devtools page, release files) | Versions, re-run | AC-11 | About shows 0.2.0 and the helper hash `553a7f49…`; `pophood.exe` ProductVersion 0.2.0; the helper's 0.1.0 |
| E2E-27 (A, O; devtools) | Live layout stability, re-run | AC-10 | The v0.1.1 row (the panel is taller, so the columns start lower; the pass rule is the same) |
| E2E-15 (O; release) | Network sign-off, re-run | AC-11 | The v0.1.1 row: one 180 s scripted run of `scripts/audit-network.ps1` from the working tree. If `-FreshProfile` is used, record `Get-FileHash` of `labels.json` before and after the run: the hashes are equal. Never on the devtools variant |

### Perf (manual)

The repo has no perf/regression skill.

| ID | Surface | Manual scenario |
|---|---|---|
| PERF-02 (re-run) | The drill-down re-renders every frame; one `Map.get` per row and the form | The v0.1.0 trace proxy on the devtools variant, CPU drill-down, full sensors. **Record and compare** with v0.1.1 (drill-down p95 5.53 ms, Dashboard p95 4.53 ms). No pass threshold; a rise is explained in the QA report |

### QA-scenario pass

- **Who and how:** one independent worker. It wrote its own 24 scenarios from the requirements and the design sections before it read this test plan, then compared, and checked every snippet and fixture fact against the code. It ran no tests or compiler.
- **Errors fixed (Rev 1.1):**
  - **Medium:** UT-42 (k) expected "26 sensors"; the full fixture has **17** Motherboard sensors (Fans 6, Temperatures 3, Voltages 2, Controls 6, all on `/lpc/it8696e/0`). Re-counted in this session with node over `frame-full.json`.
  - **Medium:** the test wiring for `Cards.test` and `Dashboard.test` was missing: `createLabelStore()` takes no seed, `Cards.test` had no commands mock, and `Dashboard.test`'s factory lacks `setLabel`, so the Rev 1 UT-43 (d) (now (c)) would throw. The implementation map now states the mocks, the provider and the seeding through `start()`.
  - **Low:** the `lib.rs` snippet dropped the existing comment above `SensorService::start`; restored. UT-42 (a) is now "save by submit" (jsdom has no implicit Enter submit); (d) focuses the input first. The load note no longer claims "default names show" after later saves. JS and Rust trim different characters, so the core now checks instead of trimming again.
- **Gaps added:** UT-42 (m) a save in flight while the selection moves; E2E-28 a label on a sensor present in both modes ("CPU Total") across reduced ↔ full, a 45-character paste cut to 40, and a 40-character fan row; step 3's dev render with a 40-character label; E2E-22 Tab into the stuck form; E2E-15's hash check of `labels.json`.
- **Strengthened:** UT-42 (g) and (l), UT-43 (a) get negative controls; the old UT-43 (c) (a CCD1 label on the CPU card alone, which couldn't fail) is merged into UT-43 (c) on the Dashboard next to a positive fan-row check.
- **Kept although optional:** UT-42 (e3) (full sensors lost: a path RF26.3 names) and UT-42 (i) (one assertion).
- **Verdict:** every committed behaviour maps to at least one scenario. The worker confirmed the draft rule: `SensorDetail` stays at one position, so `key={sensor.key}` remounts the form on every RF26.3 path, and reconnecting keeps the draft.

## Monitoring and observability

Not applicable: no new events or logs. Label problems are shown in the form (RF13.8); the core keeps no log.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Rejected alternatives |
|---|---|---|
| A JSON file written by the core (Q&A #1, ADR 0036) | Survives `-FreshProfile` and WebView2 profile resets; v0.3.0's SQLite in the core migrates it; the path is fixed in Rust | `localStorage` (lost with the profile; v0.3.0 would need the UI to push it); SQLite now (the v0.3.0 decision in a display slice) |
| The UI applies labels at render (Q&A #2) | No change under `src-tauri/src/sensors/`, so no helper regression run; `fields.ts` keeps LHM names for matching by construction | Labels in `UiFrame` (`events.rs`) |
| Move a bad file aside; never overwrite an unreadable one (Q&A #3) | Visible, recoverable, and the owner can still rename | Refuse all saves; overwrite on the next save |
| Reset shown but disabled with no label (Q&A #5) | No layout jump; the default name stays visible | Hidden; a no-op |
| Rename allowed while stale (Q&A #4) | Labels don't depend on the helper | Disabled while stale |
| Sticky stays at 800 px; padding 520 px (Q&A #6) | One value changes; the default window keeps 492 px of cards | 920 px threshold (the default window stops sticking); a width-aware rule |
| The form remounts per sensor (`key={sensor.key}`) | RF26.2/26.3 follow from React's identity rules; no effect watching the selection | A `draftKey` state compared on every render; an effect that clears the draft |
| `set_label(key, null)` clears | One write path, one command | A `clear_label` command |
| UTF-16 code units for the 40 limit | Same count as `maxLength` and `.length`; the core never refuses what the input allows | Unicode scalar values (a pasted emoji could pass the input and fail the core) |
| The context's default value is the app's store | No provider in `App.tsx`; existing tests unchanged; tests can still pass their own store | A provider like `SensorStoreProvider` (more wiring, three test files change); a module singleton like `theme.ts` (no clean reset between tests) |
| Buttons keep the app's 44 px height | Same as the banner buttons; better target size | The mockup's 40 px (4 px shorter panel) |

### Known Risks

| Risk | Likelihood / impact | Mitigation / next check |
|---|---|---|
| A label shows on the wrong sensor after an LHM bump or a hardware change that reuses an `id\|name` | Low / Medium | Exact-key match (AC-04); LHM pinned; P1 re-run on each bump (AGENTS.md); residual accepted in ADR 0008 |
| The panel at 1024×800 leaves ~331 px of cards while stuck | Certain / Low | Accepted (Q&A #6); revisit with a compact form if it bothers the owner |
| The real panel is taller than 520 px (display scale > 100 %, a long default name) | Low / Low | E2E-22's Shift+Tab step; raise the padding |
| An antivirus or indexer holds `labels.json` during the rename | Low / Low | The save fails visibly; the next save retries |
| A save in flight when the selection moves loses its message | Very low / Low | The save lands on the right key; accepted (Q&A #7) |
| `labels.json.bad` from an earlier failure is replaced by a newer bad file | Very low / Low | Only after two bad files in a row; accepted |
| `load_labels` answers after a form has mounted, so that form's input starts empty for a labelled sensor | Very low / Low | The app opens on the Dashboard and the first frame takes about a second; the row and heading still show the label (they read the store); accepted |
| A label ending in U+0085 or U+FEFF (JS and Rust trim differently) is refused | Very low / Low | Visible "wasn't saved" message; the stored text always equals the UI's |
| The harness scripts miss the Motherboard page | Certain without the change / Low | [E2E harness updates](#e2e-harness-updates) |

### Compliance with AGENTS.md and Rules

- **Trust invariants:** the helper, the pipe, the hash check, the DLL guards and `BROWSER_ARGS` are untouched. The app still never runs elevated; it writes one more file in its own folder at a fixed path; no command takes a path (the same rule as `open_pawnio_site`'s hard-coded URL). A new AGENTS.md bullet records this (step 5).
- **No network:** no URL, no `<a href>`; "Name your fans" is a `<button>`. The form never navigates: `preventDefault` on submit, and the CSP's `form-action 'none'` would block it anyway. E2E-15 re-runs.
- **Regression rule:** nothing under `helper/` or `src-tauri/src/sensors/` changes, so the full helper suite doesn't apply. `npm test` and `cargo test` run; the release keeps the helper of record.
- **Build notes:** only `pophood.exe` is rebuilt (the AGENTS.md recipe), plus the devtools variant.
- **Conventions:** owner answers verbatim (Q&A record, `owner-decisions.md`); evidence with source and limits (`measurements.txt`); a negative control for each new pass/fail check (UT-40 (c)(g), E2E-22, E2E-28, E2E-29); branching and commits stay with the owner; the agent prepares any delete command for the owner's approval.
- **Global rules:** no code comments in new code; no test IDs in code; comments that become stale are flagged, not edited ([Implementation map](#implementation-map)).

### Compliance with Skills

No project skills (`.agents/skills`). Session skill drafts that apply: `webview2-network-audit` (E2E-15); `pophood-design-canvas-mockup` (its "render check early" step, done here).

### Relevant and Dependent Files

- **Specs:** `specs/v0.2.0/requirements.md`, `specs/v0.2.0/README.md`, `specs/v0.1.1/techspec.md`, `specs/v0.1.1/ui-proposal/mockups/Main.dc.html`, `specs/v0.1.0/requirements.md` (RF13, RF26, "Database Changes"), `specs/v0.3.0/README.md`
- **ADRs:** 0008 (`sessions/20261021071727_pophood-oq1-oq2-closeout/decisions/0008-sensor-label-key-basis.md`), 0035, 0036 (`sessions/20261023085728_pophood-v020-techspec/decisions/0036-v020-label-store.md`), 0019, 0030
- **Code:** `src-tauri/src/{lib.rs,commands.rs,webview.rs}`, new `src-tauri/src/labels.rs`; `src/main.tsx`, `src/App.tsx`, `src/sensors/{commands.ts,store.ts,protocol.ts}`, new `src/sensors/labels.ts`; `src/pages/{SensorList.tsx,Dashboard.tsx}`; `src/cards/{CardParts.tsx,MotherboardCard.tsx,DashboardCard.tsx,fields.ts}`; `src/styles/app.css`; `src/theme/tokens.css` (read only)
- **Tests:** `src/pages/SensorList.test.tsx`, `src/cards/Cards.test.tsx`, `src/pages/Dashboard.test.tsx`, new `src/sensors/labels.test.ts`, `src/test/builders.ts`, `src/test/fixtures/frame-{full,reduced}.json`
- **Evidence:** `sessions/20261023085728_pophood-v020-techspec/evidences/render-check/` (prototype, measurements, screenshots)
- **Release:** `C:\Users\jimmy\pophood-e2e\pophood-followups`, `sessions/20261023055425_pophood-v011-release/` (scripts to copy), `scripts/audit-network.ps1`

## Open questions from the requirements: disposition

| Question | Disposition |
|---|---|
| OQ-A: where labels persist | `labels.json` written by the core (Q&A #1; ADR 0036) |
| OQ-B: who applies labels | The UI at render (Q&A #2) |
| OQ-C: failure copy and a bad store | Move aside, start empty; never overwrite an unreadable file; copy in [Data models → Copy](#copy) (Q&A #3) |
| OQ-D: Reset with no label | Shown, disabled (Q&A #5) |
| OQ-E: rename while stale | Allowed (Q&A #4) |
| RF13.4: how characters are counted | UTF-16 code units (Key Decisions) |
| RF26.5: the re-measure | Done in headless Edge 155 ([Measured sizes](#measured-sizes-render-check)); 800 px kept, padding 520 px (Q&A #6); the app check is step 3 and E2E-21/22 |

## Q&A record

Answers in this techspec session, 2026-10-23, quoted verbatim. The options as shown:

| # | Question and options | Answer |
|---|---|---|
| 1 | OQ-A, where should the labels be saved? "JSON file by the core (Recommended)": `labels.json` written by Rust (temp file + rename), survives `-FreshProfile`, v0.3.0 migrates it, 2 commands. "localStorage like theme": no command, lost with the profile. "SQLite now": the v0.3.0 decision brought forward | "JSON file by the core (Recommended)" |
| 2 | OQ-B, who applies the label? "UI, at render (Recommended)": no change under `sensors/`. "Core, in UiFrame": triggers the full helper regression suite | "UI, at render (Recommended)" |
| 3 | OQ-C, a file that can't be read at start? "Move aside, start empty (Recommended)": rename to `labels.json.bad`, start empty, note in the form; an unopenable file is never overwritten; save-failure copy "The name wasn't saved: {error}". "Refuse all saves". "Overwrite on next save" | "Move aside, start empty (Recommended)" |
| 4 | OQ-E, rename while stale or disconnected? "Allowed (Recommended)". "Disabled while stale" | "Allowed (Recommended)" |
| 5 | OQ-D, Reset with no label? "Shown, disabled (Recommended)". "Hidden". "Shown, no-op" | "Shown, disabled (Recommended)" |
| 6 | Sticky panel with the form (1024×800: panel 469 px, worst 504 px, ~331 px of cards)? "Keep 800 px, padding 520 (Recommended)". "Threshold 920 px" (the default window stops sticking). "Width-aware rule" | "Keep 800 px, padding 520 (Recommended)" |
| 7 | The anti-overengineering keep/cut list (as in the [breakdown](#anti-overengineering-breakdown)), with the AGENTS.md line? "Accept as proposed (Recommended)". "Accept, but no AGENTS.md line" | "Accept as proposed (Recommended)" |

## Revision history

- **Rev 1 (2026-10-23):** first version, with the render check.
- **Rev 1.1 (2026-10-23):** the independent QA-scenario pass is merged ([QA-scenario pass](#qa-scenario-pass)): the fixture count, the test wiring, the trim rule (the core checks, the UI trims), the load-note copy, the kept `lib.rs` comment, UT-42 (a)(d)(g)(l)(m), UT-43, E2E-15/22/28 and the step-3 render. One design change (the trim check), no new owner decision; the scores stand.
