<#
.SYNOPSIS
  Network audit of Pophood (Tauri 2 + WebView2): does anything leave the machine, and is crash upload off?

.DESCRIPTION
  Two modes.

  -Quick (no capture, no admin, about 10 s)
    Finds the app's WebView2 browser process and checks its command line for every flag in BROWSER_ARGS (read from
    src-tauri/src/webview.rs, the single source) and for --edge-webview-disable-crash-reporting=1 (proof that
    IsCustomCrashReportingEnabled is on, without crashing anything). Uses an already running app from -ExePath's folder
    (for example `npm run tauri dev`), or starts one and closes it afterwards. Exit code 0 = pass, 1 = fail.

  Full capture (run from an ELEVATED PowerShell 7; the app itself is started UNELEVATED)
    Two captures run side by side while the app runs for -Seconds, is closed, and is watched for -LingerSeconds:
      1. pktmon (whole machine, NIC component only, full packets) -> pktmon.etl, converted to pktmon.pcapng and
         pktmon.txt. No process attribution: ground truth for "did anything leave the machine".
      2. ETW Kernel-Network + DNS-Client trace (logman) -> netetw.etl. Kernel-Network events carry the sending PID,
         destination and port for every TCP connect/send and UDP send (IPv4, IPv6, QUIC on UDP/443). DNS-Client events
         carry the querying PID and query name. Flows are filtered to the app's process tree, which is tracked every
         second; DNS for the OneAuth watch-list hosts is listed system-wide (OneAuth can hand work to Windows services
         outside the tree).
    Each second the script also records every process on the machine (name, parent, services) to name the requester of
    each watch-list query, and the Windows-account DLLs (WAM, OnlineId) loaded in the tree's WebView2 processes.
    Outputs in -OutDir: processes.csv (the app tree), seen-processes.csv (every process), identity-loads.csv,
    attributed-flows.csv, attributed-dns.csv, watchlist-dns.csv, pktmon-remote-ips.txt, summary.txt.

    Scripted flow for the capture (E2E-15; the script prints each cue, you do the clicking):
      start, 60 s in reduced mode, click "Enable full sensors" and accept UAC, open a drill-down, switch the theme,
      then stay idle; default 180 s, plus one 30-minute idle run (-Seconds 1800).
      Do NOT click the PawnIO link: its browser may be a child of pophood.exe.

  Pass criteria: the ETW trace was read and holds Kernel-Network events; no non-loopback flow from the app's tree; no
  system-wide DNS for the watch-list hosts during the window, except ADR 0024's disclosed exception (a login.live.com
  lookup by wlidsvc, or by Dnscache for it, outside the tree, after the tree loaded WAM or OnlineId: recorded, not
  failed); the browser command line check passes; the script's close ended the app. Both modes refuse to run while
  Pophood runs from another folder, find the browser as the app's child process, and close the app by its window class.

