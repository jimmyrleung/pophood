# Task 08 - Card model: formats, field rules, fixtures

## Description

Build the pure logic that turns a `UiFrame` and `SensorStatus` into the dashboard model: number formats, the LHM → card field rules, card titles and kind labels, `gpuOrder`, the needs/lock-label model, placeholders and empty states, the "starting" model, the header summary, sparkline sources, history-chart series and legend, and the OC-profile inference. Lock every rule with the three P1-derived fixtures.

- Status: Completed (2026-10-21)
- Complexity: **L** — kept whole because `fields.ts` is one rule table behind one `buildDashboard` function, locked by shared fixtures; splitting it by card would put two tasks on the same function and fixtures.
- Estimated time: 6–8h
- Depends on: T7 (`protocol.ts` types)
- Can run in parallel with: T3, T4, T5, T6, T11

## AI guidance

- `implement-task`: runs this task.
- Session skill draft `sensor-id-stability-check.md`: rules match exact names and hardware types, never identifier indices.
- ADR `0008-sensor-label-key-basis.md`.
- The UI owns copy only; it never rewrites values (techspec § Anti-overengineering, "Helper-side RF3 classification plus UI needs labels").

## Requirements

- Every row of techspec § Card field rules (first match wins, exact names), § Card titles and kind labels, § Cards and their order (`gpuOrder`), § Header summary, § History chart series, § Sparklines, § Number formats.
- Lock labels per techspec § Availability classification → Lock labels: a `null` value never renders a digit.
- `jedecSpeed(tckNs)` = nearest bin in the listed JEDEC set to `2000 / tCK` (not rounding to 100).
- Fixtures keep LHM's hardware order (AMD iGPU before the RTX) and have the RF3 classification already applied.
- Reduced mode: Disk and Motherboard placeholders; full mode: empty-state cards per § Empty states.

## Files involved

| Path | Action |
|---|---|
| `src/cards/format.ts` | Create |
| `src/cards/fields.ts` | Create (T10 adds `componentScope` and drill-down grouping) |
| `src/test/fixtures/frame-full.json`, `frame-reduced.json`, `frame-elevated-no-pawnio.json` | Create |
| `src/cards/format.test.ts`, `src/cards/fields.test.ts` | Create |
| `C:\Users\jimmy\pophood-probes\probe-ids\ids-elev-1.json`, `ids-unpriv-1.json` | Read (P1 dumps, fixture source) |

## Implementation steps

1. `format.ts` per techspec § Number formats (`Intl.NumberFormat("en-US")`; MT/s without grouping; space between value and unit; `null` → "—").
2. Build the fixtures per the techspec `src/test/fixtures/…` row: hand-trim the P1 elevated and unprivileged dumps to ~40 sensors each, keeping every sensor a rule or test names (CPU temps/CCDs/clocks/power, both GPUs incl. `GPU Memory Total`, `/ram`, `/vram`, DIMM `tCKAVGmin`, SuperIO fans incl. 0 RPM ones and 6 `Control`, NVMe `Read Rate`/`Write Rate`/`Composite Temperature`/`Life`), with `memory[]` 2 × 16 GB DDR5 6000 (not in the P1 dumps; taken from WMI on this PC, see AC). The no-PawnIO frame = reduced + `/nvme/0`, `elevated: true`. Apply the RF3 table (nulls) by hand.
3. `fields.ts`: `buildDashboard`, `gpuOrder`, `jedecSpeed`, and the needs model, row by row from the techspec tables. Export a `DashboardModel` / `CardModel` shape that T9 renders (hero, fields with `needs`, sparkline series spec + domain, placeholder/empty flags, OC chip and caption, header summary, history series per metric).
4. Tests (see Testing). Add synthetic fixtures inline in the tests where the techspec calls for them (2 drives, unequal DIMMs, top fan 2140 RPM, Intel names).

## Acceptance Criteria

- `npm test` passes UT-14…UT-20, UT-23, UT-30, UT-31, UT-32, UT-35 and UT-37 (test output).
- `buildDashboard(frame-full)` gives the header summary "AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E · 2 × 16 GB DDR5-6000 · NVIDIA GeForce RTX 5060 Ti · AMD Radeon Graphics · KINGSTON SNV3S1000G" — the hardware names checked against the P1 elevated dump (`ids-elev-1.json`), and the memory part ("2 × 16 GB DDR5-6000") against `Get-CimInstance Win32_PhysicalMemory` (`Capacity`, `SMBIOSMemoryType` 34 = DDR5, `ConfiguredClockSpeed`), because the P1 dumps carry no memory facts (command output).
- Every sensor name a rule matches exists verbatim in a P1 dump (a test or script greps each rule name against `ids-elev-1.json`/`ids-unpriv-1.json`, except the Intel-only names, which are marked UNVERIFIED in a comment as in the techspec).
- `npm run build` passes (types check).

## Testing

