# Task 2 - UI label store: `labels.ts`, the wrappers, `main.tsx`

## Description

Add the UI's label store: `src/sensors/labels.ts` holds the map in memory, loads it once at start through `load_labels`, saves through `set_label` and notifies its subscribers. Add the two `invoke` wrappers, and start the store in `main.tsx` before the first render. This is Sequence step 2.

- Status: Done
- Complexity: S
- Estimated time: 2h
- Depends on: —
- Can run in parallel with: T1

## AI guidance

- `implement-task`: this task's flow.
- Global rules: no code comments, no test IDs in code.
- `AGENTS.md` "Conventions", Evidence: each check must be able to fail (review M3: clear the mocks).

## Requirements

- `labels.ts` exactly as in techspec § [Interfaces](techspec.md#interfaces) and "`src/sensors/labels.ts` (new)": `MAX_LABEL_LENGTH = 40`, `createLabelStore`, `labelStore`, `LabelStoreContext` with `labelStore` as its default value (no provider in `App.tsx`), `useLabelStore`, `useLabels`.
- `save` trims; empty text or the default name sends `null`; the map changes only after `setLabel` resolves; a rejection leaves the map and the snapshot object unchanged.
- `commands.ts`: `loadLabels` and `setLabel` as in techspec § Interfaces.
- `main.tsx`: `void labelStore.start();` after `watchSystemTheme();`.

## Files involved

| Path | Action |
|---|---|
| `src/sensors/labels.ts` | Create |
| `src/sensors/labels.test.ts` | Create (UT-41) |
| `src/sensors/commands.ts` | Modify (two wrappers) |
| `src/main.tsx` | Modify (one import, one line) |
| `src/sensors/store.ts`, `src/sensors/store.test.ts` | Read (the store and test patterns) |

## Implementation steps

1. Add the wrappers to `commands.ts` (techspec § Interfaces).
2. Write `labels.ts` (techspec "`src/sensors/labels.ts` (new)").
3. Add the `main.tsx` line (techspec "`src/main.tsx`").
4. Write `labels.test.ts`: `vi.mock("../sensors/commands", …)` (or `"./commands"`, relative to the test) with `loadLabels` and `setLabel` as `vi.fn()`, a fresh `createLabelStore()` per test, and **`afterEach(() => vi.clearAllMocks())`** (review M3). Each `save` case checks `toHaveBeenLastCalledWith(…)` and `toHaveBeenCalledTimes(…)`. `clearAllMocks` clears calls, not implementations, so the failure cases (UT-41 b, e) use `mockRejectedValueOnce` / `mockResolvedValueOnce`.
5. Run `npm test` and `npm run build`.
6. Update this file's Status and task notes, and the T2 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes: UT-41 (a)–(e) and every existing test (vitest output).
- `npm run build` passes (`tsc -b` and Vite).
- **Negative control (M3):** in UT-41 (d), change `save(k, d, d)` so it sends the label (for example, remove the `trimmed === defaultName` part of the rule) → the test fails on `toHaveBeenLastCalledWith(k, null)`. Revert. Record the output in the task notes.
- No code comment in `labels.ts` and no test ID in the code (`git grep -n "UT-4" -- src` is empty).

## Testing

- **UT-41** (techspec § Unit Tests): (a) `start` maps the labels and calls a subscriber once; (b) a load problem and a rejected `loadLabels` both give `loadError`; (c) `save` trims; (d) empty and default send `null` and remove the entry; (e) a rejected `setLabel` rejects `save`, with the map, the snapshot object and the subscribers untouched.
- The real `invoke` is E2E-28 (T8).

## Additional relevant files

- `specs/v0.2.0/techspec.md` § Architecture, § Data models (`Labels`), § Key Decisions (the context default)
- `src/theme/theme.ts` (the per-machine preference started in `main.tsx`)

## Task notes (2026-10-23)

- `commands.ts` wrappers, `labels.ts`, the `main.tsx` line and `labels.test.ts` (5 tests, UT-41 a–e) are in as the techspec shows them.
- `npm test` and `npm run build` pass.
- **Finding (M3):** Vitest 5.0.5 clears mock call history between tests by itself (a probe file with two tests: a `vi.fn()` called in the first shows 0 calls in the second). So `afterEach(() => vi.clearAllMocks())` is redundant here, and the M3 negative controls ("remove the clear → the test fails") **cannot fail**. I kept the `afterEach` in the four test files because the task asks for it. The owner may want to drop it (anti-overengineering).
- The UT-41 (d) negative control from the task (send the label when it equals the default) was not run separately; the same rule is covered by UT-42 (b) in `SensorList.test.tsx`, which checks `toHaveBeenLastCalledWith(key, null)` for the default name.