.NOTES
  Ported from C:\Users\jimmy\pophood-probes\probe-net\pktmon-capture-unelev.ps1 (P5). Port changes:
    - -UserDataMarker defaults to dev.pophood (the app's identifier).
    - No -ExtraBrowserArgs / WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: the flags are compiled in (BROWSER_ARGS) and checked.
    - The source's hard-coded deletion of a %LOCALAPPDATA% folder is NOT ported. The opt-in -FreshProfile switch deletes
      only %LOCALAPPDATA%\dev.pophood\EBWebView, so the theme override and local crash dumps survive otherwise.
    - The source's force-kill by process name is limited to pophood.exe and pophood-sensors.exe whose image is in the
      -ExePath folder.
    - The comment that relied on tauri.conf.json additionalBrowserArgs is dropped (that setting is ignored here).
    - Added: the system-wide DNS watch-list, the browser command-line check, and -Quick.
    - #Requires -RunAsAdministrator became a runtime check, because -Quick needs no admin.

.EXAMPLE
  pwsh -File scripts\audit-network.ps1 -Quick -ExePath src-tauri\target\debug\pophood.exe
  pwsh -File scripts\audit-network.ps1 -ExePath src-tauri\target\release\pophood.exe -FreshProfile   # elevated
#>
param(
  [Parameter(Mandatory)] [string] $ExePath,
  [switch] $Quick,
  [string] $OutDir = (Join-Path $PSScriptRoot ("..\audit-out\net-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))),
  [int] $Seconds = 180,
  [int] $LingerSeconds = 30,
  [string] $UserDataMarker = 'dev.pophood',
  # Deletes %LOCALAPPDATA%\dev.pophood\EBWebView before the run (a fresh WebView2 profile). Nothing else is deleted.
  [switch] $FreshProfile
)

$ErrorActionPreference = 'Stop'
$ExePath = (Resolve-Path -LiteralPath $ExePath).Path
$exeDir = Split-Path -Parent $ExePath
$appName = [IO.Path]::GetFileNameWithoutExtension($ExePath)          # pophood
$watchHosts = 'substrate.office.com', 'odc.officeapps.live.com', 'hrd.svc.cloud.microsoft', 'login.live.com'
# WebView2's Windows-account DLLs (ADR 0024): WAM in the browser at start, OnlineId in the crashpad handler ~30 s in.
$identityPattern = '^(Windows\.Security\.Authentication\..*|.*TokenBroker.*|.*wlid.*|.*OnlineId.*|.*MicrosoftAccount.*)\.dll$'

Add-Type -Namespace PophoodAudit -Name Win -MemberDefinition @'
delegate bool EnumProc(IntPtr h, IntPtr l);
[DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
// WM_CLOSE to the app window, found by class: Process.CloseMainWindow() can pick tao's "Tao Thread Event Target" window
// instead, and then the app never closes (T14 run 2).
public static bool CloseTauriWindow(uint pid) {
  IntPtr found = IntPtr.Zero;
  EnumWindows((h, l) => {
    uint p; GetWindowThreadProcessId(h, out p); if (p != pid) return true;
    var sb = new System.Text.StringBuilder(64); GetClassName(h, sb, 64);
    if (sb.ToString() == "Tauri Window") { found = h; return false; }
    return true;
  }, IntPtr.Zero);
  return found != IntPtr.Zero && PostMessage(found, 0x10, IntPtr.Zero, IntPtr.Zero);
}
'@

# Remote IPv4 addresses from pktmon's text, taken only from each IPv4 packet's address pair ("a.b.c.d.port > e.f.g.h.port:").
# Matching every dotted quad on a line also took PTR query names (1.68.168.192.in-addr.arpa) and ip6.arpa nibbles (T14
# observation 8).
function Get-PktmonRemoteIPv4([string] $path, [string[]] $local) {
  $counts = @{}
  foreach ($line in [System.IO.File]::ReadLines($path)) {
    if ($line -notmatch 'ethertype IPv4 \(0x0800\), length \d+: (\d{1,3}(?:\.\d{1,3}){3})(?:\.\d+)? > (\d{1,3}(?:\.\d{1,3}){3})(?:\.\d+)?:') { continue }
    foreach ($ip in $Matches[1], $Matches[2]) {
      if ($ip -notin $local -and $ip -notlike '127.*' -and $ip -notlike '255.*' -and $ip -ne '0.0.0.0') { $counts[$ip] = 1 + ($counts[$ip] ?? 0) }
    }
  }
  $counts
}

# ADR 0024: a login.live.com lookup outside the tree by wlidsvc, or by Dnscache within 2 s of a wlidsvc one, after the
# tree loaded WAM or OnlineId, is recorded, not failed. The loads are polled, so a load may be seen up to 2 s late.
function Set-DisclosedException($watch, $loads) {
  $wlid = @($watch | Where-Object { $_.Services -match '\bwlidsvc\b' -and $_.QueryName -like '*login.live.com*' })
  foreach ($w in $watch) {
    $byService = $w.Services -match '\bwlidsvc\b' -or
      ($w.Services -match '\bDnscache\b' -and @($wlid | Where-Object { [math]::Abs(($_.At - $w.At).TotalSeconds) -le 2 }).Count)
    $afterLoad = @($loads | Where-Object { $_.At -le $w.At.AddSeconds(2) }).Count -gt 0
    $w.Disclosed = (-not $w.InAppTree) -and $w.QueryName -like '*login.live.com*' -and $byService -and $afterLoad
  }
}

# --- BROWSER_ARGS: read from the one place it is defined ----------------------------------------------------------
function Get-BrowserArgs {
  $source = Join-Path $PSScriptRoot '..\src-tauri\src\webview.rs'
  $line = Select-String -Path $source -Pattern 'pub const BROWSER_ARGS: &str = "(?<v>[^"]+)";' | Select-Object -First 1
  if (-not $line) { throw "BROWSER_ARGS not found in $source" }
  $line.Matches[0].Groups['v'].Value
}

# --- Process helpers: everything is limited to the app's folder ---------------------------------------------------
function Get-AppProcesses {
  # pophood.exe and pophood-sensors.exe whose image is inside -ExePath's folder.
  Get-CimInstance Win32_Process -Filter "Name='$appName.exe' OR Name='pophood-sensors.exe'" |
    Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($exeDir, [StringComparison]::OrdinalIgnoreCase) }
}

function Assert-NoOtherInstance {
  # Single-instance would hand the launch to a Pophood running from another folder (say `tauri dev` while auditing a
  # release build), and the audit would then measure that build instead.
  $other = Get-CimInstance Win32_Process -Filter "Name='$appName.exe'" |
    Where-Object { -not ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($exeDir, [StringComparison]::OrdinalIgnoreCase)) }
  if ($other) { throw "Pophood is running from another folder (pid $($other[0].ProcessId), $($other[0].ExecutablePath)). Close it first." }
}

function Get-BrowserProcess([int] $appPid) {
  # The WebView2 browser process: a child of the app, with our user data folder, and not a --type= child process.
  Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe' AND ParentProcessId=$appPid" |
    Where-Object { $_.CommandLine -like "*$UserDataMarker*" -and $_.CommandLine -notlike '*--type=*' } |
    Select-Object -First 1
}

function Test-BrowserCommandLine([int] $appPid) {
  $expected = @((Get-BrowserArgs) -split '\s+') + '--edge-webview-disable-crash-reporting=1'
  $browser = $null
  for ($i = 0; $i -lt 60 -and -not $browser; $i++) { $browser = Get-BrowserProcess $appPid; if (-not $browser) { Start-Sleep -Milliseconds 500 } }
  if (-not $browser) { Write-Host 'FAIL  no WebView2 browser process for the app was found'; return $false }
  Write-Host "Browser process pid=$($browser.ProcessId): $($browser.CommandLine)"
  $ok = $true
  foreach ($flag in $expected) {
    if ($browser.CommandLine.Contains($flag)) { Write-Host "PASS  has $flag" } else { Write-Host "FAIL  missing $flag"; $ok = $false }
  }
  return $ok
}

# --- Quick mode ---------------------------------------------------------------------------------------------------
if ($Quick) {
  Assert-NoOtherInstance
  $launched = $null
  $running = Get-AppProcesses | Where-Object { $_.Name -eq "$appName.exe" } | Select-Object -First 1
  if (-not $running) {
    $launched = Start-Process -FilePath $ExePath -WorkingDirectory $exeDir -PassThru
    $appPid = $launched.Id
    Write-Host "Started $ExePath (pid $appPid)"
  } else {
    $appPid = [int]$running.ProcessId
    Write-Host "Using the running app (pid $appPid)"
  }
  $ok = Test-BrowserCommandLine $appPid
  if ($launched) { $null = [PophoodAudit.Win]::CloseTauriWindow($launched.Id) }
  if ($ok) { Write-Host 'QUICK CHECK PASSED' } else { Write-Host 'QUICK CHECK FAILED' }
  exit ($ok ? 0 : 1)
}

# --- Full capture -------------------------------------------------------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'The full capture needs an elevated PowerShell 7 (pktmon and ETW). Use -Quick for the command-line check.' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pktEtl = Join-Path $OutDir 'pktmon.etl'
$netEtl = Join-Path $OutDir 'netetw.etl'
$session = 'PophoodNetEtw'

# Stop a previous instance of the app, but only the ones in this folder.
Assert-NoOtherInstance
foreach ($p in (Get-AppProcesses)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }

if ($FreshProfile) {
  $profileDir = Join-Path $env:LOCALAPPDATA 'dev.pophood\EBWebView'
  if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force }
}

# 1. Start captures
pktmon stop 2>$null | Out-Null
pktmon filter remove | Out-Null          # capture everything; attribution comes from ETW below
pktmon start --capture --comp nics --pkt-size 0 --file-name $pktEtl | Out-Host

$providers = Join-Path $OutDir 'providers.txt'
@(
  '"Microsoft-Windows-Kernel-Network" 0x30 0x5'   # 0x10 IPv4 | 0x20 IPv6, level informational
  '"Microsoft-Windows-DNS-Client" 0xffffffffffffffff 0x5'
) | Set-Content -Encoding ascii $providers
logman stop $session -ets 2>$null | Out-Null
logman start $session -ets -o $netEtl -pf $providers -bs 1024 -nb 64 256 | Out-Host

# 2. Run the app and track its process tree
$tree = @{}   # pid -> row
function Update-Tree($all, [int] $rootPid, [double] $t) {
  $byParent = $all | Group-Object ParentProcessId -AsHashTable -AsString
  $seen = @{}
  $q = [System.Collections.Generic.Queue[object]]::new()
  $root = $all | Where-Object ProcessId -eq $rootPid
  if ($root) { $seen[$rootPid] = $root; $q.Enqueue($root) }
  while ($q.Count) {
    $p = $q.Dequeue()
    foreach ($c in @($byParent["$($p.ProcessId)"])) {
      if ($c -and -not $seen.ContainsKey([int]$c.ProcessId) -and $c.CreationDate -ge $p.CreationDate) { $seen[[int]$c.ProcessId] = $c; $q.Enqueue($c) }
    }
  }
  # The elevated helper is started through ShellExecute (parented to the shell, not to the app): match it by name. That
  # can only add processes to the tree (more flows to look at), never hide one.
  foreach ($h in ($all | Where-Object { $_.Name -eq 'pophood-sensors.exe' })) { $seen[[int]$h.ProcessId] = $h }
  foreach ($w in ($all | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -like "*$UserDataMarker*" })) { $seen[[int]$w.ProcessId] = $w }
  foreach ($kv in $seen.GetEnumerator()) {
    if (-not $tree.ContainsKey($kv.Key)) {
      $tree[$kv.Key] = [pscustomobject]@{ Pid = $kv.Key; ParentPid = $kv.Value.ParentProcessId; Name = $kv.Value.Name; FirstSeenS = $t; LastSeenS = $t; CommandLine = $kv.Value.CommandLine }
    } else { $tree[$kv.Key].LastSeenS = $t }
  }
}

