# Probe results: raising requirements confidence

- **Date:** 2026-10-20
- **Why:** after the adversarial review, [requirements.md](requirements.md) scored 78%. The owner wants 90% or more before moving on, so the open questions were turned into probes.
- **Machine:** the same as the [spike](spike-results.md): Ryzen 9 9900X, B850 EAGLE WIFI6E (ITE IT8696E), 2 × 16 GB DDR5-6000 (CMK32GX5M2B6000C38), RTX 5060 Ti 16 GB plus the Radeon iGPU, Kingston NV3 1 TB, Windows 11, PawnIO 2.2.0.
- **Code and raw output** (throwaway, outside the repo): `C:\Users\jimmy\pophood-probes\` (`probe-ids`, `probe-pipe`, `probe-bench`, `probe-diskspd`, `probe-net`, `probe-audit`).
- **Status:** P1–P6 are done. On 2026-10-21, OQ2 calibration passed (P4) and OQ1 passed across a reboot (P1). Nothing from the probes is still pending.

## Summary

| # | Question | Result | Settles |
|---|---|---|---|
| P1 | Are LHM sensor identifiers stable? | Stable across restarts, unprivileged and elevated, and between the two modes (163 of 163 shared ids identical). **One identifier is duplicated**: `/gpu-nvidia/0/load/3`. **Also stable across a real reboot** (2026-10-21), with only the known duplicate in 6 of 6 comparisons. | OQ1 |
| P2 | Can the pipe carry control messages, with both ends verifying each other? | Yes, tested unprivileged **and elevated**. 9 of 9 elevated checks passed. Fuzzing found a real crash, now fixed. | The control-path precedent; RF4, RF9, RF31 |
| P3 | Memory and GPU benchmarks: feasible, and how long? | Both feasible. The GPU numbers reach ~97% of the published spec. Memory takes 5 s (quick) or 20 s (full); the GPU test about 1.5 s. | OQ3, OQ7 |
| P4 | Can DiskSpd be built from source and match CDM's arguments? | Yes. The build can be made reproducible. **Calibration passed:** all 8 results are within ±5% of CDM 9.0.3, using the default flags. The worst is −3.89%, SEQ1M Q1T1 read. | OQ2; RF14 |
| P5 | Network traffic from WebView2 | Under defaults, WebView2 contacts Microsoft (an experimentation/config service, the component updater, WPAD, `substrate.office.com`). With 3 flags, set the way production would set them, **only `substrate.office.com` remains**. | Most of OQ5 |
| P6 | LHM dependencies, write paths, and what elevation without PawnIO gives | No driver install, service, or process-launch code. LHM performs **automatic writes** beyond bank select. Without PawnIO, elevation adds only storage. | OQ10, OQ9, RF1 |

## P1: Sensor identifiers (OQ1)

**Method:**
- A copy of the spike's SensorProbe, built with NativeAOT, dumps every hardware and sensor `Identifier`, name, type, index and value (null vs 0).
- Toggles are as in the spike, but with `IsControllerEnabled=false`.
- `diff-ids.ps1` compares two dumps.
- Code: `probe-ids\`.

**Results** (same boot, 2026-10-15 20:54):

| Comparison | Result |
|---|---|
| unprivileged run 1 vs run 2 | 164 sensors and 163 unique ids each. Everything identical: no adds, removes, renames, or index changes. |
| elevated run 1 vs run 2 | 258 sensors each, identical |
| unprivileged vs elevated | All 163 shared ids are identical. Elevation adds 94 sensors: 4 CPU temperatures (CCDs), 1 clock, the ITE fan chip (26), 2 DIMMs (42), and the NVMe drive (21). 24 per-core clock and factor values go from null to a value. |
| after a reboot, unprivileged (`ids-unpriv-1` vs `ids-unpriv-reboot`) | 164 sensors, 163 shared ids, all identical: no adds, removes, renames, type or index changes, and no null↔value flips |
| after a reboot, elevated (`ids-elev-1` vs `ids-elev-reboot`) | 258 sensors, 257 shared ids, all identical |
| unprivileged vs elevated, after the reboot | All 163 shared ids are identical. The same 94 elevated-only sensors, 4 added hardware entries and 24 null→value per-core clock and factor values appear as before the reboot. |

**Reboot run (2026-10-21):**
- Start → Power → Restart, so Fast Startup was bypassed.
- The boot time moved from 2026-10-15 20:54:10 to 2026-10-21 06:56:53 −03:00, a delta of 468,163 s, which confirms a new boot session.
- Run with `after-reboot.ps1`, then `compare-all.ps1`. Dumps: `probe-ids\ids-{unpriv,elev}-reboot.json`.
- Unprivileged: LHM `Open` took 392 ms and the first update 88 ms. No sensors or hardware were created lazily.
- Elevated: the 20 IT8696E fan, temperature and voltage sensors are created lazily during the first `Update()`, as in the earlier runs. Their ids came out identical.
- **All 6 comparisons gave "duplicate ids only."** Re-running `compare-all.ps1` reproduces the full report from the saved dumps.

**Findings:**
- **The duplicate:** `/gpu-nvidia/0/load/3` is both "GPU Bus" and "GPU Memory". LHM assigns the bus index from the NVAPI domain (`NvidiaGpu.cs:262`; `NvApi.cs:201` gives `BusInterface = 3`) and hardcodes 3 for memory (`NvidiaGpu.cs:450`). The identifier alone can't key renames; LHM's own rename store has the same flaw (`Sensor.cs:63`).
- **Unprivileged zeros:** the CPU reports `Core (Tctl/Tdie)` = 0 and `Package` = 0 W, not null (`Amd17Cpu.cs:190,306`). Per-core clocks and factors are null.
- **Parts of identifiers that depend on order** (from LHM 0.9.6 code; can move with LHM upgrades, driver updates or hardware changes):
  - Ryzen sensor counters (`Amd17Cpu.cs:30,132-141`), including the SMU PM table if a newer LHM learns Zen 5 (`RyzenSMU.cs:104,217-227`);
  - lazily created CCD temperatures (`Amd17Cpu.cs:312-357`);
  - NVIDIA load and power indexes, and the D3D engine numbering (`NvidiaGpu.cs:320,420,432`);
  - the storage drive number (`StorageGroup.cs:72-79`);
  - DIMM detection, which retries for up to ~10 s (`MemoryGroup.cs:47-49,125-140`).

## P2: Duplex pipe with mutual verification (control path; RF4, RF9, RF31)

**Method:** a .NET NativeAOT probe helper and a Rust (tokio + windows) client, plus attack scripts (a fake server, a foreign client, a late squatter, and 22 fuzz cases). Code: `probe-pipe\`.

**Results (unprivileged):**
- **Sampling period can change at runtime.** The helper acks within 0.2–1.3 ms.
- **Deadline scheduling holds the period:**
  - at 1000 ms, the mean is 1000.2 ms with max jitter 29 ms;
  - at 250 ms, the mean is 250.5 ms with max jitter 14 ms;
  - drift doesn't accumulate.
  - The spike's `Task.Delay`-after-update loop measured 1099 ms and 349 ms (+1.98 s of drift over 20 samples).
- **The client rejects a squatting server**, by checking the server process's image path (`GetNamedPipeServerProcessId`). The real helper refuses to start on a name that's already taken (`FirstPipeInstance`). A late squatter can't add a pipe instance.
- **The helper rejects a foreign client** (`GetNamedPipeClientProcessId` plus the image path) before reading anything.
- **All 22 malformed messages were rejected.** The fuzz run first **crashed the helper**: invalid UTF-8 inside a JSON string passes `JsonDocument.Parse` but throws from `GetString()`. Fix: an upfront UTF-8 check plus a catch-all handler. An escaped lone surrogate (`"\ud800"`) still needs the catch-all.
- **The helper exits 30 s after start if no client connects.**

**Results (elevated, run by the owner with a UAC prompt; all pass):**
- E2: a medium-integrity process can open the elevated helper with `QUERY_LIMITED_INFORMATION` and read its image path. `QUERY_INFORMATION` and `VM_READ` are denied; **`TERMINATE` is allowed**.
- E4: the client verifies the elevated server.
- E5: the helper reports `elevated=True` and integrity High.
- E6: the elevated helper rejects a foreign client.
- E7: the medium client can write to the elevated pipe, with acks at about 0.2 ms.
- E8: the helper exits when the client disconnects.
- E9: the helper writes no files.
- Timing while elevated: 1000 ms mean 1001.4 (max jitter 12.2); 250 ms mean 250.8 (max jitter 11.7).
- OQ12 data point: the user SID and logon SID are the same across elevation for this admin user.

**Consequences:**
- Because the app can terminate the elevated helper, it can kill the helper on exit. Any same-user process can too, which only causes a denial of service.
- The UI should use the frame's own timestamp: client-side receive jitter is up to ~50 ms.

## P3: Memory and GPU benchmarks (OQ3, OQ7)

Code: `probe-bench\` (`mem.rs` 304 lines; `gpu.rs` 221 lines; `bench.hlsl` 50 lines; dxc runs at build time).

**Memory** (3 × 512 MiB arrays, 8× the L3; best of iterations 2–10; validated; 4 KB pages):
- **All 24 threads:** Read 76, Copy 70, Scale 45, Add 50, Triad 51, Write 36 GB/s. Across runs: Read 69–79, Triad 47–51.
- **One CCD:** Read 62 GB/s and Write 29 GB/s. This is the Infinity Fabric per-CCD limit, assuming FCLK 2000 MHz (not read from the machine).
- **Latency (pointer chase):** 0.9 ns at 16 KiB, 14 ns at 16 MiB, 62 ns at 32 MiB, 95 ns at 1 GiB (range 90–113). The 1 GiB figure includes TLB and page-walk cost.
- **Copy is anomalous:** `copy_from_slice` likely uses non-temporal stores, so Copy is not STREAM-conformant. Use a plain loop, or label it (RF16).
- **Pitfalls found:**
  - Without `black_box`, the compiler deletes the loops (0 ns, 629 GB/s).
  - Timing from thread 0 gave 661 GB/s when that thread was descheduled. Fix: timestamp from the last thread to arrive at the barrier.
- **Run time:** quick (all-thread STREAM plus 1 GiB latency) **2.8–3.8 s**; full (6 thread configs plus a 9-size latency ladder) **16.4–18.7 s**.

**GPU** (D3D12 compute, `windows` 0.62.2, adapters chosen with `EnumAdapterByGpuPreference`):
- **RTX 5060 Ti:** FP32 FMA **25.26 TFLOPS**, against a 25.85 peak at the observed 2805 MHz, so 97.7%. Read **434 GB/s**, against a 448 spec, so 97%. Write 390 GB/s. Copy 387 GB/s, validated.
- **Radeon iGPU:** 0.56 TFLOPS, 36–43 GB/s. It works with no code changes, so the adapter picker is feasible.
- **Run time:** about 1–1.5 s in-process for the dGPU, 1.2 s for the iGPU. Over 10 s the results were identical and there was no throttling.
- **windows-rs friction:** the `windows` crate is inconsistent about out-params vs return values, and needs `ManuallyDrop` in a few descriptors. Embedding the root signature in the HLSL and using root UAVs avoids most of the boilerplate.
- **Not checked:** resource-state promotion was never validated, because the D3D12 debug layer (Graphics Tools optional feature) isn't installed.

## P4: DiskSpd built from source (OQ2, RF14)

Code: `probe-diskspd\` (`build.ps1`, `repro.props`, `calibrate.ps1`).

**Build:**
- Source: tag `v2.3`, commit `5e7025bfc9d1364f185d4c30963d7ac79195435e`.
- Built with MSVC v143 (Build Tools 2022) and SDK 10.0.26100. The tag targets VS 2026 (`v145`), so the toolset was overridden.
- **Needs ATL.** `XmlProfileParser.cpp` needs `atlbase.h` and `atls.lib`, so add the `Microsoft.VisualStudio.Component.VC.ATL` component to Build Tools.
- **Links the C runtime dynamically (`/MD`).** The exe needs `MSVCP140.dll` and `VCRUNTIME140*.dll`. Either ship those or build with `/MT`.

**Reproducibility:**
- Rebuilding at the same path gives an identical exe hash.
- A different path gives a different hash, because the PDB and source paths are embedded.
- With `/experimental:deterministic /pathmap:… /PDBALTPATH:%_PDB%` (`repro.props`), the hash is **identical across folders** (`71760F09…CEFF`).
- PDBs are never identical, so hash the exe only.

**2.3 vs CDM's fork:** CDM 9.0.3 ships a forked DiskSpd 2.2.0. 2.3 changed two defaults, and `-aup -bsn` restore 2.2 behaviour (confirmed with `-Rp`).

**`calibrate.ps1`** mirrors CDM 9.0.3:
- the test file is created the CDM way;
- the arguments match CDM, minus the fork-only `-A`;
- read tests run before write tests;
- warm-up plus N passes, keeping the best pass;
- a 5 s interval between tests;
- MB/s in decimal;
- the file is cleaned up in a `finally` block, with a sweep for files left by crashed runs;
- writes need `-AllowWrites`.

**Smoke test (reads only, 1 pass, 2 s):**

| Profile | MB/s |
|---|---:|
| SEQ1M Q8T1 | 5,890 |
| SEQ1M Q1T1 | 3,067 |
| RND4K Q32T1 | 771 |
| RND4K Q1T1 | 26 (low; no warm-up right after the file fill) |

Parsing and cleanup work.

**Write volume:** about 58.4 GB per pass, so a full run is about **234 GB**. The run the owner approved (warm-up plus 1 pass) is about 117 GB per tool.

**Calibration: passed (2026-10-21).** All 8 results are within ±5% of CDM, using the default flags, so no flag iteration was needed.

**CDM baseline (2026-10-21 06:39):**
- Settings: CrystalDiskMark 9.0.3 x64, profile Default, 1 GiB ×1, drive C: (31% full, 259/832 GiB), Admin mode, measure 5 s and interval 5 s. Random fill: the output has no 0x00-fill marker, so `-TestData Random` (the default) applies.
- The raw output is saved at `probe-diskspd\results\cdm-20261021-063936.txt`.
- The ±5% band (answer #25) applies to MB/s.

| Profile | Read MB/s | ±5% band | Write MB/s | ±5% band |
|---|---:|---|---:|---|
| SEQ1M Q8T1 | 6,168.711 | 5,860.3–6,477.1 | 5,517.909 | 5,242.0–5,793.8 |
| SEQ1M Q1T1 | 3,521.344 | 3,345.3–3,697.4 | 5,274.556 | 5,010.8–5,538.3 |
| RND4K Q32T1 | 784.488 | 745.3–823.7 | 557.563 | 529.7–585.4 |
| RND4K Q1T1 | 67.808 | 64.4–71.2 | 263.253 | 250.1–276.4 |

**Our run (2026-10-21 06:42–06:44 local):**
- Command: `calibrate.ps1 -Mode All -AllowWrites -Passes 1`, which means 1 warm-up plus 1 scored pass (answer #27).
- Machine otherwise idle.
- DiskSpd 2.3.0, sha256 `71760F09…CEFF`, the reproducible build.
- Output: `probe-diskspd\results\20261021-064220\` (`results.md`, `results.json`, `raw\`).
- Tests wrote 118.6 GB, plus the 1.07 GB file fill. Cleanup succeeded.

| Profile | Kind | CDM MB/s | Ours MB/s | Δ |
|---|---|---:|---:|---:|
| SEQ1M Q8T1 | read | 6,168.711 | 6,273.567 | +1.70% |
| SEQ1M Q1T1 | read | 3,521.344 | 3,384.258 | **−3.89%** |
| RND4K Q32T1 | read | 784.488 | 755.887 | −3.65% |
| RND4K Q1T1 | read | 67.808 | 69.227 | +2.09% |
| SEQ1M Q8T1 | write | 5,517.909 | 5,649.958 | +2.39% |
| SEQ1M Q1T1 | write | 5,274.556 | 5,382.812 | +2.05% |
| RND4K Q32T1 | write | 557.563 | 556.720 | −0.15% |
| RND4K Q1T1 | write | 263.253 | 261.420 | −0.70% |

**Final arguments**, with no flag iteration needed:
- Reads: `-b<K>K -o<Q> -t1 -W0 -S -w0 [-r] -ag -aup -bsn -d5 -L <file>`.
- Writes: the same, with `-w100 -Z<K>K` in place of `-w0`.
- `-si` only applies when threads > 1, and none of the 4 defaults use more than 1 thread.

**Caveats:**
- Each tool ran a single scored pass (n = 1), so run-to-run noise hasn't been measured. The tightest margin is SEQ1M Q1T1 read, 1.1 points inside the band.
- In our run, RND4K Q32T1 read dropped 1.8% from the warm-up (769.6) to the scored pass (755.9). The warm-up alone would have been −1.9%. The product keeps the best of 3 passes, as CDM does, which narrows this kind of spread.
- Latency is informational and outside the ±5% bar. Values agree within about 1–5 µs, except RND4K Q32T1 read, at 102 µs vs CDM's 81.35 µs; our warm-up measured 82 µs.
- The cool-down was about 3 minutes, not 5, if CDM's timestamp marks the start of its run. Our write numbers came out slightly above CDM's, so there's no sign that the SLC cache was depleted.

## P5: Network traffic from WebView2 (OQ5, RF29)

Code and captures: `probe-net\`. The probe app was a Tauri 2.12.4 release build with a strict CSP, no plugins and no helper, running on WebView2 155.0.4283.62.

| Run | Setup | Non-loopback traffic from the app's process tree |
|---|---|---|
| 1–2 (unprivileged polling and net-log) | Defaults (wry adds only `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`) | `config.edge.skype.com` (Edge experimentation/config, over TCP and QUIC, at start-up); `edge.microsoft.com/componentupdater` (from t=60 s, repeating); WPAD; DNS straight to the router; once, `52.97.11.82` from the **browser process** |
| 3 (unprivileged, flags set by environment variable) | `--disable-background-networking --disable-component-update --no-proxy-server` | None visible. Unprivileged observation can't see UDP peers or browser-process sockets, though. |
| 4 (**elevated** pktmon + Kernel-Network/DNS ETW) | The flags did **not** apply, because the app was launched elevated and WebView2 ignored the environment variable | Same as defaults, plus a clear attribution: the browser process resolves `substrate.office.com` → `outlook.cloud.microsoft` → 52.97.x:443 |
| 5 (**elevated capture, app unelevated**, flags in `tauri.conf.json` `additionalBrowserArgs`) | The production configuration | **Only one flow:** the browser process (`--embedded-browser-webview=1`) → `substrate.office.com` → 52.97.11.82:443, from t≈9 s to t≈2 min. The net-log shows only `tauri.localhost`, so this flow bypasses Chromium's network stack. |

**Findings:**
- **Setting `additionalBrowserArgs` replaces wry's default arguments** (`wry-0.57.0 src/webview2/mod.rs:300-333`). The production value must therefore re-add the defaults: `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-background-networking --disable-component-update --no-proxy-server`. Run 5 verified this value.
- **Residual traffic:** the `substrate.office.com` flow (Microsoft 365) is probably an Edge identity or M365 integration tied to the work account signed in on this PC. That isn't verified, and no Chromium flag stops it. Owner decision #33: the techspec must find and disable the source and re-run this capture. If it can't be disabled, it comes back to the owner before v0.1.0 ships.
- **Crash dumps:** WebView2 uploads crash minidumps to Microsoft unless `IsCustomCrashReportingEnabled` is set. That is a WebView2 *environment option*, and wry doesn't expose it. Not exercised.
- **Runtime updates:** WebView2 Runtime updates go through the system EdgeUpdate service, which is outside Pophood's process tree.

## P6: LHM dependencies, write paths, and elevation without PawnIO (OQ10, RF1, OQ9)

Code and dumps: `probe-audit\`. Sources were read at LHM v0.9.6 (`3d331e3`) and at each package's nuspec commit. The DLLs were scanned with a metadata and IL tool, without loading or running them.

**OQ10: no driver install, service creation, or process launch** in DiskInfoToolkit 1.1.2, RAMSPDToolkit-NDD 1.4.2, BlackSharp.Core 1.0.7, HidSharp 2.6.4 or Mono.Posix 1.0.0, as LHM uses them.
- RAMSPDToolkit's WinRing0 path is compiled out of the NDD package (`#if !RELEASE_NDD`, `DriverManager.cs:16-21`). Defender removed `WinRing0x64.sys` from the source clone.
- Mono.Posix exposes `Stdlib.system`, but nothing calls it.
- Note: the `1.0.7` tag of BlackSharp.Core points to a different commit than its nuspec (c70b735).

