# Spike results: sensors, helper, pipe, run times

- **Date:** 2026-10-20
- **Plan it tested:** [grill-session/session.md](grill-session/session.md)
- **Code (throwaway, local git only):** `C:\Users\jimmy\projects\pc-bench-spike\` (its README has the full tables, raw outputs and vendored-tool SHA-256s)
- **Machine:**
  - CPU: Ryzen 9 9900X
  - Motherboard: Gigabyte B850 EAGLE WIFI6E
  - RAM: 2 × 16 GB DDR5-6000
  - GPU: RTX 5060 Ti 16 GB
  - Disk: Kingston NV3 1 TB
  - OS: Windows 11
- **Tool versions:**
  - Sensors: LibreHardwareMonitorLib 0.9.6, PawnIO 2.2.0
  - Benchmarks: DiskSpd 2.3, 7-Zip 26.04
  - Toolchains: .NET 10.0.402, Rust 1.99.1, Tauri 2

## Verdict

**The plan holds.** Each piece of the Q2/Q9/Q11/Q13b design worked on the owner's PC:
- the LHM helper, built as a single NativeAOT executable;
- the PawnIO driver, signed by Microsoft;
- the user-only named pipe;
- the unprivileged Tauri app;
- elevation on demand, with the helper exiting when the app closes.

## Findings

| # | Finding | Effect on the requirements |
|---|---|---|
| F1 | **Unprivileged, the dashboard is almost empty.** Only the GPUs and CPU load work. CPU temperature, power and clocks read 0; the NVMe drive, the motherboard fans and the DIMMs are missing. | "Enable full sensors" is the normal path, not an edge case. The reduced mode needs clear placeholders on each card ("needs full sensors"), not zeros. Treat 0 values from the unprivileged CPU as "not available". |
| F2 | **Elevated with PawnIO, everything on the card list works:** <ul><li>CPU: Tctl/Tdie, CCD temperatures, package power, effective clocks</li><li>RAM: DIMM temperatures, SPD timings</li><li>NVMe: SMART (life 97%, temperatures, hours)</li><li>Fan chip: ITE IT8696E with 2 live fans, 5 temperatures, 9 voltages</li></ul> | The Q23 card list is achievable on this machine. |
| F3 | **The motherboard sensor labels are generic** ("Fan #1", "Voltage #3"). LHM has no mapping for this board, so Vcore can't be identified automatically. | Decide in requirements: let the user rename or hide sensors in v1, or keep everything for v2 customization (Q6b). |
| F4 | **The per-core VID readings are suspicious** (1.6 V unprivileged, 0.3 V elevated). | Leave VID off the cards. |
| F5 | **Memory "configured speed" and "EXPO" aren't LHM sensors.** SPD gives the rated timings; the configured 6000 MT/s comes from WMI `Win32_PhysicalMemory`, without admin. | The Memory card takes its speed from WMI. "EXPO on" would have to be inferred (configured speed above the JEDEC base); decide whether to show it. |
| F6 | **The helper builds as one NativeAOT exe of 8.1 MB**, plus 1.5 MB of Mono.Posix DLLs, which are probably removable. No .NET runtime ships. All elevated code paths (storage, SMBus) work under AOT despite trim warnings. Startup takes 0.3 s unprivileged and 2.5 s elevated; each update takes ~90 ms. | The 250 ms sampling during runs is feasible. The UI needs a "connecting to sensors…" state for ~2.5 s after elevation. |
| F7 | **The pipe works across the elevation boundary.** The elevated helper and the medium-integrity client connect when the DACL allows only the current user's SID. The helper exits when the client disconnects. The PawnIO driver stays loaded until reboot after first use, but only admin processes can open it. | Techspec: protect against **pipe squatting** (check the server's process path, `GetNamedPipeServerProcessId`) and version the message schema (Q14b). |
| F8 | **PawnIO.sys is signed by Microsoft Windows Hardware Compatibility Publisher**, meaning it went through Microsoft's attestation signing. The LHM library embeds only PawnIO modules and **no driver installer**. | This supports Q10 (the app never installs drivers) without any patching of LHM. |
| F9 | **CPU benchmark run time: 7-Zip takes 32 s** (17 s multi-thread for 170,780 MIPS, plus 15 s single-thread for 10,509 MIPS). | Fits "Run all". |
| F10 | **Disk benchmark run time: DiskSpd takes 55 s** for one 5 s pass of each CrystalDiskMark profile, read + write, on a 1 GiB file. It works without admin, but file prep is slower without SeManageVolumePrivilege. Two write results look faster than the drive's rating, and some Q32 latencies are implausible. | Requirements: a quick default (1 pass, ~1 min) vs a full CDM-style test (5 passes, ~4.5 min). The flags need **calibrating against a real CrystalDiskMark run** on the same drive. Report MB/s (decimal) like CDM. |
| F11 | **"Run all" estimate.** Measured: CPU ~32 s, disk ~60 s. Estimated: memory ~20 s, GPU ~20 s (neither built yet). That gives **~2.5 min quick** or ~6 min with the full disk test. | The ~5 min target (Q26) holds with the quick disk default. |

## Still unverified

- Whether NVMe SMART can be read without admin through a direct IOCTL. LHM doesn't do it, and Q21 makes the helper the only sensor source, so this only matters if a disk card is wanted in reduced mode.
- Whether the DiskSpd numbers match CrystalDiskMark (F10).
- Memory and GPU benchmark run times (not built in the spike).

## Owner decisions on the findings (2026-10-20)

**Question:** These five items need a decision in the requirements:
1. The dashboard is nearly empty without admin; cards need a "needs full sensors" placeholder.
2. Motherboard sensors have generic names; is renaming in v1 or v2?
3. Is the disk test a quick ~1 min default or the full ~4.5 min CrystalDiskMark-style run?
4. Leave the suspicious per-core VID off the cards.
5. Memory configured speed comes from WMI, and EXPO is inferred.

**Answer:**
> on the items, I think the first one is fine, we should push the users to enable full access. Let's do renaming sensors in v1. Disk test like CrystalDiskMark. Agree. Ack.

| Finding | Decision |
|---|---|
| F1 (reduced mode is almost empty) | Fine as is. The app should **push users to enable full sensors**. |
| F3 (generic motherboard labels) | **Renaming sensors is in v1.** This brings one piece of customization forward from v2 (Q6b). |
| F10 (disk test length) | **The disk test works like CrystalDiskMark** (its default 5 passes, ~4.5 min). "Run all" will therefore take ~6 min, slightly over the ~5 min target in Q26. |
| F4 (suspicious VID) | Agreed: leave VID off the cards. |
| F5 (memory speed and EXPO) | Acknowledged: configured speed comes from WMI, EXPO is inferred. |

> **Note on F10 (2026-10-21):** the "5 passes, ~4.5 min" figure was based on CrystalDiskMark 8.x. It is superseded by **CDM 9.x defaults: 1 warm-up plus 3 scored passes**, about 3.5 min for the disk test and about 4.2 min for "Run all", within the ≤ 5 min budget (owner answers #13 and #32). On 2026-10-21, calibration against CDM 9.0.3 on the NV3 passed within ±5% for all 8 results (OQ2). See [requirements.md](requirements.md) RF18, [probe-results.md](probe-results.md#p4-diskspd-built-from-source-oq2-rf14) P4, and ADR 0007.