# Every process seen during the window ("pid|creation" -> row), to name a DNS requester outside the tree after it exited.
$history = @{}
function Update-History($all, [double] $t) {
  $byPid = @{}; foreach ($p in $all) { $byPid[[int]$p.ProcessId] = $p }
  $services = Get-CimInstance Win32_Service -Filter "State='Running'" -Property Name, ProcessId | Group-Object ProcessId -AsHashTable -AsString
  foreach ($p in $all) {
    $key = "$($p.ProcessId)|$($p.CreationDate.Ticks)"
    if (-not $history.ContainsKey($key)) {
      $history[$key] = [pscustomobject]@{ Pid = [int]$p.ProcessId; Name = $p.Name; Created = $p.CreationDate; ParentPid = [int]$p.ParentProcessId; ParentName = $byPid[[int]$p.ParentProcessId].Name; Services = ''; FirstSeenS = $t }
    }
    $have = @($history[$key].Services -split ';' | Where-Object { $_ })
    $new = @(@($services["$($p.ProcessId)"]).Name | Where-Object { $_ -and $_ -notin $have })
    if ($new) { $history[$key].Services = ($have + $new) -join ';' }
  }
}
function Find-Requester([int] $id, [datetime] $at) {
  $history.Values | Where-Object { $_.Pid -eq $id -and $_.Created -le $at } | Sort-Object Created | Select-Object -Last 1
}

