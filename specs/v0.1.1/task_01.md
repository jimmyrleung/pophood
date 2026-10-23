# Task 1 - Drill-down model: group locks in `fields.ts`, and the AGENTS.md `groupNeeds` line

## Description

Give each drill-down group a `lock` ("Needs full sensors", "Needs PawnIO" or `null`) from the dashboard's own lock rule, so that the page (T2) can show a locked card in place of a column of "—". The dashboard and the drill-down build their lock inputs in one place (`accessOf`). This is Sequence step 1.

- Status: Done (2026-10-22)
- Complexity: S
- Estimated time: 2–3h
- Depends on: —
- Can run in parallel with: — (T3 could, but the Sequence puts it after T2)

## AI guidance

- `implement-task`: this task's flow.
- `AGENTS.md` "Reading before editing" (global rules): read `src/cards/fields.ts` and `src/cards/fields.test.ts` end to end before you edit them.
- `AGENTS.md` trust invariants, RF3 line: the helper writes `null`, and the UI owns the copy and never rewrites a value. The lock needs **every** value `null`, so a live value is never hidden.
- Anti-overengineering (global rules) and the techspec's [Anti-overengineering breakdown](techspec.md#anti-overengineering-breakdown): `lockFor` stays private; no separate drill-down lock helper; no new test file.
- `helper/Availability.cs` is read only, to confirm the `groupNeeds` table. Never edit it.

## Requirements

- `drillSections(frame, scope, status)` returns a `lock` on every group. It is set only when every value in the group is `null` **and** `lockFor(accessOf(frame, status), groupNeeds(hardware.type, type))` returns a label.
- The lock reads the frame's values, not the stale-nulled ones (techspec, after the `drillSections` snippet).
- `buildDashboard` builds its lock inputs with `accessOf`. The dashboard's labels don't change: UT-31 stays unchanged and green.
- `lockFor` stays private; only its parameter type narrows (`Ctx` → `Access`). Its body doesn't change.
- `npm run build` stays green. `tsc -b` checks all of `src`, so the one caller, `SensorList.tsx`, passes the status in this task. The hook goes with the other hooks, before the `frame === null` return (techspec, the hook order).
- The `AGENTS.md` LHM-bump line gets the `groupNeeds` item in the same change as the code, so `AGENTS.md` never names code that doesn't exist.

## Files involved

| Path | Action |
|---|---|
| `src/cards/fields.ts` | Modify |
| `src/cards/fields.test.ts` | Modify |
| `src/pages/SensorList.tsx` | Modify: the call site only (`useSensorStatus()` and the `status` argument). T2 does the rest |
| `AGENTS.md` | Modify: one item in "After any LHM or dependency bump" |
| `helper/Availability.cs` | Read only |
| `src/sensors/store.ts` (`useSensorStatus`), `src/sensors/protocol.ts` (`SensorStatus`, `UiHardware`) | Read |
| `src/test/builders.ts`, `src/test/fixtures/frame-full.json`, `frame-reduced.json`, `frame-elevated-no-pawnio.json` | Read |

## Implementation steps