- **UT-14** CPU rules (full fixture). **UT-15** reduced fixture. **UT-16** elevated-without-PawnIO fixture. **UT-17** empty states. **UT-18** OC profile and `jedecSpeed` bins (DDR5 and DDR4). **UT-19** GPU rules. **UT-20** Motherboard rules and bar scale.
- **UT-23** every row of the number-formats table.
- **UT-30** Disk and Memory rules (2-drive synthetic; unequal sizes).
- **UT-31** lock-label matrix (needs × elevated × `pawnIo.installed`/`loaded`), and no Voltage sensor on any card.
- **UT-32** history-chart series: `gpuOrder` puts the RTX in series 2; locked series have no data and a lock label in the legend; "Drive" row; fixed domains. (The SVG path itself is UT-22 in **Task 09**.)
- **UT-35** remaining fallbacks (CPU `Core (Tdie)`, `CPU Package`, CCD1 only, Intel `Core Max` suffixes, `Cores (Average)` never used, GPU chains, MB title, fan footer n = 0/1/4).
- **UT-37** titles, kind labels, `gpuOrder` ties, sparkline sources and domains, header summary (full and reduced).
- Rendering ("a locked field never renders a digit" in the DOM) is UT-24 in **Task 09**.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Card field rules, § Card titles and kind labels, § History chart series, § Sparklines, § Number formats, § Availability classification (Lock labels), § Empty states, § Reduced placeholders, § Mockup corrections, § Patterns reused (AMD/Intel sensor sets, `tCKAVGmin`)
- `specs/v0.1.0/probe-results.md` (P1)
- `specs/v0.1.0/ui-proposal/mockups/dashboard.dc.html`

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 93%. Remaining uncertainty: the Intel and other-CPU name rules are unverified on hardware (as the techspec says); T9's rendering consumes this model for the first time; `stale` handling for the Motherboard card is mine (see below).
- **Evidence:**
  - `npm test`: 8 files, 176 tests pass (UT-14…UT-20, UT-23, UT-30, UT-31, UT-32, UT-35, UT-37 plus T7's). `npm run build` passes.
  - Header summary for `frame-full` is exactly "AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E · 2 × 16 GB DDR5-6000 · NVIDIA GeForce RTX 5060 Ti · AMD Radeon Graphics · KINGSTON SNV3S1000G" (a test); hardware names come from `ids-elev-1.json`; memory facts from `Win32_PhysicalMemory`: 2 × `Capacity` 17179869184 (16 GiB), `ConfiguredClockSpeed` 6000, DDR5 (`SMBIOSMemoryType` 34 = DDR5, confirmed with `Get-CimInstance Win32_PhysicalMemory` in this session; IT-11 in T5 asserts size and speed against WMI).
  - P1 name check (a one-off node script, not committed): all 23 rule names that apply to this PC (CPU, GPU, Memory, Storage, SuperIO) exist verbatim with the right hardware and sensor type in `ids-elev-1.json` / `ids-unpriv-1.json`; 0 missing. Not in the dumps by design (UNVERIFIED, marked in `fields.ts`): `Core (Tdie)`, `CPU Package`, `Core Max`, `CPU Core #n`, `P-Core #n`, `E-Core #n`.
- **Fixtures** (`src/test/fixtures/frame-full.json`, `frame-reduced.json`, `frame-elevated-no-pawnio.json`): generated by a throwaway script from the P1 dumps (not committed; the JSON files are the artefact). 70, 35 and 41 sensors; LHM order kept (AMD iGPU before the RTX, SuperIO right after the Motherboard); the reduced and no-PawnIO frames have every non-load CPU sensor set to `null` (RF3). `memory[]` is 2 × 16 GB DDR5 6000 (WMI; both modules report locator "DIMM 1"). The reduced frame comes from the *unprivileged* dump, so its memory used/total (22.6 / 31.1 GB) differs from the full frame's.
- **Decisions / gaps:**
  - `buildDashboard(frame, status, { stale })`: a third, optional argument. When stale every value becomes "—" (a lock label stays where the field needs more than the helper has); the OC chip is hidden; the Motherboard card keeps its fan rows with "—" and no footer (otherwise every fan would read as "0 RPM").
  - Card ids: `cpu:<hwId>`, `memory`, `gpu:<hwId>`, `disk:<hwId>`, `motherboard`; placeholders and empty cards use `disk-placeholder`, `motherboard-placeholder`, `gpu-empty`, `disk-empty`, `motherboard-empty` (not clickable). T10's `componentScope` parses the normal ids.
  - Motherboard placeholder, elevated with PawnIO installed but its driver not running (`loaded === false`): "Needs PawnIO" with the sentence "The fan chip is read through PawnIO, whose driver isn't running." (the techspec's sentence says "which isn't installed", which would be wrong there).
  - GPU empty card appears in reduced mode too (GPUs need no elevation); the Disk and Motherboard placeholders appear whenever the frame is not elevated.
  - CPU hero rule: the hero is the package temperature unless that cell is *locked*; a temperature that is merely missing in full mode shows "—" instead of switching to load.
  - Sparkline domains: Memory is `[0, used + available]` (so `[0, 0]` when either is missing: T9 must guard a zero-height domain); Disk `[0, 10e6]` with `growToFit` (T9 raises the upper bound to the highest value in the window).
  - `gigabytesOf`, `vram` and the other card formats live in `format.ts`; `cleanName` and `jedecSpeed` are exported from `fields.ts`.
