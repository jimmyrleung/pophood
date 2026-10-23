# Publishes the NativeAOT sensor helper and stages ONLY its exe as the Tauri sidecar (OQ8).
# Requires: .NET SDK 10, VS Build Tools (MSVC) and vswhere on PATH (C10).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command vswhere -ErrorAction SilentlyContinue)) {
    throw "vswhere is not on PATH. NativeAOT needs the MSVC Build Tools; add '%ProgramFiles(x86)%\Microsoft Visual Studio\Installer' to PATH (C10)."
}
if (-not (Test-Path (Join-Path $root 'third_party\LibreHardwareMonitor\LibreHardwareMonitorLib'))) {
    throw "The LibreHardwareMonitor submodule is empty. Run: git submodule update --init"
}

$publish = Join-Path $root 'helper\bin\publish'
$binaries = Join-Path $root 'src-tauri\binaries'

# A no-op restore skips the lock-file check, so force a locked-mode restore first (a tampered contentHash then fails with NU1403).
& dotnet restore (Join-Path $root 'helper') -r win-x64 --locked-mode --force
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed ($LASTEXITCODE): the lock file does not match" }

& dotnet publish (Join-Path $root 'helper') -c Release -r win-x64 `
    -p:RestoreLockedMode=true -p:GeneratePackageOnBuild=false -p:IlcGenerateMapFile=true -o $publish
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed ($LASTEXITCODE)" }

$exe = Join-Path $publish 'pophood-sensors.exe'
if (-not (Test-Path $exe)) { throw "Publish did not produce $exe" }

# BUG-T14-01: NativeAOT loads a P/Invoke DLL from the helper's folder first unless its search path is System32 only
# (suffix _2048 on the map's __nativemodule_<assembly>__Module__<library> symbol). Every other module must belong to an
# assembly that helper/DllSearch.cs gives a resolver. Assembly names as the compiler mangles them; DllSearchTests reads
# this list and fails when it differs from DllSearch.Assemblies.
$confined = 'S_P_CoreLib', 'System_Security_Principal_Windows', 'LibreHardwareMonitorLib', 'HidSharp', 'DiskInfoToolkit',
    'RAMSPDToolkit_NDD', 'BlackSharp_Core'
$map = Join-Path $root 'helper\obj\Release\net10.0-windows\win-x64\native\pophood-sensors.map.xml'
if (-not (Test-Path $map)) { throw "The ILC map $map is missing, so the P/Invoke search paths can't be checked" }
$modules = Select-String -Path $map -Pattern '__nativemodule_(\w+?)__Module__(\w+)' -AllMatches |
    ForEach-Object { $_.Matches } | Sort-Object Value -Unique
if (-not $modules) { throw "No P/Invoke module found in ${map}: the pattern no longer matches the compiler's names" }
$unconfined = @($modules | Where-Object { $_.Groups[2].Value -notmatch '_2048$' -and $_.Groups[1].Value -notin $confined })
if ($unconfined) {
    throw ("P/Invoke modules that would load from the helper's folder (BUG-T14-01): " + ($unconfined.Value -join ', ') +
        ". Add the assembly to DllSearch.Assemblies and to `$confined in this script.")
}
Write-Host "P/Invoke modules: $(@($modules).Count), each System32-only or in a confined assembly"

# Only the exe ships: the Mono.Posix DLLs in the publish folder must never reach the app.
New-Item -ItemType Directory -Force $binaries | Out-Null
Get-ChildItem $binaries -File | Remove-Item -Force
$staged = Join-Path $binaries 'pophood-sensors-x86_64-pc-windows-msvc.exe'
Copy-Item $exe $staged

$hash = (Get-FileHash $staged -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Staged $staged"
Write-Host "SHA-256 $hash"
