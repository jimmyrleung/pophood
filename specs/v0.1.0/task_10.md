# Task 10 - Drill-down, About and third-party notices

## Description

Add the per-component sensor list (card scopes, SensorType grouping, Memory grouped by hardware, live values, a detail panel with a 10-minute chart and Min/Max) and the About page (versions, the compiled-in helper SHA-256, and `THIRD-PARTY-NOTICES.md` shown as text), and write the notices file itself (RF30).

- Status: Completed (2026-10-21); live drill-down click-through pending (T13 E2E-12)
- Complexity: M
- Estimated time: 3–5h
- Depends on: T9 (LineChart, card navigation)
- Can run in parallel with: T5, T6, T11

## AI guidance

- `implement-task`: runs this task.
- No rename form: renaming is v0.2.0. The subline omits "· generic names until you rename them".
- About shows URLs as text, never `<a href>` (navigation is pinned).

## Requirements

- `componentScope(frame, cardId)` per techspec § Drill-down groups and card scopes; groups by SensorType in the stated order, plural labels with counts, rows in LHM `index` order; scopes with more than one hardware item that has sensors grouped by hardware first.
- SensorList layout per the techspec `SensorList.tsx` row (breadcrumb, title, subline with hardware names and count, `aria` sections, first row selected, `aria-pressed` rows, muted rows for 0 RPM / `null`, detail with identifier in mono, value, chart, Min (10 min) / Max (10 min) / Unit `<dl>`).
- List/detail flex bases 250/400 (side by side down to 1024 px).
- About: app version 0.1.0, "LHM 0.9.6 @ 3d331e3", `status.helperSha256`, and `THIRD-PARTY-NOTICES.md` imported `?raw` into a `<pre>`.
- `THIRD-PARTY-NOTICES.md`: one section per component listed in the techspec `THIRD-PARTY-NOTICES.md` row, with version, licence, copyright and source location; LHM's source location per MPL §3.2.

## Files involved

| Path | Action |
|---|---|
| `src/cards/fields.ts` | Modify (created in T8; adds `componentScope` and drill-down grouping) |
| `src/pages/SensorList.tsx`, `src/pages/About.tsx` | Create |
| `src/App.tsx` | Modify (created in T2, shell and page state from T7; routes the `sensors` and `about` pages) |
| `THIRD-PARTY-NOTICES.md` | Create |
| `src/cards/fields.test.ts` | Modify (created in T8; adds UT-34) |
| `helper/packages.lock.json`, `src-tauri/Cargo.lock`, `package-lock.json` | Read (exact versions for the notices) |

## Implementation steps

1. Add `componentScope` and the grouping function to `fields.ts` per techspec § Drill-down groups and card scopes.
2. `SensorList.tsx` per its techspec row and mockup E2 (`sensors-motherboard.dc.html`, drill-down chart ≈:84-85), using `LineChart` (drill-down variant) and `format.ts` drill-down formats; Min/Max over the 10-min series from `useSeries`.
3. `About.tsx` per its techspec row.
4. `THIRD-PARTY-NOTICES.md` per its techspec row; take every version from the lock files, not from memory; copyright lines from each package's licence file (LHM's from the submodule).
5. UT-34.

## Acceptance Criteria

- `npm test` passes UT-34 and all earlier UI tests; `npm run build` succeeds.
- `npm run tauri dev` with T6 merged (if it isn't yet, these live checks wait for E2E-12 in T13; the elevated helper isn't needed): clicking the CPU card and its "All sensors" link both open "AMD Ryzen 9 9900X sensors" (or the CPU title from the live frame) with live values, the first row selected, and Min/Max that change over time; the breadcrumb returns to the Dashboard (screenshot or owner confirmation).
- The Memory drill-down shows `/ram` and `/vram` under separate hardware headings (screenshot).
- About shows a SHA-256 equal to `Get-FileHash src-tauri/binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` (command output vs screen).
- Every version in `THIRD-PARTY-NOTICES.md` matches the corresponding lock file entry (spot-check LHM submodule commit, HidSharp, tauri, react — lock file lines quoted in the PR/summary).
- `rg "href=" src/pages/About.tsx` returns nothing.

## Testing

