import { describe, expect, it } from "vitest";
import full from "../test/fixtures/frame-full.json";
import noPawnio from "../test/fixtures/frame-elevated-no-pawnio.json";
import reduced from "../test/fixtures/frame-reduced.json";
import { liveElevated, liveReduced, sensor } from "../test/builders";
import type { SensorStatus, UiFrame, UiHardware, UiSensor } from "../sensors/protocol";
import { buildDashboard, cleanName, componentName, componentScope, drillSections, fanScale, gpuOrder, jedecSpeed, type CardModel, type Cell } from "./fields";

const FULL = full as UiFrame;
const REDUCED = reduced as UiFrame;
const NO_PAWNIO = noPawnio as UiFrame;

const fullStatus = (): SensorStatus => liveElevated();
const reducedStatus = (): SensorStatus => liveReduced();
const noPawnioStatus = (): SensorStatus => liveElevated({ installed: false, version: null, loaded: false });

const clone = <T,>(value: T): T => structuredClone(value);

function card(model: ReturnType<typeof buildDashboard>, id: string): CardModel {
  const found = model.cards.find((c) => c.id === id);
  if (!found) throw new Error(`no card ${id}: ${model.cards.map((c) => c.id).join(", ")}`);
  return found;
}

const text = (c: Cell): string => (c.kind === "value" ? `${c.value} ${c.unit}`.trim() : c.kind === "locked" ? c.label : "—");
const field = (c: CardModel, id: string) => c.fields.find((f) => f.id === id)!;

function hw(id: string, type: string, name: string, parent: string | null = null): UiHardware {
  return { id, type, name, parent };
}

/** A small hand-made frame for the fallback tests. */
function custom(hardware: UiHardware[], sensors: UiSensor[], overrides: Partial<UiFrame> = {}): UiFrame {
  return { seq: 1, t: 1000, periodMs: 1000, elevated: true, memory: [], hardware, sensors, ...overrides };
}

describe("cards and order (UT-37)", () => {
  it("lists CPU, Memory, GPUs in gpuOrder, Disk and Motherboard for the full frame", () => {
    const model = buildDashboard(FULL, fullStatus());
    expect(model.starting).toBe(false);
    expect(model.cards.map((c) => c.id)).toEqual([
      "cpu:/amdcpu/0",
      "memory",
      "gpu:/gpu-nvidia/0",
      "gpu:/gpu-amd/0",
      "disk:/nvme/0",
      "motherboard",
    ]);
  });

  it("returns the starting model when there is no frame", () => {
    const model = buildDashboard(null, reducedStatus());
    expect(model).toMatchObject({ starting: true, cards: [], summary: "" });
  });

  it("uses the kind labels GPU and Disk, with no discrete/integrated or drive-letter suffix", () => {
    const model = buildDashboard(FULL, fullStatus());
    expect(model.cards.map((c) => c.kindLabel)).toEqual(["CPU", "Memory", "GPU", "GPU", "Disk", "Motherboard"]);
  });

  it("drops (TM) and (R) from titles", () => {
    const model = buildDashboard(FULL, fullStatus());
    expect(card(model, "gpu:/gpu-amd/0").title).toBe("AMD Radeon Graphics");
    expect(card(model, "gpu:/gpu-nvidia/0").title).toBe("NVIDIA GeForce RTX 5060 Ti");
    expect(card(model, "disk:/nvme/0").title).toBe("KINGSTON SNV3S1000G");
    expect(card(model, "cpu:/amdcpu/0").title).toBe("AMD Ryzen 9 9900X");
    expect(cleanName("Intel(R) Core(TM) i7-14700K")).toBe("Intel Core i7-14700K");
  });

  it("gpuOrder puts the RTX (16311 MiB) before the iGPU (512 MiB), though LHM lists the iGPU first", () => {
    expect(FULL.hardware.filter((h) => h.type.startsWith("Gpu")).map((h) => h.id)).toEqual(["/gpu-amd/0", "/gpu-nvidia/0"]);
    expect(gpuOrder(FULL)).toEqual(["/gpu-nvidia/0", "/gpu-amd/0"]);
  });

  it("gpuOrder keeps LHM order on ties and puts hardware without a total last", () => {
    const frame = custom(
      [hw("/gpu-amd/0", "GpuAmd", "A"), hw("/gpu-amd/1", "GpuAmd", "B"), hw("/gpu-intel/0", "GpuIntel", "C"), hw("/gpu-nvidia/0", "GpuNvidia", "D")],
      [
        sensor("/gpu-amd/0/smalldata/2", "GPU Memory Total", 1024, "SmallData", "/gpu-amd/0"),
        sensor("/gpu-amd/1/smalldata/2", "GPU Memory Total", 1024, "SmallData", "/gpu-amd/1"),
        sensor("/gpu-nvidia/0/smalldata/2", "GPU Memory Total", 8192, "SmallData", "/gpu-nvidia/0"),
      ],
    );
    expect(gpuOrder(frame)).toEqual(["/gpu-nvidia/0", "/gpu-amd/0", "/gpu-amd/1", "/gpu-intel/0"]);
  });

  it("builds the header summary for the full frame", () => {
    expect(buildDashboard(FULL, fullStatus()).summary).toBe(
      "AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E · 2 × 16 GB DDR5-6000 · NVIDIA GeForce RTX 5060 Ti · AMD Radeon Graphics · KINGSTON SNV3S1000G",
    );
  });

  it("leaves the drive out of the header in reduced mode", () => {
    expect(buildDashboard(REDUCED, reducedStatus()).summary).toBe(
      "AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E · 2 × 16 GB DDR5-6000 · NVIDIA GeForce RTX 5060 Ti · AMD Radeon Graphics",
    );
  });

  it("picks each card's sparkline source and domain", () => {
    const model = buildDashboard(FULL, fullStatus());
    expect(card(model, "cpu:/amdcpu/0").spark).toEqual({ keys: ["/amdcpu/0/temperature/2|Core (Tctl/Tdie)"], domain: [20, 100], growToFit: false });
    const memory = card(model, "memory").spark!;
    expect(memory.keys).toEqual(["/ram/data/0|Memory Used"]);
    expect(memory.domain[0]).toBe(0);
    expect(memory.domain[1]).toBeCloseTo(23.113663 + 7.9995995, 5);
    expect(card(model, "gpu:/gpu-nvidia/0").spark).toEqual({ keys: ["/gpu-nvidia/0/temperature/0|GPU Core"], domain: [20, 100], growToFit: false });
    expect(card(model, "disk:/nvme/0").spark).toEqual({
      keys: ["/nvme/0/throughput/54|Read Rate", "/nvme/0/throughput/55|Write Rate"],
      domain: [0, 10e6],
      growToFit: true,
    });
    expect(card(model, "motherboard").spark).toBeNull();
  });

  it("switches the CPU sparkline to load when the temperature is locked", () => {
    const cpu = card(buildDashboard(REDUCED, reducedStatus()), "cpu:/amdcpu/0");
    expect(cpu.spark).toEqual({ keys: ["/amdcpu/0/load/0|CPU Total"], domain: [0, 100], growToFit: false });
  });
});

