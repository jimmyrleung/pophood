# Task 01 - Helper build chain: LHM submodule, lock file, bans, `build-helper.ps1`

## Description

Set up the .NET 10 NativeAOT build of `pophood-sensors.exe` from LHM 0.9.6 pinned as a git submodule, with a committed NuGet lock file, the RF1 banned-API list enforced by the compiler, and the script that publishes the exe and stages it as the Tauri sidecar. The helper's `Program.cs` is a stub that reaches LHM's hardware code without running it; the point is to prove the source-built LHM under AOT, the lock and the bans before any feature code (C4, C10).

- Status: Completed (2026-10-21)
- Complexity: M
- Estimated time: 4–6h
- Depends on: —
- Can run in parallel with: —

## AI guidance

- `implement-task`: runs this task.
- Session skill draft `sessions/20261020214713_pophood-define-reqs-confidence/skills/lhm-write-path-audit.md`: the source of `WRITE-ALLOWLIST.md` and the re-audit rule.
- ADRs `0004-helper-never-changes-hardware-state.md` and `0006-supply-chain-and-hashing.md` (`sessions/20261020214713_pophood-define-reqs-confidence/decisions/`).
- No `AGENTS.md` exists yet (T11 writes it). Until then, the trust invariants in `sessions/20261021102214_pophood-v010-techspec/long_term_memory.md` items 6–10 apply. In particular: **no root `Directory.Packages.props` or `Directory.Build.targets`** (LHM would pick them up, NU1008), and **never ban `T:LibreHardwareMonitor.PawnIo.PawnIo`**.
- Owner memory: the 90% confidence bar applies to phase moves, not to this task.

## Requirements

- LHM is a submodule at `3d331e3370efb858411f19511373eff65a218701`, referenced as a ProjectReference (C4).
- NuGet is limited to nuget.org; the helper restores in locked mode; the lock file covers LHM's transitive packages with `contentHash`.
- `BannedSymbols.txt` holds exactly the list in techspec § Data models → BannedSymbols.txt, and RS0030 is an error.
- `build-helper.ps1` fails early without `vswhere` on PATH (C10), and copies **only** `pophood-sensors.exe` to `src-tauri/binaries/pophood-sensors-x86_64-pc-windows-msvc.exe` (OQ8).
- The stub helper is a `WinExe`, writes no files and no console output.

## Files involved

| Path | Action |
|---|---|
| `.gitignore` | Create |
| `.gitmodules`, `third_party/LibreHardwareMonitor` | Create (submodule) |
| `nuget.config` | Create |
| `helper/PophoodSensors.csproj` | Create |
| `helper/packages.lock.json` | Create (generated, committed) |
| `helper/BannedSymbols.txt` | Create |
| `helper/WRITE-ALLOWLIST.md` | Create |
| `helper/Program.cs` | Create (stub; replaced in T3) |
| `scripts/build-helper.ps1` | Create |

## Implementation steps

