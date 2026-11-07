# Task 3 - Dashboard: the fan-row label, "Name your fans", the fan-name CSS

## Description

The Motherboard card's fan rows show a sensor's label in place of the LHM name, and the card's link reads "Name your fans" (H1). Other cards keep "All sensors". The fan name gets a CSS rule so a long one-word label wraps (review L1). This is Sequence step 4, moved before the drill-down so T4's render has every part.

- Status: Done
- Complexity: S
- Estimated time: 1–2h
- Depends on: T2 (`useLabels`, `createLabelStore`, `LabelStoreContext`)
- Can run in parallel with: T1

## AI guidance

- `implement-task`: this task's flow.
- `AGENTS.md` "No network": "Name your fans" is a `<button>`, never a link.
- Global rules: no code comments, no test IDs in code. `CardParts.tsx:101-104` says "'All sensors' is the keyboard target": don't edit it; T6 lists it for the owner.

## Requirements

- `CardParts.tsx`: `CardProps` gets `linkText?: string`; `Card` renders `{linkText}` with the default `"All sensors"` (techspec "`src/cards/CardParts.tsx`").
- `MotherboardCard.tsx`: `useLabels()`; each fan row shows `map.get(row.key) ?? row.name`; `linkText="Name your fans"` (techspec "`src/cards/MotherboardCard.tsx`").
- **Added (owner: "Add the 2 CSS rules (Recommended)", review L1):** the fan name `<span>` gets `className="fan__name"`, and `app.css` gets, after `.fan__top`:

  ```css
  .fan__name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  ```

  The same two properties as `.row__name` (`app.css:797-801`).
- Labels never enter `buildDashboard` or `fields.ts`; the placeholder and empty cards (`PlaceholderCard`) stay without a link.

## Files involved

| Path | Action |
|---|---|
| `src/cards/CardParts.tsx` | Modify (`linkText`) |
| `src/cards/MotherboardCard.tsx` | Modify (label, link, `fan__name`) |
| `src/styles/app.css` | Modify (`.fan__name`) |
| `src/cards/Cards.test.tsx` | Modify (UT-43 a, b) |
| `src/pages/Dashboard.test.tsx` | Modify (UT-43 c) |
| `src/cards/DashboardCard.tsx`, `src/cards/fields.ts`, `src/pages/Dashboard.tsx` | Read (no change) |

## Implementation steps

1. `CardParts.tsx` and `MotherboardCard.tsx` per the techspec, plus `className="fan__name"`.
2. `app.css`: the `.fan__name` rule after `.fan__top`.
3. `Cards.test.tsx`: add `vi.mock("../sensors/commands", …)` with `loadLabels` and `setLabel`; `renderCard` takes an optional label store and wraps `LabelStoreContext.Provider`; seed labels by mocking `loadLabels` to resolve `{ labels, problem: null }`, then `await act(() => labels.start())` (techspec Implementation map, `Cards.test.tsx` row). Add **`afterEach(() => vi.clearAllMocks())`** (review M3).
4. `Dashboard.test.tsx`: extend the existing commands mock with `loadLabels` and `setLabel`; `renderDashboard` wraps a fresh `createLabelStore()` and returns it as `labels`. Add `afterEach(() => vi.clearAllMocks())` if the file has none.
5. Write UT-43 (a)–(c). Run `npm test` and `npm run build`.
6. Update this file's Status and task notes, and the T3 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes: UT-43 (a)–(c) and every existing test, including the "All sensors" clicks in `App.test.tsx`, `Cards.test.tsx` and `Dashboard.test.tsx` (vitest output).
- `npm run build` passes.
- **Negative control:** UT-43 (a) with an empty store reads "Fan #1" (part of the test). Also, once: render `row.name` in place of the label → UT-43 (a) and (c) fail. Revert. Record the output in the task notes.
- `MotherboardCard.tsx` has no `style=` other than the existing bar width, and no `<a` (`git grep`).
- The fan row's overflow is checked in the real WebView2 with a one-word 40-character label in E2E-28 (T8). jsdom applies no CSS.

## Testing

- **UT-43** (techspec § Unit Tests): (a) a seeded `fan/0` label on the Motherboard card's first fan row, with no " · Fan #1"; "Name your fans" calls `onOpen("motherboard")` once; an empty store reads "Fan #1"; (b) GPU and CPU cards still show "All sensors"; (c) the Dashboard updates the fan row on `labels.save` with no new frame, while the CPU card keeps "62.5 °C · CCD1", "Package temperature" and "CPU package".
- The layout of `.fan__name` is E2E-28 (T8).

## Additional relevant files

- `specs/v0.2.0/techspec.md` § Copy, § Key Decisions
- `specs/v0.2.0/tasks.md` § Review findings (L1)

## Task notes (2026-10-23)

- `Card` takes `linkText` (default "All sensors"); `MotherboardCard` reads `useLabels()`, shows `map.get(row.key) ?? row.name` in a `.fan__name` span, and passes "Name your fans". `app.css` has the two `.fan__name` properties after `.fan__top`.
- `Cards.test.tsx`: a commands mock, `renderCard` takes an optional label store, labels are seeded through a mocked `loadLabels` and `start()`. UT-43 (a) and (b) are two tests. `Dashboard.test.tsx`: the commands mock has `loadLabels` and `setLabel`, `renderDashboard` wraps a fresh store and returns it as `labels`; UT-43 (c) is one test (a fan label and a CCD1 label saved with no new frame; the CPU card keeps "62.5 °C · CCD1", "Package temperature" and the legend "CPU package").
- **Negative control:** `{row.name}` in place of the label → the Cards (a) test and the Dashboard (c) test FAILED (2 failed, 145 passed). Reverted; 147 pass. The empty-store "Fan #1" check is part of (a).
- `MotherboardCard.tsx` has no `<a` and no `style=` except the existing bar width.