describe("CPU rules (UT-14)", () => {
  const cpu = () => card(buildDashboard(FULL, fullStatus()), "cpu:/amdcpu/0");

  it("shows the package temperature as the hero", () => {
    expect(cpu().hero).toEqual({ label: "Package temperature", cell: { kind: "value", value: "65.6", unit: "°C" } });
  });

  it("then total load, effective clock in GHz, package power and the hottest CCD", () => {
    expect(text(field(cpu(), "total-load").cell)).toBe("12 %");
    expect(text(field(cpu(), "effective-clock").cell)).toBe("0.66 GHz avg");
    expect(text(field(cpu(), "package-power").cell)).toBe("70.8 W");
    expect(field(cpu(), "hottest").label).toBe("Hottest CCD");
    expect(text(field(cpu(), "hottest").cell)).toBe("62.5 °C · CCD1");
  });

  it("never uses the nominal clock as the effective clock", () => {
    expect(text(field(cpu(), "effective-clock").cell)).not.toContain("4.67");
  });
});

describe("reduced fixture (UT-15)", () => {
  const model = () => buildDashboard(REDUCED, reducedStatus());

  it("falls back to Total load, with a locked Package temperature", () => {
    const cpu = card(model(), "cpu:/amdcpu/0");
    expect(cpu.hero).toEqual({ label: "Total load", cell: { kind: "value", value: "15", unit: "%" } });
    expect(field(cpu, "package-temperature").cell).toEqual({ kind: "locked", label: "Needs full sensors" });
    expect(field(cpu, "effective-clock").cell).toEqual({ kind: "locked", label: "Needs full sensors" });
    expect(field(cpu, "package-power").cell).toEqual({ kind: "locked", label: "Needs full sensors" });
  });

  it("shows 'Hottest core' locked, with no suffix", () => {
    const hottest = field(card(model(), "cpu:/amdcpu/0"), "hottest");
    expect(hottest.label).toBe("Hottest core");
    expect(hottest.cell).toEqual({ kind: "locked", label: "Needs full sensors" });
  });

  it("shows the Disks and Motherboard placeholders, which can't be opened", () => {
    const disks = card(model(), "disk-placeholder");
    expect(disks).toMatchObject({
      variant: "placeholder",
      kindLabel: "Disks",
      lock: "Needs full sensors",
      note: "Drives, throughput, temperature and SMART health are read by the elevated helper.",
      clickable: false,
    });
    const board = card(model(), "motherboard-placeholder");
    expect(board).toMatchObject({
      variant: "placeholder",
      kindLabel: "Motherboard",
      lock: "Needs full sensors",
      note: "The fan chip needs the helper elevated and PawnIO.",
      clickable: false,
    });
  });

  it("hides the OC profile and keeps the Memory card to used/total and configured speed", () => {
    const memory = card(model(), "memory");
    expect(memory.oc).toBeNull();
    expect(memory.fields.map((f) => f.id)).toEqual(["configured-speed"]);
    expect(text(memory.hero!.cell)).toBe("22.6 / 31.1 GB");
  });

  it("GPUs read normally without elevation", () => {
    const rtx = card(model(), "gpu:/gpu-nvidia/0");
    expect(text(rtx.hero!.cell)).toBe("30.0 °C");
    expect(text(field(rtx, "load").cell)).toBe("2 %");
  });
});

describe("elevated without PawnIO (UT-16)", () => {
  const model = () => buildDashboard(NO_PAWNIO, noPawnioStatus());

  it("shows the Disk card live", () => {
    const disk = card(model(), "disk:/nvme/0");
    expect(disk.variant).toBe("normal");
    expect(text(disk.heroes[0].cell)).toMatch(/MB\/s read$/);
    expect(text(field(disk, "temperature").cell)).toMatch(/°C$/);
  });

  it("shows CPU fields as 'Needs PawnIO', never a 0", () => {
    const cpu = card(model(), "cpu:/amdcpu/0");
    expect(cpu.hero!.label).toBe("Total load");
    expect(field(cpu, "package-temperature").cell).toEqual({ kind: "locked", label: "Needs PawnIO" });
    expect(field(cpu, "effective-clock").cell).toEqual({ kind: "locked", label: "Needs PawnIO" });
    expect(field(cpu, "package-power").cell).toEqual({ kind: "locked", label: "Needs PawnIO" });
    for (const f of cpu.fields) {
      if (f.cell.kind === "value") expect(f.cell.value).not.toBe("0");
    }
  });

  it("shows the Motherboard placeholder as 'Needs PawnIO'", () => {
    expect(card(model(), "motherboard-placeholder")).toMatchObject({
      variant: "placeholder",
      lock: "Needs PawnIO",
      note: "The fan chip is read through PawnIO, which isn't installed.",
    });
  });

  it("explains a driver that isn't running differently from a missing PawnIO", () => {
    const status = liveElevated({ installed: true, version: "2.2.0.0", loaded: false });
    expect(card(buildDashboard(NO_PAWNIO, status), "motherboard-placeholder").note).toBe(
      "The fan chip is read through PawnIO, whose driver isn't running.",
    );
  });
});

