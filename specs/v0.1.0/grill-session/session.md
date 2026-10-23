# Grill session: all-in-one Windows hardware monitor + benchmark

- **Date:** 2026-10-20
- **Format:** `/grill-me`, which calls Matt Pocock's `grilling` skill. That skill isn't installed locally, so it was fetched from [mattpocock/skills](https://github.com/mattpocock/skills) (`skills/productivity/grilling`).
- **Prompt:** replace HWiNFO (complete, but a hard-to-read UI) and separate benchmark apps (Cinebench, MemTest, CrystalDiskMark) with one app, without granting admin to a tool the owner doesn't trust (btop4win).
- **All 31 questions with the owner's verbatim answers:** [questions.md](questions.md)
- **Status:** 4 rounds complete. The owner confirmed this is a shared understanding (2026-10-20). Spike setup: throwaway code in `C:\Users\jimmy\projects\pc-bench-spike\` (local git only). Claude installs Rust (rustup via winget) and downloads 7-Zip and DiskSpd from official sources. The owner installs PawnIO and clicks the UAC prompts.

## What we agreed

| Area | Decision |
|---|---|
| Users | The owner first, in a public repo. Long term: an open-source release with an installer for other users. |
| Platforms | Windows 11 x64 for v1 and v2. Cross-platform in the long term, prepared for only by two seams (see Architecture). |
| Form | A desktop window app with a modern, curated UI, explicitly unlike HWiNFO's "read everything" sensor list. |
| Stack | **Tauri** (Rust core + React/TypeScript UI) plus a **.NET sensor helper** wrapping **LibreHardwareMonitorLib** (MPL-2.0), pinned, built from source, with its driver auto-install turned off. |
| Trust model | The main app never runs elevated. The helper is the **only sensor source** and is **read-only permanently**: no fan control, no tuning, no CPU register writes. It runs unprivileged by default; "enable full sensors" restarts it elevated after one UAC prompt, and it runs only while the app is open. It talks to the app over a named pipe that only the current user can open. |
| Driver | **PawnIO** (the driver that replaced WinRing0 in LHM, FanControl and ZenTimings). The app **never installs a driver itself**: it detects PawnIO, explains what's missing without it, links to the official setup, and works in a reduced mode until it's installed. |
| Network | v1 makes no network connections: no telemetry, update checks, crash reporting or online score lookups. |
| Architecture seams | (1) Sensor source: a helper speaking a versioned sensor schema. (2) Test runners: "run, report progress, return a result," with several test types per component (benchmark now; stress and stability later). No other cross-platform abstractions, and no Linux builds before v2 ships. |
| Dashboard (v1) | Fixed, curated cards with sparklines; clicking a card opens the full sensor list. **CPU:** package temperature, load, effective clock, package power, hottest core. **GPU:** temperature, load, VRAM used/total, power, clock. **Memory:** used/total, configured speed, EXPO status. **Disk (per drive):** read/write throughput, temperature, SMART health. **Motherboard:** fans. Customization (pinning, reordering, hiding cards) comes in v2. |
| Sampling | 1 s live; 250 ms while a benchmark run is active. |
| Benchmarks (v1) | **CPU:** 7-Zip's built-in benchmark (`7z b`). **Memory:** a STREAM-style bandwidth test plus a pointer-chasing latency test, in Rust. **GPU:** a D3D12 compute test (FP32 throughput + VRAM bandwidth), in Rust. **Disk:** DiskSpd running CrystalDiskMark's four default profiles, on a 1 GiB temporary file on a chosen drive. "Run all" (CPU → memory → GPU → disk, ~5 min) is the main action; each test can also run alone. A pre-run load check warns but doesn't block. |
| Benchmarks (later) | v2: in-OS memory stability (free RAM only, labeled as not replacing MemTest86) and stress modes. A VRAM stability test (memtest_vulkan is a candidate). No 3D-scene benchmark planned. |
| Bundled tools | 7-Zip and DiskSpd at pinned versions, with SHA-256 checksums in the repo verified before each run, and their license files included. |
| Results | Compared mainly with the owner's own history. Disk numbers can be compared with CrystalDiskMark; no promise of matching Cinebench. Saved runs go in SQLite under `%LOCALAPPDATA%`: score, settings, hardware snapshot, driver versions, and a sensor trace. The live history is the last ~10 minutes, in memory only. No continuous logging in v1; CSV logging can come in v2. A Runs page compares 2 or more labeled runs (bar charts with % difference, traces overlaid). |
| License | MIT. |
| Way of working | Claude implements; the owner reviews code as it's written and asks questions. |
| Name | **Pophood**, chosen after the spike (2026-10-20), as in "pop the hood" on your PC. Free on GitHub and crates.io when checked. Runners-up: Hoodlight, Clearhood, Dynorig. Openhood was the favourite, but a GitHub org already uses it. Until then, `pc-bench-monitor` was the placeholder. |

## Changes since this session

The table above records what was agreed on 2026-10-20. The requirements phase (2026-10-20 to 2026-10-21) changed the decisions below. [requirements.md](../requirements.md) is now the source of truth, and its [Q&A record](../requirements.md#qa-record-this-session) holds the owner's verbatim answers (#n).

| Area | Change |
|---|---|
| Disk benchmark | Follows CrystalDiskMark **9.x** defaults: 1 warm-up plus **3 passes**, not the 5 passes of CDM 8.x (#13). It is not user-configurable (#7). It was calibrated within ±5% of CDM 9.0.3 on the NV3 (#25; OQ2, 2026-10-21). See ADR 0007. |
| DiskSpd | **Built from MIT source** at tag `v2.3`. The release zip's EULA forbids redistribution (#14). |
| LibreHardwareMonitorLib | Built from pinned source rather than the NuGet package (#15). Its NuGet dependencies are pinned with a lock file and content hashes (#20). |
| Bundled-tool hashes | `7za.exe` is downloaded, so its SHA-256 is kept in the repo. The helper and `diskspd.exe` are self-built, so the build writes a **hash manifest** next to the app (#21). See ADR 0006. |
| Trust model | "Read-only" is restated as "**never changes hardware state**". The only exceptions are the documented read-path register selects and the allow-listed monitoring writes (#19, #29, #30; RF1). See ADR 0004. |
| LHM controllers | `IsControllerEnabled` is **off** in v1 (#19). |
| Memory card | "EXPO status" became "**OC profile likely on**" (#8, #16), inferred from SPD and shown only with full sensors (#24). |
| GPU card | **One card per GPU** (#17). |
| Single instance | A second launch focuses the running window (#18; RF7). |
| "Run all" | About 4.2 min, using the quick memory test. Budgets: "Run all" ≤ 5 min, memory ≤ 30 s, GPU ≤ 10 s (#31, #32). |

## Next steps (in order)

1. **Spike** on the owner's PC (Ryzen 9 9900X, Gigabyte B850 EAGLE WIFI6E, RTX 5060 Ti, Kingston NV3 1 TB):
   - LHM 0.9.6 + PawnIO reading 9900X temperatures, clocks and power, and the B850's SuperIO fan chip;
   - which readings survive without admin, especially NVMe SMART;
   - NativeAOT or trimmed self-contained size for the helper;
   - an elevated helper → named pipe → hello-world Tauri app;
   - run times for `7z b` and the DiskSpd profiles (to check the ~5 min target).
2. Choose the project name and create the repo. Move these notes into it.
3. Requirements (`define-reqs`), updated with the spike results.
4. The owner's Claude Design round for mockups (dashboard, drill-down, Runs comparison).
5. Techspec (`techspec`), taking the mockups into account.
6. Tasks (`tasks-breakdown`), then implementation.

## Facts to re-verify during the spike

All resolved in the [spike results](../spike-results.md) (2026-10-20), except the D3DKMT unit, which isn't needed:

- **Whether LHM supports this board's SuperIO chip:** yes. It detects the ITE IT8696E, but with generic labels (F2, F3).
- **Whether NVMe SMART can be read without admin:** not through LHM; it needs elevation (F1). A direct IOCTL is untested.
- **Whether LHM works with NativeAOT:** yes, giving an 8.1 MB exe, and the elevated paths work too (F6).
- **Who signs PawnIO:** Microsoft Windows Hardware Compatibility Publisher, so it's attestation-signed (F8).
- **The D3DKMT temperature unit:** not needed, because LHM reads the GPU.
