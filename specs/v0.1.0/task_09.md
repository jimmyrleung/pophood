# Task 09 - Charts, cards and Dashboard

## Description

Render the dashboard from T8's model: SVG path maths, the sparkline (including the Disk two-line variant) and history/drill-down line charts, the card parts and the five cards plus placeholder, empty and starting states, the Dashboard page with header, banner, grid, history panel and footnote. After this task the owner's daily screen works live once T6 is merged; T6 isn't upstream, so the live checks below move to Task 13 if it isn't.

- Status: Completed (2026-10-21)
- Complexity: M
- Estimated time: 5–7h
- Depends on: T8
- Can run in parallel with: T5, T6, T11

## AI guidance

- `implement-task`: runs this task.
- Plain SVG, no chart library (#41, open UI question 2).
- Mockup E1 is the visual reference; § Mockup corrections in the techspec overrides it where they differ (RTX first, kind labels, names, no Run buttons).

## Requirements

- `linePath` / `areaPath` per techspec § Implementation map (`path.ts` row): time → x over the window, clamped y, `null` breaks the path, 1-decimal coordinates, each non-null area segment closed to the baseline on its own.
- Sparkline, Disk variant, history LineChart and drill-down LineChart exactly per the `Sparkline.tsx, LineChart.tsx` row (viewBoxes, heights, strokes, dashes, `aria` labels, axes in HTML, U+2212 in "−10 min").
- Cards per the `CardParts.tsx` and card rows: whole card clickable, "All sensors" the keyboard target; placeholders not clickable; `LockedValue` never shows a digit.
- Dashboard per the `Dashboard.tsx, HistoryPanel.tsx` row: no Run buttons; blocking panel **or** grid + history panel; "Starting the sensor helper…" panel while there's no frame; footnote copy; segmented control with Temperatures first.
- Grid `repeat(auto-fill, minmax(300px, 1fr))` gap 16 (2 columns at 1024 px, 3 at 1280).

## Files involved

| Path | Action |
|---|---|
| `src/charts/path.ts`, `Sparkline.tsx`, `LineChart.tsx` | Create |
| `src/cards/CardParts.tsx` | Create |
| `src/cards/CpuCard.tsx`, `GpuCard.tsx`, `MemoryCard.tsx`, `DiskCard.tsx`, `MotherboardCard.tsx`, `PlaceholderCard.tsx` | Create |
| `src/pages/Dashboard.tsx` | Modify (created in T7 as a stub → full page) |
| `src/pages/HistoryPanel.tsx` | Create |
| `src/charts/path.test.ts`, `src/cards/Cards.test.tsx`, `src/pages/Dashboard.test.tsx` | Create |

## Implementation steps

1. `path.ts` per its techspec row and the mockup path maths (`dashboard.dc.html` sparkline ≈:115, history chart ≈:251-264).
2. `Sparkline.tsx` and `LineChart.tsx` (history and drill-down variants) per the techspec row; series come from `useSeries(key)` (T7) as directed by T8's model.
3. `CardParts.tsx`, then the six card components per their techspec rows and mockup E1 (Memory one row; Disk two 28 px heroes and the two-line sparkline; Motherboard fan list with bars, no sparkline; GPU VRAM bar `muted` on `line`).
4. `Dashboard.tsx` and `HistoryPanel.tsx` per their techspec row; card click / "All sensors" sets page `{ page: "sensors", cardId }` (T10 renders it).
5. Tests (see Testing).
6. If T6 is merged, run `npm run tauri dev` and compare with mockup E1 side by side. If it isn't, record that the live ACs below are deferred to E2E-01, E2E-21 and E2E-22 in Task 13; the task closes on the unit tests and the build.

## Acceptance Criteria

- `npm test` passes UT-22, UT-24 and the Dashboard parts of UT-25 (test output); `npm run build` succeeds.
- **Live checks** — only if T6 is merged; otherwise they wait for E2E-01 and E2E-21 in T13 (the elevated helper isn't needed):
  - `npm run tauri dev`: CPU, Memory and both GPU cards with the RTX first, sparklines moving about once per second on CPU, Memory and GPU, the dashed Disks and Motherboard placeholders, the "Reduced sensors" banner, and no Run buttons (screenshot compared with `dashboard.dc.html`; owner confirms the look).
  - In reduced mode no CPU field other than Total load shows a number (screenshot / DOM inspection).
  - At a 1024 px window the grid shows 2 columns, at 1280 px 3 (devtools measurement or screenshot). The full E2E-21 check is in T13.
- Without T6, the same layout checks run against the full fixture: `Dashboard.test.tsx` renders `frame-full.json` and asserts the card order (CPU, Memory, RTX, iGPU, Disk, Motherboard) and no Run button (test output).

## Testing

- **UT-22** `linePath` / `areaPath`: time-to-x, null → new `M`, clamping, a gap gives two closed area segments.
- **UT-24** cards render: a locked field never renders a digit, the lock text is present, placeholder cards aren't clickable.
- **UT-25, Dashboard parts:** with `phase: "starting"` and no frame, the "Starting the sensor helper…" panel replaces the grid and no history panel renders; under every blocking notice the history panel is absent. The banner rows themselves are in **Task 07**.
- Live E2E (E2E-01 reduced first launch, E2E-21 window size, E2E-22 keyboard and focus) is in **Task 13**. The CSP on a release build is E2E-20 in **Task 13**.

## Additional relevant files

- `specs/v0.1.0/ui-proposal/mockups/dashboard.dc.html`
- `specs/v0.1.0/techspec.md` § Implementation map → UI (charts, cards, pages rows), § Patterns reused (SVG drawing), § Mockup corrections, § Fixed source parameters (Window)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 91%. Remaining uncertainty: the 1024 px / 1280 px column counts and the keyboard/focus ring were not measured (E2E-21 and E2E-22 in T13); the owner hasn't judged the look against the mockup; the charts have only been seen with ~40 s of history (the sparkline correctly occupies the right-hand sliver of a 10-minute axis).
- **Evidence:**
  - `npm test`: 11 files, 213 tests pass (UT-22 `path.test.ts` ×11, UT-24 `Cards.test.tsx` ×12, UT-25 Dashboard parts `Dashboard.test.tsx` ×14 incl. each blocking notice, plus T7/T8). `npm run build` passes.
  - Live (T6 is in): `npm run tauri dev` + `PrintWindow` capture at 1280×860: header summary line (no drive), the Reduced sensors banner, CPU card with Total load as the hero and four "Needs full sensors" fields (no number except the load), Memory "22.8 / 31.1 GB" with "Configured speed 6000 MT/s" and no OC chip, the RTX card first and the Radeon second, and the dashed Disks and Motherboard placeholders; no Run buttons. The capture was deleted afterwards. Closing the window left no helper.
- **Decisions / gaps:**
  - The whole card is clickable (`article` `onClick`); "All sensors" is the only focusable control and stops propagation. The Motherboard footer is plain text: the "All sensors" link in the techspec's footer description would duplicate the header's button (two buttons with one name).
  - Charts and cards use classes and SVG attributes only (`stroke-dasharray`, `viewBox`); the one `style` prop left is the bar fill width (CSSOM, allowed under `style-src 'self'`, to be confirmed by E2E-20's "zero CSP violations").
  - `useSeriesList(keys)` returns an array in the order of `keys` with `undefined` where there's no history; `fields.ts` now gives the Disk spark `[read key, write key]` with `""` for a missing sensor so the second line stays dashed.
  - The chart's right edge is the newest frame's `t` (`nowMs = frame.t`), so a stalled source freezes the chart instead of scrolling it.
  - `DetailChart` and `detailDomain` (10 % padded min–max, flat series on the baseline) are written here for T10; the drill-down page itself is T10.
  - Dashboard and App now take `onOpenCard`; T10 routes the `sensors` page.