describe("empty states (UT-17)", () => {
  it("no GPU → 'No GPU detected'", () => {
    const frame = clone(FULL);
    frame.hardware = frame.hardware.filter((h) => !h.type.startsWith("Gpu"));
    frame.sensors = frame.sensors.filter((s) => !s.hw.startsWith("/gpu"));
    const empty = card(buildDashboard(frame, fullStatus()), "gpu-empty");
    expect(empty).toMatchObject({ variant: "empty", title: "No GPU detected", note: "LHM found no graphics adapter it can read.", clickable: false });
  });

  it("elevated with no Storage → 'No drives detected'", () => {
    const frame = clone(NO_PAWNIO);
    frame.hardware = frame.hardware.filter((h) => h.type !== "Storage");
    frame.sensors = frame.sensors.filter((s) => !s.hw.startsWith("/nvme"));
    expect(card(buildDashboard(frame, noPawnioStatus()), "disk-empty")).toMatchObject({ variant: "empty", title: "No drives detected" });
  });

  it("PawnIO usable but no SuperIO or EC → 'No fan chip detected'", () => {
    const frame = clone(FULL);
    frame.hardware = frame.hardware.filter((h) => h.type !== "SuperIO");
    frame.sensors = frame.sensors.filter((s) => !s.hw.startsWith("/lpc"));
    expect(card(buildDashboard(frame, fullStatus()), "motherboard-empty")).toMatchObject({
      variant: "empty",
      title: "No fan chip detected",
      note: "LHM doesn't support this board's fan chip yet.",
    });
  });

  it("SuperIO present with no Fan sensors → 'No fans detected'", () => {
    const frame = clone(FULL);
    frame.sensors = frame.sensors.filter((s) => s.type !== "Fan" || s.hw !== "/lpc/it8696e/0");
    expect(card(buildDashboard(frame, fullStatus()), "motherboard-empty")).toMatchObject({ variant: "empty", title: "No fans detected" });
  });
});

describe("OC profile (UT-18)", () => {
  it.each([
    [0.416, 4800],
    [0.357, 5600],
    [0.312, 6400],
    [0.625, 3200],
    [0.75, 2666],
    [0.938, 2133],
    [0.682, 2933],
    [1.071, 1866],
  ])("jedecSpeed(%f ns) = %d", (tck, expected) => {
    expect(jedecSpeed(tck)).toBe(expected);
  });

  const withSpeed = (configured: number, tck: number): CardModel => {
    const frame = clone(FULL);
    frame.memory.forEach((m) => (m.configuredMTs = configured));
    frame.sensors.filter((s) => s.name === "tCKAVGmin (Minimum Cycle Time)").forEach((s) => (s.value = tck));
    return card(buildDashboard(frame, fullStatus()), "memory");
  };

  it("configured 6000 against 4800 is 'Likely on · inferred', with the caption", () => {
    expect(withSpeed(6000, 0.416).oc).toEqual({
      chip: "Likely on · inferred",
      caption: "Inferred: configured 6000 MT/s is above the SPD JEDEC speed of 4800 MT/s.",
    });
  });

  it("configured at the JEDEC speed is 'Likely off · inferred'", () => {
    expect(withSpeed(4800, 0.416).oc?.chip).toBe("Likely off · inferred");
    expect(withSpeed(4800, 0.416).oc?.caption).toBe("Inferred: configured 4800 MT/s matches the SPD JEDEC speed of 4800 MT/s.");
  });

  it("DDR4: 2666 against tCK 0.750 is 'Likely off' (rounding to 100 would have said 2700)", () => {
    expect(withSpeed(2666, 0.75).oc?.chip).toBe("Likely off · inferred");
  });

  it("is hidden in reduced mode and when stale", () => {
    expect(card(buildDashboard(REDUCED, reducedStatus()), "memory").oc).toBeNull();
    expect(card(buildDashboard(FULL, fullStatus(), { stale: true }), "memory").oc).toBeNull();
  });
});

describe("GPU rules (UT-19)", () => {
  const model = () => buildDashboard(FULL, fullStatus());

  it("NVIDIA: load is GPU Core, power is GPU Package, temperature is GPU Core", () => {
    const rtx = card(model(), "gpu:/gpu-nvidia/0");
    expect(text(rtx.hero!.cell)).toBe("30.4 °C");
    expect(text(field(rtx, "load").cell)).toBe("2 %");
    expect(text(field(rtx, "core-clock").cell)).toBe("465 MHz");
    expect(text(field(rtx, "power").cell)).toBe("12.1 W");
  });

  it("AMD iGPU: load is D3D 3D, temperature is GPU VR SoC, VRAM 512 MiB is 0.5 GB", () => {
    const igpu = card(model(), "gpu:/gpu-amd/0");
    expect(text(igpu.hero!.cell)).toBe("51.0 °C");
    expect(text(field(igpu, "load").cell)).toBe("5 %");
    expect(text(field(igpu, "power").cell)).toBe("43.0 W");
    expect(text(field(igpu, "vram").cell)).toBe("0.4 / 0.5 GB");
    expect(field(igpu, "vram").bar).toBeCloseTo(413.76 / 512, 1);
  });

  it("the VRAM bar is used over total", () => {
    const rtx = card(model(), "gpu:/gpu-nvidia/0");
    expect(text(field(rtx, "vram").cell)).toBe("2.4 / 15.9 GB");
    expect(field(rtx, "vram").bar).toBeCloseTo(2429 / 16311, 5);
  });
});

