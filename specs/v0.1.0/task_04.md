# Task 04 - Helper sensors: reader, RF3 availability, deadline sampler

## Description

Make the helper produce frames: the LHM `Computer` with the fixed toggles, the recursive update-and-snapshot walk (with `ValuesTimeWindow = Zero` and SMBIOS memory facts), the RF3 availability classification with the PawnIO device check, the deadline maths, and the sampler thread with its per-tick exception policy and `set_period` handling. After this task the helper is functionally complete, and the owner runs its first elevated AOT smoke test (C10, ADR 0002).

- Status: Completed (2026-10-21); owner-run elevated AOT smoke passed on the final helper (T13 build)
- Complexity: M
- Estimated time: 5–7h (including the owner's elevated smoke, about 15 min)
- Depends on: T3
- Can run in parallel with: T2, T7, T8, T11

## AI guidance

- `implement-task`: runs this task.
- Session skill drafts `sessions/20261020214713_pophood-define-reqs-confidence/skills/lhm-write-path-audit.md` (toggles and the allow-list) and `sessions/20261021071727_pophood-oq1-oq2-closeout/skills/sensor-id-stability-check.md`.
- Requirements C10 and ADR 0002 (`sessions/20261020135705_pophood-grill-spike-naming/decisions/0002-stack-tauri-with-dotnet-aot-helper.md`): every helper change needs an AOT smoke test of the elevated paths.
- ADRs `0004-helper-never-changes-hardware-state.md`, `0008-sensor-label-key-basis.md`.
- LHM facts (until T11 writes `AGENTS.md`): `sessions/20261021102214_pophood-v010-techspec/long_term_memory.md` items 6–9 — every LHM call on the sampler thread (`ThreadAffinity.Set` needs a dedicated OS thread), no `Computer.Update()`, `ValuesTimeWindow = Zero` on every sensor including late ones.

## Requirements

- `CreateComputer()`: default constructor, exactly `IsCpuEnabled`, `IsGpuEnabled`, `IsMemoryEnabled`, `IsMotherboardEnabled`, `IsStorageEnabled`, `IsPowerMonitorEnabled` = true in an object initializer; all other toggles left false (#19, #30).
- `pawnIoUsable = elevated && PawnIo.IsInstalled && PawnIoDevicePresent()`, evaluated once before `Open`; `PawnIoDevicePresent` is called only when elevated (access 0, `OPEN_EXISTING`, closed at once). `hello.pawnIo.loaded` = `PawnIoDevicePresent()` when elevated, `null` otherwise (techspec § Hello).
- Classification per techspec § Availability classification (RF3); the helper writes `null`, never a fake value.
- `Frame.t` = the tick's start (Unix ms); first frame right after `Open`; then on a deadline schedule that steps from the previous deadline, never from the wake time.
- `set_period` → `next = max(lastTick + p, now)`, the event is signalled, `ack` sent.
- Per-tick policy: an exception from `UpdateAndSnapshot` skips the frame; 5 in a row → `error{lhm_failed, detail: type}` and exit 70. `Open` throwing → same.
- Memory facts from `computer.SMBios.MemoryDevices ?? []`, skipping `Size` 0, `0xFFFF` or bit 15 set; `sizeGB = Size / 1024`; `ConfiguredSpeed` 0 → `null`; no serial numbers.
- Shutdown: the sampler calls `computer.Close()` on EOF/`IOException`, then exit 0.

## Files involved

| Path | Action |
|---|---|
| `helper/SensorReader.cs` | Create |
| `helper/Availability.cs` | Create |
| `helper/Deadline.cs` | Create |
| `helper/Program.cs` | Modify (created in T1, rewritten in T3; adds the sampler thread, `set_period` wiring, `pawnIo.loaded`) |
| `helper.Tests/AvailabilityTests.cs`, `DeadlineTests.cs`, `SensorReaderTests.cs` | Create |

## Implementation steps

1. `Deadline.cs` per techspec § Implementation map (`Deadline.cs` row) and § Patterns reused (deadline loop): `Next` and `AfterPeriodChange`, pure.
2. `Availability.cs` per the techspec row and the RF3 table; `PawnIoDevicePresent` opens `\\?\GLOBALROOT\Device\PawnIO` through `Native.CreateFileW` (from T3).
3. `SensorReader.cs` per the techspec row: `CreateComputer`, constructor calling `Open()`, `UpdateAndSnapshot` (take `computer.Hardware` once per tick, recursive `Update()` then collect, cached `Identifier.ToString()`, `ValuesTimeWindow` reset, `memory` from SMBIOS). Precedents: spike `SensorProbe/Program.cs → UpdateVisitor (≈:49-59)`, LHM `Hardware/SMBios.cs → MemoryDevice`.
4. `Program.cs`: the sampler thread per the techspec `Program.cs` row ("Sampler thread", "Per-tick exception policy", "Shutdown"), using an `AutoResetEvent` instead of P2's `Task.Delay` race, and the same `writeGate` as the read loop. Wire `set_period` from the read loop to the sampler.
5. Write UT-04, UT-05, UT-33, UT-36. UT-33 constructs the `Computer` and reads the toggles; it never calls `Open`.
6. Re-run `scripts/build-helper.ps1`.
7. Write the small pwsh client for the manual runs below as a session-folder script (not in the repo): it launches the published helper with a fresh `--pipe pophood-<32 hex>` and `--client` = its own `(Get-Process -Id $PID).Path`, connects with `NamedPipeClientStream`, prints `hello` and a summary of N frames (sensor count, hardware ids, non-null counts per hardware item, `t` deltas), then disconnects. T14 reuses it.
8. **Elevated AOT smoke (owner-run, C10):** the agent prepares the command; the owner runs the same client from an elevated pwsh (the helper inherits the elevation, and PawnIO 2.2.0 is installed). The agent records the output.

## Acceptance Criteria

- `dotnet test helper.Tests` passes UT-01…UT-06, UT-33 and UT-36 (test output).
- `scripts/build-helper.ps1` succeeds; RS0030 stays clean (setting `IsControllerEnabled` or `IsPsuEnabled` anywhere in `helper/` would fail it).
- `helper/SensorReader.cs`'s object initializer sets exactly the six toggles (file contents), and UT-33 reads all ten toggle values from a constructed `Computer`.
- A manual run of the published helper, with a small pwsh client that launches it with `--client` = the pwsh path, receives `hello` and then frames about 1000 ms apart, each with `"v":1` first and `null` for every unprivileged `Cpu` sensor except Load (command output). T5's IT-01…IT-04 and IT-11 automate this.
- In that unprivileged run, `/gpu-nvidia/0` and `/gpu-amd/0` are present with non-null sensors (command output). Both appear unprivileged in the P1 dump `ids-unpriv-1.json`, so this is the first check that `nvapi64.dll` and `atiadlxx.dll` still load under `SetDefaultDllDirectories(System32)`. If either is missing, stop and report to the owner: the fallback (preload `%SystemRoot%\System32\<dll>` by full path) is a design change.
- **Elevated AOT smoke (owner-run):** `hello` has `elevated: true` and `pawnIo.loaded: true`. The frames include `/lpc/it8696e/0`, `/memory/dimm/*` and `/nvme/0`; CPU temperature, both GPUs and SuperIO fans have non-null values; the sensor count is 258 on this PC. No console window appears, and the helper exits 0 within 5 s of the client disconnecting (`$LASTEXITCODE`, the agent's record of the owner's output). Any later helper change re-runs this smoke (tasks.md regression rule).
- The publish's AOT/trim warning count is no higher than T1's, or every new warning is listed with its LHM source (build log).

## Testing

- **UT-04** availability table and `pawnIoUsable` truth table, including `GpuIntel` `Power` and `(true, true, false)` → false.
- **UT-05** deadline maths: missed ticks skipped, phase kept, 100 late-by-15 ms wakes still on multiples of 1000, `AfterPeriodChange`.
- **UT-33** `CreateComputer` toggles (6 true; Controller, Network, Psu, Battery false). The test project isn't analysed by BannedApiAnalyzers, so it may read the banned properties.
- **UT-36** a real `Computer { IsMemoryEnabled = true }` (unprivileged, `/ram` only) through `SensorReader`, 20 updates: every sensor `ValuesTimeWindow == Zero`, `Values` empty.
- Real-frame checks (IT-01 hello and first frame, IT-02 RF3 in a live frame, IT-03/IT-04 cadence and `set_period`, IT-11 memory facts vs WMI) are in **Task 05**. The elevated smoke above is the first elevated run; the sign-off checks of elevated behaviour through the app (E2E-02, and E2E-14 with PawnIO uninstalled) are in **Task 14**.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Availability classification (RF3), § Fixed source parameters (LHM `Computer`, Timing), § Patterns reused (LHM rows: `ValuesTimeWindow`, SMBIOS, PawnIO zero buffers, LHM threads, vendor DLLs)
- LHM at `third_party/LibreHardwareMonitor`: `Hardware/Computer.cs`, `Hardware/Sensor.cs`, `Hardware/SMBios.cs`, `PawnIo/PawnIo.cs`, `Hardware/Memory/MemoryGroup.cs`
- `C:\Users\jimmy\projects\pc-bench-spike\helper\SensorProbe\Program.cs`, `helper\SensorHelper\Program.cs`
- `C:\Users\jimmy\pophood-probes\probe-pipe\helper\Program.cs → SampleLoop (≈:168-208)`

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 88% → done 90% for the code; the elevated half of the AC is **not run** (needs the owner at the UAC prompt), so the elevated claims stay at the plan level. Remaining uncertainty: elevated AOT behaviour (SuperIO/DIMM/NVMe under PawnIO, 258 sensors), the `lhm_failed` exit-70 path (no automated test), and `Close()` time at exit.
- **Evidence (unprivileged):**
  - `dotnet test helper.Tests -r win-x64`: 66 passed (adds UT-04 ×~25 cases, UT-05, UT-33, UT-36 and three snapshot tests).
  - `scripts/build-helper.ps1` exit 0; 14 unique IL2xxx/IL3xxx warning lines = T1's 14 (no new warnings). New sidecar SHA-256 `2f0b5790…02bfd`.
  - `sessions/20261021133000_pophood-v010-implementation/helper-smoke.ps1` against the published exe: `hello` (`elevated:false`, `pawnIo.installed:true`, `loaded:null`); first frame 454 ms after hello; 12 frames, `t` deltas 1013, 995, 998, 999, 999, 1000, 998, 1013, 999, 1001, 986 (mean 1000.1 ms); 164 sensors, 6 hardware items; `/amdcpu/0` has 26 non-null of 90 sensors and **0 non-null non-Load sensors**; `/gpu-nvidia/0` 38/38 and `/gpu-amd/0` 30/30 non-null, so `nvapi64.dll` and `atiadlxx.dll` do load under `SetDefaultDllDirectories(System32)`; memory = 2 × 16 GB DDR5 6000 MT/s; the helper exits 0 13 ms after the client drops.
- **Owner-run elevated AOT smoke (C10): PASS, 2026-10-21.** The owner ran it from an elevated pwsh on the **final** helper: T13's release build of commit `73fdb0f`, SHA-256 `11a0ed2b…`. Earlier helpers (`f1b85cd7…` from T12, `8059a695…` from T13 pass 1) were never smoke-tested elevated, and the techspec doesn't require them to be.
  - Command: `pwsh -NoProfile -File C:\Users\jimmy\projects\pophood\sessions\20261021133000_pophood-v010-implementation\helper-smoke.ps1 -Frames 12 -Exe C:\Users\jimmy\pophood-e2e\pophood\src-tauri\target\release\pophood-sensors.exe`
  - Output, verbatim:
    ```
    helper pid=47832 pipe=pophood-ca7c75f7eff07e2c94da8e37d3ebf29b
    hello: {"v":1,"type":"hello","elevated":true,"pawnIo":{"installed":true,"version":"2.2.0.0","loaded":true}}
    first frame after 2566 ms (from hello)
    t deltas (ms): 1015, 985, 1000, 1000, 1015, 986, 1003, 998, 1000, 1001, 1000
      mean 1,000.3 ms
    seq=12 periodMs=1000 sensors=258 hardware=10
    memory: DIMM 1 16 GB DDR5 6000 MT/s; DIMM 1 16 GB DDR5 6000 MT/s
    hardware (non-null / total sensors):
      /motherboard               Motherboard    Gigabyte B850 EAGLE WIFI6E         0/0
      /lpc/it8696e/0             SuperIO        ITE IT8696E                        20/26
      /amdcpu/0                  Cpu            AMD Ryzen 9 9900X                  95/95
      /vram                      Memory         Virtual Memory                     3/3
      /ram                       Memory         Total Memory                       3/3
      /memory/dimm/1             Memory         Corsair - CMK32GX5M2B6000C38 (#1)  21/21
      /memory/dimm/3             Memory         Corsair - CMK32GX5M2B6000C38 (#3)  21/21
      /gpu-amd/0                 GpuAmd         AMD Radeon(TM) Graphics            30/30
      /gpu-nvidia/0              GpuNvidia      NVIDIA GeForce RTX 5060 Ti         38/38
      /nvme/0                    Storage        KINGSTON SNV3S1000G                21/21
    Cpu /amdcpu/0: non-Load sensors with a value = 69
    client disconnected -> helper exited=True code=0 after 12 ms
    ```
  - Against the criteria:
    - `elevated:true` and `pawnIo.loaded:true` ✓.
    - `/lpc/it8696e/0`, `/memory/dimm/1` and `/3`, and `/nvme/0` are present ✓.
    - CPU: 95/95 non-null, 69 non-Load ✓ (the unprivileged run had 0).
    - Both GPUs fully non-null ✓. So `nvapi64.dll` and `atiadlxx.dll` load elevated under `SetDefaultDllDirectories(System32)`.
    - SuperIO: 20/26 non-null. The 6 nulls match the techspec's six `Control` sensors, which were null in P1 too.
    - 258 sensors ✓.
    - Exit 0 12 ms after the disconnect ✓.
    - The 12-frame cadence averages 1000.3 ms.
  - **No console window: checked from the binary.** The smoke script starts the helper with `-WindowStyle Hidden`, so the run itself couldn't show it, and the owner wasn't sure (owner: "I don't know if I saw one"). Evidence (`sessions/20261021165812_pophood-v010-e2e/evidences/pass2/helper-no-console.txt`):
    - `dumpbin /headers` shows `2 subsystem (Windows GUI)`, from `<OutputType>WinExe</OutputType>`, so Windows never creates a console at launch;
    - `dumpbin /imports` lists none of `AllocConsole`, `AttachConsole`, `CreateConsoleScreenBuffer` or `SetConsoleActiveScreenBuffer`.

    E2E-02 still watches for it through the app's real elevated launch in T14.
  - The first elevated frame arrived 2566 ms after `hello` (unprivileged: 454 ms). That is within E2E-02's "Connecting ≤ ~3 s", but close to it.
  - Both modules report the locator "DIMM 1". That is the firmware's SMBIOS `DeviceLocator`: `Win32_PhysicalMemory` shows "DIMM 1" for both, told apart only by `BankLabel` (P0 CHANNEL A/B). The helper passes it through as specified, and the UI doesn't display it. Observation only.
- **Decisions / gaps:**
  - **Memory size rule differs from the techspec's wording.** The techspec skips entries with "bit 15 set". LHM merges the extended size (0x7FFF → 32-bit field, MiB) into the same property, so a 32 GiB module arrives as 32768 (bit 15 set) and a 48 GiB one as 49152. Skipping bit 15 would drop real modules. The reader skips only 0 (empty) and 0xFFFF (unknown); KiB-granularity entries (< 32 MiB) do not occur on desktop DIMMs.
  - Two sampler classes of files: `Sampler.cs` is new (not in the techspec's file list); it holds the thread, wait loop, per-tick policy and `Fatal`. `Program.cs` keeps the lifetime and the read loop. `Session.Stop(exitCode)` lets either thread end the session (the first caller sets the exit code; it disposes the pipe to wake the blocked read).
  - The sampler thread is a background thread: after `Join(4 s)` the process exits even if `computer.Close()` is still running; the app's own 3 s grace/terminate is the backstop.
  - `SensorReader` caches `Identifier.ToString()` per hardware/sensor with a reference-keyed dictionary, and reads SMBIOS memory once after `Open`.
  - NaN/Infinity sensor values become `null` (the JSON writer would throw on them).
  - `Value` is `float?`, so `12.3f` is written as `12.3`.
  - The `lhm_failed` / exit 70 path and the 5-failure policy have no automated test (they need an LHM failure to inject); they are reviewed by reading only.
