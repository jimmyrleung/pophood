# Task 12 - Code review of the v0.1.0 changes

## Description

Review every v0.1.0 change at once, before verification starts, so the fixes land before the release build that T13 and T14 sign off. This task covers the review and its fixes only; QA runs afterwards, in a separate session (T13).

- Status: Completed (the owner elevated smoke ran on the final T13 helper and passed; see task_04.md)
- Complexity: M
- Estimated time: 3–5h
- Depends on: T6, T10, T11 (and transitively every code task)
- Can run in parallel with: —

## AI guidance

- `review-implementation`: runs this task, over the whole v0.1.0 diff. Its own contract puts complete QA in a separate session after the review, which is why T13 is a separate task.
- `AGENTS.md` (from T11) applies to every fix.
- Review against the trust boundary first: `helper/` (bans, first statement, no files or console, client check, parser), `src-tauri/src/sensors/` (lock until launch, PID check, integrity notices always block), `src-tauri/src/webview.rs` (`BROWSER_ARGS` only here, navigation pin), then the UI (no external `<a href>`, no fake 0).

## Requirements

- Every finding is fixed in its owning task's files or dispositioned by the owner (accepted, deferred to a named version), and recorded with the file and line.
- The regression rule in `tasks.md` applies to every fix under `helper/` or `src-tauri/src/sensors/`.
- No behaviour, constant or copy changes beyond what the techspec specifies; a finding that needs one goes to the owner as a design question.

## Files involved

| Path | Action |
|---|---|
| Any file created in T1–T11 | Modify only to fix a review finding |
| `sessions/<this session>/review.md` | Create (the review report) |

## Implementation steps

1. Run `review-implementation` over the v0.1.0 changes.
2. Fix each finding in its owning file, or take it to the owner.
3. For any fix under `helper/` or `src-tauri/src/sensors/`, apply the regression rule: `npm run build:helper`, `dotnet test helper.Tests`, `cargo test` (with the ITs), the E2E-19 negatives, and T4's elevated smoke (owner).
4. Run every suite once more after the last fix.

## Acceptance Criteria

- The review report lists every finding with its severity, file:line and outcome (fixed, or the owner's disposition quoted verbatim) (the report file).
- `npm test`, `npm run build`, `cargo test`, `cargo test -- --ignored` and `dotnet test helper.Tests` all pass after the last fix (command output).
- If any helper file changed: the E2E-19 negatives still fail with RS0030, and the owner's elevated smoke output from T4 was re-recorded after the change (command output).

## Testing

- No new tests of its own. Reason: this task reviews code whose tests already exist; it re-runs every suite after its fixes (above). Verification on the release build is in **Task 13** and **Task 14**.

## Additional relevant files

- `specs/v0.1.0/techspec.md` (the whole design; § Key decisions and § Compliance with AGENTS.md and Rules first)
- `specs/v0.1.0/tasks.md` (regression rule)
- `AGENTS.md`

## Task notes (review, 2026-10-21)

- **Status:** Completed. Report: `sessions/20261021163415_pophood-v010-review/review.md`. It lists every finding with its severity, file:line, how it was verified, and the outcome or the owner's disposition, quoted verbatim.
- **Applied:**
  - **Highs:**
    - **R1:** `/DEPENDENTLOADFLAG:0x800`. The helper's non-KnownDLL static imports loaded from its folder first; this was executed with a planted `bcrypt.dll`.
    - **B1:** RAMSPDToolkit's `DriverManager`, `IPawnIODriver`, `IPawnIOModule` and `IGenericDriver` are banned.
  - **Mediums:**
    - **A1:** exit 3 and access-denied are now `pipe_squatter`.
    - **D1:** a status event no longer clears the stale flag.
    - **C1, C2:** the audit script fails on an empty or unreadable ETL, refuses another instance, and finds the browser by parent PID.
  - **Lows:** D2 (lines break over 3 s gaps), D3, A3, B4, B6, B2, D6, C3, O1, O2, O7.
  - Deferred as recommended: D8, A2, D5, B5, O3–O6. The rest proceed as-is.
- **Regression rule (helper and `src-tauri/src/sensors/` changed):**
  - `npm run build:helper` exit 0. The new helper SHA-256 is `f1b85cd7eb2e7f545b77742fb74e305b593f768c9010d193a145227eb1a9631c`, and AOT warnings stay at 14 unique lines.
  - Every suite passes after the last fix:
    - `dotnet test`: 66.
    - `cargo test`: 74 + UT-13 + 18 ITs.
    - `cargo test -- --ignored`: IT-10.
    - `npm test`: 236. `npm run build` succeeds.
  - E2E-19: all 12 classes fail with RS0030. `BannedSymbols.txt` matches the techspec block (72 lines).
  - `dumpbin /imports` + `/loadconfig`: `0800 Dependent Load Flag`, and the plant repro passes.
  - `audit-network.ps1 -Quick` passes.
- **Open (owner):** the elevated AOT smoke (`sessions\20261021133000_pophood-v010-implementation\helper-smoke.ps1`, from an elevated pwsh) must run on the helper above. It was pending from T4; any earlier evidence would no longer count. The other owner steps from T2, T6, T10 and T11 are unchanged.
- **Spec changes recorded in the techspec:**
  - The ban list, with its reasons and two new E2E-19 lines.
  - The csproj row: `RestoreLockedMode`, `LinkerArg`.
  - The `pipe_squatter` row, the state-machine row, IT-09 and IT-17.
  - The `path.ts` gap rule and UT-22; the store's stale rule and UT-21.
  - The fan footer rule, E2E-24's static-import rule, and the Cargo crate type.
- **Confidence:** 84% before the fixes, 90% after (the breakdown is in the report).
