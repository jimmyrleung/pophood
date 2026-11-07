# Task 4 - Drill-down rename form and styles, then an early `tauri dev` render

## Description

Add the rename form to the drill-down's detail panel, and show labels in the rows, the heading and the chart name. The Motherboard subline gets its suffix (H2), and the sticky panel's focus padding grows from 360 px to 520 px. Then render the page in the real WebView2 under `npm run tauri dev` before any release build, with the review's typing check (M1). This is Sequence step 3.

- Status: Done (the render ran; M1 fixed with the fallback selector, owner-approved)
- Complexity: M
- Estimated time: 5–7h
- Depends on: T1 (the commands, for the render), T2 (the store), T3 (the Dashboard, for the render)
- Can run in parallel with: —

## AI guidance

- `implement-task`: this task's flow.
- ADR 0019 (`sessions/20261021165812_pophood-v010-e2e/decisions/0019-agent-e2e-uia-and-cdp.md`): drive the app through UI Automation and CDP, never with OS keystrokes. The owner uses the same PC.
- Session skill draft `sessions/20261022171503_pophood-v011-techspec/skills/pophood-webview2-render-check.md` and v0.1.1's T2 render (evidence in `sessions/20261022204727_pophood-v011-implementation/evidences/tauri-dev-render/`; its scripts `render-check.ps1` and `sticky-focus.ps1` in that session's root): the render method.
- `AGENTS.md` "No network": no `<a href>`; layout in `app.css` classes, never a `style` prop (CSP `style-src 'self'`).
- `AGENTS.md` "Conventions", Evidence: each pass/fail check has a negative control.
- Global rules: no code comments, no test IDs in code. `app.css:298` ("about 450 px") and `:305` ("at most ~350 px tall") become wrong: don't edit them; T6 lists them for the owner.

## Requirements

