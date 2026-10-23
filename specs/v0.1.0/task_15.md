# Task 15 - Confine the helper's P/Invoke DLL loads to System32 (BUG-T14-01)

## Description

T14's E2E-16 capture showed the elevated helper probing its own folder for `DPAPI.DLL`, `setupapi.dll`, `cfgmgr32.dll`, `user32.dll` and `ntdll.dll`. A follow-up check proved that it loads them from there:
- **The check:** genuine System32 copies were planted next to an unelevated copy of the helper (`sessions/20261021181500_pophood-v010-owner-e2e/dll-plant-check.ps1`, evidence `evidences/dll-plant-check.txt`).
- **The result:** 4 of the 5 appear in the module list from the helper's folder. The 5th, `user32`, crashes the helper with `0xC000041D`.

A same-user process could plant one of these DLLs in the user-writable helper folder (C11). It would then run **elevated** after one "Enable full sensors" click, and the SHA-256 check (RF14) covers only the exe. This breaks the `AGENTS.md` invariant "a DLL dropped next to the helper would run elevated and bypass the hash check".

Likely mechanism: NativeAOT resolves a `[DllImport]` with no `DefaultDllImportSearchPaths` attribute by trying the assembly directory **by full path** first, and `SetDefaultDllDirectories` doesn't restrict full-path loads.
- **Covered:** the helper's own P/Invokes, through `[assembly: DefaultDllImportSearchPaths(System32)]` in `helper/Native.cs`.
- **Not covered:** LHM's (setupapi, cfgmgr32, user32) and the framework's (DPAPI).

The techspec's Known Risks row assumed `SetDefaultDllDirectories` "covers LoadLibrary and P/Invoke resolution". It accepted only static imports, which `/DEPENDENTLOADFLAG:0x800` covers.

v0.1.0 is **not signed off** until this task is done (owner: "New fix task T15 (Recommended)").

- Status: **Completed 2026-10-22.** Every acceptance criterion passes on the fresh-clone release build (`55d5b2a`, helper `5e0ebebe…`), unelevated and elevated. v0.1.0 is signed off (owner: "Sign off v0.1.0 (Recommended)"). Notes below.
- Complexity: **M**. A small code change, but the regression rule and the elevated re-runs are most of the work.
- Estimated time: 3–4h, about 1h of it with the owner (the elevated smoke, the elevated plant check, E2E-02, E2E-16)
- Depends on: T14
- Can run in parallel with: —

## AI guidance

