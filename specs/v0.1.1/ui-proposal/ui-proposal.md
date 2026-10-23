# UI proposal: Pophood v0.1.1 drill-down

- **Date:** 2026-10-22
- **Status:** chosen by the owner: variant B, "chart on top" (answer #7 in [the session's owner decisions](../../../sessions/20261022163940_pophood-v011-drilldown-design/owner-decisions.md)).
- **Supersedes:** the drill-down part of the [v0.1.0 UI proposal](../../v0.1.0/ui-proposal/ui-proposal.md#sensor-drill-down-e2-motherboard-example) (mockup E2: a list on the left, the detail panel on the right). The shell, tokens, type, dashboard and Runs designs stay as they are.
- **Canvas:** https://claude.ai/artifact/T5R65BXDC8EC5t4wyNWAGQ (private to the owner). Row "Variant B" holds the chosen design. The "Variant A" rows hold the rejected side drawer; their group cards are the same as B's.
- **Mockup sources:** [mockups/](mockups/), copied from the canvas so this folder stands on its own. They need the Design runtime (`support.js`), so read them as source, or open the canvas.
- **Altitude:** a visual and interaction reference for the techspec, not a component design. Where it names a CSS mechanism, that is how the mockup was drawn; the techspec decides.

## Why it changed

The owner's request (answer #1): "it really bothers me having to scroll so much and have so much space on the right that could be used".

In v0.1.0 the drill-down is one list column of 40 px rows. On the owner's PC (P1 elevated dump):

| Drill-down | Sensors | Groups |
|---|---|---|
| CPU (Ryzen 9 9900X) | 95 | Clocks 27, Loads 26, Power 13, Voltages 12, Factors 12, Temperatures 5 |
| GPU (RTX 5060 Ti) | 38 | 9 groups: Loads 21, the other 8 have 1–5 sensors |
| Memory | 48, over 4 hardware items | Each DIMM: Timings 14, Temperatures 6, Data 1 |
| Disk (NV3) | 21 | 6 groups |
| Motherboard (IT8696E) | 26 | Fans 6, Temperatures 5, Voltages 9, Controls 6 |

The v0.1.0 CPU list is about 4,400 px tall, more than 4 screens at a 1917×1029 window. The detail panel next to it is about 450 px tall, and the space below it is empty.

## The chosen set

| Artboard | Mockup | Shows |
|---|---|---|
| B · CPU · chart on top | [CpuTop.dc.html](mockups/CpuTop.dc.html) | The main layout at 1920 px |
| B · Motherboard · chart on top with the v0.2.0 rename form | [MotherboardTop.dc.html](mockups/MotherboardTop.dc.html) | Where v0.2.0 puts the rename form |
| B · CPU · 1024 px minimum window | [CpuTop1024.dc.html](mockups/CpuTop1024.dc.html) | 2 columns at the minimum window |
| A · CPU · reduced mode | [CpuReduced.dc.html](mockups/CpuReduced.dc.html) | The banner and the locked groups (the cards are the same in B) |
| A · GPU, A · Memory, A · Disk (light theme) | [Gpu](mockups/Gpu.dc.html), [Memory](mockups/Memory.dc.html), [Disk](mockups/Disk.dc.html) | The cards for the other drill-downs (the same in B) |

[Main.dc.html](mockups/Main.dc.html) draws every artboard. Its props: `view` (cpu, cpuReduced, gpu, memory, disk, motherboard), `theme`, `detail` (`drawer` or `top`), `stickyChart`, `rename` and `open` (the selected sensor).

**Data in the mockups:**

| Data | Source |
|---|---|
| Sensor names, identifiers, LHM index order and current values | The owner's PC at idle: `C:\Users\jimmy\pophood-probes\probe-ids\ids-elev-1.json` (full sensors) and `ids-unpriv-1.json` (reduced mode). In reduced mode every non-Load CPU value is `null`, as the helper sends it without PawnIO (`helper/Availability.cs`). |
| The 10-minute chart, Min and Max | Illustrative |

## Layout, top to bottom

1. **Header, unchanged:** breadcrumb "Dashboard / {Component}", the title "{Component} sensors" and the subline "{hardware names} · {n} sensors".
2. **Reduced-sensors banner,** in reduced mode only. It is the same as the dashboard's: "Reduced sensors", the body "CPU temperature, power and clocks, drives, fans and DIMMs need the sensor helper elevated. Pophood itself never runs as admin.", **Enable full sensors** and "One UAC prompt · exits when Pophood closes".
3. **Sensor detail panel, full width.** It stays in view at the top of the window while the page scrolls (`position: sticky` in the mockup), so a click on a sensor far down the page updates a chart the owner can see. It shows, for the selected sensor:
   - the group ("CLOCKS"), the name, and the LHM identifier in mono;
   - the current value (mono, 40 px) and "now · refreshes every second";
   - Min (10 min), Max (10 min) and Unit;
   - the 10-minute chart across the full width, 130 px tall, with "−10 min", "−5 min" and "now" under it.
   - The first sensor of the first group that is not locked is selected when the page opens (as in v0.1.0). Clicking a row selects it. If the selected sensor leaves the frame, the selection goes back to the first row (as in v0.1.0).
4. **Group cards in flowing columns.** One card per SensorType, in the v0.1.0 group order and labels ("CLOCKS · 27"). Rows keep LHM `index` order.
   - The cards flow down, then across, in columns at least 270 px wide with a 16 px gap: 5 columns at 1920 px, 2 at 1024 px.
   - A group of 8 sensors or fewer never splits. A larger group can continue at the top of the next column; each piece keeps the card border (`box-decoration-break: clone`, Chromium 130 and later). The continuation has no title.
   - A row is a button: the name on the left, the value on the right (mono, 13 px), at least 36 px tall. Long names wrap. The selected row has the `raised` background and an `accent` border. Values that are `null`, and fans at 0 RPM, use `muted`.
   - **Several hardware items** (Memory: Virtual Memory, Total Memory, each DIMM): each one gets its name as a heading and its own column flow, as in v0.1.0.
5. **Locked groups.** When the values of a group need more than the helper has, the card shows only its title and a lock with "Needs full sensors" (or "Needs PawnIO"; the same rule as the dashboard cards). It has no rows. The CPU page in reduced mode then shows Loads with values and five small locked cards.

**Rename (v0.2.0, not in v0.1.1):** the form is one row along the bottom of the detail panel: "Display name", the input with the default name as placeholder, **Save name**, **Reset to "{default}"**, and the caption "Shows on the dashboard, in this list and in run traces. Saved on this PC only." The copy is unchanged from mockup E2.

## Estimates (not measured)

These come from row counts and CSS arithmetic. The owner hasn't measured them in the app.

| Page | v0.1.0 | v0.1.1 at 1920×1029 |
|---|---|---|
| CPU | ~4,400 px, more than 4 screens | ~1.4 screens with the panel |
| GPU | ~2,000 px, 2 screens | Less than 1 screen |
| Detail panel height | ~450 px, beside the list | ~290 px at 1920 px; ~380 px at 1024 px, where it wraps |

**Measured in the techspec session** (2026-10-22). A prototype with the app's own `app.css`, tokens, fonts and the P1 data was rendered in headless Edge 155.0.4283.62, the WebView2 runtime's build. These numbers are from that render, not from the app: [measurements.txt](../../../sessions/20261022171503_pophood-v011-techspec/evidences/render-check/measurements.txt).

| Page | 1917×1029 | 1024×680 |
|---|---|---|
| CPU | 1,266 px = 1.23 screens, 5 columns, 3 split cards | 2,444 px = 3.59 screens, 2 columns |
| CPU, reduced | 1 screen | 2.06 screens |
| GPU, Disk, Motherboard | 1 screen each | — |
| Memory | 1.39 screens | 3.01 screens |
| Detail panel (with its 12 px strip) | 273 px | 348 px (Min / Max / Unit wrap) |

The split cards keep their border on every piece (`box-decoration-break: clone`), and sticky works.

## States: mocked and not mocked

**Mocked:** full sensors (all five drill-downs), reduced mode (CPU), the light theme (Disk), the 1024 px window, and the v0.2.0 rename row.

**Not mocked, for the techspec:**
- Elevated without PawnIO: the lock says "Needs PawnIO".
- Stale values (reconnecting): every value shows "—", as in v0.1.0.
- No frame yet: "No sensor data yet.", as in v0.1.0.
- A scope with no sensors: today's caption, "This component has no sensors in the current frame.", moves to where the panel would be.
- A selected sensor whose value is `null`: the panel shows "—" and an empty chart.

## Rejected: variant A, side drawer

The detail opened in a 440 px drawer on the right, over the cards, when a sensor was clicked; nothing was selected on open. The cards used the whole window. The owner chose B (answer #7) after seeing both. B shows the chart all the time and keeps v0.1.0's "first sensor selected on open"; it costs vertical space (see the estimates).

## Open UI questions for the techspec (answered)

Answered in the [v0.1.1 techspec](../techspec.md) (owner answers in its Q&A record):
1. **The sticky panel in a short window:** sticky only when the window is at least 800 px tall; below that it scrolls with the page (the mockup's `stickyChart: false` case). While it sticks, a 360 px scroll padding keeps a keyboard-focused row out from under it.
2. **The banner on the drill-down:** the dashboard's status banner, with all its states.
3. **Where the lock rule lives:** `drillSections` returns a lock per group, through the private `lockFor`.
4. **Verify the estimates:** rendered in Edge 155 (above); the app check is E2E-21.

**New token:** `--shadow` (dark `rgba(0, 0, 0, 0.45)`, light `rgba(14, 22, 38, 0.18)`), from `Main.dc.html`, for the panel's shadow.