- `SensorList.tsx` per techspec "`src/pages/SensorList.tsx`": `RenameForm` (local component), `SensorDetail` gets `label`, the heading and chart name use `label ?? sensor.name`, the row shows "{label} · {default}" with `.row__default`, the Motherboard subline suffix.
- `useLabels()` sits with the other hooks, **before** the `frame === null` return (hook order, UT-39 (g)).
- `<RenameForm key={sensor.key} …/>` is the only new `key`. **Don't add a `key` to `SensorDetail`** (review L11): it would remount the chart.
- `app.css` per techspec "`src/styles/app.css`": `.btn--accent`, `.btn:disabled`, `.row__default`, `.rename*`, and `scroll-padding-top: 520px`.
- No `style` prop, no `<a`, no `dangerouslySetInnerHTML`.
- **M1 rule:** if the typing check (step 7) fails, **stop and ask the owner** before using the fallback selector `html:has(.drill__detail):not(:has(.rename :focus))`. A fix that changes a techspec value (a size, a threshold, a rule) needs the owner's OK first.
- **Label file:** follow `tasks.md` § [Label file state](tasks.md#label-file-state): no `labels.json` at the start of the render (move one aside if it exists), every label reset at the end, then move `labels.json` aside. Never delete.

## Files involved

| Path | Action |
|---|---|
| `src/pages/SensorList.tsx` | Modify |
| `src/pages/SensorList.test.tsx` | Modify (UT-42, the subline regex, the commands mock, the label store in `setup`) |
| `src/styles/app.css` | Modify |
| `src/sensors/labels.ts` (T2), `src/charts/LineChart.tsx` (`DetailChart`), `src/test/builders.ts`, `src/test/fixtures/frame-{full,reduced}.json` | Read |
| `sessions/20261023085728_pophood-v020-techspec/evidences/render-check/measurements.txt` | Read (to compare) |
| `sessions/20261021165812_pophood-v010-e2e/ui.psm1`, `cdp.psm1`, `devtools-start.ps1` | Read (the harness; import, don't edit) |
| `sessions/<yyyyMMddHHmmss>_pophood-v020-implementation/` (the implementation session): `render.ps1` (or similar), `evidences/tauri-dev-render/`, `evidences/label-files/` | Create |

## Implementation steps

1. `SensorList.tsx`: imports, `RenameForm`, `SensorDetail` with `label`, `useLabels()` in `SensorList`, the panel call, the row markup and the subline (techspec "`src/pages/SensorList.tsx`", items 1–4).
2. `app.css`: the four blocks and the 520 px padding (techspec "`src/styles/app.css`").
3. `SensorList.test.tsx`:
   - `vi.mock("../sensors/commands", …)` with all five wrappers (`setLabel` resolves by default);
   - `setup` creates a `createLabelStore()`, wraps `LabelStoreContext.Provider` and returns it as `labels`;
   - **`afterEach(() => vi.clearAllMocks())`** (review M3). `clearAllMocks` clears calls, not implementations, so the failure and in-flight cases (UT-42 f, m) use `mockRejectedValueOnce` / `mockReturnValueOnce`. Place UT-42 (e1) **after** (a) in the file, or the M3 negative control can't fail. Each save step in UT-42 checks `toHaveBeenLastCalledWith` and `toHaveBeenCalledTimes` (for example, (b): after Reset, `toHaveBeenLastCalledWith(key, null)`; then save "Fan #1" → last call `(key, null)` and the count grows by one; then save "" → the same);
   - the Motherboard subline regex ends with "· generic names until you rename them";
   - UT-42 (a)–(m).
4. Run `npm test` and `npm run build`. Run the negative controls below once each and revert them.
5. **Start the render** in `npm run tauri dev` (unelevated, so reduced mode). Set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` to the value in `devtools-start.ps1` (every `BROWSER_ARGS` flag plus a 127.0.0.1 CDP port). Resize with `Set-PhSize -Client`; check `innerWidth` / `innerHeight` through CDP; screenshots with `Save-PhShot`. First check `%LOCALAPPDATA%\dev.pophood\labels.json` (Label file state).
6. **Render, both themes, at 1917×1029, 1280×860, 1024×800 and 1024×680,** on the CPU page:
   - the form (input, Save name, disabled Reset, caption);
   - a renamed row "{label} · {default}" and a **40-character label** in the heading and in a row (it wraps without clipping);
   - the save-failure line: with the app running, create a folder `labels.json.tmp` in `%LOCALAPPDATA%\dev.pophood`, save → "The name wasn't saved: could not write …"; then move the folder to `evidences\label-files\render-tmp\` and save again → it works;
   - the panel height (the `.drill__detail` wrapper) with the form, and the "worst" case (the 40-character label plus the error line), compared with `measurements.txt` (469 / 504 px at 1024×800). **If the worst wrapper is taller than 508 px** (520 px minus the 12 px margin), stop and tell the owner (techspec Known Risks: raise the padding).
   - The Motherboard card's fan row and the Motherboard page need full sensors, so they are E2E-28 (T8), not this render.
7. **Sticky and focus at 1024×800:**
   - the panel sticks while the CPU page scrolls;
   - E2E-22's Shift+Tab step: scroll to the bottom, Shift+Tab back through the first rows of each column; each focused row is fully below the panel (`document.activeElement.getBoundingClientRect()` against `.drill__detail`);
   - **M1, typing in the stuck form:** run **the M1 rule** in `tasks.md` § [Review findings](tasks.md#review-findings-disposition) exactly: CDP mouse clicks and letter keys (helpers written in the render script; `cdp.psm1` is not edited), the precondition (focus and value), the pass (`scrollY` and the panel top unchanged), and the `blur()` / `focus()` negative control that must show a change.
   - **Records (not pass/fail):** the same typing at scroll 0; and, scrolled down, focus the first row of the first column, then Shift+Tab to **Save name** and to the input (the input is the panel's first focusable, so Tab never reaches it from the panel); record `scrollY` before and after each step.
8. **End of the render:** Reset every label you saved in the UI; check `labels.json` holds `"labels": {}`; move it to `evidences\label-files\after-render\`.
9. Update this file's Status and task notes, and the T4 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes: UT-42 (a)–(m), the changed subline test, every v0.1.x `SensorList` test and every other test (vitest output).
- `npm run build` passes.
- **Negative controls** (run once, revert, output in the task notes):
  - `useLabels()` moved after the `frame === null` return → UT-39 (g) fails with a hook-order error;
  - `key={sensor.key}` removed from `RenameForm` → UT-42 (e1) fails (the draft survives the selection change);
  - the M3 clear removed (no `afterEach`) → UT-42 (e1) ("`setLabel` not called") fails, because (a), placed before it, saved.
- `src/pages/SensorList.tsx` has no `style=`, no `<a` and no `dangerouslySetInnerHTML` (`git grep`).
- `git status --short` after the task shows no new path outside the three source files above, the session folder and docs (compare with the list at the start of the task; nothing is committed before T6).
- **Render evidence** under `evidences/tauri-dev-render/`, each screenshot with its viewport size from CDP:
  - both themes at the four sizes; the form; a renamed row; the 40-character heading and row; the save-failure line;
  - the panel heights in a table next to `measurements.txt`; the worst wrapper ≤ 508 px at 1024×800;
  - at 1024×800: the panel sticks; each Shift+Tab row is fully below the panel; **M1:** the precondition holds (the input is focused and holds the 10 letters), `scrollY` and the panel top are unchanged, and the `blur()` / `focus()` control shows a scroll change; the two records are logged.
- `%LOCALAPPDATA%\dev.pophood` holds no `labels.json` at the end, and the moved files are in `evidences\label-files\`.

## Testing

- **UT-42** (techspec § Unit Tests): (a) save by submit; (b) Save button, Reset, default, empty, with last-call checks; (c) no label: Reset disabled, placeholder, `maxLength` 40; (d) frames keep the draft and the focus; (e1)–(e4) selection changes discard the draft and never save to the old key; (f) save and reset failures; (g) the load problem, with a store without one as the control; (h) exact key only; (i) markup is text; (j) stale; (k) the subline; (l) display only; (m) a save in flight across a selection change.
- The render is a preview: `tauri dev` uses `devCsp` and isn't the release. The E2E rows (E2E-21, 22, 27, 28) close in T7 and T8.

## Additional relevant files

- `specs/v0.2.0/techspec.md` § Workflows (rename, selection change), § Copy, § Form states, § Fixed layout parameters, § Measured sizes, § Known Risks
- `specs/v0.1.1/task_02.md` (the v0.1.1 render: steps and evidence format)
- `specs/v0.2.0/tasks.md` § Review findings (M1, M3, M4, L11), § Label file state

## Task notes (2026-10-23)

- `SensorList.tsx` (`RenameForm`, `SensorDetail` with `label`, `useLabels()` before the `frame === null` return, the row, the subline) and `app.css` (`.btn--accent`, `.btn:disabled`, `.row__default`, `.rename*`, padding 520 px) are in as the techspec shows them. `RenameForm` is the only new `key`; `SensorDetail` has none (L11).
- `SensorList.test.tsx`: the commands mock (all five wrappers), the label store in `setup` (it returns `labels`), a `startedLabels` helper, the changed subline regex, and a `rename` block of 17 tests covering UT-42 (a)–(m) (e1–e4 are four tests). The About version is 0.2.0 (T5).
- `npm test`: 277 pass (14 files). `npm run build` passes.
- **Negative controls (run once, reverted):**
  - `useLabels()` moved after the early return → UT-39 (g) FAILED ("Rendered more hooks than during the previous render").
  - `key` removed from `RenameForm` → 4 tests FAILED (selection leaves, reduced → full, full lost, save in flight).
  - M3 clear removed → still passes, because Vitest 5.0.5 clears call history itself (see T2 notes). This control cannot fail; the `not.toHaveBeenCalled()` check in the (e1) test does fail if a call leaks, as the setup is.
- `git grep` on `SensorList.tsx`: no `style=`, no `<a`, no `dangerouslySetInnerHTML`.
- **The `tauri dev` render ran** (steps 5–8; evidence in `sessions/20261023134341_pophood-v020-implementation/evidences/tauri-dev-render/README.md`). Both themes at four sizes, the form, a renamed row, a 40-character heading and row, the save-failure line (a real `labels.json.tmp` folder, then moved aside and the save works), the sticky panel and E2E-22's Shift+Tab step all pass. The panel heights equal `measurements.txt` (469 / 504 px at 1024×800); the worst wrapper is 504 px, at most 508 px. The Shift+Tab negative control hides 21 rows (rule off).
- **M1 failed first, then passed.** Scrolled to the bottom at 1024×800 (scrollY 738, panel top 0), after a CDP click on a row and on the input, typing 10 letters moved scrollY to 127 and the panel top to 156 (precondition held; the `blur()`/`focus()` control scrolled too, 127 → 115). Cause: the browser's caret reveal honours `scroll-padding-top: 520px` while the input sits inside the stuck panel. **Owner: "Use the fallback selector (Recommended)".** `app.css` now has `html:has(.drill__detail):not(:has(.rename :focus))` for the 520 px rule. Second run: scrollY 738 → 738 and panel top 0 → 0 (pass); the Shift+Tab rule-on run still hides 0 rows, the rule-off control hides 21; Shift+Tab into the form no longer scrolls. `npm test` (277) and `npm run build` still pass. The `blur()`/`focus()` control can't show a change after the fix (the padding is off while the form has focus); its first-run change is the evidence.
- Records (not pass/fail): typing at scroll 0 does not scroll. Shift+Tab from the first row to Save name and to the input scrolled the page up before the fix (scrollY 427 → 141 → 115); after the fix it doesn't scroll (both stay at top 352, visible in the panel).
- Label file: no `labels.json` at the start; every label reset; `labels.json` (`"labels": {}`) moved to `evidences/label-files/after-render/`; the `.tmp` folders moved to `render-tmp/`; nothing deleted. The app and `tauri dev` are stopped.