- **Before choosing the fix, confirm the mechanism at source.** Read how NativeAOT resolves P/Invokes for an assembly without the attribute (the runtime's `PInvokeMarshal`/`NativeLibrary` probing and the ILCompiler's `DirectPInvoke` handling for .NET 10). Also find which LHM and framework call sites import the five DLLs (LHM's interop folders; the DPAPI caller). Every other non-KnownDLL that any `[DllImport]`/`LibraryImport` in the published closure reaches is in scope too, not just these five: list them all.
- **Fix options** (pick one with the owner after the source check; record the answer verbatim):
  1. **`NativeLibrary.SetDllImportResolver`** for the LHM assembly and each affected framework assembly, set in `Program.cs` right after `SetDefaultDllDirectories` and before any LHM or crypto call. It returns `NativeLibrary.Load(name, assembly, DllImportSearchPath.System32)` (or `IntPtr.Zero` for the bare-name vendor DLLs, so the default `System32` search applies). Check that NativeAOT honours resolvers for every affected call site; `DirectPInvoke` call sites bypass resolvers.
  2. **`<DirectPInvoke Include="…" />`** in `helper/PophoodSensors.csproj` for the affected system libraries. They become static imports, confined to System32 by the existing `/DEPENDENTLOADFLAG:0x800`, with no LHM change. `dumpbin /imports` must then list them, and E2E-24's import rule must be updated to match.
- **Don't touch `third_party/LibreHardwareMonitor`** (pinned source, C4).
- `AGENTS.md` applies. Every helper change follows the regression rule in `tasks.md`.

## Requirements

- No DLL is ever loaded from the helper's folder, unelevated or elevated, at start, during `Open`, or while sampling.
- The vendor DLLs (`nvapi64`, `atiadlxx`, `ControlLib`, `nvml`) still load from System32 or the DriverStore, and both GPUs keep their sensors when elevated.
- No change to sensor output: 258 sensors elevated on this PC and 164 unprivileged, with the same ids (P1 comparison not needed unless LHM changes).
- `AGENTS.md`'s DLL-search paragraph and the techspec's Known Risks row describe the real coverage: static imports through `/DEPENDENTLOADFLAG`, P/Invokes through the chosen fix, `LoadLibrary` through `SetDefaultDllDirectories`.
- The owner-approved T14 follow-up goes in the same doc edit: the AMD ADL HKCU write (`HKCU\Software\ATI\ACE\Settings\ADL\MaxCofuncPaths`, 2 REG_DWORDs at the elevated helper's start) is listed in `helper/WRITE-ALLOWLIST.md` and `AGENTS.md` as a known third-party write (owner: "Accept and document (Recommended)").

## Files involved

| Path | Action |
|---|---|
| `helper/Program.cs` or `helper/PophoodSensors.csproj` | Modify, depending on the fix chosen |
| `helper.Tests/` | Add a test if the fix is testable unelevated (for example, the resolver returns only System32 paths) |
| `sessions/20261021181500_pophood-v010-owner-e2e/dll-plant-check.ps1` | Run unelevated, then elevated (add an `-Elevated` path through the real app, or run the script from an elevated shell, where the helper inherits elevation) |
| `AGENTS.md`, `helper/WRITE-ALLOWLIST.md`, `specs/v0.1.0/techspec.md` (Known Risks) | Modify (docs; owner approves the AGENTS.md text) |
| `scripts/build-helper.ps1`, `src-tauri/binaries/` | Run (the rebuild changes the helper hash compiled into `pophood.exe`) |

## Implementation steps

1. Do the source check in AI guidance. List every library reached by `[DllImport]` / `LibraryImport` in the published helper, with its assembly, and show the list and the two options to the owner.
2. Implement the chosen fix.
3. Run the regression rule:
   - `npm run build:helper` and `dotnet test helper.Tests -r win-x64`;
   - `cargo test` with the ITs, and IT-10 with `--ignored`;
   - E2E-19 (one banned line per class still fails with RS0030);
   - E2E-24's `dumpbin /imports` and `/loadconfig` check;
   - the elevated AOT smoke (`sessions/20261021133000_pophood-v010-implementation/helper-smoke.ps1`).
4. Run `dll-plant-check.ps1` on the new helper, unelevated and then **elevated** (the owner runs it). Nothing may load from the plant folder, and the helper must run normally with every plant present (no crash with `user32` planted).
5. Release build (README steps; fresh clone if the owner wants T13's standard), then re-run on it with the owner:
   - E2E-02, including the 258 count and both GPUs elevated;
   - E2E-16 (Process Monitor: expect no probe of the helper's folder for any DLL);
   - E2E-24 (agent);
   - `audit-network.ps1 -Quick`.
   The other O items don't exercise the changed load path; the owner decides whether any more are re-run.
6. Update the docs listed in Requirements.

## Acceptance Criteria

- `dll-plant-check.txt` (new run) shows **no module loaded from the plant folder** for every one of the five names, plus any others found in step 1, both unelevated and elevated. The helper runs normally with all of them planted.
- A Process Monitor capture of an elevated start shows **no `QueryOpen`/`CreateFile` of a `.dll` in the helper's folder**.
- Both GPUs and 258 sensors elevated; 164 unprivileged.
- Every regression-rule check passes, and E2E-02 and E2E-16 pass on the new release build.
- The `AGENTS.md`, `WRITE-ALLOWLIST.md` and techspec text matches the real coverage; the owner approves the AGENTS.md text.
- Then v0.1.0 is signed off: `tasks.md` records it.

## Testing

- The `dll-plant-check.ps1` plant matrix, unelevated and elevated: the regression test for this bug.
- The regression rule's suites and checks (above).
- E2E-02, E2E-16 and E2E-24 on the new release build.

## Additional relevant files

- `sessions/20261021181500_pophood-v010-owner-e2e/qa.md` (BUG-T14-01, E2E-16), `evidences/e2e16-helper-events.csv` (the probes: 20:20:05.926–.935 and 20:20:08.949–.956)
- `helper/Native.cs` (the assembly-level attribute that covers only the helper's own P/Invokes)
- `specs/v0.1.0/techspec.md` § Known Risks (the user-writable helper folder row), `requirements.md` C11

## Task notes (2026-10-22, T15 session from 10:05; `sessions/20261022100556_pophood-v010-t15-dll-confine/`)

### Owner decisions (verbatim)

| Question | Answer |
|---|---|
| Which fix confines the P/Invoke loads? | "Resolver (Recommended)" |
| How should the pre-Main DPAPI load (via CRYPT32) be fixed? | "Delay-load CRYPT32 (Recommended)" |
| Add a build-time guard? | "Guard in build (Recommended)" |
| Approve the AGENTS.md text? | "Approve as drafted" |
| Which release build? | "Fresh clone (T13 standard)" |
| What to commit before the clone? | "Two commits (Recommended)" |
| Run the two elevated checks now, on the working-tree helper? | "Yes, now (Recommended)" |

### Source check (step 1)

- **Mechanism, confirmed in .NET 10 (`release/10.0`):**
  - ILCompiler (`PInvokeMethodFixupNode.cs`) takes a P/Invoke's search path from the method's `DefaultDllImportSearchPaths`, else its assembly's, else none.
  - The runtime (`InteropHelpers.FixupModuleCell` → `NativeLibrary.LoadBySearch`) treats "none" as `AssemblyDirectory` and first loads `Path.Combine(AppContext.BaseDirectory, name)` **by full path**. A full-path load ignores `SetDefaultDllDirectories` and KnownDLLs, which is why a second `user32` crashed the helper.
  - The framework's own default, `AssemblyDirectory | System32` (2050), probes the folder first too.
  - `LoadLibraryCallbackStub` (the resolver) runs before all of it, for every lazy fixup.
- **Inventory (ILC map, 35 modules).** Without a System32-only search path:
  - DiskInfoToolkit: setupapi, cfgmgr32, user32;
  - HidSharp: setupapi, cfgmgr32, user32, hid, BluetoothAPIs, plus Linux and macOS names;
  - RAMSPDToolkit-NDD: setupapi;
  - BlackSharp.Core: kernel32, ntdll;
  - CoreLib (2050): ntdll, advapi32;
  - System.Security.Principal.Windows (2050): advapi32, sspicli;
  - LHM: libc and nvidia-ml (Linux only).

  LHM's CsWin32 imports and the helper's own are System32-only (`_2048`). The explicit loads are LHM's bare-name vendor DLLs (covered by `SetDefaultDllDirectories`) and System.Management's `wminet_utils.dll`, from the HKLM .NET path.
- **New finding, DPAPI isn't a P/Invoke.** `CRYPT32` was a static import of the helper, for `CryptProtectMemory` / `CryptUnprotectMemory` from the default direct-call list. Its own Dependent Load Flag is 0, and its **delay import** `DPAPI.dll` was resolved at process start (E2E-16: 05.9260, before the first managed code), helper folder first. `/DEPENDENTLOADFLAG` covers only the exe's direct imports. The startup `ntdll` probe comes after `CreatePipe`, inside `Main`, so a resolver registered at the top of `Main` catches it.

### Implementation

- `helper/DllSearch.cs` (new):
  - `Assemblies`: the seven assemblies above.
  - `TryConfine()` calls `NativeLibrary.SetDllImportResolver` on each.
  - `Resolve` accepts plain names only, calls `LoadLibraryExW(name, 0, LOAD_LIBRARY_SEARCH_SYSTEM32)`, never returns 0, and throws `DllNotFoundException` instead.
- `helper/Program.cs` calls `TryConfine()` right after `SetDefaultDllDirectories`; exit 70 if it fails. `helper/Native.cs` gains `LoadLibraryExW`.
- `helper/PophoodSensors.csproj` adds `/DELAYLOAD:CRYPT32.dll` and `delayimp.lib`.
- `scripts/build-helper.ps1` publishes with `-p:IlcGenerateMapFile=true`. It fails when a `__nativemodule_` without `_2048` belongs to an assembly outside its `$confined` list, which mirrors `DllSearch.Assemblies`.
- `helper.Tests/DllSearchTests.cs`: 21 tests (22 before the review merged two). System32 loads; refusals throw; a genuine copy in the app folder is ignored when the P/Invoke asks for `AssemblyDirectory`; the seven assembly names.
- Docs: `AGENTS.md` (approved text), `helper/WRITE-ALLOWLIST.md` (the ADL write), `techspec.md` (every "T15" note, the Known Risks row, E2E-24, revision history).
- **Decision, `LoadLibraryExW` rather than `NativeLibrary.TryLoad(name, asm, System32)`.** In the unit test, CoreCLR's `TryLoad` loaded a planted copy from the test's app folder: the host's `NATIVE_DLL_SEARCH_DIRECTORIES` come before any flag. NativeAOT has no such step today, but the resolver shouldn't depend on any runtime's search order.
- **Session scripts:**
  - `dll-plant-check.ps1` supersedes T14's. It plants genuine copies of every module a clean run loads, plus the inventory and the CRYPT32/IPHLPAPI delay imports: 65 on this PC.
  - `e2e24-static.ps1` walks the imports of the non-KnownDLL static imports.
  - `e2e19.ps1` is T13's script, guarding only the hashes that exist.
  - `t15.psm1`, `watch.ps1`, `e2e02.ps1` and `e2e16-procmon-elevated.ps1` are T14's harness pointed at the T15 clone. E2E-16 also counts every event on a `.dll` in the helper's folder.
  - `release-build.ps1` runs T13's `fresh-build.ps1` and `fresh-tests.ps1` on a clone.
- **Commits:** commit 1, `a965782`, carries the T13 tail and T14. `tasks.md` and `task_15.md` went into commit 1 because they held only T14 edits then. Commit 2 is T15.

### Verification on the working tree (helper `2982b170…`)

| Check | Result | Evidence (`evidences/`) |
|---|---|---|
| `npm run build:helper` with the map guard | PASS: 35 modules, each `_2048` or confined. Removing HidSharp or CoreLib from the list makes the guard fail (13 and 2 modules) | session log |
| `dotnet test helper.Tests -r win-x64` | PASS 88 (66 + 22 new) | `dotnet-test.txt` |
| `cargo test`, `POPHOOD_OWNER_PC=1` | PASS: 74 lib, UT-13, 18 ITs, and IT-10 under `--ignored` | `cargo-test.txt` |
| E2E-19 | PASS: 12 of 12 lines fail with RS0030; staged helper unchanged | `e2e19.txt` |
| E2E-24 import walk | PASS: CRYPT32 delay-loaded, `0800`, only `bcrypt` → `bcryptPrimitives` (plant-checked). Garbage CRYPT32/DPAPI files: exit 64. **Old helper: FAIL** (CRYPT32's DPAPI delay import; a garbage `DPAPI.DLL` kills it with `0xC000012F` before `Main`) | `e2e24-static.txt`, `e2e24-static-old-helper.txt` |
| Plant check, unelevated | PASS: 7 runs, 65 copies, nothing from a plant folder, 164 sensors each. **Old helper: FAIL**, reproducing T14 (DPAPI, setupapi, cfgmgr32, ntdll from the folder; user32 and all-planted crash `0xC000041D`) | `dll-plant-check-unelevated-worktree.txt`, `dll-plant-check-old-helper-unelevated.txt` |
| Elevated AOT smoke (owner) | PASS: elevated, PawnIO loaded, 258 sensors, both GPUs (RTX 5060 Ti 38/38, Radeon 30/30), mean 1000.1 ms, exit 0 | `helper-smoke-elevated-worktree.txt` |
| Plant check, elevated (owner, 57-copy inventory) | PASS: 7 runs, `hello elevated=True` and PawnIO loaded in each, 258 sensors each. The log's `this shell elevated: False` line was a script bug (`IsInRole('Administrators')`), fixed since | `dll-plant-check-elevated-worktree.txt` |
| LHM submodule | `3d331e3`, no changes (C4) | — |

### Independent review (Fable, high)

- **Accepted and applied:**
  - The CRYPT32/bcrypt delay imports are safe only because their first use comes after `Main`'s first act. Said so in the Known Risks row and the E2E-24 script, and added their names to the plant inventory.
  - "Static import DPAPI" was wrong: it's a delay import. Fixed in the csproj comment and the techspec. E2E-24 now FAILs on such a delay import unless the plant check covers it, so it flags the old helper by its own rule.
  - The plant check reads modules after the frames: limit stated in its header; E2E-16's Process Monitor capture is the full record.
- **Rejected:** "IT-10 `--ignored` not run". `cargo-test.txt:150` shows `it10_no_client_exits_4_after_30_seconds ... ok`.
- **Out of scope, already open:** the NVML `%ProgramW6432%` fallback (UNVERIFIED in the techspec).

### Verification on the release build (step 5)

The release is a fresh clone of `55d5b2a` in `C:\Users\jimmy\pophood-e2e\pophood-t15`, built with the README steps verbatim (`release-build.ps1`). Release helper `5e0ebebed67250f4d54890051bc60ea0a13f95f80aab35f8900901e9976aee39`; the map guard passed in the clone too. The working-tree helper has another hash (the PDB path is embedded), so the elevated checks were repeated here.

| Check | Result | Evidence (`evidences/`) |
|---|---|---|
| Build + every suite on the clone | PASS: npm 237, dotnet 88, cargo 74 + UT-13 + 18 ITs, IT-10 (`--ignored`), all with `POPHOOD_OWNER_PC=1` | `build-log.txt`, `test-log.txt` |
| Plant check, unelevated | PASS: 7 runs, 65 copies, nothing from a plant folder, 164 sensors each | `dll-plant-check-unelevated-release.txt` |
| Plant check, elevated (owner) | PASS: `this shell elevated: True`, every hello elevated and PawnIO loaded, 258 sensors each | `dll-plant-check-elevated-release.txt` |
| Elevated AOT smoke (owner) | PASS: 258 sensors, both GPUs (38/38, 30/30), mean 1001.2 ms, exit 0 | `helper-smoke-elevated-release.txt` |
| E2E-24 | PASS: the import walk, `0800`, CRYPT32 delay-loaded, garbage plants exit 64, no DLL in the release folder, lock tamper fails with NU1403, submodule `3d331e3` | `e2e24-static-release.txt`, `e2e24-lock-tamper-release.txt` |
| E2E-19 on the clone | PASS: 12 of 12 RS0030; release and staged helpers unchanged | `e2e19-release.txt` |
| E2E-02 (owner clicks) | PASS. UAC in the foreground (owner: "Foreground"). Connecting → live 2.96 s by the fast poll (2.77 s by the watcher; T14 measured 2.68 s). The file lock showed 6 violations exactly during `consent.exe`. One elevated helper from +0 to 6 s. `pophood.exe` and all 6 WebView2 processes unelevated. Both GPUs, Disk and the IT8696E fans live | `e2e02.txt`, `e2e02-elevated-dashboard.png`, `e2e02-uia-tree.txt` |
| E2E-16 (owner, Process Monitor) | PASS. **0 events on a `.dll` in the helper's folder**, from both helpers (58,704 events). Control: the same filter on T14's capture finds its 12 probes. The 792 suspect rows fall in T14's accepted classes: 402 handle-tag `RegSetInfoKey`, 239 Perflib opens with no write, 147 opens of the `C:` volume, and the 4 ADL rows (accepted, in `WRITE-ALLOWLIST.md`). The only `RegSetValue`s are the 2 ADL values. Process Create: 0 | `e2e16.txt`, `e2e16-suspect.csv`, `e2e16-folder-dll-events.csv` (empty) |
| `audit-network.ps1 -Quick` | PASS: 5 of 5 flags, `QUICK CHECK PASSED` | `audit-network-quick-release.txt` |

Sensor output is unchanged: 258 elevated and 164 unprivileged. The 10 hardware ids and the per-device non-null/total counts are identical to the pre-fix helper's elevated smoke (`task_04.md`). LHM is untouched, so no P1 comparison is needed.

### Owner decisions at close (verbatim)

- E2E-02, UAC prompt: "Foreground".
- v0.1.0: "Sign off v0.1.0 (Recommended)".

### Follow-ups (not done in T15)

- The raw captures in `C:\Users\jimmy\pophood-e2e\t15-raw` are deleted (owner's request). T14's `target-oq13` is still there. Keep the `pophood-t15` clone while it's the build under test.
- E2E-02's Connecting → live was 2.96 s against a ~3 s bar (T14: 2.68 s). Watch it on the next elevated runs.
- The NVML `%ProgramW6432%` fallback stays UNVERIFIED (techspec Known Risks).
- `$confined` in `build-helper.ps1` duplicates `DllSearch.Assemblies`. The guard fails loudly on an addition, and `DllSearchTests` pins the names; one shared list would remove the duplication.
- T14's open follow-ups are unchanged (disclosure copy, the AGENTS.md "No network" line, the `audit-network.ps1` items).
- From the review (owner: "Follow-ups (Recommended)"):
  - **F12:** `AGENTS.md`'s load-path list doesn't say that `.local` and external-manifest redirection are blocked only because the helper embeds the SDK's default manifest (`asInvoker`); a `<NoWin32Manifest>` would open that path. One line, for the owner to approve with T14's pending `AGENTS.md` lines.
  - **F14:** rename `Native.LoadLibraryEx` to `LoadLibraryExW`, like `CreateFileW`. Do it with the next helper change: it changes the hash, so the regression rule runs.
  - **UNVERIFIED:** do per-user COM registrations (`HKCU\Software\Classes`) apply to the elevated helper's WMI and COM use? That would be another way for a same-user process to reach the elevated helper. Outside T15's scope.
- `untitled.md` and `untitled-2.md` in the repo root aren't from this session; they're untouched and uncommitted.

### Confidence

**Plan: 87%** (0.30·90 + 0.35·85 + 0.20·85 + 0.15·85). Assembly identity and delay-load under NativeAOT were unproven at plan time.

**Final: 94%** (0.30·96 + 0.35·95 + 0.20·90 + 0.15·90 = 28.8 + 33.25 + 18 + 13.5 = 93.55).

| Factor | Weight | Score | Evidence |
|---|---|---|---|
| Requirement/AC and changed-scope coverage | 30% | 96 | Every AC has release-build evidence, unelevated and elevated; the docs match the code; the owner approved the AGENTS.md text and the sign-off. −4: the exe's own CRYPT32 delay-load path (`SecureString`) is reachable only in theory and wasn't exercised |
| Direct source and executed-check evidence | 35% | 95 | The mechanism was read in .NET 10 source. Each check has a negative control on the old helper (plant check, E2E-24, the E2E-16 filter on T14's capture). The elevated runs used the release hash. −5: the plant check is a module snapshot, which Process Monitor covers |
| Data-flow, dependency and environment understanding | 20% | 90 | Every load path is mapped: static, transitive delay, lazy P/Invoke, `LoadLibrary`. −10: flag-0 delay imports are safe only because their first use comes after `Main` (documented and guarded); one Windows build tested; NVML fallback open |
| Risk and regressions | 15% | 90 | Sensor output unchanged; every suite passes; the CoreLib resolver changes how framework P/Invokes resolve, with no failure seen. −10: E2E-02's timing is close to its bar; the resolver list needs upkeep on dependency bumps (guarded) |

Remaining uncertainty: a runtime or LHM bump could add a pre-`Main` call into a flag-0 import, or a new P/Invoke assembly. The build guard, E2E-24 and the plant check are there to catch both. Only this PC's Windows build was tested.

## Review (review-implementation, 2026-10-22; `sessions/20261022125650_pophood-v010-t15-review/`)

**Scope:** commit `55d5b2a` plus the uncommitted close-out. Two independent lanes and one agent pass:
- **Lane A** traced every load path against .NET `release/10.0` (identical to the shipped `v10.0.13`). It ran `dumpbin`, replayed the map guard, and tested `.local` and external-manifest plants.
- **Lane B** checked whether the regression scripts can pass with the bug present, and checked each evidence row against this file's tables.

**Result:** no critical, high or medium defect in the helper; every load path is closed as built. All findings were in the scripts, the tests or the docs, so the helper and its hash (`5e0ebebe…`) are unchanged and the elevated evidence still counts.

| # | Where | Finding | Sev. | Owner decision |
|---|---|---|---|---|
| F1 | `dll-plant-check.ps1:50` | A relative or 8.3-form `-Work` never matched the module paths: a silent false PASS (string repro run). The recorded runs used the absolute default | Medium | Applied: a run fails unless the helper's module path equals `$exe` |
| F2 | `dll-plant-check.ps1:101` | The VERDICT ignored elevation | Low | Applied: FAIL when a `hello.elevated` differs from the shell; the PASS line shows it |
| F4 | `e2e24-static.ps1:41` | `-band 0x800` accepted `0xA00` (adds the app folder) | Low | Applied: the flag must be exactly `0x0800` |
| F8 | `DllSearchTests.cs` | Only the planted-copy test tells System32-only from the default search | Low | Applied: it now asks for `AssemblyDirectory`, and `Resolve_IgnoresTheRequestedSearchPath` is merged into it (22 → 21 tests) |
| F13 | `task_15.md` § Follow-ups | The `t15-raw` deletion was already done | Low | Applied |
| F12 | `AGENTS.md` | The embedded manifest's role against `.local` and external-manifest redirection isn't written down | Low | Follow-up (owner: "Follow-ups (Recommended)") |
| F14 | `Native.cs:19` | `LoadLibraryEx` breaks the file's `W` naming (`CreateFileW`) | Low | Follow-up, with the next helper change |
| — | HKCU COM | Whether per-user COM registrations reach the elevated helper (UNVERIFIED, outside T15) | — | Follow-up |
| F3, F5–F7, F9–F11 | scripts, tests | Exit 0 on FAIL; KnownDLL delay imports not walked (E2E-16 covers them); E2E-16 filter from `$Rel` (verified correct, negative control holds); `ControlLib`/`Ftd2xx` can't be planted (logged); a cleanup throw can mask a failing assertion; an empty `helper image:` line; a hard-coded map path | Low | Proceed as-is |

Anti-overengineering: the three copies of the assembly list (known follow-up), the 10-row System32 theory and the release hash in two session scripts stay as they are. The name check in `Resolve`, `TryConfine`'s exit 70 and the map guard each block a real bypass: keep.

**Re-run after the fixes (unelevated, agent; evidence in the review session's `evidences/`):**

| Check | Result | Evidence |
|---|---|---|
| `dotnet test helper.Tests -r win-x64` | PASS 87 (88 − the merged test) | `dotnet-test.txt` |
| Plant check, release helper `5e0ebebe…` | PASS: 7 runs, elevated False, 65 copies, nothing from a plant folder, 164 sensors each | `dll-plant-check-unelevated-release.txt` |
| Plant check, pre-fix helper `11a0ed2b…` (negative control) | FAIL as expected: DPAPI, setupapi, cfgmgr32, ntdll from the folder; `all` and `user32` crash `0xC000041D` | `dll-plant-check-old-helper-unelevated.txt` |
| Plant check, release helper with `-Work .\plant-rel` (F1 control) | FAIL as expected: every run stops at the module-path check; the helper exits 0 | `dll-plant-check-relative-work.txt` |
| E2E-24 import walk, release helper | PASS, `0x0800`; same output as T15's release run | `e2e24-static-release.txt` |

No helper code changed, so the regression rule (build, `cargo test`, E2E-19, the elevated smoke) doesn't apply. The elevated plant check isn't repeated: its evidence shows an elevated shell and every `hello` elevated, so the new checks would have passed.

**Confidence:** before the fixes **92%** (0.30·95 + 0.35·92 + 0.20·90 + 0.15·90). After: **93%** (0.30·96 + 0.35·94 + 0.20·90 + 0.15·90 = 28.8 + 32.9 + 18 + 13.5 = 93.2). The F1 fix is proven by an executed negative control. It isn't higher because only one PC and Windows build were tested, the hardware-only paths (ControlLib, FTDI) didn't run, KnownDLL delay-import behaviour rests on the docs, and the HKCU COM question is open.

## Follow-ups session (2026-10-22; `sessions/20261022132420_pophood-v010-followups/`)

Owner: "All v0.1.0 follow-ups". Every answer is verbatim in that folder's `owner-decisions.md`.

| Follow-up | Outcome | Evidence |
|---|---|---|
| HKCU COM question (review) | **Closed, not reachable.** Windows ignores per-user COM classes for UAC-elevated processes (Microsoft Learn, "The COM Elevation Moniker"). E2E-16's capture shows the elevated helper made no CLSID lookup in 30 s live; its one COM registry read went to the machine view | `evidences/helper-env-checks.txt` §5 |
| NVML `%ProgramW6432%` fallback | **Confirmed, then fixed.** A same-user `HKCU\Environment` value sets `ProgramW6432` (owner: "Run it (Recommended)"). The helper's third act pins it to the Program Files known folder (owner: "Fix now, bundle F14 (Recommended)"; ADR 0028). The only environment-built load path; `DOTNET_GCName` / `GCPath` load nothing | `nvml-env-probe.txt`, `env-pin-check-new.txt` (PASS), `env-pin-check-old-helper.txt` (negative control: FAIL) |
| F14 (`LoadLibraryExW`) | Done, in the same helper change | — |
| F12 manifest line, T14 and T15 `AGENTS.md` lines | Applied (owner: "Approve as drafted (Recommended)"), plus the new "Paths built from the environment" line | `AGENTS.md` |
| `login.live.com` disclosure | README and trust panel (owner: "Full sentence in the row (Recommended)"); UT-27 updated; renders in full at 1024×680 | `trust-panel-1024x680.png` |
| One list for `$confined` and `DllSearch.Assemblies` | `DllSearchTests` reads `$confined` from `build-helper.ps1`; its own copy is gone. A name added to one list only fails `dotnet test` (negative control run) | `dotnet-test.txt` |
| `audit-network.ps1` (T14's four items) | Window-class close, requester names and services, WAM / OnlineId loads, ADR 0024 verdict, pktmon parse (owner: "All four, one capture (Recommended)"; ADR 0029). Checked offline and unelevated; the elevated capture is the owner's | `audit-offline-check.txt`, `audit-network-quick.txt` |
| `target-oq13` | Deleted (owner: "You delete it, I'll run it"), after its running app was closed (owner: "Close it (Recommended)") | — |

**Regression rule for the helper change (working tree, helper `0c90a8c4…`):** build PASS (36 P/Invoke modules, each covered); `dotnet test` 87 PASS; `cargo test -- --include-ignored` PASS (74 + 1 + 19); E2E-19 12 of 12 RS0030; E2E-24 PASS (`0x0800`); plant check unelevated PASS (7 runs, 164 sensors each).

**Release build of record:** a fresh clone of `1a51df2` in `C:\Users\jimmy\pophood-e2e\pophood-followups` (`release-build.ps1`), helper `553a7f496e4f2dc2cd1590d6bd127f47384351f5fb7b25b2c05615937b357936`. Every check passes on it:

| Check | Result | Evidence (session `evidences/`) |
|---|---|---|
| Clone, README build, every suite | PASS: map guard 36 modules; npm 237, dotnet 87, cargo 74 + UT-13 + 18 ITs, IT-10 (`--ignored`), all with `POPHOOD_OWNER_PC=1` | `release-build-log.txt`, `release-test-log.txt` |
| E2E-19 | 12 of 12 RS0030; release and staged helpers unchanged | `e2e19-release.txt` |
| E2E-24 import walk | PASS: `0x0800`, CRYPT32 delay-loaded, garbage plants exit 64 | `e2e24-static-release.txt` |
| Plant check, unelevated | PASS: 7 runs, 65 copies, nothing from a plant folder, 164 sensors each | `dll-plant-check-unelevated-release.txt` |
| Plant check, elevated (owner) | PASS: 7 runs, `this shell elevated: True`, every hello elevated and PawnIO loaded, 258 sensors each | `dll-plant-check-elevated-release.txt` |
| Elevated AOT smoke (owner) | PASS: 258 sensors, both GPUs (38/38, 30/30), mean 1000.5 ms, exit 0 on disconnect | `helper-smoke-elevated-release.txt` |
| `env-pin-check.ps1` | PASS: `ProgramW6432` pinned to `C:\Program Files` | `env-pin-check-release.txt` |
| `audit-network.ps1 -Quick` | PASS: 5 of 5 flags; the app's and the browser's PIDs are gone afterwards | `audit-network-quick-release.txt` |
| E2E-15 180 s capture, run 1 (owner) | OVERALL PASS, but not the scripted flow: every cue printed empty (bug below), so Enable came at t 121.7 s, with no drill-down or theme switch (owner: "Enable at ~120 s only"). Kept as a record | `audit-network-180s.txt`, `audit-network-180s/` |
| E2E-15 180 s capture, run 2 (owner, fixed script) | OVERALL PASS: the three cues printed; elevated helper from t 65.2 s; no flow and no DNS from the tree; WAM t 0.6 s, OnlineId t 30.9 s; no watch-list DNS at all (`wlidsvc` didn't start); the script's close ended the app | `audit-network-180s-run2.txt`, `audit-network-180s-run2/` |

- **Bug fixed: the capture's cues were always empty** (`scripts/audit-network.ps1:300`, since `920b1e2`). On an `[ordered]` dictionary, `$cues[$c]` with an int key is a position, so it returned `$null`. The loop now goes over `$cues.GetEnumerator()` (owner: "Fix cue, re-run (c) (Recommended)"). Negative control: over a simulated 0–185 s, the old line prints run 1's three empty cues and the new one prints each cue once. Earlier E2E-15 captures had empty cues too; the timings came from the runbooks.
- **ADR 0029's verdict on a real lookup (run 1):** `services.exe` started `wlidsvc` at t 9.7 s, and it resolved `login.live.com` at once (16 Dnscache and 4 `wlidsvc` rows, all `Disclosed=True`). The same poll first saw `MicrosoftAccountWAMExtension.dll` in the browser, 21 s before the crashpad handler's OnlineId load. So the browser's WAM path can come before the lookup too, not only ADR 0024's OnlineId path (about 30 s in); the poll shows timing, not cause. Same disclosed class: the README and trust-panel copy state no timing. With T14's 3 of 11, the lookup is now seen in 4 of 13 watched launches.