describe("Motherboard rules (UT-20)", () => {
  const board = () => card(buildDashboard(FULL, fullStatus()), "motherboard");

  it("titles the card with the board and chip names verbatim", () => {
    expect(board().title).toBe("Gigabyte B850 EAGLE WIFI6E · ITE IT8696E");
  });

  it("lists spinning fans as rows and counts the rest in the footer", () => {
    const { fans } = board();
    expect(fans!.rows.map((r) => [r.name, text(r.cell)])).toEqual([
      ["Fan #1", "1,744 RPM"],
      ["Fan #5", "1,688 RPM"],
    ]);
    expect(fans!.footer).toBe("4 more fan headers read 0 RPM.");
  });

  it("scales the bars to 2000 RPM, or to the next 500 above the top fan", () => {
    expect(fanScale(1744)).toBe(2000);
    expect(fanScale(2140)).toBe(2500);
    expect(fanScale(0)).toBe(2000);
    expect(board().fans!.rows[0].fraction).toBeCloseTo(1744.186 / 2000, 5);
  });

  it("has no sparkline and no Voltage on any card", () => {
    const model = buildDashboard(FULL, fullStatus());
    expect(card(model, "motherboard").spark).toBeNull();
    const voltageKeys = new Set(FULL.sensors.filter((s) => s.type === "Voltage").map((s) => s.key));
    expect(voltageKeys.size).toBeGreaterThan(0);
    for (const c of model.cards) {
      for (const key of [...(c.spark?.keys ?? []), ...(c.fans?.rows.map((r) => r.key) ?? [])]) expect(voltageKeys.has(key)).toBe(false);
    }
    for (const metric of model.history) for (const s of metric.series) expect(voltageKeys.has(s.key ?? "")).toBe(false);
  });
});

describe("Disk and Memory rules (UT-30)", () => {
  it("formats Disk heroes in decimal MB/s, temperature at 0 dp and Life as '% life left'", () => {
    const disk = card(buildDashboard(FULL, fullStatus()), "disk:/nvme/0");
    expect(disk.heroes.map((h) => text(h.cell))).toEqual(["0.0 MB/s read", "0.4 MB/s write"]);
    expect(text(field(disk, "temperature").cell)).toBe("31 °C");
    expect(text(field(disk, "smart").cell)).toBe("97 % life left");
  });

  it("gives two cards for two drives, and falls back through the temperature chain", () => {
    const frame = clone(FULL);
    frame.hardware.push(hw("/nvme/1", "Storage", "SECOND DRIVE"));
    frame.sensors.push(
      sensor("/nvme/1/temperature/1", "Temperature #1", 44.4, "Temperature", "/nvme/1"),
      sensor("/nvme/1/temperature/2", "Temperature #2", 70, "Temperature", "/nvme/1"),
    );
    const model = buildDashboard(frame, fullStatus());
    const disks = model.cards.filter((c) => c.kind === "disk");
    expect(disks.map((c) => c.title)).toEqual(["KINGSTON SNV3S1000G", "SECOND DRIVE"]);
    // No "Composite Temperature" or "Temperature" on the second drive: the first Temperature sensor is used.
    expect(text(field(disks[1], "temperature").cell)).toBe("44 °C");
  });

  it("titles Memory '2 × 16 GB DDR5', or the total when sizes differ", () => {
    expect(card(buildDashboard(FULL, fullStatus()), "memory").title).toBe("2 × 16 GB DDR5");
    const unequal = clone(FULL);
    unequal.memory = [
      { locator: "A", sizeGB: 16, type: "DDR5", configuredMTs: 6000 },
      { locator: "B", sizeGB: 8, type: "DDR5", configuredMTs: 5600 },
    ];
    const model = buildDashboard(unequal, fullStatus());
    expect(card(model, "memory").title).toBe("24 GB DDR5");
    expect(text(field(card(model, "memory"), "configured-speed").cell)).toBe("6000 MT/s");
  });

  it("computes used / (used + available) because LHM has no total sensor", () => {
    const memory = card(buildDashboard(FULL, fullStatus()), "memory");
    expect(text(memory.hero!.cell)).toBe("23.1 / 31.1 GB");
  });
});

