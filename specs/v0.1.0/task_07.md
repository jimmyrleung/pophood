# Task 07 - UI foundation: theme, shell, store, banners

## Description

Build the UI's skeleton on top of T2's scaffold: design tokens, the theme (follow Windows, toggle overrides and is remembered), fonts, icons, the app shell with sidebar and trust panel, the TS mirror of the UI contract with its shared fixture, the sensor store (Channel subscription, 10-minute history, frame-age watchdog), and the status banner and blocking-panel selection. Everything is tested against fixtures, so this runs in parallel with the helper and core tasks.

- Status: Completed (2026-10-21)
- Complexity: **L** — about 20 files and 6 test files. Kept whole because the store, the banner selection and the trust panel all read the one `SensorStatus` contract and its fixture, and T6 needs all three for its live checks.
- Estimated time: 6–8h
- Depends on: T2
- Can run in parallel with: T3, T4, T5, T11

## AI guidance

- `implement-task`: runs this task.
- ADR `0012-ui-owns-live-history.md` (history lives in the UI, #38).
- No router, state or chart library (techspec § Anti-overengineering breakdown, #41). Hooks use `useSyncExternalStore`.
- The UI never renders an external `<a href>`; URLs are text (navigation is pinned, T2).

## Requirements

- Tokens from `ui-proposal.md` under `:root[data-theme="light"]` / `[data-theme="dark"]`, plus the first-paint background rule.
- Theme per #35: follow `prefers-color-scheme`; toggling stores an override in localStorage `pophood.theme` (try/catch); toggling back to the system theme clears it; re-applies on a `matchMedia` change while there's no override; `applyTheme()` runs before the first render; never calls Tauri `setTheme`.
- Fonts from `@fontsource` as files (CSP `font-src 'self'`).
- `src/sensors/protocol.ts` mirrors `events.rs` and is locked by `src/test/fixtures/event-frame.json`.
- Store: `stale = phase !== "live"`; `stopped` with a blocking notice → `frame = null`; history appended per frame and trimmed to `frame.t − 600_000`; watchdog sets `stale` after 3 × `periodMs` with no frame.
- Banner and panel copy, precedence and actions exactly per techspec § UI states not mocked; trust-panel rows per § Trust panel rows.
- Shell: nav with Dashboard only (no Runs item), About link, theme toggle with `aria-label`, `:focus-visible` ring.

## Files involved

| Path | Action |
|---|---|
| `src/main.tsx` | Modify (created in T2 as a placeholder → fonts, CSS, `applyTheme()`, `<App/>`) |
| `src/App.tsx` | Modify (created in T2 as a placeholder → shell, page state, `SensorStoreProvider`; T10 adds the pages) |
| `src/theme/theme.ts`, `src/theme/tokens.css` | Create |
| `src/styles/app.css` | Create |
| `src/icons/Icons.tsx` | Create |
| `src/sensors/protocol.ts`, `history.ts`, `store.ts`, `commands.ts` | Create |
| `src/shell/Sidebar.tsx`, `TrustPanel.tsx`, `StatusBanner.tsx`, `BlockingPanel.tsx` | Create |
| `src/pages/Dashboard.tsx` | Create as a stub that renders `StatusBanner` and `BlockingPanel` (T9 fills it) |
| `src/test/fixtures/event-frame.json` | Create (shared with T6, which may correct it against techspec § UI contract) |
| `src/sensors/history.test.ts`, `store.test.ts`, `protocol.test.ts`, `src/shell/StatusBanner.test.tsx`, `TrustPanel.test.tsx`, `src/theme/theme.test.ts` | Create |

## Implementation steps

1. `tokens.css` and `app.css` per techspec § Implementation map → UI (rows `tokens.css`, `app.css`) and `ui-proposal.md` → Colour tokens; Type, spacing and icons. Include the drill-down 250/400 flex bases now (used by T10).
2. `theme.ts` per its techspec row.
3. `Icons.tsx`: the mockup icons plus the new warning icon (techspec row).
4. `protocol.ts` from techspec § UI contract; then `event-frame.json`: one `{"kind":"frame", …}` event with a short `UiFrame` (a few sensors including a `null` value) written to match the Rust `events.rs` shapes in the techspec (camelCase, `key` on each sensor, `elevated`). Include one `memory[]` entry, so the field names `sizeGB` and `configuredMTs` are locked too.
5. `history.ts`, `store.ts`, `commands.ts` per their techspec rows. Precedent for subscribe/cleanup: spike `tauri-hello/src/App.tsx (≈:24-31)`. Until T6 registers `subscribe_sensors`, the `invoke` is rejected; the store then keeps its initial status (`phase: "starting"`, everything else null or idle) without throwing.
6. `Sidebar.tsx`, `TrustPanel.tsx`, `StatusBanner.tsx`, `BlockingPanel.tsx` per their techspec rows and § UI states not mocked (blocking-panel style uses `surface`, `danger-line`, `danger-text` from `runs.dc.html ≈:14-15`).
7. `App.tsx`: page state `{dashboard} | {sensors, cardId} | {about}`, no router; a stub `Dashboard.tsx` that shows the banner / blocking panel (cards come in T9).
8. Tests (see Testing). Mock `@tauri-apps/api/core` (`invoke`, `Channel`) in `store.test.ts` only.

## Acceptance Criteria

- `npm test` passes UT-21, UT-25 (banner and panel rows), UT-26, UT-27 and UT-28 (TS half); `npm run build` (`tsc -b && vite build`) succeeds (command output).
- `dist/` contains the IBM Plex `.woff2` files as separate assets (directory listing), and no CSS file embeds a `data:` URI: `rg "url\(\s*['\"]?data:" dist -g "*.css"` returns nothing. (Minified JS legitimately contains `data:` object keys, so the check is limited to CSS `url()`s.)
- `npm run tauri dev`: the shell renders in both themes; toggling the theme, restarting, and toggling back behaves per #35 (screenshot or owner confirmation). With no supervisor yet (T6 is downstream), the rejected `subscribe_sensors` leaves the trust panel on the `starting` row "Starting sensor helper…" and the devtools console shows no uncaught error. T6's live checks cover the `live` rows.
- The CSP itself is checked on a release build in E2E-20 (Task 13): under `tauri dev` the page comes from Vite, which injects CSS as `<style>`, so a dev-mode CSP check proves nothing about the shipped policy.
- No `<a href` in `src/` pointing outside the app (`rg "href=\"http" src` returns nothing).

## Testing

- **UT-21** history and watchdog: append, trim > 600 s, nulls kept, aged-out series dropped, `stale` follows phase, fake timers: no frame for 3 × `periodMs` → stale, next frame clears.
- **UT-25 (banner and panel rows):** each status row of techspec § UI states not mocked gives its copy and actions; combined states show the highest-priority row only; the three `elevation_*` copies (`elevation_timeout` without `{detail}`), "Reduced sensors" title, PawnIO-driver-not-running banner. The Dashboard-level parts (the `starting` info panel, history absent under blocking panels) are in **Task 09**.
- **UT-26** theme: system default, override stored, toggling back clears, localStorage throwing is tolerated.
- **UT-27** trust panel: every row and state in techspec § Trust panel rows, including "2.2.0.0" → "2.2.0".
- **UT-28, TS half:** `event-frame.json` parses into `SensorEvent`/`UiFrame` with the expected field types. The Rust half is in **Task 06**.

## Additional relevant files

- `specs/v0.1.0/ui-proposal/ui-proposal.md`; `ui-proposal/mockups/dashboard.dc.html` (shell, icons), `runs.dc.html` (danger tokens)
- `specs/v0.1.0/techspec.md` § Implementation map → UI, § UI contract, § UI states not mocked, § Trust panel rows, § Fixed source parameters (CSP)
- `C:\Users\jimmy\projects\pc-bench-spike\tauri-hello\src\App.tsx`

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 92%. Remaining uncertainty: both themes were not eyeballed (one `tauri dev` capture, in the light theme the PC currently uses); the `live` trust rows and the banner buttons run only in tests until T6 supplies a real supervisor; `tsc` strictness passes but no lint was run.
- **Evidence:**
  - `npm test`: 6 files, 73 tests pass (UT-21 history + store/watchdog, UT-25 banner and panel rows, UT-26 theme, UT-27 trust panel, UT-28 TS half). `npm run build` passes.
  - `dist/assets` holds the IBM Plex `.woff2` (and `.woff`) files as separate assets; the built CSS has 0 `data:` occurrences; `grep 'href="http' src` finds nothing; `index.html` has no `<style>`.
  - `npm run tauri dev` + `PrintWindow` capture of the `pophood` window: shell renders (sidebar, brand, theme toggle showing the moon in the light theme, Dashboard item, trust panel on "Starting sensor helper…" / "PawnIO · Not checked yet" / "No network", "About and licenses", Plex Sans loaded). No supervisor exists yet, so `subscribe_sensors` was rejected and swallowed. The capture was deleted afterwards (not committed).
- **Decisions / gaps:**
  - No inline `style` attributes anywhere (CSP `style-src 'self'` blocks them): all layout is classes in `app.css`. React's `style` prop (CSSOM) stays allowed for dynamic values in T8/T9.
  - Banner priority is the techspec table read top to bottom (`bannerFor`), so combined states show one row. `elevation: prompting` / `connecting` render as an info banner with only the status text (no title, no buttons). A reconnecting banner with elevation in flight shows the "waiting for full sensors…" copy plus the elevation line underneath.
  - Theme: if `localStorage` writes throw, the override is kept in memory for the session (otherwise the toggle would do nothing in a blocked-storage window). `useTheme()` is a `useSyncExternalStore` over `data-theme`.
  - `SensorStoreProvider` lives in `src/sensors/StoreProvider.tsx`, the context and hooks in `store.ts`; `useSensorSnapshot()` is an extra hook for components that need several fields. `store.applyEvent` is public (the Channel's `onmessage` calls it; tests too).
  - `src/test/builders.ts` and `src/test/setup.ts` are test helpers (`cleanup` after each test; vitest globals stay off).
  - `devCsp` (T2) is what lets Vite's injected `<style>` and HMR work under `tauri dev`; the shipped CSP is checked in E2E-20.
  - `event-frame.json` is the contract fixture for T6: camelCase `UiFrame` (`seq`, `t`, `periodMs`, `elevated`, `memory[]`, `hardware[]`, `sensors[]` with `key`).
