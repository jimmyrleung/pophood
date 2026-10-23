# Grill session: questions and answers

- **Date:** 2026-10-20
- **Project:** an all-in-one Windows hardware monitor + benchmark app (CPU, memory, disk, GPU). The name isn't chosen yet; `pc-bench-monitor` is a placeholder folder until the project gets its own repo.
- **Format:** `/grill-me` (Matt Pocock's `grilling` skill, fetched from [mattpocock/skills](https://github.com/mattpocock/skills) `skills/productivity/grilling` because it isn't installed locally).
- **Prompt:** the owner dislikes HWiNFO's UI, wants CPU/memory/disk/GPU benchmarks in one app instead of Cinebench + MemTest + CrystalDiskMark, and doesn't trust btop4win enough to give it admin rights.
- **Format of each entry:** the question and my recommendation (condensed), the owner's answer **verbatim**, and the outcome.

## Facts gathered before round 1

**The machine** (read-only inventory, 2026-10-20):

| Part | What's installed |
|---|---|
| Type | Desktop |
| CPU | AMD Ryzen 9 9900X (Zen 5, 12 cores / 24 threads) |
| Motherboard | Gigabyte B850 EAGLE WIFI6E |
| RAM | 2 × 16 GB DDR5-6000 (Corsair CMK32GX5M2B6000C38), running at 6000 MT/s with the EXPO memory overclock profile on |
| GPU | NVIDIA RTX 5060 Ti 16 GB (driver 617.42, `nvidia-smi` available), plus the CPU's built-in AMD Radeon graphics |
| Disk | One drive: Kingston SNV3S1000G, 1 TB NVMe |
| Toolchains | .NET SDK 10.0.402; Node 24 with npm and pnpm; VS 2026 Professional; VS Build Tools 2022 (MSVC 14.44, Windows SDK 10.0.26100); git; winget. No Rust, Python or Go. |
| Benchmark tools | Cinebench 2026, unzipped in Downloads |

**Sensors and drivers** (web research, 2026-10-20):

- CPU temperatures, voltages and per-core clocks, motherboard fans, and RAM SPD all require a kernel driver, so the reading process must have admin rights.
- GPU vendor APIs (NVML/NVAPI), performance counters, and the disk-throughput benchmark need no admin.
- **WinRing0** has a vulnerability that lets any process reach physical memory (CVE-2020-14979). Microsoft Defender has flagged it since about March 2025.
- **PawnIO** replaced WinRing0 in LibreHardwareMonitor (LHM) 0.9.5+, FanControl and ZenTimings. It's GPL-2.0, with an exception for programs that only talk to it through IOCTLs (driver calls). It runs only signed modules, but its device can only be opened by SYSTEM or Administrators.
- **btop4win's sensor build** uses LHM 0.9.4, which still loads WinRing0. The project is dormant: there have been no releases since 1.0.5 (2025-10-12), and that release says the antivirus detection is "not fixed yet."
- **LibreHardwareMonitorLib** is MPL-2.0, targets .NET 8/9/10, uses PawnIO, and has an option to turn off its automatic driver install (v0.9.6, 2026-02-14).
- **Benchmark building blocks:**
  - CrystalDiskMark is a front end for Microsoft **DiskSpd** (MIT).
  - Intel MLC's license is proprietary, so don't bundle it.
  - A memory test inside Windows can't reach all RAM.
  - memtest_vulkan (Zlib) tests video memory.
  - The 7-Zip benchmark is LGPL.
  - Geekbench's license is personal and non-commercial.

## Round 1

### Q1: Who is this for?

**Question:** A personal tool, or something published (open source, installer, other users)?

**Recommendation:** A personal tool first, with at most a public but unpolished repo. Publishing is a later decision.

**Answer:**
> primarily for me, but in the long-term I plan to publish as you mentioned: open source, with an installer so other users can use it. But the initial version could be something for me with a public repo yes.

**Outcome:** v1 is for the owner and lives in a public repo. The long-term goal is an open-source release with an installer, so choices that would block other users' hardware or an installer should be avoided even in v1.

### Q2: Admin and kernel driver

**Question:** (a) never elevate and lose CPU temps/voltages/fans; (b) unprivileged main app + small separate elevated sensor helper using a vetted signed driver; (c) whole app runs as admin (the btop4win approach).

**Recommendation:** (b).

**Answer:**
> yea option (b)

**Outcome:** The main app never runs elevated. Only a separate sensor helper does. (Follow-up Q9: what the helper is built from.)