describe("lock labels (UT-31)", () => {
  /** A frame with one CPU whose Effective clock (needs PawnIO) is null, and one drive whose read rate (needs admin) is null. */
  const nullFrame = (elevated: boolean) =>
    custom(
      [hw("/amdcpu/0", "Cpu", "CPU"), hw("/nvme/0", "Storage", "Drive")],
      [
        sensor("/amdcpu/0/clock/2", "Cores (Average Effective)", null, "Clock", "/amdcpu/0"),
        sensor("/nvme/0/throughput/54", "Read Rate", null, "Throughput", "/nvme/0"),
      ],
      { elevated },
    );
  const status = (elevated: boolean, installed: boolean, loaded: boolean | null): SensorStatus =>
    elevated ? liveElevated({ installed, version: installed ? "2.2.0.0" : null, loaded }) : liveReduced({ pawnIo: { installed, version: null, loaded } });

  it.each([
    // elevated, installed, loaded → [needs PawnIO field, needs admin field]
    [false, true, null, "Needs full sensors", "Needs full sensors"],
    [false, false, null, "Needs full sensors", "Needs full sensors"],
    [true, true, true, "—", "—"],
    [true, true, null, "—", "—"],
    [true, true, false, "Needs PawnIO", "—"],
    [true, false, false, "Needs PawnIO", "—"],
    [true, false, null, "Needs PawnIO", "—"],
  ] as const)("elevated=%s installed=%s loaded=%s", (elevated, installed, loaded, pawnioLabel, adminLabel) => {
    const model = buildDashboard(nullFrame(elevated), status(elevated, installed, loaded));
    const cpu = card(model, "cpu:/amdcpu/0");
    expect(text(field(cpu, "effective-clock").cell)).toBe(pawnioLabel);
    if (elevated) {
      const disk = card(model, "disk:/nvme/0");
      expect(text(disk.heroes[0].cell)).toBe(adminLabel);
    } else {
      expect(card(model, "disk-placeholder").lock).toBe(adminLabel);
    }
  });

  it("a null value never renders a digit, whatever the label", () => {
    for (const [frame, status] of [
      [REDUCED, reducedStatus()],
      [NO_PAWNIO, noPawnioStatus()],
    ] as const) {
      const model = buildDashboard(frame, status);
      for (const c of model.cards) {
        for (const f of c.fields) if (f.cell.kind !== "value") expect(text(f.cell)).not.toMatch(/\d/);
      }
    }
  });

  it("stale values read as a dash (or the lock), not as the last number", () => {
    const model = buildDashboard(FULL, fullStatus(), { stale: true });
    const cpu = card(model, "cpu:/amdcpu/0");
    expect(cpu.hero!.cell).toEqual({ kind: "none" });
    expect(text(field(cpu, "total-load").cell)).toBe("—");
    const board = card(model, "motherboard");
    expect(board.fans!.rows.every((r) => r.cell.kind === "none")).toBe(true);
    expect(board.fans!.footer).toBeNull();
  });
});

describe("history chart series (UT-32)", () => {
  const model = () => buildDashboard(FULL, fullStatus());
  const metric = (id: string) => model().history.find((m) => m.id === id)!;

  it("temperatures: CPU package, the RTX's GPU Core, then the first drive", () => {
    const m = metric("temperatures");
    expect(m.series.map((s) => s.name)).toEqual(["CPU package", "NVIDIA GeForce RTX 5060 Ti", "KINGSTON SNV3S1000G"]);
    expect(m.series.map((s) => s.key)).toEqual([
      "/amdcpu/0/temperature/2|Core (Tctl/Tdie)",
      "/gpu-nvidia/0/temperature/0|GPU Core",
      "/nvme/0/temperature/0|Composite Temperature",
    ]);
    expect(m.series.map((s) => text(s.cell))).toEqual(["65.6 °C", "30.4 °C", "31 °C"]);
  });

  it("load and power: series 2 and 3 are the RTX, then the iGPU", () => {
    expect(metric("load").series.map((s) => s.name)).toEqual(["CPU total", "NVIDIA GeForce RTX 5060 Ti", "AMD Radeon Graphics"]);
    expect(metric("load").series.map((s) => text(s.cell))).toEqual(["12 %", "2 %", "5 %"]);
    expect(metric("power").series.map((s) => s.name)).toEqual(["CPU package", "NVIDIA GeForce RTX 5060 Ti", "AMD Radeon Graphics"]);
    expect(metric("power").series.map((s) => text(s.cell))).toEqual(["70.8 W", "12.1 W", "43.0 W"]);
  });

  it("colours and dash patterns follow the series slot", () => {
    const m = metric("temperatures");
    expect(m.series.map((s) => s.color)).toEqual(["accent", "s2", "s3"]);
    expect(m.series.map((s) => s.dash)).toEqual(["none", "6 4", "2 3"]);
  });

  it("uses the fixed domains and axis labels", () => {
    expect(metric("temperatures")).toMatchObject({ domain: [20, 100], axis: ["100 °C", "60", "20"], label: "Temperatures" });
    expect(metric("load")).toMatchObject({ domain: [0, 100], axis: ["100 %", "50", "0"], label: "Load" });
    expect(metric("power")).toMatchObject({ domain: [0, 200], axis: ["200 W", "100", "0"], label: "Power" });
  });

  it("a locked series has no path and shows its lock label", () => {
    const reducedModel = buildDashboard(REDUCED, reducedStatus());
    const temps = reducedModel.history.find((m) => m.id === "temperatures")!;
    expect(temps.series[0]).toMatchObject({ name: "CPU package", key: null, locked: "Needs full sensors" });
    expect(temps.series[1].key).not.toBeNull();
    const power = reducedModel.history.find((m) => m.id === "power")!;
    expect(power.series[0]).toMatchObject({ key: null, locked: "Needs full sensors" });
  });

  it("reduced mode names the missing drive 'Drive' with the lock label", () => {
    const temps = buildDashboard(REDUCED, reducedStatus()).history.find((m) => m.id === "temperatures")!;
    expect(temps.series[2]).toMatchObject({ name: "Drive", key: null, locked: "Needs full sensors" });
  });

  it("full mode with no drive omits the third row, and a missing second GPU omits its row", () => {
    const frame = clone(NO_PAWNIO);
    frame.hardware = frame.hardware.filter((h) => h.type !== "Storage" && h.id !== "/gpu-amd/0");
    frame.sensors = frame.sensors.filter((s) => !s.hw.startsWith("/nvme") && !s.hw.startsWith("/gpu-amd"));
    const model = buildDashboard(frame, noPawnioStatus());
    expect(model.history.find((m) => m.id === "temperatures")!.series.map((s) => s.name)).toEqual(["CPU package", "NVIDIA GeForce RTX 5060 Ti"]);
    expect(model.history.find((m) => m.id === "load")!.series).toHaveLength(2);
  });
});

