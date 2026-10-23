# Pophood v0.6.0: disk benchmark (slice 6)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 6 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.3.0](../v0.3.0/README.md): the test-runner seam, SQLite and traces.

## Goal

The owner runs the disk benchmark on a chosen drive and gets CrystalDiskMark-comparable MB/s for the 4 default profiles.

## Requirements delivered

- **RF18**, with CDM 9.x defaults and the flags calibrated in P4 (OQ2, within ±5%):
  - 1 warm-up plus 3 passes, keeping the best;
  - 5 s per test, 5 s between tests;
  - a 1 GiB test file;
  - decimal MB/s.
- **RF14:** `diskspd.exe` is hash-verified before every run.
- **The temp file** is deleted on success, failure and cancel, plus a startup sweep for files left behind.
- **Free-space check** before the run.
- **Write-volume warning** before the run: about 234 GB on the NV3.

## Inherited from earlier versions

- **The trusted hash is compiled into `pophood.exe` by `build.rs`.** The helper has done this since v0.1.0 (answer #39); add `diskspd.exe` the same way.
- **The P4 precedent:** `C:\Users\jimmy\pophood-probes\probe-diskspd\` (`build.ps1`, `repro.props`, `calibrate.ps1`).
- **DiskSpd source:** tag `v2.3`, commit `5e7025b`. Its release zip has a no-redistribution EULA, so ship the source build only.

## Handed over from v0.1.0

- **The drive letter on the Disk card** ("Disk · C:"). This needs a volume mapping, which the drive picker needs anyway.
- **Add the DiskSpd build notes to `AGENTS.md`:**
  - the ATL component (`Microsoft.VisualStudio.Component.VC.ATL`);
  - toolset `v143` instead of `v145`;
  - the C runtime: ship the VC++ runtime DLLs, or build with `/MT`;
  - `/experimental:deterministic /pathmap /PDBALTPATH`.

## Open questions for this techspec

- **The C runtime:** `/MT` or shipping the VC++ runtime DLLs.
- **Where the temp file goes:** a location on the chosen drive that the unprivileged user can write to.
- **Recalibration** for any DiskSpd version or argument change (C9). Skill draft: `disk-calibration-vs-cdm`.

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 6 first.
- Every release re-runs the network audit (P5 method).
