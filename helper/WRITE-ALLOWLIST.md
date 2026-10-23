# RF1 write allow-list

Baseline: LibreHardwareMonitor 0.9.6 at `3d331e3370efb858411f19511373eff65a218701` (`third_party/LibreHardwareMonitor`), audited 2026-10-20.
Source of the audit: P6 in `specs/v0.1.0/probe-results.md`; artifacts in `C:\Users\jimmy\pophood-probes\probe-audit`.

RF1: the helper never changes hardware state. The mechanical check is `BannedSymbols.txt` (RS0030 is a build error). It covers only the helper's own code, so LHM's internal writes are covered by this list and by the re-audit rule below.

## Automatic writes the owner allow-listed (answer #29)

These happen without any caller action, even with the default no-op settings. Paths are relative to the submodule.

| Write | Where (file:line at `3d331e3`) | Gated by |
|---|---|---|
| Nuvoton NCT6683D / NCT6686D / NCT6687D: init writes in the constructor (voltage sensing), and the I/O-space lock cleared and never restored | `LibreHardwareMonitorLib/Hardware/Motherboard/Lpc/Nct677X.cs:483-494, 554-565, 668, 1281-1305`; `Lpc/LpcIO.cs:475-479` | `IsMotherboardEnabled` (on) |
| ATA SMART ENABLE (0xD8) when a SMART read fails | DiskInfoToolkit 1.1.2 `DiskHandler.cs:601…873` | `IsStorageEnabled` (on) |
| Realtek 9220DP NVMe-to-USB bridge mode switch (restored afterwards) | DiskInfoToolkit 1.1.2 `DiskHandler.cs:154, 161` | `IsStorageEnabled` (on) |
| WireViewPro2 probes every COM port with STM32 VID/PID 0483:5740 | `LibreHardwareMonitorLib/Hardware/PowerMonitor/WireViewPro2.cs:80-88` | `IsPowerMonitorEnabled` (on, answer #30) |

Read-path writes (index or bank selects, SPD page select, the SMU PM-table command, HID status requests) are not hardware state changes; they are listed with file:line in `probe-audit`.

## Known third-party write outside hardware state

Not hardware state, and not the helper's own code (the registry stays banned there), but the elevated helper process makes it. Owner, T14: "Accept and document (Recommended)".

| Write | Where | Gated by | Evidence |
|---|---|---|---|
| AMD ADL sets 2 REG_DWORDs under `HKCU\Software\ATI\ACE\Settings\ADL\MaxCofuncPaths` (one value per display path GUID, data 5 and 4 on the owner's PC) when the elevated helper starts; the key already existed | the AMD driver's `atiadlxx.dll`, loaded by LHM's AMD GPU code (`Interop/AtiAdlxx.cs`) | `IsGpuEnabled` (on) and an AMD GPU | E2E-16 (T14): `sessions/20261021181500_pophood-v010-owner-e2e/evidences/e2e16.txt` |

## Writes that stay off

| Write | Where | Why it is off |
|---|---|---|
| NZXT GRID+ V3 sets fans to 40% at `Open`; Arctic sets fans to 30% at `Close`; Heatmaster sets its update rate | `GridV3.cs:87`, `ArcticFanController.cs:150-157`, `Heatmaster.cs:96` | `Computer.IsControllerEnabled` stays `false` (answer #19). The helper never touches that property, and `BannedSymbols.txt` bans it. |

## The toggles

`SensorReader.CreateComputer()` sets exactly these six to `true` in an object initializer:

`IsCpuEnabled`, `IsGpuEnabled`, `IsMemoryEnabled`, `IsMotherboardEnabled`, `IsStorageEnabled`, `IsPowerMonitorEnabled`.

`IsControllerEnabled`, `IsNetworkEnabled`, `IsPsuEnabled` and `IsBatteryEnabled` stay `false`. UT-33 asserts this.

## Never a persisting `ISettings`

A persisting settings store re-applies saved fan values at `Open` (`Control.cs:33-44`; SuperIO, NVIDIA, AMD, Kraken, Razer). With the default no-op settings (`Computer.cs:58-61`) nothing is written. So:

- the helper uses `new Computer { … }` with no `ISettings`;
- `Computer.#ctor(ISettings)`, `T:ISettings` and `Motherboard` (whose public constructor takes `ISettings`) are banned.

## Re-audit rule

Re-run the `lhm-write-path-audit` skill draft (`sessions/20261020214713_pophood-define-reqs-confidence/skills/lhm-write-path-audit.md`) on:

- any bump of LHM, DiskInfoToolkit, RAMSPDToolkit-NDD, BlackSharp.Core, HidSharp or Mono.Posix;
- any change to the `Computer.Is*Enabled` toggles.

Get each package's source at its nuspec commit, not its tag. A new automatic write is a blocking finding: take it to the owner before it enters this list. Also re-check `BannedSymbols.txt` for new public write surfaces after a bump, including routes that reach a banned operation through an interface (RAMSPDToolkit's `DriverManager` → `IPawnIOModule.Execute` was one; T12 review). E2E-19 proves one entry per ban class still resolves.

`T:LibreHardwareMonitor.PawnIo.PawnIo` is **not** banned: the helper needs `IsInstalled` and `Version`.
