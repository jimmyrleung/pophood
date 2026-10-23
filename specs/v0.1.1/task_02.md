# Task 2 - Drill-down page and styles, then an early `tauri dev` render

## Description

Build variant B on the drill-down page. The selected sensor's panel goes full width on top, and it sticks in windows at least 800 px tall. The group cards flow in CSS columns below it. The page gets the dashboard's status banner, locked cards and selection over the unlocked rows. Then render the page in the real WebView2 under `npm run tauri dev` before any release build, because the CSS is where the risk is. This is Sequence step 2.

- Status: Done (2026-10-22)
- Complexity: M
- Estimated time: 4–6h
- Depends on: T1 (`drillSections(…, status)` and `SensorGroup.lock`)
- Can run in parallel with: —

## AI guidance

- `implement-task`: this task's flow.
- ADR 0019 (`sessions/20261021165812_pophood-v010-e2e/decisions/0019-agent-e2e-uia-and-cdp.md`): drive the app through UI Automation and CDP, never with OS keystrokes. The owner uses the same PC.
- Session skill draft `sessions/20261022171503_pophood-v011-techspec/skills/pophood-webview2-render-check.md`: the render-check method and what its numbers mean.
- `AGENTS.md` "No network": no `<a href>`, and no new URL (none is expected). Layout stays in `app.css` classes, not in `style` props (techspec § Patterns reused, the CSP row).
- `AGENTS.md` "Conventions", Evidence: each pass/fail check has a negative control.

## Requirements