1. Add `Access` and `accessOf` after `pawnIoUsable`, narrow `lockFor` to `Access`, and build `buildDashboard`'s `ctx` with `...accessOf(frame, status)`. See techspec § [Implementation map](techspec.md#implementation-map), "`src/cards/fields.ts`, the lock inputs".
2. Add `lock` to `SensorGroup`, add `groupNeeds`, and pass `hardware` and `access` through `groupByType` and `drillSections`. See techspec "`src/cards/fields.ts`, the drill-down" and § [Group needs](techspec.md#group-needs-groupneeds-the-copy-of-rf3).
   - In the one-section branch, call `groupByType` once per entry (`flatMap`), as the techspec's "After" snippet does, so each group knows its hardware type. With 0 or 1 entries this gives the same groups as today.
3. In `src/pages/SensorList.tsx`, add `const status = useSensorStatus();` right after the `useState` line, import it from `../sensors/store`, and call `drillSections(frame, scope, status)`. Nothing else on the page changes in this task.
4. UT-34 (`describe("card scopes and drill-down groups (UT-34)")`): every `drillSections` call passes `fullStatus()`. Add one case: in the full fixture every group has `lock: null`, including the all-`null` Motherboard "Controls · 6". See techspec § [Unit Tests](techspec.md#unit-tests).
5. UT-38: add `describe("drill-down group locks (UT-38)")` with cases (a)–(d) from the techspec row. Use the file's `custom`, `hw`, `fullStatus`, `reducedStatus`, `noPawnioStatus` and `sensor` from `src/test/builders.ts`.
6. `AGENTS.md`: add the item to "After any LHM or dependency bump" with the techspec's text (§ Implementation map, the `AGENTS.md` row).
7. Run `npm test` and `npm run build`. Then run the negative control (below) once and revert it.
8. Update this file's Status and task notes, and the T1 row in `tasks.md`.

## Acceptance Criteria

- `npm test` passes: UT-31 unchanged, UT-34 updated, UT-38 (a)–(d) new, and every other test (vitest output).
- `npm run build` passes (`tsc -b` and vite output).
- `git diff src/cards/fields.test.ts` shows no change inside the `lock labels (UT-31)` block.
- **Negative control:** with the "every value `null`" condition removed from `groupByType`, UT-38 (d) fails. Run once, then revert (test output in the task notes).
- The task notes record `groupNeeds` checked against `helper/Availability.cs → IsTrustworthy`, with the line numbers read: `Cpu` keeps only Load; `Motherboard`, `SuperIO` and `EmbeddedController` keep nothing; `GpuIntel` loses Power.
- `git diff --stat` lists only `src/cards/fields.ts`, `src/cards/fields.test.ts`, `src/pages/SensorList.tsx` and `AGENTS.md`, plus this task's docs.
- `AGENTS.md` has the `groupNeeds` item under "After any LHM or dependency bump" (`git diff AGENTS.md`).

## Testing

- **UT-31** (unchanged): the dashboard's lock labels, after the `Access` / `accessOf` refactor.
- **UT-34** (updated): every v0.1.0 expectation with `drillSections(…, fullStatus())`, plus "no lock in full mode".
- **UT-38** (new): (a) reduced CPU groups "Needs full sensors", Load `null`; (b) elevated without PawnIO, "Needs PawnIO"; (c) `GpuIntel` Power locked, an all-`null` Clock group not locked; (d) one live value → no lock. The `loaded: false` label is UT-31's row, through the same `lockFor`.
- The page's tests (UT-39) are in T2. The v0.1.0 `SensorList.test.tsx` tests must still pass after step 3.

## Additional relevant files

- `specs/v0.1.1/techspec.md` § Interfaces, § Implementation map, § Data models (the `SensorGroup` table, Group needs, the lock-label table)
- `specs/v0.1.0/techspec.md` "Lock labels" and "Availability classification (RF3)"
- `src/shell/StatusBanner.tsx` (not changed here; T2 renders it)

## Task notes (2026-10-22)

- Done: `accessOf`, `groupNeeds`, `SensorGroup.lock` and `drillSections(…, status)` in `src/cards/fields.ts`; UT-34 updated (every call passes `fullStatus()`, plus "locks no group in the full fixture"); UT-38 (a)–(d); the `AGENTS.md` LHM-bump item. The UT-31 block is unchanged.
- `groupNeeds` checked against `helper/Availability.cs → IsTrustworthy` (lines 24–38): `Cpu` keeps only Load; `Motherboard`, `SuperIO`, `EmbeddedController` keep nothing; `GpuIntel` loses Power.
- Negative control: with the "every value null" condition removed from `groupByType`, UT-38 (d) fails (1 failed, 93 passed). Reverted.
- The reduced fixture has no Factors group, so UT-38 (a) lists four locked CPU groups.
