# Pophood

All-in-one Windows hardware monitor and benchmark. Plan and history: `specs/` (one folder per version, `specs/v0.1.0/` first). Build steps: `README.md`.

Three code trees in one repo: `helper/` (.NET 10 NativeAOT sensor helper), `src-tauri/` (Rust, Tauri 2 app core) and `src/` (React UI).

## Trust invariants (never break these without an explicit owner decision)

The product is a monitor you can trust to be read-only and offline. These keep it that way.

**Privilege**
- Only the sensor helper may run elevated, after one UAC prompt. `pophood.exe` never does: it shows a message box and exits with code 1 if its own token is elevated (`src-tauri/src/lib.rs`, C1).
- The app never installs a driver. It detects PawnIO and links to https://pawnio.eu (C3).
- The core writes one data file, `labels.json` (with `labels.json.tmp` and `labels.json.bad`), in `%LOCALAPPDATA%\dev.pophood`, at a fixed path (`src-tauri/src/labels.rs`). No command takes a path or file name from the UI.

**The helper never changes hardware state** (`helper/WRITE-ALLOWLIST.md`)
- It never calls LHM control or set APIs (`IControl.SetSoftware` / `SetDefault`, WireViewPro2 writes, `PawnIo.*` write methods, SMBus writes, HidSharp `Write` / `SetFeature`). `helper/BannedSymbols.txt` makes that a compile error (RS0030).
- The only writes are the read-path register selects and the owner-approved monitoring-enablement writes listed in `helper/WRITE-ALLOWLIST.md`.
- One known third-party write: AMD ADL (`atiadlxx.dll`) sets 2 REG_DWORDs under `HKCU\Software\ATI\ACE\Settings\ADL\MaxCofuncPaths` when the elevated helper starts. It isn't hardware state; the owner accepted it (T14) and it's listed in `helper/WRITE-ALLOWLIST.md`.
- `Computer.IsControllerEnabled` stays off (controllers write fans at Open/Close); `IsPowerMonitorEnabled` stays on; `IsNetworkEnabled`, `IsPsuEnabled` and `IsBatteryEnabled` stay off. `SensorReader.CreateComputer()` sets exactly six toggles in an object initializer.
- **Never give LHM a persisting `ISettings`**: saved settings replay fan values at Open.
- **The elevated helper writes no files** and prints nothing: it is a `WinExe`, diagnostics travel over the pipe, and `File`, `StreamWriter`, `Process` and the registry are banned symbols.
- **After any LHM or dependency bump:** re-run the write-path audit (session skill draft `lhm-write-path-audit`), re-check `BannedSymbols.txt` for new public write surfaces (including routes through an interface, like RAMSPDToolkit's `DriverManager`), re-check `src/cards/fields.ts → groupNeeds` and the card fields' `needs` against `helper/Availability.cs` (the UI's copy of the RF3 table, for lock labels), update `LHM_VERSION` / `LHM_COMMIT` in `src/pages/About.tsx` and `THIRD-PARTY-NOTICES.md`, re-run the P1 id comparison (skill draft `sensor-id-stability-check`; probe artifacts are in `C:\Users\jimmy\pophood-probes`, see the memory note) and E2E-19 (one banned line per class must still fail with RS0030).
- Never ban `T:LibreHardwareMonitor.PawnIo.PawnIo`: the helper needs `IsInstalled` and `Version`. Ban the PawnIO module types at type level instead.

**No DLL loads from the helper's folder** (BUG-T14-01). The folder is user-writable (C11): a DLL dropped there would run elevated and bypass the hash check. One guard per load path; never remove one:
- **`LoadLibrary` by bare name** (LHM loads `nvapi64.dll`, `atiadlxx.dll`, `ControlLib.dll` and `nvml.dll` that way, application directory first): the helper's first act is `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` (`helper/Program.cs`).
- **P/Invokes:** NativeAOT loads a P/Invoke DLL from the helper's folder **by full path** first unless its search path is System32 only, and a full-path load ignores both `SetDefaultDllDirectories` and KnownDLLs. The second act, `DllSearch.TryConfine()` (`helper/DllSearch.cs`), gives each such assembly a resolver that loads from System32 only and never returns 0. `build-helper.ps1` fails when the ILC map shows a module it doesn't cover: add the assembly to `DllSearch.Assemblies` and to `$confined` in the script.
- **Static imports** resolve before `Main`. `/DEPENDENTLOADFLAG:0x800` (`helper/PophoodSensors.csproj`) loads the non-KnownDLL ones (`bcrypt`, `IPHLPAPI`) from System32 only, but not their own imports: `CRYPT32` (its flag is 0) pulled `DPAPI.dll` from the folder, so it is delay-loaded (`/DELAYLOAD:CRYPT32.dll`). After a .NET bump, run E2E-24's import walk (`sessions/20261022100556_pophood-v010-t15-dll-confine/e2e24-static.ps1`).
- **Paths built from the environment:** a same-user value in `HKCU\Environment` reaches the elevated helper's environment. LHM's NVML fallback loads `%ProgramW6432%\NVIDIA Corporation\NVSMI\nvml.dll` when System32 has no `nvml.dll`, so the helper's third act pins `ProgramW6432` to the Program Files known folder (`helper/Program.cs`). After an LHM or dependency bump, look for new load paths built with `ExpandEnvironmentVariables` or `GetEnvironmentVariable`.
- **DLL redirection** (`.local` folders, an external `pophood-sensors.exe.manifest`): ignored only because the helper embeds the SDK's default manifest (`asInvoker`). Never set `<NoWin32Manifest>` in `helper/PophoodSensors.csproj`.
- **Regression test:** `dll-plant-check.ps1` in the same folder plants genuine copies of every module the helper loads next to a copy of it; nothing may load from there, unelevated or elevated.

**Both pipe ends verify**
- The pipe is per launch (`pophood-<32 hex>`), `FirstPipeInstance`, DACL = the current user's SID only.
- The helper accepts only the client whose image path equals `--client`. The app accepts only a server whose PID equals the process it launched (`GetNamedPipeServerProcessId`) and writes nothing to anyone else.
- The helper treats every control line as untrusted: 1024-byte lines, UTF-8 check, JSON depth 2, field allow-list, the 22-case fuzz corpus (`helper.Tests/ControlParserTests.cs`, `src-tauri/tests/helper_pipe.rs`). The app caps helper lines at 4 MiB.
- The app hashes the helper (SHA-256 compiled in by `src-tauri/build.rs`) through a handle held with `FILE_SHARE_READ` from the check until the launch, before **every** launch (start, restart, "Enable full sensors").
- `helper_missing`, `helper_hash_mismatch`, `pipe_squatter` and `schema_mismatch` **always block**, wherever they are detected: every helper is terminated and the notice is never downgraded to a warning (`src-tauri/src/sensors/machine.rs`).
- The helper exits when its pipe client disconnects, or when no verified client connects within 30 s.

**No network** (RF29 / C5)
- No telemetry, update checks, crash upload or online lookups.
- **WebView2 flags live only in `src-tauri/src/webview.rs` (`BROWSER_ARGS`).** Never set `additionalBrowserArgs` in `tauri.conf.json`: with the app's own WebView2 environment it is silently ignored. The flags include `msOneAuthWAM` (the OQ13 fix; Microsoft notice MC1490911 says it may be ignored from runtime 157).
- **Known exception (ADR 0024; owner: "Disclosed exception (Recommended)").** WebView2's browser process loads WAM (`Windows.Security.Authentication.Web.Core.dll`) at start, and its crashpad handler loads the OnlineId API (`Windows.Security.Authentication.OnlineId.dll`) about 30 s in. Windows' `wlidsvc`, outside the tree, may then resolve `login.live.com`. No flag stops it on runtime 155: don't re-walk the OQ13 ladder there. E2E-15 records such a hit instead of failing it, but only when the tree's WAM / OnlineId load is on record; any flow or DNS from the tree still fails. The README and the trust panel disclose it.
- `IsCustomCrashReportingEnabled = true` stays on, so crash dumps stay local. The browser process command line must contain `--edge-webview-disable-crash-reporting=1`.
- Navigation stays pinned to the app's origin (`on_navigation`, new windows denied). The UI never renders an external `<a href>`: URLs are shown as text. The only way out is `open_pawnio_site`, whose URL is hard-coded in Rust.
- **After any WebView2 runtime, Tauri or wry bump, and after any `BROWSER_ARGS` change, re-run the network audit**: `scripts/audit-network.ps1` (an elevated capture while the app runs unelevated), and `-Quick` for the command-line check. Polling `Get-NetTCPConnection` without admin is never evidence. Also check that `msOneAuthWAM` still holds (MC1490911: maybe not from runtime 157). To try a flag without a rebuild, `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` merges its `--disable-features` with `BROWSER_ARGS`: it can add a flag, never remove one, so check the browser's real command line.

**Bundled tools** (7-Zip, DiskSpd, from v0.3.0 on) are pinned, and their SHA-256 is verified before each run.

## LHM threading facts (helper code)

- **Every `Computer` / `IHardware` call the helper makes happens on the sampler thread** (`helper/Sampler.cs`), including `Open` and `Close`: `ThreadAffinity.Set` changes the calling thread's affinity, and LHM's update path takes no locks. The only exception is the static, read-only `PawnIo.IsInstalled` / `Version` read in `Program.cs` before the sampler starts; it shares no state with `Computer`.
- LHM's own threads still touch its state (the DIMM retry on the thread pool, storage hot-plug), so an exception from a tick is handled, not prevented: the sampler **skips that frame and gives up after 5 in a row** (`error{lhm_failed}`, exit 70).
- There is no `Computer.Update()`: walk `computer.Hardware`, call `Update()` on each item and recurse into `SubHardware`.
- Set `ValuesTimeWindow = TimeSpan.Zero` on every sensor, including sensors created lazily: by default each keeps a day of values.
- Frame `t` is the start of the tick, and the deadline schedule steps from the previous deadline, never from the wake time.
- Another monitoring tool (HWiNFO) holding LHM's global ISA/PCI mutexes makes values go stale silently: `t` keeps advancing while the values repeat. Known and accepted for v0.x.
- RF3: the helper writes `null`, never a fake zero, for readings that need PawnIO when PawnIO isn't usable (`helper/Availability.cs`). The UI owns the copy ("Needs full sensors" / "Needs PawnIO") and never rewrites a value.

## Build notes

- `dotnet publish` of the NativeAOT helper needs `vswhere` on PATH: `C:\Program Files (x86)\Microsoft Visual Studio\Installer`. `scripts/build-helper.ps1` refuses to run without it.
- MSVC lives in VS Build Tools 2022 (or a Visual Studio with the C++ workload). The ATL component (`Microsoft.VisualStudio.Component.VC.ATL`) arrives with v0.6.0 (DiskSpd).
- Build and test the helper projects with `-r win-x64` (`dotnet build helper -c Release -r win-x64`, `dotnet test helper.Tests -r win-x64`); LHM's CsWin32 output is platform-specific.
- **No root `Directory.Packages.props` or `Directory.Build.targets`**: the LHM submodule would pick them up (NU1008). `nuget.config` limits NuGet to nuget.org; the helper restores in locked mode (`helper/packages.lock.json`).
- Only `pophood-sensors.exe` is staged into `src-tauri/binaries/` (the Mono.Posix DLLs never ship). Rebuilding the helper changes the hash compiled into `pophood.exe`; restart any running `tauri dev`.
- **The helper's hash depends on the build folder** (NativeAOT embeds the PDB path): a fresh clone's helper never matches the working tree's, even at the same commit. Elevated evidence counts only for the exact binary under test. To rebuild only `pophood.exe` and keep the staged helper's hash, use a short separate `CARGO_TARGET_DIR` and `npm run tauri build -- --no-bundle --config '{"build":{"beforeBuildCommand":"npm run build"}}'` (template: `sessions/20261021181500_pophood-v010-owner-e2e/oq13-build.ps1`).
- **Every helper change needs the elevated AOT smoke test** (NativeAOT trims what nothing reaches; C10). Regression rule: any change under `helper/` or `src-tauri/src/sensors/` re-runs `npm run build:helper`, `dotnet test helper.Tests`, `cargo test` (with the integration tests), E2E-19 (the bans), E2E-24's import walk, the DLL plant check (unelevated, then elevated) and the elevated smoke (`sessions/20261021133000_pophood-v010-implementation/helper-smoke.ps1`, run from an elevated pwsh).
- Windows paths in shell text replacements: use an exact-string edit, not `sed` in Git Bash (`\U`, `\L` become case conversions).

## Conventions

- **One minor version per slice.** `specs/v0.1.0/requirements.md` is the umbrella requirements for v0.1.0–v0.8.0; each version has a scope stub at `specs/v0.N.0/README.md` and its techspec next to it. A patch (`v0.N.1`) changes an existing capability without adding one; it gets `specs/v0.N.1/` with a scope stub and a techspec, like a slice. Constraints written "for v0.1.0" apply to every v0.x until the public release.
- Specs live under `specs/vX.Y.Z/` (grill-session/, requirements.md, techspec.md, tasks.md, task_NN.md). Sessions live under `sessions/<yyyyMMddHHmmss>_<slug>/`. Every owner decision is recorded with the answer quoted verbatim.
- Python isn't installed: scripts are pwsh. Traps that gave wrong output: variable names are case-insensitive (a `$alone` result reuses an `[string[]]$Alone` parameter); `Tee-Object` inside a function adds its input to the function's return value; `IsInRole('Administrators')` is always false (use `[Security.Principal.WindowsBuiltInRole]::Administrator`); write `"${map}: text"`, not `"$map: text"`.
- **Evidence:** every pass/fail check gets a negative control: it must fail on the pre-fix binary, or find the known events in an earlier capture. A filter must first match something that has to be there (such as the exe's own module path), and a flag check uses exact equality. Attribute a network hit by PID and module loads while the process still exists, never by DNS alone: on this PC, Windows 365, Edge and `wlidsvc` resolve the watch-list hosts by themselves.
- Who runs what: the owner runs anything that needs a UAC prompt, a reboot, an elevated capture or heavy SSD writes (disk benchmarks, about 117 GB per tool per calibration pass) and pastes the output back; the agent prepares the exact command and the pass criteria. A re-run that adds SSD writes needs the owner's approval first.
- Advance a phase (requirements → techspec → tasks → implementation) only at a confidence of 90% or more, and show the factor breakdown.
- Branching and commits are the owner's call.