- The markup, class names and heading levels are as in techspec § [Implementation map](techspec.md#implementation-map), "`src/pages/SensorList.tsx`":
  - `drill__detail` wrapper;
  - the "Sensor list" region with `drill__section`, `drill__heading` (`h2`) and `drill__columns`;
  - `div.group` (`group--split` only for an unlocked group of more than `SPLIT_ABOVE` = 8 rows);
  - `group__title`: `h2` on a page with one hardware item, `h3` under a hardware heading;
  - `group__lock` with `LockedValue` and no rows for a locked group.
- `SensorDetail`: the Min / Max / Unit list in the top row, the id next to the name, the chart last. The logic doesn't change.
- `StatusBanner` sits under the header, unchanged, with every state.
- Selection: the first row of the unlocked groups, in display order. There is no stored selection until a click. A clicked key stays in state (techspec § Workflows).
- The header count counts locked sensors too.
- CSS: replace the drill-down blocks and change only the listed properties (techspec "`src/styles/app.css`" and its table). `--shadow` goes into both themes (techspec "`src/theme/tokens.css`").
- The old `div.drill` wrapper and the `.list`, `.list__heading` and `.list__group` rules go. The "Sensor list" and "Sensor detail" landmarks stay.
- No `style` prop is added.

## Files involved

| Path | Action |
|---|---|
| `src/pages/SensorList.tsx` | Modify |
| `src/pages/SensorList.test.tsx` | Modify |
| `src/styles/app.css` | Modify |
| `src/theme/tokens.css` | Modify |
| `src/cards/CardParts.tsx` (`LockedValue`), `src/shell/StatusBanner.tsx`, `src/charts/LineChart.tsx` (`DetailChart`), `src/App.tsx` | Read |
| `specs/v0.1.1/ui-proposal/mockups/Main.dc.html` | Read (the variant B values) |
| `sessions/20261022171503_pophood-v011-techspec/evidences/render-check/` (`measurements.txt`, `screenshots/`) | Read (to compare) |
| `sessions/20261021165812_pophood-v010-e2e/ui.psm1`, `cdp.psm1`, `devtools-start.ps1` | Read (the harness; import the modules, don't edit them) |
| This session's `evidences/tauri-dev-render/` | Create (the render evidence) |

## Implementation steps

1. `SensorDetail`: the new markup (techspec, first `SensorList.tsx` snippet).
2. `SensorList`: `SPLIT_ABOVE`, `count`, `rows` over the unlocked groups, `<StatusBanner />`, and the sections markup with `Title` (techspec, second snippet). Keep T1's hook placement. The row button markup doesn't change.
3. `app.css`: replace the block under `/* ---- Drill-down: the list and detail panes share a row … */` and the `.list`, `.list__heading`, `.list__group` rules. Then apply the rule-change table (techspec "`src/styles/app.css`").
4. `tokens.css`: `--shadow` in both themes, and the header comment.
5. `SensorList.test.tsx`:
   - `setup` gets a status parameter. Today it is `setup(cardId, frame = FULL, onBack = vi.fn())`, so add the status last, with today's `{ ...liveElevated(), helperSha256: "ad65be57" }` as the default, and every existing call keeps working.
   - The "Controls · 6" query reads the card's heading.
   - Add UT-39 (a)–(g), with a small helper that finds a card by its title heading (techspec § Unit Tests, UT-39).
6. Run `npm test` and `npm run build`. Run the UT-39 (g) negative control (below) once and revert it.
7. **Early render** in `npm run tauri dev` (the dev app runs unelevated, so this is reduced mode):
   - **Start:** set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` for the `npm run tauri dev` process to the value in `devtools-start.ps1` (every `BROWSER_ARGS` flag plus a 127.0.0.1 CDP port). CDP then sends keys without a foreground. Resize with `Set-PhSize -Client` (the render check's sizes are viewport sizes) and take screenshots with `Save-PhShot`. Check `window.innerWidth` and `innerHeight` through CDP.
   - **Sizes:** in both themes, at 1917×1029 and 1024×680, render the CPU page (Loads and the locked cards), Memory (hardware headings), Motherboard and GPU. Count the columns from the card titles' rectangles (5 at 1917, 2 at 1024). The split Loads card keeps its border in the next column and has no title there.
   - **Sticky and focus, at 1024×800:** the panel sticks while the CPU page scrolls. Then E2E-22's Shift+Tab step: scroll to the bottom, Shift+Tab back through the first rows of each column, and check that each focused row is fully below the panel (`document.activeElement.getBoundingClientRect()` against `.drill__detail`).
   - **Panel height:** compare it with `measurements.txt` (273 px at 1917×1029, 348 px at 1024×680). If it is taller than 360 px, stop and tell the owner (techspec Known Risks: raise the padding).
   - **CSS problems:** fix them here and render again. A fix that changes a techspec value (a size, a threshold, a rule) needs the owner's OK first.
8. Update this file's Status and task notes, and the T2 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes: UT-39 (a)–(g), every v0.1.0 test in `SensorList.test.tsx`, and every other test (vitest output).
- `npm run build` passes.
- **Negative control:** with `useSensorStatus()` moved after the `frame === null` return, UT-39 (g) fails with a React hook-order error. Run once, then revert (test output in the task notes).
- `src/pages/SensorList.tsx` has no `style=` prop and no `<a` element (`git grep`).
- `git diff --stat` for this task lists only the four source files above, plus docs.
- **Render evidence** under `evidences/tauri-dev-render/`, each screenshot with its viewport size from CDP:
  - both themes at 1917×1029 and 1024×680;
  - 5 columns at 1917 and 2 at 1024;
  - the split card has its border and no title in its second column;
  - at 1024×800, the panel stays at the top after a scroll;
  - each row focused by Shift+Tab is fully below the panel;
  - the panel is 360 px tall or less at each size.

## Testing

- **UT-39** (new): (a) Motherboard cards and heading levels, Memory `h3`; (b) the reduced CPU banner and locked Clocks, "CPU Total" selected, then "Core (Tctl/Tdie)" after elevation with no click; (c) the clicked "Cores (Average)" falls back and comes back; (d) `group--split` only above 8 rows and never on a locked card; (e) the no-sensors caption in the panel's place; (f) stale on a locked page; (g) no frame → frame → blocking stop, with no React error.
- The v0.1.0 page tests keep passing.
- The `tauri dev` render is a preview: `tauri dev` uses `devCsp`, and the dev build isn't the release. The E2E rows (E2E-12, 21, 22, 27) close in T5 and T6 on the release builds.

## Additional relevant files

- `specs/v0.1.1/techspec.md` § Architecture, § Workflows, § UI states on the drill-down, § Fixed layout parameters, § Measured sizes, § Known Risks
- `specs/v0.1.1/ui-proposal/ui-proposal.md`
- `src/test/builders.ts` (`liveReduced`, `liveElevated`, `stopped`, `sensor`, `frame`)

## Task notes (2026-10-22)

- Done: `SensorList.tsx` (variant B markup, `StatusBanner`, locked cards, selection over unlocked rows, `group--split`, `h2` or `h3` card titles), `app.css`, `tokens.css` (`--shadow`), UT-39 (a)–(g) in `SensorList.test.tsx`. No `style=` and no `<a` in the page (grep).
- Negative control: with `useSensorStatus()` after the `frame === null` return, UT-39 (g) fails with "Rendered more hooks than during the previous render" (1 failed, 19 passed). Reverted.
- **Not done: step 7, the early `tauri dev` render** (screenshots, column counts, sticky panel and Shift+Tab at 1024×800, panel height). The session goal was code complete with green build and tests. It should run before T5, so that a CSS problem shows up before the release build.

### Early render (step 7), done 2026-10-22 after the T4-style review

- Done in the real WebView2 under `npm run tauri dev`, reduced mode: both themes at 1917×1029 and 1024×680, 5 and 2 columns, the split Loads card with its border and no second title, the panel 273 px and 348 px (≤ 360), no horizontal scroll, the panel sticky at 1024×800, and E2E-22's Shift+Tab step (0 rows hidden with the rule, 14 hidden with it switched off). Evidence: `sessions/20261022204727_pophood-v011-implementation/evidences/tauri-dev-render/` (README, `measurements.json`, 16 screenshots, `shift-tab-*.json`, and the two scripts one level up).
- No CSS problem found, so no CSS or spec value changed.
- Review items L1 and L2 (two test gaps) are closed: UT-38 gets an all-`null` CPU Load case, and UT-39 (b) checks that the header count includes locked sensors. Both fail on the matching mutation. `npm test`: 251 passed.