- **UT-34** `componentScope` for each card; group order and plural labels; `index` order; Memory grouped by hardware first; Motherboard "Controls · 6" group.
- E2E-12 (drill-down live, both entry points, Memory grouping) and E2E-23 (About and notices on the release build) are in **Task 13**. E2E-21's drill-down-at-1024 check is in **Task 13**.

## Additional relevant files

- `specs/v0.1.0/ui-proposal/mockups/sensors-motherboard.dc.html`
- `specs/v0.1.0/techspec.md` § Drill-down groups and card scopes, § Number formats, § Implementation map (`SensorList.tsx`, `About.tsx`, `THIRD-PARTY-NOTICES.md` rows)
- `specs/v0.1.0/requirements.md` § Dependencies (the RF30 checklist)

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 90%. Remaining uncertainty: the drill-down and About page were not opened in the live window (I can't click it from this session; nothing was automated against the owner's desktop), so the layout at 1024 px and the "Min/Max change over time" claim rest on `SensorList.test.tsx` (Min/Max recomputed after a new frame) and the build.
- **Evidence:**
  - `npm test`: 12 files, 233 tests pass (UT-34 ×8 in `fields.test.ts`, 12 `SensorList` tests, 1 `About` test, plus everything earlier). `npm run build` passes (`THIRD-PARTY-NOTICES.md?raw` and `package.json` import fine).
  - About shows `status.helperSha256`, which is the `POPHOOD_HELPER_SHA256` that `src-tauri/tests/helper_hash.rs` (UT-13) asserts equals `Get-FileHash` of `src-tauri/binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` (so About = the file's hash after any rebuild; not re-read from the screen).
  - Version spot-check of `THIRD-PARTY-NOTICES.md` against the lock files: `src-tauri/Cargo.lock` tauri 2.12.4, wry 0.57.0, tao 0.37.1, webview2-com 0.39.1, windows 0.62.2, tokio 1.54.0, serde 1.0.229, serde_json 1.0.154, sha2 0.10.9, getrandom 0.3.4, tauri-plugin-single-instance 2.5.4; `package-lock.json` react / react-dom 19.3.1, @tauri-apps/api 2.12.4, @fontsource/ibm-plex-sans and -mono 5.3.0; `helper/packages.lock.json` HidSharp 2.6.4, DiskInfoToolkit 1.1.2, RAMSPDToolkit-NDD 1.4.2, BlackSharp.Core 1.0.7, Mono.Posix.NETStandard 1.0.0, System.Management 10.0.2, System.IO.Ports 10.0.3, System.CodeDom 10.0.2, System.IO.FileSystem.AccessControl 5.0.0, Microsoft.DotNet.ILCompiler 10.0.13; LHM = submodule commit `3d331e3370efb858411f19511373eff65a218701`.
  - `grep href src/pages/About.tsx` → nothing; no `<a href` in `src/` pointing anywhere.
- **Decisions / gaps:**
  - Page title and breadcrumb name: the cleaned hardware name for CPU, GPU and Disk ("AMD Ryzen 9 9900X sensors", as the AC says), and "Memory" / "Motherboard" for the other two (an "2 × 16 GB DDR5 sensors" title would read oddly). The subline lists every hardware name in the scope (so the Motherboard line is "Gigabyte B850 EAGLE WIFI6E · ITE IT8696E · N sensors", as in the mockup) and a singular "1 sensor".
  - Group labels: Fans, Temperatures, Voltages, Clocks, Loads, **Power**, Currents, **Data**, **Small data**, **Throughput**, Levels, Factors, Timings, Controls; unknown types get an "s". (Mass nouns stay singular.)
  - A "Controls" row and a "Fans" row can share a name ("Fan #5"); rows are keyed by `id|name` and the groups tell them apart.
  - A selected sensor that leaves the frame falls back to the first row. When the data is stale the list and the detail show "—".
  - `THIRD-PARTY-NOTICES.md` lists name, version, licence, copyright and source per bundled component; full licence texts stay in the source trees (LHM's `LICENSE` and `THIRD-PARTY-NOTICES.txt` in the submodule carry MPL-2.0 and the PawnIO LGPL text), with the generated, full-text list left for the public release as the techspec says. The HidSharp source URL is the nuspec's project URL (`software.seekye.com/hidsharp`), not a GitHub repo, because the package names no repository. DiskInfoToolkit, RAMSPDToolkit-NDD and BlackSharp.Core are credited to "Florian K. (Blacktempel)" from their nuspec copyright fields.