### Q3: Memory benchmark vs memory stability

**Question:** A bandwidth/latency benchmark (works in Windows without admin) vs a stability test (full coverage needs a boot-time tester such as MemTest86).

**Recommendation:** v1 is the benchmark. v2 at most adds an in-OS free-RAM stress test, labeled as not replacing MemTest86.

**Answer:**
> I'd like to make both tests available, but agree with order: v1 benchmark, v2 stability

**Outcome:** v1 is the memory benchmark. v2 is the in-OS stability test (free RAM only, labeled as such).

### Q4: Benchmark (score) vs stress (stability) for CPU and GPU

**Question:** Scores like Cinebench, or stress like Prime95/OCCT/FurMark, for which components?

**Recommendation:** Scores first. Later, a timed "stress + watch sensors" mode that reuses the same workloads.

**Answer:**
> Same as Q3 - the app should make available different types of tests but we'll start with the simple one first

**Outcome:** The app supports several test types per component (benchmark, stress, and so on). v1 ships the benchmark type only, so the design needs a test model that later types plug into.

### Q5: What scores are compared against

**Question:** Your own past runs, or other people's published results?

**Recommendation:** Mainly your own saved runs, compared side by side. The disk tests copy CrystalDiskMark's profiles so the numbers can be compared online. No promise of matching Cinebench.

**Answer:**
> agree with recommendation

**Outcome:** As recommended.

### Q6: What's wrong with HWiNFO's UI

**Question:** Is it the flat list of hundreds of sensors, numbers without graphs, and no sense of what matters, or something else?

**Recommendation:** A curated dashboard: one card per component showing 3–5 key readings with sparklines, a drill-down to the full sensor list, and pinning.