1. Create `.gitignore` per techspec § Implementation map → Repo and build (`.gitignore` row).
2. Add the submodule `https://github.com/LibreHardwareMonitor/LibreHardwareMonitor.git` at `third_party/LibreHardwareMonitor`, checked out at `3d331e3` (techspec § Implementation map, `.gitmodules` row).
3. Create `nuget.config` with a cleared source list plus nuget.org only (techspec `nuget.config` row). Do not add any root `Directory.*.props/targets`.
4. Create `helper/PophoodSensors.csproj` with every property in the techspec `helper/PophoodSensors.csproj` row. Precedent: `C:\Users\jimmy\projects\pc-bench-spike\helper\SensorHelper\SensorHelper.csproj`. Add `Microsoft.CodeAnalysis.BannedApiAnalyzers` (latest stable, `PrivateAssets=all`) and `<AdditionalFiles Include="BannedSymbols.txt" />`. Add `InternalsVisibleTo` `PophoodSensors.Tests` now, so T3 doesn't need to modify the csproj.
5. Create `helper/BannedSymbols.txt` by copying the code block in techspec § BannedSymbols.txt verbatim (one doc ID per line).
6. Create `helper/WRITE-ALLOWLIST.md` per the techspec row: the P6 allow-list with file:line at `3d331e3`, the toggles, the "never a persisting `ISettings`" rule, and the re-audit rule. Source the P6 entries from `specs/v0.1.0/probe-results.md` (P6) and the `lhm-write-path-audit` skill draft.
7. Write a stub `helper/Program.cs` that returns 0 and touches no hardware when run. NativeAOT trims every method nothing reaches, so the stub must **reach** LHM's hardware code for its AOT and trim warnings to show now rather than in T4 (ADR 0002's reason for the smoke rule). Build the computer with the techspec's six toggles in an object initializer (`IsCpuEnabled`, `IsGpuEnabled`, `IsMemoryEnabled`, `IsMotherboardEnabled`, `IsStorageEnabled`, `IsPowerMonitorEnabled`), read `LibreHardwareMonitor.PawnIo.PawnIo.IsInstalled`, and put `computer.Open(); computer.Close();` behind a branch no launch takes (for example `if (args.Length > 1000)`). Nothing in T1 or T2 launches the stub; T3 replaces it.
8. Run the first restore to generate `helper/packages.lock.json`; commit it.
9. Create `scripts/build-helper.ps1` per the techspec `scripts/build-helper.ps1` row (pwsh only; Python isn't installed). Style precedent: `C:\Users\jimmy\pophood-probes\REBUILD.md`. `src-tauri/` doesn't exist until T2, so the script creates `src-tauri/binaries/` if it's missing. Print the SHA-256 at the end.
10. Run the E2E-19 negatives (see Testing) and revert each line.

## Acceptance Criteria

- `git submodule status` prints `3d331e3370efb858411f19511373eff65a218701 third_party/LibreHardwareMonitor`.
- `pwsh -File scripts/build-helper.ps1` exits 0, prints a 64-hex SHA-256, and `src-tauri/binaries/` contains exactly one file, `pophood-sensors-x86_64-pc-windows-msvc.exe`, whose `Get-FileHash` equals the printed hash.
- `helper/bin/publish` may hold Mono.Posix DLLs, but `src-tauri/binaries/` holds none (directory listing).
- With `vswhere` removed from PATH in a child shell, the script fails before `dotnet publish` with a message naming `vswhere`.
- Changing one character of any `contentHash` in `helper/packages.lock.json` makes the script fail with NU1403 (command output); reverting restores a green build.
- `packages.lock.json` lists LHM's transitive packages (e.g. `HidSharp`, `RAMSPDToolkit-NDD`, `DiskInfoToolkit`) as `Transitive` with a `contentHash` (file contents).
- Each E2E-19 negative fails the build with RS0030 (command output per line, below).
- `helper/BannedSymbols.txt` matches the techspec's code block line for line: a `Compare-Object` of the file against the block extracted from `techspec.md` prints nothing (E2E-19 tests only one entry per class).
- The publish output records the AOT/trim warning count (IL2xxx/IL3xxx) for the stub, which reaches LHM's hardware code (build log). T4 compares its own count against it.
- `git status` shows no `Directory.Packages.props` or `Directory.Build.targets` at the repo root.

## Testing

- **E2E-19 (moved up from step 11):** add, one at a time, each temporary line from techspec E2E-19 to the stub `Program.cs` (`sensor.Control.SetSoftware(50)`; `new Motherboard(computer.SMBios, null)`; `computer.IsControllerEnabled = true`; `new CorsairPsuGroup(null)`; `SMBusManager.DetectSMBuses()`; `Stdlib.remove("x")`; `Logger.SaveToFile("x", false)`; a `Kernel32` member; `File.WriteAllText("x", "")`; `Process.Start("x")`), with any locals it needs declared. Each must fail with RS0030; a line that builds means its entry resolves to nothing and must be fixed in `BannedSymbols.txt`. Record the output. T13 re-runs it on the final helper.
- **E2E-24, partial:** the NU1403 lock-tamper check, `git submodule status`, and "only the exe is staged" (above). The release-folder, `rerun-if-changed` and `dumpbin /imports` parts run in T13, once the real helper and `pophood.exe` exist.
- **Unit tests:** none in this task. Reason: the only code is a stub; the helper test project is created with the first testable code in T3.

## Additional relevant files

- `specs/v0.1.0/techspec.md` § Implementation map (Repo and build; Helper), § BannedSymbols.txt, § Integration points (LHM row)
- `specs/v0.1.0/probe-results.md` (P6 write-path audit)
- `C:\Users\jimmy\pophood-probes\REBUILD.md`
- `C:\Users\jimmy\projects\pc-bench-spike\helper\SensorHelper\SensorHelper.csproj`

## Task notes (implementation, 2026-10-21)

- **Confidence:** plan 90% → done 92%. All ACs executed and observed. Remaining uncertainty: the stub never runs (as designed), so AOT *runtime* behaviour of LHM is still first checked by T4's elevated smoke.
- **Evidence:**
  - `git submodule status` → ` 3d331e3370efb858411f19511373eff65a218701 third_party/LibreHardwareMonitor (v0.9.6)`.
  - `pwsh -File scripts/build-helper.ps1` exit 0; `src-tauri/binaries/` holds exactly `pophood-sensors-x86_64-pc-windows-msvc.exe` and its `Get-FileHash` equals the printed SHA-256. `helper/bin/publish` has the Mono.Posix DLLs (`libMonoPosixHelper.dll`, `MonoPosixHelper.dll`); `binaries/` has none.
  - **AOT/trim baseline for T4:** 14 unique IL2xxx/IL3xxx warning lines in the publish log (IL2026 ×4, IL2075 ×4, IL2091 ×2, IL2104 ×2, IL3050 ×1, IL3053 ×1) from LHM (`OpCode.cs`, `NvApi.cs`, `MsiCoreLiquidController.cs`, `WireViewPro2.cs`), `System.Management` and `HidSharp`. Plus ILC "will always throw" notes for DiskInfoToolkit's MEGARAID/CSMI marshalling stubs and three `System.Management.Wbem*` constructors. T4 compares its count with this one.
  - `BannedSymbols.txt` vs the techspec block: `Compare-Object` → 0 differences (58 lines).
  - **E2E-19:** each of the 10 lines fails with RS0030 (messages name `IControl.SetSoftware(float)`, `Motherboard`, `Computer.IsControllerEnabled`, `CorsairPsuGroup`, `SMBusManager`, `Stdlib`, `Logger.SaveToFile(string, bool)`, `Kernel32`, `File`, `Process`). Test lines that compile on their own: `Logger.Instance.SaveToFile("x", false)` (SaveToFile is an instance method; the techspec's static form gives CS0120, not RS0030) and `BlackSharp.Core.Interop.Windows.Native.Kernel32.CloseHandle(IntPtr.Zero)`. `Program.cs` was restored after each run.
  - No `vswhere` on PATH → the script throws a message naming `vswhere` before `dotnet restore`/`publish`.
  - Lock tamper → `NU1403: Package content hash validation failed for Microsoft.CodeAnalysis.BannedApiAnalyzers.5.6.0`, exit 1; restored → exit 0.
  - No `Directory.Packages.props` / `Directory.Build.targets` at the repo root.
- **Decisions / gaps:**
  - **Added a forced locked-mode restore** (`dotnet restore -r win-x64 --locked-mode --force`) to `build-helper.ps1` before `publish`. With only `-p:RestoreLockedMode=true` on `publish`, NuGet's no-op restore skips the lock check, so the tampered hash was **not** detected (first attempt: exit 0). The AC requires NU1403.
  - **`vswhere` is not on this PC's PATH** (it lives in `%ProgramFiles(x86)%\Microsoft Visual Studio\Installer`). The script correctly refuses; runs in this session add that folder to PATH first. The README (T11) must say so.
  - `dotnet build helper` without `-r win-x64` fails in LHM (CsWin32 `SP_DEVICE_INTERFACE_DATA` missing); with `-r win-x64` it works. Use the RID for every build, including T3's test project references.
  - BannedApiAnalyzers version: 5.6.0 (latest stable when implemented).
  - Not reproducible byte for byte across rebuilds (OQ14, deliberately cut).
  - The `WRITE-ALLOWLIST.md` file:line references were checked only for file existence; line numbers come from P6.