**RF1: automatic writes** (no caller action needed, even with the default no-op settings):

| Write | Where | Toggle that gates it |
|---|---|---|
| NZXT GRID+ V3 sets fans to 40% at Open; Arctic sets fans to 30% at Close; Heatmaster sets its update rate | `GridV3.cs:87`, `ArcticFanController.cs:150-157`, `Heatmaster.cs:96` | `IsControllerEnabled` (off, answer #19) |
| Nuvoton NCT6683D/6686D/6687D: init writes in the constructor (voltage sensing) and the I/O-space lock cleared (never restored) | `Nct677X.cs:483-494,554-565,668,1281-1305`; `LpcIO.cs:475-479` | `IsMotherboardEnabled` |
| ATA SMART ENABLE when a SMART read fails; Realtek 9220DP NVMe-to-USB bridge mode switch (restored) | DiskInfoToolkit `DiskHandler.cs:601…873`, `:154/161` | `IsStorageEnabled` |
| WireViewPro2 probes every COM port with STM32 VID/PID 0483:5740 | `WireViewPro2.cs:80-88` | `IsPowerMonitorEnabled` |

**Other write surfaces:**
- **A persisting settings store re-applies saved fan values at Open** (`Control.cs:33-44`; SuperIO, NVIDIA, AMD, Kraken, Razer). With the default no-op settings (`Computer.cs:58-61`) nothing is written.
- **Public write surfaces for the mechanical check to target:**
  - `ISensor.Control` → `IControl.SetSoftware`/`SetDefault`;
  - `WireViewPro2.WriteConfig`/`NonVolatileMemoryCommand`/`ScreenCmd`/`ClearFaults`;
  - `PawnIo.IsaBridgeEc.WriteMmio`/`TrySetState`, `LpcAcpiEc.WritePort`, `LpcCrOSEc.EcCommand`;
  - RAMSPDToolkit `SMBusInterface.i2c_smbus_write_*`;
  - HidSharp `HidStream.Write`/`SetFeature`;
  - Mono.Posix `Stdlib.system`.
- **Read-path writes** (index or bank select, SPD page select, the SMU PM-table command, HID status requests) are listed with file:line in `probe-audit` and in the agent report.
- LHM never calls a PawnIO MSR or PCI write ioctl.

**OQ9: elevated without PawnIO.**
- LHM substitutes a null PawnIO handle that returns zero-filled buffers (`PawnIo.cs:67-76,98-120`). The PawnIO device allows only SYSTEM and Administrators (`PawnIO.inf.in:39`).
- So elevation without PawnIO adds **only storage**: SMART and NVMe through `\\.\PhysicalDriveN`, which needs admin.
- Everything that needs PawnIO either disappears (SuperIO, SPD, SMU) or reports **fake values**: AMD 0 °C / 0 W / 1.55 V VID; Intel package power 0 W; ACPI EC readings 0.
- This conclusion comes from code reading only (owner answer #28).

## Owner decisions taken during the probes (verbatim option labels)

| # | Question | Answer |
|---|---|---|
| 23 | OQ6: serial numbers in exports | "Strip by default" |
| 24 | OQ4: source for the OC-profile check | "Full sensors only, from SPD" |
| 25 | OQ2: tolerance | "±5%" |
| 26 | OQ11/OQ12 | "Out of v0.1.0" |
| 27 | Calibration write volume | "Reduced: 1 pass each". Corrected afterwards: CDM always adds a warm-up, so about 117 GB per tool. |
| 28 | OQ9 method | "Code reading only" |
| 29 | LHM's automatic monitoring writes | "Allow-list them" |
| 30 | `IsPowerMonitorEnabled` | "On" |
| 31 | Memory test in "Run all" | "Quick in Run all, full alone" |
| 32 | Run-time budgets | "Mem ≤30 s, GPU ≤10 s, Run all ≤5 min" |
| 33 | Residual `substrate.office.com` traffic | "Research in techspec, gate v0.1.0" |