**Answer:**
> exactly, you can get lost very easily, feels like you need to read too much to find what you need. tbh seems a "college" project (even though I know it's complex and can do a lot, just talking about taste and feeling). I'd like to show it more nicely in a modern UI, and on v2 we could even let the user customize de dashboard so they see what they want at first.

**Outcome:** A modern, curated dashboard (cards with key readings and sparklines, plus a drill-down). Dashboard customization comes in v2. (Follow-up Q6b: does pinning count as customization?)

### Q7: App form

**Question:** A terminal UI like btop, a native desktop window, or a local web UI?

**Recommendation:** A desktop window. The stack is chosen after the toolchain check.

**Answer:**
> agree with recommendation

**Outcome:** A desktop window app.

### Q8: Where the plan lives

**Question:** A new project folder, or this wiki?

**Recommendation:** A new project folder, with the grill notes in its `docs/`.

**Answer:**
> yeah I would plan on a new project which I still need to define the name! For now if you're going to persist that, you can just do it here under `specs` and we can move it when we decide the name and create the project folder

**Outcome:** The notes live in `second_brain/specs/pc-bench-monitor/` for now. They move into the new project's repo once it has a name.

## Round 2

### Q6b: Is pinning part of v2's customization?

**Recommendation:** Yes. v1 has a fixed curated dashboard plus a drill-down to the full sensor list. Pinning, reordering and hiding cards all come in v2.

**Answer:**
> yes

**Outcome:** As recommended.

### Q9: What the elevated helper is built from (follow-up to Q2)

**Question:** In Q2 I described the helper as "a few hundred lines you wrote and read." That only holds if we write our own sensor code. The options: (a) reuse LibreHardwareMonitorLib, pinned, built from source, with its automatic driver install turned off; or (b) write our own code on PawnIO modules, which covers only the hardware we write for.

**Recommendation:** (a). Publishing for other people's PCs needs LHM's hardware coverage. The trust boundary becomes "well-known open-source code at a version I pinned, through PawnIO."

**Answer:**
> yes (a) looks the right option

**Outcome:** The helper uses LHM, pinned and built from source, with its driver auto-install turned off.

### Q10: Who installs the driver

**Recommendation:** The app never installs a driver on its own. It detects PawnIO, explains what's lost without it, links to PawnIO's official setup, and runs in a reduced mode in the meantime. Later, the installer can offer PawnIO as a labeled optional step.

**Answer:**
> agree

**Outcome:** As recommended.

### Q11: How the helper starts

**Question:** (a) on demand, with one UAC prompt, running only while the app is open; or (b) a Windows service running as SYSTEM.

**Recommendation:** (a) for v1. Decide again when we build the installer.

**Answer:**
> (a)

**Outcome:** The helper starts on demand. Nothing elevated runs while the app is closed.

### Q12: Is the helper read-only, permanently?

**Recommendation:** Yes. No fan control, no tuning, no writes to CPU registers. It's reachable only through a named pipe that only the current user can open.

**Answer:**
> yes

**Outcome:** As recommended. Any control feature would be a separate product decision with its own helper.

### Q13: Stack

**Question:** (a) .NET 10 host + React/TS UI in WebView2; (b) WinUI 3 / Avalonia; (c) Tauri (Rust), plus a .NET helper for LHM; (d) Electron.

**Recommendation:** (a).

**Answer:**
> hmmm I was thinking of maybe exploring RUST, but LHM being a .NET library would make (a) a good option. how big of a lift is running that .NET helper for LHM?

**Outcome:** Open. The owner leans toward Rust, and Q14's answer (cross-platform in the long term) bears on this. See Q13b.

### Q14: Windows only?

**Recommendation:** Windows 11 x64 only, permanently, with no cross-platform abstractions.

**Answer:**
> v1 and v2 yes, but long-term I'm planning on it being cross-platform

**Outcome:** Windows only for v1 and v2. **The answer differs from the recommendation:** in the long term the app should be cross-platform. That rules out "no abstractions." See Q14b.

### Q15: CPU benchmark for v1

**Recommendation:** (a) bundle 7-Zip's built-in benchmark (`7z b`, LGPL).

**Answer:**
> (a)

**Outcome:** As recommended. Our own workloads come later as further test types.

### Q16: GPU benchmark for v1

**Recommendation:** A D3D12 compute-shader test (FP32 throughput + VRAM bandwidth). No 3D-scene benchmark. memtest_vulkan is a candidate for the v2 VRAM stability test.

**Answer:**
> agree with recommendation

**Outcome:** As recommended.

### Q17: Memory and disk tests for v1

**Recommendation:** Memory: a STREAM-style bandwidth test plus a pointer-chasing latency test. Disk: DiskSpd running CrystalDiskMark's four default profiles, a 1 GiB test file on a drive the user picks that's deleted afterwards, and a note about the SSD writes.

**Answer:**
> yes

**Outcome:** As recommended. Q13b changes the memory test's language: C++ if the stack is .NET, Rust if it's Tauri.

### Q18: Run conditions and sensor capture

**Recommendation:** Every run saves a sensor trace with its result. A pre-run check for background load warns but doesn't block.

**Answer:**
> yes

**Outcome:** As recommended.

### Q19: What's stored, and where

**Recommendation:** Saved runs go in SQLite in `%LOCALAPPDATA%`. The live history is the last ~10 minutes, in memory. No continuous logging in v1; CSV logging can come in v2.

**Answer:**
> agree with all

**Outcome:** As recommended.

### Q20: License

**Recommendation:** MIT.

**Answer:**
> agree

**Outcome:** MIT.

## Round 3

### Q13b: Stack, revisited

**Question:** The helper is a separate process regardless of stack (Q2, Q11): a .NET console app of ~300–500 lines that sends JSON over a named pipe only the current user can open. Its costs are two toolchains, a pipe message format to version, and ~30–70 MB of bundled .NET runtime; whether NativeAOT works with LHM is unverified. With Rust, the memory and D3D12 tests need no C++, and the host can run on other platforms. The choice: (a) a .NET 10 host + WebView2, or (c) Tauri (Rust + React/TS) + the .NET helper.

**Recommendation:** (c). The Q14 answer reversed my earlier pick of (a).

**Answer:**
> yea let's go with Tauri + .NET helper

**Outcome:** A Tauri app (Rust core + React/TypeScript UI), with a .NET sensor helper wrapping LHM. The memory and GPU benchmarks are written in Rust, using the `windows` crate for D3D12.

### Q14b: Preparing for cross-platform now

**Recommendation:** Exactly two seams: (1) the sensor source, which is a helper speaking a versioned sensor schema; (2) test runners, each behind a "run, report progress, return a result" interface. No Linux builds or CI before v2 ships.

**Answer:**
> agree

**Outcome:** As recommended.

### Q21: Is the helper the only sensor source?

**Question:** (a) the same helper runs unprivileged and restarts elevated for full sensors; or (b) the Rust core reads unprivileged sensors and the helper adds only the admin ones.

**Recommendation:** (a): one sensor model, one code path.

**Answer:**
> (a)

**Outcome:** The helper is the only sensor source. It runs unprivileged by default (LHM in reduced mode), and "enable full sensors" restarts it elevated.

### Q22: Sampling rate

**Recommendation:** 1 s for the live dashboard. 250 ms during a benchmark run, only while the run is active.

**Answer:**
> agree

**Outcome:** As recommended.

### Q23: What each v1 dashboard card shows

**Recommendation:**
- **CPU:** package temperature, total load, average effective clock, package power, hottest core.
- **GPU:** temperature, load, VRAM used / total, power, core clock.
- **Memory:** used / total, configured speed, EXPO status if available.
- **Disk (one card per drive):** read/write throughput, temperature, SMART health %.
- **Motherboard:** fan speeds.
- Every card has sparklines, and clicking one opens the full sensor list.

**Answer:**
> that's a nice initial list

**Outcome:** As listed. The owner didn't ask for extras (Vcore, GPU hotspot); those are reachable through the full sensor list.

### Q24: Comparing benchmark runs

**Recommendation:** A Runs page. Selecting 2 or more runs shows one bar chart per test with the % difference, plus their sensor traces overlaid. Runs can be labeled ("before EXPO", "new driver").

**Answer:**
> agree

**Outcome:** As recommended.

## Round 4

### Q25: How 7-Zip and DiskSpd are shipped

**Recommendation:** (a) bundle pinned versions with SHA-256 checksums kept in the repo and checked before each run, plus their license files.

**Answer:**
> agree

**Outcome:** As recommended.

### Q26: One-click "Run all" suite

**Recommendation:** "Run all" is the main action: CPU, then memory, then GPU, then disk, saved as one labeled run, aiming for ~5 minutes. Each test can also be run on its own.

**Answer:**
> agree

**Outcome:** As recommended. The ~5-minute target gets checked in the spike.

### Q27: Network access and telemetry

**Recommendation:** v1 makes no network connections: no telemetry, no update checks, no crash reporting, no online score lookup. An optional, labeled update check may come with the installer.

**Answer:**
> agree

**Outcome:** As recommended.

### Q28: Who writes the Rust

**Question:** (a) Claude implements and walks the owner through it; (b) the owner writes it with coaching; (c) a mix.

**Recommendation:** (c).

**Answer:**
> actually option (a), I can just go and review the code as you write it and ask you questions

**Outcome:** (a). Claude implements; the owner reviews the code as it's written and asks questions.

### Q29: What happens after the grill

**Recommendation:** First a spike on the owner's PC: LHM + PawnIO on the 9900X and the B850 fan chip; which readings survive without admin, including NVMe SMART; NativeAOT for the helper; a hello-world Tauri app reading the pipe; run times for 7-Zip and DiskSpd. Then requirements, techspec and tasks.

**Answer:**
> the spike

**Outcome:** The spike comes first.

### Q30: Design the UI before building it?

**Recommendation:** After the techspec, mockups of the dashboard, the drill-down and the Runs comparison, published for review before any UI code.

**Answer:**
> once we're done with the final reqs after the spike I'll do a claude design round to get initial mockups to be considered when designing the techspec

**Outcome:** The order changes: spike → requirements → **the owner's Claude Design round for mockups** → techspec (which takes the mockups into account) → tasks.

### Q31: Project name

**Recommendation:** Decide it when the real repo is created, after the spike.

**Answer:**
> after the spike

**Outcome:** As recommended. `pc-bench-monitor` stays the placeholder until then.

## Closing: shared understanding and spike setup

**Question:** With the frontier empty:
1. Is the summary in [session.md](session.md) a shared understanding?
2. Should the spike be throwaway code in `C:\Users\jimmy\projects\pc-bench-spike\`, with a local git repo only?
3. Installs: Claude installs Rust (`winget install Rustlang.Rustup`) and downloads 7-Zip and DiskSpd from official sources; the owner installs PawnIO and accepts the UAC prompts. Agreed?
4. Should `specs/pc-bench-monitor/` be committed to main?

**Answer:**
> 1. yes, 2. agree, 3. agree, and 4 agree too

**Outcome:** The shared understanding was confirmed and the spike started. The results are in [../spike-results.md](../spike-results.md), with the owner's decisions on the findings recorded there verbatim.

## After the spike: the name

The full discussion, with every candidate, the availability checks and the owner's verbatim replies, is in [../naming.md](../naming.md). The outcome: the project is named **Pophood**, and these notes moved from `second_brain/specs/pc-bench-monitor/` to `pophood/specs/v0.1.0/`.