describe("remaining fallbacks (UT-35)", () => {
  const cpuFrame = (sensors: UiSensor[], elevated = true) => custom([hw("/cpu/0", "Cpu", "CPU")], sensors, { elevated });
  const cpuOf = (frame: UiFrame, status = fullStatus()) => card(buildDashboard(frame, status), "cpu:/cpu/0");
  const t = (name: string, value: number | null) => sensor(`/cpu/0/temperature/${name}`, name, value, "Temperature", "/cpu/0");

  it("uses Core (Tdie), then CPU Package, for the hero", () => {
    expect(text(cpuOf(cpuFrame([t("Core (Tdie)", 55)])).hero!.cell)).toBe("55.0 °C");
    expect(text(cpuOf(cpuFrame([t("CPU Package", 61)])).hero!.cell)).toBe("61.0 °C");
    // The order is by name priority, not by position.
    expect(text(cpuOf(cpuFrame([t("CPU Package", 61), t("Core (Tdie)", 55)])).hero!.cell)).toBe("55.0 °C");
  });

  it("CCD1 alone is 'Hottest CCD · CCD1'", () => {
    const hottest = field(cpuOf(cpuFrame([t("CCD1 (Tdie)", 58.2)])), "hottest");
    expect(hottest.label).toBe("Hottest CCD");
    expect(text(hottest.cell)).toBe("58.2 °C · CCD1");
  });

  it("CCDs Max names the CCD that holds the value", () => {
    const hottest = field(cpuOf(cpuFrame([t("CCD1 (Tdie)", 50), t("CCD2 (Tdie)", 61), t("CCDs Max (Tdie)", 61)])), "hottest");
    expect(text(hottest.cell)).toBe("61.0 °C · CCD2");
  });

  it("Intel Core Max names the core, including hybrid P-Core and E-Core names (UNVERIFIED on hardware)", () => {
    const plain = field(cpuOf(cpuFrame([t("CPU Core #3", 71), t("CPU Core #4", 60), t("Core Max", 71)])), "hottest");
    expect(plain.label).toBe("Hottest core");
    expect(text(plain.cell)).toBe("71.0 °C · CPU Core #3");
    const hybridP = field(cpuOf(cpuFrame([t("P-Core #2", 80), t("E-Core #9", 70), t("Core Max", 80)])), "hottest");
    expect(text(hybridP.cell)).toBe("80.0 °C · P-Core #2");
    const hybridE = field(cpuOf(cpuFrame([t("P-Core #2", 60), t("E-Core #9", 75), t("Core Max", 75)])), "hottest");
    expect(text(hybridE.cell)).toBe("75.0 °C · E-Core #9");
  });

  it("no matching temperature gives 'Hottest core' with no suffix", () => {
    const hottest = field(cpuOf(cpuFrame([t("Something Else", 40)])), "hottest");
    expect(hottest.label).toBe("Hottest core");
    expect(hottest.cell).toEqual({ kind: "none" });
  });

  it("a null value never shows a suffix", () => {
    const hottest = field(cpuOf(cpuFrame([t("CCD1 (Tdie)", null), t("CCDs Max (Tdie)", null)])), "hottest");
    expect(hottest.cell.kind).not.toBe("value");
  });

  it("'Cores (Average)' alone leaves Effective clock as a dash", () => {
    const frame = cpuFrame([sensor("/cpu/0/clock/1", "Cores (Average)", 4668, "Clock", "/cpu/0")]);
    expect(field(cpuOf(frame), "effective-clock").cell).toEqual({ kind: "none" });
  });

  it("falls back from Package to CPU Package for power", () => {
    const frame = cpuFrame([sensor("/cpu/0/power/0", "CPU Package", 42.04, "Power", "/cpu/0")]);
    expect(text(field(cpuOf(frame), "package-power").cell)).toBe("42.0 W");
  });

  const gpu = (type: string, sensors: UiSensor[]) => {
    const frame = custom([hw("/gpu/0", type, "GPU")], sensors);
    return card(buildDashboard(frame, fullStatus()), "gpu:/gpu/0");
  };
  const g = (kind: string, name: string, value: number | null) => sensor(`/gpu/0/${kind}/${name}`, name, value, kind === "temperature" ? "Temperature" : kind === "load" ? "Load" : kind === "clock" ? "Clock" : "Power", "/gpu/0");

  it("GPU temperature: GPU Core, then GPU VR SoC, then the first temperature", () => {
    expect(text(gpu("GpuNvidia", [g("temperature", "Other", 70), g("temperature", "GPU VR SoC", 51), g("temperature", "GPU Core", 40)]).hero!.cell)).toBe("40.0 °C");
    expect(text(gpu("GpuAmd", [g("temperature", "Other", 70), g("temperature", "GPU VR SoC", 51)]).hero!.cell)).toBe("51.0 °C");
    expect(text(gpu("GpuAmd", [g("temperature", "Hotspot", 66)]).hero!.cell)).toBe("66.0 °C");
  });

  it("GPU load: NVIDIA uses GPU Core only; AMD and Intel prefer D3D 3D, then GPU Core", () => {
    const loads = [g("load", "D3D 3D", 20), g("load", "GPU Core", 50)];
    expect(text(field(gpu("GpuNvidia", loads), "load").cell)).toBe("50 %");
    expect(text(field(gpu("GpuAmd", loads), "load").cell)).toBe("20 %");
    expect(text(field(gpu("GpuIntel", [g("load", "GPU Core", 7)]), "load").cell)).toBe("7 %");
  });

  it("GPU power: GPU Package, then GPU Core, then the first power; clock is GPU Core", () => {
    expect(text(field(gpu("GpuAmd", [g("power", "GPU Core", 33), g("power", "GPU Package", 40)]), "power").cell)).toBe("40.0 W");
    expect(text(field(gpu("GpuAmd", [g("power", "GPU SoC", 13), g("power", "GPU Core", 33)]), "power").cell)).toBe("33.0 W");
    expect(text(field(gpu("GpuAmd", [g("power", "GPU SoC", 13)]), "power").cell)).toBe("13.0 W");
    expect(text(field(gpu("GpuAmd", [g("clock", "GPU Memory", 3000), g("clock", "GPU Core", 600)]), "core-clock").cell)).toBe("600 MHz");
  });

  const fanFrame = (fans: (number | null)[]) =>
    custom(
      [hw("/motherboard", "Motherboard", "Board"), hw("/lpc/chip/0", "SuperIO", "Chip", "/motherboard")],
      fans.map((rpm, i) => sensor(`/lpc/chip/0/fan/${i}`, `Fan #${i + 1}`, rpm, "Fan", "/lpc/chip/0")),
    );

  it("fan footer: none for 0 idle headers, singular for 1, plural for 4", () => {
    expect(card(buildDashboard(fanFrame([900, 1200]), fullStatus()), "motherboard").fans!.footer).toBeNull();
    expect(card(buildDashboard(fanFrame([900, 0]), fullStatus()), "motherboard").fans!.footer).toBe("1 more fan header reads 0 RPM.");
    expect(card(buildDashboard(fanFrame([900, 0, 0, 0, 0]), fullStatus()), "motherboard").fans!.footer).toBe("4 more fan headers read 0 RPM.");
  });

  it("fan footer: a header with no reading is not counted as reading 0 RPM", () => {
    expect(card(buildDashboard(fanFrame([900, 0, null]), fullStatus()), "motherboard").fans!.footer).toBe("1 more fan header reads 0 RPM.");
    expect(card(buildDashboard(fanFrame([900, null]), fullStatus()), "motherboard").fans!.footer).toBeNull();
  });

  it("scales fan bars to the next 500 above a 2140 RPM fan", () => {
    const rows = card(buildDashboard(fanFrame([2140, 1070]), fullStatus()), "motherboard").fans!.rows;
    expect(rows[0].fraction).toBeCloseTo(2140 / 2500, 5);
    expect(rows[1].fraction).toBeCloseTo(1070 / 2500, 5);
  });

  it("titles the Motherboard card with the board and the chip", () => {
    expect(card(buildDashboard(fanFrame([900]), fullStatus()), "motherboard").title).toBe("Board · Chip");
  });

  it("an embedded controller counts as a fan chip", () => {
    const frame = custom(
      [hw("/motherboard", "Motherboard", "Board"), hw("/ec/0", "EmbeddedController", "EC", "/motherboard")],
      [sensor("/ec/0/fan/0", "Fan #1", 1000, "Fan", "/ec/0")],
    );
    expect(card(buildDashboard(frame, fullStatus()), "motherboard").title).toBe("Board · EC");
  });
});