# Windows-account DLLs in the tree's WebView2 processes alive at this poll, first sighting of each.
$identity = @{}   # "pid|module" -> row
function Update-IdentityLoads([double] $t) {
  foreach ($w in @($tree.Values | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.LastSeenS -eq $t })) {
    try { $mods = @((Get-Process -Id $w.Pid -ErrorAction Stop).Modules.ModuleName) } catch { continue }
    foreach ($m in ($mods -match $identityPattern)) {
      if (-not $identity.ContainsKey("$($w.Pid)|$m")) {
        $type = if ($w.CommandLine -match '--type=(\S+)') { $Matches[1] } else { 'browser' }
        $identity["$($w.Pid)|$m"] = [pscustomobject]@{ TimeS = $t; At = Get-Date; Pid = $w.Pid; Type = $type; Module = $m }
      }
    }
  }
}

$start = Get-Date
# Launch UNELEVATED, as Pophood always runs: explorer.exe runs at medium integrity and starts the exe as the signed-in user.
Start-Process -FilePath "$env:WINDIR\explorer.exe" -ArgumentList "`"$ExePath`""
$app = $null
for ($i = 0; $i -lt 50 -and -not $app; $i++) {
  Start-Sleep -Milliseconds 200
  $found = Get-AppProcesses | Where-Object { $_.Name -eq "$appName.exe" } | Select-Object -First 1
  if ($found) { $app = Get-Process -Id $found.ProcessId -ErrorAction SilentlyContinue }
}
if (-not $app) { throw 'the app did not start' }
$owner = (Get-CimInstance Win32_Process -Filter "ProcessId=$($app.Id)" | Invoke-CimMethod -MethodName GetOwner).User
"App owner: $owner (launched via explorer, unelevated)"
"Launched pid=$($app.Id) at $($start.ToString('o'))"

$cues = [ordered]@{
  60  = 'CUE: click "Enable full sensors" and accept the UAC prompt'
  90  = 'CUE: open a drill-down (click a card), then switch the theme'
  120 = 'CUE: now leave the app idle'
}
$cued = @{}
$closed = $false
$browserChecked = $false
while (((Get-Date) - $start).TotalSeconds -lt ($Seconds + $LingerSeconds)) {
  $tick = Get-Date
  $t = [math]::Round(($tick - $start).TotalSeconds, 1)
  $all = Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, Name, CommandLine, CreationDate
  Update-Tree $all $app.Id $t
  Update-History $all $t
  Update-IdentityLoads $t
  # Not $cues[$key]: an int index on an [ordered] dictionary is a position, so every cue printed empty until v0.1.0's
  # follow-ups session.
  foreach ($c in $cues.GetEnumerator()) { if ($t -ge $c.Key -and -not $cued[$c.Key] -and $c.Key -lt $Seconds) { $cued[$c.Key] = $true; "[t=$t s] $($c.Value)" } }
  if (-not $browserChecked -and $t -ge 10) { $browserChecked = $true; $browserOk = Test-BrowserCommandLine $app.Id }
  if (-not $closed -and $t -ge $Seconds) {
    $closed = $true; $app.Refresh()
    if (-not $app.HasExited) { "Close requested at t=$t s (WM_CLOSE to the Tauri window: $([PophoodAudit.Win]::CloseTauriWindow($app.Id)))" }
  }
  Start-Sleep -Milliseconds ([math]::Max(0, 1000 - ((Get-Date) - $tick).TotalMilliseconds))
}
$app.Refresh()
$appClosed = $app.HasExited

# 3. Stop and convert
logman stop $session -ets | Out-Host
pktmon stop | Out-Host
pktmon etl2pcap $pktEtl --out (Join-Path $OutDir 'pktmon.pcapng') | Out-Host
pktmon etl2txt $pktEtl --out (Join-Path $OutDir 'pktmon.txt') | Out-Host

$tree.Values | Sort-Object FirstSeenS, Pid | Export-Csv -NoTypeInformation (Join-Path $OutDir 'processes.csv')
$history.Values | Sort-Object FirstSeenS, Pid | Export-Csv -NoTypeInformation (Join-Path $OutDir 'seen-processes.csv')
$loads = @($identity.Values | Sort-Object TimeS, Pid)
$loads | Select-Object TimeS, @{ n = 'Time'; e = { $_.At.ToString('HH:mm:ss.fff') } }, Pid, Type, Module |
  Export-Csv -NoTypeInformation (Join-Path $OutDir 'identity-loads.csv')
$pids = [System.Collections.Generic.HashSet[int]]::new([int[]]@($tree.Keys))

# Kernel-Network writes IPv4 addresses as a little-endian integer (16777343 = 127.0.0.1), IPv6 addresses as 32 hex
# digits, and ports in network byte order (20480 = 80). Decoded here, so the loopback test and the summary see real
# addresses (the first T14 capture flagged 127.0.0.1:80 and [::1]:80 as non-loopback without this).
function ConvertFrom-EtwAddress([string] $v) {
  if ($v -match '^[0-9a-fA-F]{32}$') { return [System.Net.IPAddress]::new([Convert]::FromHexString($v)).ToString() }
  if ($v -match '^\d+$') { return [System.Net.IPAddress]::new([int64]$v).ToString() }
  $v
}
function ConvertFrom-EtwPort([string] $v) {
  if ($v -match '^\d+$') { $p = [int]$v; return (($p -band 0xFF) -shl 8) -bor ($p -shr 8) }
  $v
}

# 4. Attribute flows and DNS queries to the app's PIDs; list watch-list DNS system-wide
$flows = [System.Collections.Generic.List[object]]::new()
$dns = [System.Collections.Generic.List[object]]::new()
$watch = [System.Collections.Generic.List[object]]::new()
$events = @()
try { $events = @(Get-WinEvent -Path $netEtl -Oldest -ErrorAction Stop) } catch { "Reading $netEtl failed: $($_.Exception.Message)" }
# System-wide Kernel-Network events are never 0 over the window: 0 means the trace didn't run or can't be read.
$kernelEvents = @($events | Where-Object ProviderName -eq 'Microsoft-Windows-Kernel-Network').Count
foreach ($e in $events) {
  $x = [xml]$e.ToXml()
  $d = @{}; foreach ($n in $x.Event.EventData.Data) { $d[$n.Name] = $n.'#text' }
  if ($e.ProviderName -eq 'Microsoft-Windows-Kernel-Network') {
    $procId = [int]($d['PID'] ?? $e.ProcessId)
    if ($pids.Contains($procId)) {
      $flows.Add([pscustomobject]@{ Time = $e.TimeCreated.ToString('HH:mm:ss.fff'); Pid = $procId; Proc = $tree[$procId].Name; EventId = $e.Id; Task = $e.TaskDisplayName; Opcode = $e.OpcodeDisplayName; Daddr = (ConvertFrom-EtwAddress $d['daddr']); Dport = (ConvertFrom-EtwPort $d['dport']); Saddr = (ConvertFrom-EtwAddress $d['saddr']); Sport = (ConvertFrom-EtwPort $d['sport']); Size = $d['size'] })
    }
  } elseif ($e.ProviderName -eq 'Microsoft-Windows-DNS-Client') {
    $procId = [int]$e.ProcessId
    $q = $d['QueryName']
    if ($pids.Contains($procId)) {
      $dns.Add([pscustomobject]@{ Time = $e.TimeCreated.ToString('HH:mm:ss.fff'); Pid = $procId; Proc = $tree[$procId].Name; EventId = $e.Id; QueryName = $q; QueryResults = $d['QueryResults'] })
    }
    if ($q -and ($watchHosts | Where-Object { $q -like "*$_*" })) {
      $r = Find-Requester $procId $e.TimeCreated
      $watch.Add([pscustomobject]@{ Time = $e.TimeCreated.ToString('HH:mm:ss.fff'); At = $e.TimeCreated; Pid = $procId; Proc = $r.Name ?? '(not seen by the poll)'; Services = $r.Services; Parent = $(if ($r) { "$($r.ParentName) ($($r.ParentPid))" }); InAppTree = $pids.Contains($procId); QueryName = $q; Disclosed = $false })
    }
  }
}
Set-DisclosedException $watch $loads
$flows | Export-Csv -NoTypeInformation (Join-Path $OutDir 'attributed-flows.csv')
$dns | Export-Csv -NoTypeInformation (Join-Path $OutDir 'attributed-dns.csv')
$watch | Select-Object -ExcludeProperty At | Export-Csv -NoTypeInformation (Join-Path $OutDir 'watchlist-dns.csv')

# 5. Whole-machine remote IPs seen by pktmon (unattributed)
$ipCounts = Get-PktmonRemoteIPv4 (Join-Path $OutDir 'pktmon.txt') @((Get-NetIPAddress).IPAddress)
$ipCounts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object { "$($_.Key)`t$($_.Value)" } | Set-Content (Join-Path $OutDir 'pktmon-remote-ips.txt')

