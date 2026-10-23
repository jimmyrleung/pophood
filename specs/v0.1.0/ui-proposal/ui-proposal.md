# UI proposal: Pophood v0.1.0

- **Date:** 2026-10-21
- **Status:** chosen by the owner (Claude Design round 3, answer #34 in [requirements.md](../requirements.md#qa-record-this-session)).
- **Inputs:** [requirements.md](../requirements.md) (User experience, slice requirements), [probe-results.md](../probe-results.md) (the measured numbers shown in the mockups).
- **Canvas:** https://claude.ai/artifact/7Ryz61YTgHU398gpBeXdRN (private to the owner). Row E holds the chosen set. Rows A–D hold the rejected options.
- **Mockup sources:** [mockups/](mockups/). These are the canvas files for row E, copied here so this folder stands on its own.
- **Altitude:** this is a visual and interaction reference for the techspec. It is not a component design. Where it names a mechanism (inline SVG, CSS variables), that is how the mockup was drawn, not a choice for the app.

## The chosen set

| Screen | Mockup | Canvas artboard | Origin |
|---|---|---|---|
| Dashboard | [dashboard.dc.html](mockups/dashboard.dc.html) | E1 · Final · Dashboard | D1 (A's card grid in C's colours), plus C's "Last 10 minutes" chart below the six cards |
| Drill-down (motherboard example) | [sensors-motherboard.dc.html](mockups/sensors-motherboard.dc.html) | E2 · Final · Motherboard sensors | C's list-and-detail layout |
| Runs | [runs.dc.html](mockups/runs.dc.html) | E3 · Final · Runs | D4 (B's table in C's colours) |

All three share one shell: D1's sidebar, IBM Plex type and C's ("Timeline") colours. The owner picked the content of each screen; putting E2 and E3 in E1's shell was done so the set reads as one app.

**Rejected options, for context:**
- **A · Graphite:** dark, amber accent, card grid.
- **B · Datasheet:** light, spec-sheet rows.
- **C · Timeline:** dark navy and teal, history chart first. The owner preferred C's colours over A's and B's.
- **D:** C's colours applied to A's and B's layouts, and C with the tiles on top.

## Reading the mockup files

- Each `.dc.html` file is a Claude Design artboard. It needs the Design runtime (`support.js`), so it does not render if opened directly. Open the canvas link to see it, or read the file as source.
- The useful parts of the source are:
  - the colour tokens in the `<style>` block (`.th.dark`, `.th.light`);
  - the markup and copy;
  - the states, driven by `data-props` (`theme`, `sensors`, `runAll`) and by `state` in the `Component` class.
- Links between the three files work in the canvas's Play mode.

**Data shown in the mockups:**

| Data | Source |
|---|---|
| Hardware names, sensor list shape (IT8696E: 5 fans, 5 temperatures, 9 voltages), LHM identifiers like `/lpc/it8696e/0/fan/0` | The owner's PC (spike and P1) |
| "EXPO 6000" run scores: 7-Zip 170,780 / 10,509 MIPS; memory 76 / 70 / 36 GB/s and 95 ns; GPU 25.26 TFLOPS and 434 GB/s; disk MB/s | Measured (F9, P3, P4) |
| "JEDEC 4800 (before EXPO)" run scores | **Illustrative only**, invented so the comparison has something to show |
| Live readings, sparklines, the 10-minute history, sensor traces, the run list | Illustrative |

## Shell and navigation

- **Sidebar**, left, ~200 px. It contains:
  - the Pophood mark and name, and the theme toggle;
  - navigation: **Dashboard** and **Runs**. The drill-down sits under Dashboard, with a breadcrumb.
  - a trust panel at the bottom:
    - "Sensor helper verified" (Elevated · read-only, or Unprivileged);
    - "PawnIO 2.2.0, detected, not managed by Pophood";
    - "No network, Pophood makes no connections" (v0.1.0 adds the `login.live.com` disclosure; final copy in the techspec's trust panel table);
  - an "About and licenses" link.
- **Content area:** fluid, with 28–32 px padding. At narrow widths the sidebar stacks above the content; the mockups use flex-wrap for this.
- **Global actions** on the Dashboard header: "Run one test" (secondary) and "Run all · about 4 min" (primary). The Runs header has Export JSON, Export CSV, Delete and Run all.

## Themes

- **Two themes, dark and light.** Dark is the default.
- **The toggle** is a sun/moon icon button in the sidebar header, with an `aria-label` of "Switch to light theme" or "Switch to dark theme".
- **Not decided:** whether the app follows the Windows theme by default, and whether the choice persists. See [Open UI questions](#open-ui-questions-for-the-techspec).

**Colour tokens**, from `.th.dark` and `.th.light` in the mockups:

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0A0F1A` | `#F4F7FB` | Page background |
| `surface` | `#0F1626` | `#FFFFFF` | Cards, panels, tables |
| `raised` | `#1A2540` | `#E3ECF7` | Active nav item, active tab, selected list item |
| `selected` | `#14203A` | `#EEF5FD` | Selected table row (Runs) |
| `inset` | `#0A0F1A` | `#F4F7FB` | Wells inside a panel: legend rows, inputs, stat boxes |
| `line` | `#1E2A40` | `#DCE3EE` | Card borders, dividers, chart gridlines |
| `hair` | `#18233A` | `#EAEFF5` | Table row separators |
| `strong` | `#2A3854` | `#C3CEDD` | Button and input borders |
| `rule` | `#B4C3DA` | `#0E1626` | Heavy table rule, run-flag chip borders |
| `text` | `#E6EDF7` | `#0E1626` | Primary text |
| `sub` | `#B4C3DA` | `#33415A` | Secondary text |
| `muted` | `#8B9BB4` | `#4F5E75` | Labels, units, captions |
| `accent` | `#34D3C0` | `#0B8577` | Links, primary chart line, focus ring, progress |
| `accent-fill` / `on-accent` | `#34D3C0` / `#04201C` | `#0B8577` / `#FFFFFF` | Primary button |
| `s2` | `#FF9F43` | `#C2570C` | Second chart series (drawn dashed) |
| `s3` | `#C3A6FF` | `#7A4FD6` | Third chart series (drawn dotted) |
| `locked` | `#3A4A66` | `#C3CEDD` | Legend swatch of a series that needs full sensors |
| `good` / `bad` / `same` | `#34D3C0` / `#FF9F43` / `#5D6E8C` | `#0B7A6D` / `#B4530A` / `#9AA8BC` | Runs: better, worse, within ±1% |
| `base-line` | `#8B9BB4` | `#6A7A92` | Baseline run's trace (dashed) |
| `track` / `axis` | `#0A0F1A` / `#5D6E8C` | `#EEF2F7` / `#6A7A92` | Difference-bar track and zero line |
| `info-bg` / `info-line` / `info-text` | `#11233A` / `#22476B` / `#B4C3DA` | `#EAF3FF` / `#B5D2F5` / `#33415A` | Reduced-sensors banner |
| `info-icon`, `info-fill` / `on-info` | `#7CC4FF`, `#7CC4FF` / `#061A2E` | `#1C5FA8`, `#1C5FA8` / `#FFFFFF` | Banner icon and "Enable full sensors" button |
| `danger-line` / `danger-text` | `#6B2E2E` / `#FFB1A8` | `#E8B4B0` / `#A3271F` | Delete button |
| `dashed` | `#2A3854` | `#B4C1D3` | Border of "needs full sensors" placeholder cards |
| `ok-icon` | `#34D3C0` | `#0B8577` | "Helper verified" shield |

The light accent `#0B8577` is a darker teal than the dark theme's, so links and lines keep at least 4.5:1 contrast on white.

## Type, spacing and icons

- **Fonts:** IBM Plex Sans (400, 500, 600) for the UI, and IBM Plex Mono (400, 500) for every number, unit value, identifier and axis label.
  - The mockups load them from Google Fonts. The app must bundle them locally instead, because it makes no network connections (C5, RF29).
  - Both fonts are under the SIL OFL, so they need an entry in THIRD-PARTY-NOTICES.
- **Type scale:**

  | Element | Font | Size and weight |
  |---|---|---|
  | Page title | Plex Sans | 26 px, 600 |
  | Card hero value | Plex Mono | 40 px, 500 |
  | Card secondary value | Plex Mono | 16 px |
  | Card kind label ("CPU", "GPU · discrete") | Plex Sans | 12 px uppercase, 0.08em tracking |
  | Body | Plex Sans | 14 px |
  | Captions | Plex Sans | 12 px |

- **Radii:** 12 px for cards and panels, 8 px for buttons and inputs, full or 4 px for chips.
- **Spacing:** 16 px between cards, 18 px card padding, 20 px between page sections.
- **Icons:** inline stroke icons drawn on a 24 px grid with a 2 px stroke. They mark verified, lock, play, cancel, rename, export, delete and the theme toggle. The mockups use no emoji.
- **Targets:** buttons and links are at least 44 px tall where they are primary actions. Icon-only buttons have an `aria-label`.

## Screens

### Dashboard (E1)

**Layout, top to bottom:**
1. **Header:** "Dashboard", a hardware summary line, "Run one test" and "Run all · about 4 min".
2. **Reduced-sensors banner.** This appears in reduced mode only. It reads: "CPU temperature, power and clocks, drives, fans and DIMMs need the sensor helper elevated. Pophood itself never runs as admin." Next to it are the **Enable full sensors** button and the line "One UAC prompt · exits when Pophood closes".
3. **Run-all progress panel.** This appears only while a run is in progress. It shows:
   - the step ("step 4 of 4: Disk") and the sub-step ("SEQ1M Q1T1 write · pass 2 of 3");
   - "sampling every 250 ms", the time left, and a progress bar;
   - completed steps with a check;
   - a Cancel button.
4. **Card grid:** `repeat(auto-fill, minmax(300px, 1fr))`, which gives three columns at 1280 px. The cards are CPU, Memory, GPU per adapter (here the RTX 5060 Ti and the Radeon iGPU), Disk per drive, and Motherboard. Each card has:
   - a kind label, the model name, and an "All sensors" link to the drill-down;
   - a hero value with its label (CPU: package temperature; Memory: used / total; GPU: temperature; Disk: read and write MB/s; Motherboard: a list of fan RPMs with bars);
   - a 10-minute sparkline;
   - a 2 × 2 grid of secondary values, matching the slice-1 card contents in requirements.md.
5. **"Last 10 minutes" chart**, full width under the grid:
   - **Metric switch:** a segmented control for Temperatures, Load and Power (buttons with `aria-pressed`).
   - **Series:** up to three, told apart by colour *and* dash pattern (solid, dashed, dotted).
     - Temperatures: CPU package, RTX 5060 Ti, NV3.
     - Load: CPU, RTX 5060 Ti, iGPU.
     - Power: CPU package, RTX 5060 Ti, iGPU.
   - **Legend:** on the right, with each series' current value.
   - **Axes:** the y-axis is labelled; the x-axis runs from −10 min to now.

**Reduced mode** (`sensors: reduced` in the mockup):
- **CPU card:** the hero becomes Total load. Temperature, clock, power and hottest core each show a lock icon with "Needs full sensors", never a 0.
- **Memory card:** shows only used/total and the configured speed. The "OC profile · Likely on · inferred" chip and its explanation are hidden.
- **Disk and Motherboard:** each becomes a dashed placeholder card with a lock, "Needs full sensors", and one line saying why.
- **History chart:** series that need full sensors are not drawn. Their legend rows show the lock and "Needs full sensors".
- **Sidebar trust panel:** shows "Unprivileged".

**Inferred values** are labelled as inferred:
- the chip reads "Likely on · inferred";
- the caption reads "Inferred: configured 6000 MT/s is above the SPD JEDEC speed of 4800 MT/s."

### Sensor drill-down (E2, motherboard example)

> **Superseded from v0.1.1** (2026-10-22): the layout below (a list on the left, the detail on the right) is replaced by group cards in flowing columns with the detail panel full width at the top. See the [v0.1.1 UI proposal](../../v0.1.1/ui-proposal/ui-proposal.md). The rename copy below still holds for v0.2.0.

- **Header:** breadcrumb "Dashboard / Motherboard", the title, and "Gigabyte B850 EAGLE WIFI6E · ITE IT8696E · 19 sensors · generic names until you rename them".
- **Left: the sensor list.** Groups are Fans, Temperatures and Voltages, each with a count. Each row is a button showing the name and current value; the selected row has an accent border.
  - Renamed sensors show the new name and the default ("CPU fan · Fan #1").
  - Fans reading 0 RPM are shown in the muted colour.
- **Right: the detail panel** for the selected sensor. It shows:
  - the group, the name, and the LHM identifier in mono;
  - a large current value with "now · refreshes every second";
  - a 10-minute chart;
  - Min, Max and Unit boxes.
- **The rename form** sits in the detail panel. It has:
  - a "Display name" input, with the default name as the placeholder;
  - **Save name** and **Reset to "Fan #2"** buttons;
  - the caption "Shows on the dashboard, in this list and in run traces. Saved on this PC only."
  - Saving an empty name, or the default name, clears the rename.
- **Applies to every component.** The same layout serves every drill-down (CPU, GPU, Memory, Disk). Only the motherboard was mocked, because it shows the generic-name problem (F3) and the rename flow (G5).

### Runs (E3)

- **Header:** "Runs" and "Tick 2 or more to compare. The first ticked run is the baseline." On the right: Export JSON, Export CSV, Delete and Run all.
- **Run table.** The columns are a checkbox, Label, Taken (date and time in mono), Tests, Notes, and a Relabel icon button.
  - The baseline row carries a "BASELINE" tag.
  - **Flags in Notes:** "Reduced sensors" (a lock chip with a solid border) and "Partial · cancelled in Disk" (a chip with a dashed border). The border style keeps the two flags apart without relying on colour.
  - The caption under the table reads "Exports strip serial numbers by default."
- **Compare table**, shown when 2 or more runs are ticked.
  - **Layout:** one section each for CPU, Memory, GPU and Disk. Each section has a note naming the tool and the hardware.
  - **Columns:** metric (with its unit), baseline value, compared value, and a diverging difference bar with the % and a word ("better", "worse", "≈ same").
  - **Direction:** bars run right when better and left when worse. For lower-is-better metrics (memory latency), this means the bar still points right when the number goes down. The unit says "lower is better".
  - **Threshold:** within ±1% counts as "≈ same" and uses the `same` colour.
  - The disk section lists all 8 CrystalDiskMark profiles (read and write × 4).
- **Sensor trace:** an overlay of the same sensor across runs, here CPU package temperature over the 32 s CPU test.
  - The baseline is dashed and the compared run is solid, with a legend.
  - The x-axis marks where single-thread starts at 17 s.
  - The caption reads "Sampled every 250 ms. Sensors are matched by identifier across runs."
- **Fewer than 2 runs ticked:** a dashed empty panel takes the place of the comparison.

## States: covered and not covered

**Mocked**, with the slice requirements they serve:

| State | Where | Requirement |
|---|---|---|
| Full sensors | E1 default | Slice 1 card contents |
| Reduced mode: placeholders, banner, Enable full sensors | E1 `sensors: reduced` | Slice 1 reduced mode; "Reduced mode has to look intentional" |
| Run all in progress, with step, sub-step, time left and Cancel | E1 `runAll: true` | Execution flow 4; UX long-running work |
| Rename and reset | E2 | Slice 2 |
| Compare 2 runs, % difference, overlaid trace | E3 | Slice 8; G4 |
| Reduced and partial runs marked in the list | E3 | UX "visibly marked wherever runs are listed or compared" |
| Light and dark themes | All | UX theme (now decided) |

**Not mocked.** The techspec should design these with the same shell and tokens:

- **Sensor and helper states:**
  - "Connecting to sensors…" (~2.5 s after UAC).
  - UAC cancelled, or the elevated helper never connects: return to reduced mode with a message and a retry.
  - PawnIO missing: what's missing, and a pawnio.eu link. Also the elevated-without-PawnIO case, which gets storage only.
  - Helper missing or failing its hash check, a pipe squatter, a schema mismatch: blocking errors that leave the app usable as a shell.
  - "Sensors disconnected" and recovering.
  - "None detected" empty states for GPU, drive and fan.
- **Benchmark setup:**
  - The single-test chooser behind "Run one test", including the GPU adapter picker (default dGPU) and the drive picker.
  - The disk write-volume warning (~234 GB on the NV3) and the pre-run background-load check.
- **Runs actions:** the relabel, delete-confirm and export (save dialog) flows.
- **Comparing more than 2 runs.** The table has one compared-value column, so more runs need a layout decision.
- **Other screens:** the CPU, GPU, Memory and Disk drill-downs (same layout as E2), and the About and licenses page.

## Accessibility conventions in the mockups

- Real `<button>`, `<a href>`, `<input>` and `<label>` elements throughout. Icon-only buttons have an `aria-label`. Segmented controls and list selection use `aria-pressed`. The progress bar has `role="progressbar"` and values.
- No information is carried by colour alone:
  - chart series also differ by dash pattern;
  - differences carry a sign and a word;
  - run flags differ by border style and text;
  - locked values say "Needs full sensors".
- Text tokens were picked for at least 4.5:1 contrast on their surface in both themes. Verify them in the real build.
- Focus is shown as a 2 px accent outline.

## Open UI questions for the techspec

1. **Theme default and persistence:**
   - follow the Windows app theme, or default to dark?
   - store the choice per machine, alongside sensor renames?
2. **Chart rendering:** the mockups draw sparklines and charts as inline SVG paths. The app needs a way to draw ~10 minutes of 1 s data, and 250 ms traces, across many cards without jank. The techspec chooses between a library and plain SVG or canvas, under the strict CSP.
3. **Comparing 3 or more runs:** extra value columns, or one comparison table per pair against the baseline?
4. **Window minimum size**, and how the card grid and sidebar behave at that size.