describe("card scopes and drill-down groups (UT-34)", () => {
  it("scopes each card to its hardware", () => {
    expect(componentScope(FULL, "cpu:/amdcpu/0")).toEqual(["/amdcpu/0"]);
    expect(componentScope(FULL, "gpu:/gpu-nvidia/0")).toEqual(["/gpu-nvidia/0"]);
    expect(componentScope(FULL, "gpu:/gpu-amd/0")).toEqual(["/gpu-amd/0"]);
    expect(componentScope(FULL, "disk:/nvme/0")).toEqual(["/nvme/0"]);
    expect(componentScope(FULL, "memory")).toEqual(["/vram", "/ram", "/memory/dimm/1", "/memory/dimm/3"]);
    expect(componentScope(FULL, "motherboard")).toEqual(["/motherboard", "/lpc/it8696e/0"]);
  });

  it("gives an empty scope for an unknown card or hardware", () => {
    expect(componentScope(FULL, "cpu:/nope")).toEqual([]);
    expect(componentScope(FULL, "nonsense")).toEqual([]);
    expect(componentScope(FULL, "disk-placeholder")).toEqual([]);
    expect(componentScope(REDUCED, "motherboard")).toEqual(["/motherboard"]);
  });

  it("groups by SensorType in the stated order, with plural labels", () => {
    const [section] = drillSections(FULL, componentScope(FULL, "motherboard"), fullStatus());
    expect(section.heading).toBeNull();
    expect(section.groups.map((g) => g.label)).toEqual(["Fans", "Temperatures", "Voltages", "Controls"]);
  });

  it("the Motherboard scope has a 'Controls · 6' group", () => {
    const [section] = drillSections(FULL, componentScope(FULL, "motherboard"), fullStatus());
    const controls = section.groups.find((g) => g.type === "Control")!;
    expect(controls.sensors).toHaveLength(6);
    expect(`${controls.label} · ${controls.sensors.length}`).toBe("Controls · 6");
  });

  it("locks no group in the full fixture, not even the all-null Controls group", () => {
    const controls = drillSections(FULL, componentScope(FULL, "motherboard"), fullStatus())[0].groups.find((g) => g.type === "Control")!;
    expect(controls.sensors.every((s) => s.value === null)).toBe(true);
    for (const cardId of ["cpu:/amdcpu/0", "gpu:/gpu-nvidia/0", "gpu:/gpu-amd/0", "disk:/nvme/0", "memory", "motherboard"]) {
      const groups = drillSections(FULL, componentScope(FULL, cardId), fullStatus()).flatMap((s) => s.groups);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.map((g) => g.lock)).toEqual(groups.map(() => null));
    }
  });

  it("orders the CPU groups Temperature, Clock, Load, Power ... and the rest alphabetically", () => {
    const [section] = drillSections(FULL, ["/amdcpu/0"], fullStatus());
    expect(section.groups.map((g) => g.type)).toEqual(["Temperature", "Voltage", "Clock", "Load", "Power"]);
    const odd = custom(
      [hw("/x", "Cpu", "X")],
      [sensor("/x/b", "B", 1, "Zebra", "/x"), sensor("/x/a", "A", 1, "Apple", "/x"), sensor("/x/f", "F", 1, "Fan", "/x")],
    );
    const types = drillSections(odd, ["/x"], fullStatus())[0].groups.map((g) => g.type);
    expect(types).toEqual(["Fan", "Apple", "Zebra"]);
    expect(drillSections(odd, ["/x"], fullStatus())[0].groups.map((g) => g.label)).toEqual(["Fans", "Apples", "Zebras"]);
  });

  it("keeps rows in LHM index order", () => {
    const frame = custom(
      [hw("/x", "Cpu", "X")],
      [
        sensor("/x/2", "Third", 3, "Fan", "/x", 2),
        sensor("/x/0", "First", 1, "Fan", "/x", 0),
        sensor("/x/1", "Second", 2, "Fan", "/x", 1),
      ],
    );
    expect(drillSections(frame, ["/x"], fullStatus())[0].groups[0].sensors.map((s) => s.name)).toEqual(["First", "Second", "Third"]);
  });

  it("groups the Memory scope by hardware first, so the two 'Memory Used' rows sit under different headings", () => {
    const sections = drillSections(FULL, componentScope(FULL, "memory"), fullStatus());
    expect(sections.map((s) => s.heading)).toEqual([
      "Virtual Memory",
      "Total Memory",
      "Corsair - CMK32GX5M2B6000C38 (#1)",
      "Corsair - CMK32GX5M2B6000C38 (#3)",
    ]);
    const used = sections.map((s) => s.groups.flatMap((g) => g.sensors).filter((x) => x.name === "Memory Used").map((x) => x.id));
    expect(used.slice(0, 2)).toEqual([["/vram/data/2"], ["/ram/data/0"]]);
    expect(sections[0].groups.map((g) => g.label)).toEqual(["Loads", "Data"]);
  });

  it("names the component for the page title", () => {
    expect(componentName(FULL, "cpu:/amdcpu/0")).toBe("AMD Ryzen 9 9900X");
    expect(componentName(FULL, "gpu:/gpu-amd/0")).toBe("AMD Radeon Graphics");
    expect(componentName(FULL, "disk:/nvme/0")).toBe("KINGSTON SNV3S1000G");
    expect(componentName(FULL, "memory")).toBe("Memory");
    expect(componentName(FULL, "motherboard")).toBe("Motherboard");
  });
});