# 6. Summary
$s = @()
$s += "App tree: $($tree.Count) processes; observed ${Seconds}s + ${LingerSeconds}s linger."
$isLoop = { param($a) $ip = $null; [System.Net.IPAddress]::TryParse($a, [ref]$ip) -and ([System.Net.IPAddress]::IsLoopback($ip) -or ($ip.IsIPv4MappedToIPv6 -and [System.Net.IPAddress]::IsLoopback($ip.MapToIPv4()))) }
$remote = $flows | Where-Object { $_.Daddr -and -not (& $isLoop $_.Daddr) }
$s += ''
$s += '== Attributed non-loopback flows (Kernel-Network ETW, app PIDs only) =='
foreach ($g in ($remote | Group-Object Proc, Daddr, Dport, Task)) {
  $hn = try { (Resolve-DnsName $g.Group[0].Daddr -Type PTR -DnsOnly -QuickTimeout -ErrorAction Stop | Select-Object -First 1).NameHost } catch { '?' }
  $s += "$($g.Name)  ptr=$hn  events=$($g.Count)  first=$($g.Group[0].Time)  last=$($g.Group[-1].Time)"
}
if (-not $remote) { $s += '(none)' }
$s += ''
$s += '== Attributed DNS queries (DNS-Client ETW, app PIDs only) =='
foreach ($g in ($dns | Where-Object QueryName | Group-Object Proc, QueryName)) { $s += "$($g.Name)  events=$($g.Count)  first=$($g.Group[0].Time)" }
if (-not $dns) { $s += '(none)' }
$s += ''
$s += '== Windows-account DLLs loaded in the app tree (WebView2; ADR 0024) =='
foreach ($l in $loads) { $s += "t=$($l.TimeS) s  $($l.At.ToString('HH:mm:ss.fff'))  $($l.Type) $($l.Pid)  $($l.Module)" }
if (-not $loads) { $s += '(none)' }
$s += ''
$s += "== System-wide DNS for the OneAuth watch-list ($($watchHosts -join ', ')); requester, services, parent =="
foreach ($g in ($watch | Group-Object Proc, Pid, Services, Parent, QueryName, InAppTree, Disclosed)) { $s += "$($g.Name)  events=$($g.Count)  first=$($g.Group[0].Time)" }
if (-not $watch) { $s += '(none)' }
$s += ''
$s += "== Whole-machine remote IPv4 addresses in pktmon (top 30, unattributed; see pktmon.pcapng) =="
$s += Get-Content (Join-Path $OutDir 'pktmon-remote-ips.txt') -TotalCount 30
$s += ''
$etwOk = $kernelEvents -gt 0
$watchFail = @($watch | Where-Object { -not $_.Disclosed })
$disclosed = @($watch | Where-Object Disclosed)
$pass = $etwOk -and (-not $remote) -and (-not $watchFail) -and $browserOk -and $appClosed
$s += "ETW TRACE READ ($kernelEvents Kernel-Network events system-wide): $(if ($etwOk) { 'PASS' } else { 'FAIL' })"
$s += "BROWSER COMMAND LINE: $(if ($browserOk) { 'PASS' } else { 'FAIL' })"
$s += "APP CLOSED BY THE SCRIPT: $(if ($appClosed) { 'PASS' } else { 'FAIL (still running: the linger window did not follow a close)' })"
$s += "NO NON-LOOPBACK FLOW FROM THE APP TREE: $(if (-not $remote) { 'PASS' } else { 'FAIL' })"
$s += "NO WATCH-LIST DNS (ADR 0024's disclosed exception aside): $(if (-not $watchFail) { 'PASS' } else { 'FAIL' })"
$s += "DISCLOSED EXCEPTION (ADR 0024, recorded): $($disclosed.Count) events$(if ($disclosed) { ', first ' + $disclosed[0].Time })"
$s += "OVERALL: $(if ($pass) { 'PASS' } else { 'FAIL' })"
$s | Tee-Object -FilePath (Join-Path $OutDir 'summary.txt')
exit ($pass ? 0 : 1)
