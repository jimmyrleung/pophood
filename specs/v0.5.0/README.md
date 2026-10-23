# Pophood v0.5.0: GPU benchmark (slice 5)

- **Status:** not started. This is a scope stub; the techspec comes next.
- **Umbrella requirements:** [v0.1.0/requirements.md](../v0.1.0/requirements.md), [slice 5 in "Later slices"](../v0.1.0/requirements.md#later-slices-in-order), and the [version map](../v0.1.0/requirements.md#version-map).
- **Builds on:** [v0.3.0](../v0.3.0/README.md): the test-runner seam, SQLite and traces.

## Goal

The owner runs the GPU benchmark on a chosen adapter, defaulting to the discrete GPU, and sees FP32 throughput and VRAM bandwidth.

## Requirements delivered

- **RF17:** D3D12 compute, written in Rust.
- **Adapter picker:** defaults to the high-performance adapter via `IDXGIFactory6::EnumAdapterByGpuPreference`; software adapters are excluded.
- **Budget:** ≤ 10 s. P3 measured about 1.5 s.

## Inherited from earlier versions

- **The P3 precedent:** `C:\Users\jimmy\pophood-probes\probe-bench\src\bin\gpu.rs` and `shaders\bench.hlsl`.
  - It reached ~97% of spec on the RTX 5060 Ti.
  - It also works on the iGPU.
- **HLSL** is compiled at build time with the Windows SDK's `dxc.exe` (C10).

## Handed over from v0.1.0

- **"GPU · discrete" / "GPU · integrated" card labels.** LHM can't tell them apart. D3D12 `D3D12_FEATURE_DATA_ARCHITECTURE.UMA` can, so match adapters to LHM GPU cards.
- **GPU order.** v0.1.0 sorts GPU cards and chart slots by LHM's `GPU Memory Total`, largest first (`gpuOrder` in `src/cards/fields.ts`), because LHM lists the AMD iGPU before the RTX. Replace that heuristic with the D3D12 `UMA` answer: discrete adapters first.
- **The AMD iGPU's sensor meaning.** `GPU Core` power reads 33–43 W, which looks like SoC power, and the only temperature is `GPU VR SoC`. Revisit the card labels with the D3D12 data.

## Open questions for this techspec

- **The shader compiler:** DXC or FXC. Precompile, or compile at runtime? Can `dxcompiler.dll` be redistributed? (Unverified.)
- **Matching** DXGI adapters to LHM GPU hardware, by LUID or by name.
- **Resource-state promotion** was never validated, because the D3D12 debug layer isn't installed (P3).

## Before the techspec

- Check that the umbrella requirements are detailed enough for this slice. If they aren't, run `define-reqs` scoped to slice 5 first.
- Every release re-runs the network audit (P5 method).