describe("drill-down group locks (UT-38)", () => {
  const cpuLocks = (frame: UiFrame, status: SensorStatus) =>
    Object.fromEntries(drillSections(frame, ["/amdcpu/0"], status)[0].groups.map((g) => [g.type, g.lock]));

  it("(a) locks the CPU groups that need PawnIO in the reduced fixture, and not Load", () => {
    expect(cpuLocks(REDUCED, reducedStatus())).toEqual({
      Temperature: "Needs full sensors",
      Voltage: "Needs full sensors",
      Clock: "Needs full sensors",
      Load: null,
      Power: "Needs full sensors",
    });
  });

  it("(b) says 'Needs PawnIO' when the helper is elevated and PawnIO is missing", () => {
    expect(cpuLocks(NO_PAWNIO, noPawnioStatus())).toEqual({
      Temperature: "Needs PawnIO",
      Voltage: "Needs PawnIO",
      Clock: "Needs PawnIO",
      Load: null,
      Power: "Needs PawnIO",
    });
  });

  it("(c) locks an Intel GPU's Power group, and not a group that needs nothing", () => {
    const frame = custom(
      [hw("/gpu-intel/0", "GpuIntel", "Intel Arc")],
      [
        sensor("/gpu-intel/0/power/0", "GPU Power", null, "Power", "/gpu-intel/0"),
        sensor("/gpu-intel/0/clock/0", "GPU Core", null, "Clock", "/gpu-intel/0"),
      ],
      { elevated: false },
    );
    const locks = Object.fromEntries(drillSections(frame, ["/gpu-intel/0"], reducedStatus())[0].groups.map((g) => [g.type, g.lock]));
    expect(locks).toEqual({ Clock: null, Power: "Needs full sensors" });
  });

  it("(c) also: does not lock a CPU Load group whose values are all null: Load needs nothing", () => {
    const frame = custom([hw("/x", "Cpu", "X")], [sensor("/x/load/0", "CPU Total", null, "Load", "/x", 0)], { elevated: false });
    expect(drillSections(frame, ["/x"], reducedStatus())[0].groups[0].lock).toBeNull();
  });

  it("(d) never locks a group that has a live value", () => {
    const frame = custom(
      [hw("/x", "Cpu", "X")],
      [
        sensor("/x/clock/0", "Core #1", null, "Clock", "/x", 0),
        sensor("/x/clock/1", "Core #2", 4200, "Clock", "/x", 1),
        sensor("/x/clock/2", "Core #3", null, "Clock", "/x", 2),
      ],
      { elevated: false },
    );
    expect(drillSections(frame, ["/x"], reducedStatus())[0].groups[0].lock).toBeNull();
  });
});
