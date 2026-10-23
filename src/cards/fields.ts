// The dashboard model: turns a frame and the supervisor status into cards, a header summary and the history chart's
// series, by the techspec's rule tables ("Card field rules", "Card titles and kind labels", "Sparklines",
// "History chart series"). Rules match exact sensor names inside a hardware type, in order, first match wins. They are
// never keyed on an identifier index, because indices depend on order. This file owns copy and layout only: it never
// rewrites a value, and a `null` value never becomes a digit.

import type { SensorStatus, UiFrame, UiHardware, UiSensor } from "../sensors/protocol";
import * as fmt from "./format";

// ---- Public model ----

export type Needs = "none" | "admin" | "pawnio";
export type LockLabel = "Needs full sensors" | "Needs PawnIO";

/** What a field shows. `locked` and `none` never carry a digit. */
export type Cell =
  | { kind: "value"; value: string; unit: string }
  | { kind: "locked"; label: LockLabel }
  | { kind: "none" };

export interface HeroModel {
  label: string | null;
  cell: Cell;
}

export interface FieldModel {
  id: string;
  label: string;
  cell: Cell;
  /** 0..1, for a bar under the value (the GPU's VRAM). */
  bar?: number;
}

export interface SparkModel {
  /** Series keys: one line, or two for the Disk card (read, then write). Empty when the sensor isn't there. */
  keys: string[];
  domain: [number, number];
  /** The upper bound grows to the highest value in the window when it exceeds `domain[1]` (Disk). */
  growToFit: boolean;
}

export interface FanRow {
  key: string;
  name: string;
  cell: Cell;
  /** 0..1 of the bar's scale. */
  fraction: number;
}

export type CardKind = "cpu" | "memory" | "gpu" | "disk" | "motherboard";

export interface CardModel {
  /** `cpu:/amdcpu/0`, `memory`, `gpu:/gpu-nvidia/0`, `disk:/nvme/0`, `motherboard`; placeholders and empty cards have their own. */
  id: string;
  kind: CardKind;
  kindLabel: string;
  title: string;
  variant: "normal" | "placeholder" | "empty";
  /** Placeholders and empty cards can't be opened. */
  clickable: boolean;
  hero: HeroModel | null;
  /** The Disk card's two heroes (read, write). */
  heroes: HeroModel[];
  spark: SparkModel | null;
  fields: FieldModel[];
  /** Memory only: the inferred OC-profile chip and its caption. */
  oc: { chip: string; caption: string } | null;
  /** Motherboard only. */
  fans: { rows: FanRow[]; footer: string | null } | null;
  /** The lock on a placeholder card. */
  lock: LockLabel | null;
  /** The sentence under a placeholder's or an empty card's headline. */
  note: string | null;
}

export type MetricId = "temperatures" | "load" | "power";

export interface HistorySeries {
  id: string;
  /** Legend name. */
  name: string;
  color: "accent" | "s2" | "s3";
  dash: string;
  /** The series to draw; `null` for a locked or missing sensor (no path). */
  key: string | null;
  cell: Cell;
  locked: LockLabel | null;
}

export interface HistoryMetric {
  id: MetricId;
  label: string;
  domain: [number, number];
  /** y-axis labels, top to bottom. */
  axis: [string, string, string];
  series: HistorySeries[];
}

export interface DashboardModel {
  /** No frame yet: show "Starting the sensor helper…" in place of the cards. */
  starting: boolean;
  summary: string;
  cards: CardModel[];
  history: HistoryMetric[];
}

export interface BuildOptions {
  /** Values aren't live (reconnecting, or no frame for 3 periods): every value shows "—". */
  stale?: boolean;
}

// ---- Helpers ----

/** The LHM hardware name without "(TM)" and "(R)". */
export function cleanName(name: string): string {
  return name.replace(/\((?:TM|R)\)/g, "").replace(/\s{2,}/g, " ").trim();
}

const JEDEC_SPEEDS = [
  1600, 1866, 2133, 2400, 2666, 2933, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800, 7200, 7600, 8000, 8400, 8800,
];

/** The JEDEC speed bin nearest to `2000 / tCK` (MT/s). Rounding to the nearest 100 would be wrong for DDR4. */
export function jedecSpeed(tckNs: number): number {
  const mts = 2000 / tckNs;
  let best = JEDEC_SPEEDS[0];
  for (const bin of JEDEC_SPEEDS) {
    if (Math.abs(bin - mts) < Math.abs(best - mts)) best = bin;
  }
  return best;
}

const isGpu = (hardware: UiHardware) => hardware.type.startsWith("Gpu");

/** `Gpu*` hardware, largest `GPU Memory Total` first, hardware without it last, ties in LHM order. */
export function gpuOrder(frame: UiFrame): string[] {
  const total = (hardware: UiHardware): number => {
    const sensor = frame.sensors.find((s) => s.hw === hardware.id && s.type === "SmallData" && s.name === "GPU Memory Total");
    return sensor?.value ?? Number.NEGATIVE_INFINITY;
  };
  return frame.hardware
    .filter(isGpu)
    .map((hardware, index) => ({ id: hardware.id, total: total(hardware), index }))
    .sort((a, b) => (b.total === a.total ? a.index - b.index : b.total > a.total ? 1 : -1))
    .map((entry) => entry.id);
}

interface Ctx {
  frame: UiFrame;
  elevated: boolean;
  pawnInstalled: boolean;
  pawnLoaded: boolean | null;
  stale: boolean;
  byHw: Map<string, UiSensor[]>;
}

/** PawnIO can serve reads: the helper is elevated, PawnIO is installed, and its driver isn't known to be dead. */
function pawnIoUsable(ctx: Ctx): boolean {
  return ctx.elevated && ctx.pawnInstalled && ctx.pawnLoaded !== false;
}

/** What the lock labels depend on. Both the dashboard and the drill-down build it with `accessOf`. */
type Access = Pick<Ctx, "elevated" | "pawnInstalled" | "pawnLoaded">;

/** Privilege from the frame, PawnIO from the hello. Before the first hello, PawnIO counts as installed. */
function accessOf(frame: UiFrame, status: SensorStatus): Access {
  const pawn = status.pawnIo ?? { installed: true, version: null, loaded: null };
  return { elevated: frame.elevated, pawnInstalled: pawn.installed, pawnLoaded: pawn.loaded };
}

function lockFor(ctx: Access, needs: Needs): LockLabel | null {
  if (needs === "none") return null;
  if (!ctx.elevated) return "Needs full sensors";
  if (needs === "pawnio" && (!ctx.pawnInstalled || ctx.pawnLoaded === false)) return "Needs PawnIO";
  return null;
}

/** A null value is a lock label when the field needs more than the helper has, and "—" otherwise. */
function cell(ctx: Ctx, raw: number | null | undefined, needs: Needs, format: (v: number) => fmt.Parts): Cell {
  const value = ctx.stale ? null : (raw ?? null);
  if (value !== null) return { kind: "value", ...format(value) };
  const label = lockFor(ctx, needs);
  return label === null ? { kind: "none" } : { kind: "locked", label };
}

function withSuffix(c: Cell, suffix: string | null): Cell {
  return c.kind === "value" && suffix ? { ...c, unit: `${c.unit} · ${suffix}` } : c;
}

function sensorsOf(ctx: Ctx, hw: string): UiSensor[] {
  return ctx.byHw.get(hw) ?? [];
}

/** The first sensor of `type` whose name is in `names`, trying the names in order. */
function find(sensors: UiSensor[], type: string, names: string[]): UiSensor | undefined {
  for (const name of names) {
    const match = sensors.find((s) => s.type === type && s.name === name);
    if (match) return match;
  }
  return undefined;
}

const firstOfType = (sensors: UiSensor[], type: string) => sensors.find((s) => s.type === type);

function sizeText(gb: number): string {
  return Number.isInteger(gb) ? String(gb) : String(Number(gb.toFixed(1)));
}

function memoryText(frame: UiFrame, withSpeed: boolean): string {
  const modules = frame.memory;
  if (modules.length === 0) return "Memory";
  const type = modules[0].type;
  const equal = modules.every((m) => m.sizeGB === modules[0].sizeGB);
  const size = equal
    ? `${modules.length} × ${sizeText(modules[0].sizeGB)} GB ${type}`
    : `${sizeText(modules.reduce((sum, m) => sum + m.sizeGB, 0))} GB ${type}`;
  const speeds = modules.map((m) => m.configuredMTs).filter((v): v is number => v !== null);
  return withSpeed && speeds.length > 0 ? `${size}-${fmt.speedText(Math.max(...speeds))}` : size;
}

const emptyCard = (
  base: Pick<CardModel, "id" | "kind" | "kindLabel">,
  patch: Partial<CardModel>,
): CardModel => ({
  ...base,
  title: "",
  variant: "normal",
  clickable: false,
  hero: null,
  heroes: [],
  spark: null,
  fields: [],
  oc: null,
  fans: null,
  lock: null,
  note: null,
  ...patch,
});

// ---- CPU ----

interface CpuSensors {
  temp?: UiSensor;
  load?: UiSensor;
  clock?: UiSensor;
  power?: UiSensor;
  hottest: { label: string; sensor?: UiSensor; suffix: string | null };
}

function cpuSensors(sensors: UiSensor[]): CpuSensors {
  const temps = sensors.filter((s) => s.type === "Temperature");
  let hottest: CpuSensors["hottest"] = { label: "Hottest core", suffix: null };
  const ccdMax = find(sensors, "Temperature", ["CCDs Max (Tdie)"]);
  const ccd1 = find(sensors, "Temperature", ["CCD1 (Tdie)"]);
  const coreMax = find(sensors, "Temperature", ["Core Max"]);
  if (ccdMax) {
    const source = temps.find((s) => /^CCD\d+ \(Tdie\)$/.test(s.name) && ccdMax.value !== null && s.value === ccdMax.value);
    hottest = { label: "Hottest CCD", sensor: ccdMax, suffix: source ? source.name.slice(0, source.name.indexOf(" ")) : null };
  } else if (ccd1) {
    hottest = { label: "Hottest CCD", sensor: ccd1, suffix: "CCD1" };
  } else if (coreMax) {
    // Intel: `CPU Core #n`, or `P-Core #n` / `E-Core #n` on hybrid parts. UNVERIFIED on hardware (no Intel PC).
    const source = temps.find((s) => /^(?:CPU Core|P-Core|E-Core) #\d+$/.test(s.name) && coreMax.value !== null && s.value === coreMax.value);
    hottest = { label: "Hottest core", sensor: coreMax, suffix: source ? source.name : null };
  }
  return {
    temp: find(sensors, "Temperature", ["Core (Tctl/Tdie)", "Core (Tdie)", "CPU Package"]),
    load: find(sensors, "Load", ["CPU Total"]),
    clock: find(sensors, "Clock", ["Cores (Average Effective)"]), // never "Cores (Average)": that is the nominal clock
    power: find(sensors, "Power", ["Package", "CPU Package"]),
    hottest,
  };
}

function cpuCard(ctx: Ctx, hardware: UiHardware): CardModel {
  const s = cpuSensors(sensorsOf(ctx, hardware.id));
  const temperature = cell(ctx, s.temp?.value, "pawnio", fmt.celsius1);
  const load = cell(ctx, s.load?.value, "none", fmt.percent0);
  const hottestCell = withSuffix(cell(ctx, s.hottest.sensor?.value, "pawnio", fmt.celsius1), s.hottest.suffix);

  // The hero is the package temperature, or Total load when that is locked.
  const heroIsLoad = temperature.kind === "locked";
  const hero: HeroModel = heroIsLoad
    ? { label: "Total load", cell: load }
    : { label: "Package temperature", cell: temperature };
  const spark: SparkModel = heroIsLoad
    ? { keys: s.load ? [s.load.key] : [], domain: [0, 100], growToFit: false }
    : { keys: s.temp ? [s.temp.key] : [], domain: [20, 100], growToFit: false };

  return emptyCard(
    { id: `cpu:${hardware.id}`, kind: "cpu", kindLabel: "CPU" },
    {
      title: cleanName(hardware.name),
      variant: "normal",
      clickable: true,
      hero,
      spark,
      fields: [
        heroIsLoad
          ? { id: "package-temperature", label: "Package temperature", cell: temperature }
          : { id: "total-load", label: "Total load", cell: load },
        { id: "effective-clock", label: "Effective clock", cell: cell(ctx, s.clock?.value, "pawnio", fmt.gigahertz2) },
        { id: "package-power", label: "Package power", cell: cell(ctx, s.power?.value, "pawnio", fmt.watts1) },
        { id: "hottest", label: s.hottest.label, cell: hottestCell },
      ],
    },
  );
}

// ---- Memory ----

function memoryCard(ctx: Ctx): CardModel {
  const ram = sensorsOf(ctx, "/ram");
  const used = find(ram, "Data", ["Memory Used"]);
  const available = find(ram, "Data", ["Memory Available"]);
  // LHM has no total sensor: total = used + available.
  const total = used?.value != null && available?.value != null ? used.value + available.value : null;

  const speeds = ctx.frame.memory.map((m) => m.configuredMTs).filter((v): v is number => v !== null);
  const configured = speeds.length > 0 ? Math.max(...speeds) : null;

  // OC profile (full sensors only): the SPD's minimum cycle time gives the JEDEC speed, the module's configured speed is
  // compared with it. Inferred, and labelled as such. Hidden when no DIMM sensor has a value.
  let oc: CardModel["oc"] = null;
  const dimmBins = ctx.frame.hardware
    .filter((h) => h.id.startsWith("/memory/dimm/"))
    .map((h) => find(sensorsOf(ctx, h.id), "Timing", ["tCKAVGmin (Minimum Cycle Time)"])?.value)
    .filter((v): v is number => v != null && v > 0)
    .map(jedecSpeed);
  if (!ctx.stale && dimmBins.length > 0 && configured !== null) {
    const jedec = Math.max(...dimmBins);
    const above = configured > jedec;
    oc = {
      chip: above ? "Likely on · inferred" : "Likely off · inferred",
      caption: `Inferred: configured ${fmt.speedText(configured)} MT/s ${above ? "is above" : "matches"} the SPD JEDEC speed of ${fmt.speedText(jedec)} MT/s.`,
    };
  }

  return emptyCard(
    { id: "memory", kind: "memory", kindLabel: "Memory" },
    {
      title: memoryText(ctx.frame, false),
      variant: "normal",
      clickable: true,
      hero: { label: "Used", cell: cell(ctx, used?.value, "none", (v) => fmt.gigabytesOf(v, total)) },
      spark: { keys: used ? [used.key] : [], domain: [0, total ?? 0], growToFit: false },
      fields: [{ id: "configured-speed", label: "Configured speed", cell: cell(ctx, configured, "none", fmt.megatransfers) }],
      oc,
    },
  );
}

// ---- GPU ----

interface GpuSensors {
  temp?: UiSensor;
  load?: UiSensor;
  clock?: UiSensor;
  power?: UiSensor;
  vramUsed?: UiSensor;
  vramTotal?: UiSensor;
}

function gpuSensors(ctx: Ctx, hardware: UiHardware): GpuSensors {
  const sensors = sensorsOf(ctx, hardware.id);
  const nvidia = hardware.type === "GpuNvidia";
  return {
    temp: find(sensors, "Temperature", ["GPU Core", "GPU VR SoC"]) ?? firstOfType(sensors, "Temperature"),
    // NVIDIA's `GPU Core` load is the engine load; AMD and Intel report it through D3D (the AMD iGPU's own stays 0).
    load: find(sensors, "Load", nvidia ? ["GPU Core"] : ["D3D 3D", "GPU Core"]),
    clock: find(sensors, "Clock", ["GPU Core"]),
    power: find(sensors, "Power", ["GPU Package", "GPU Core"]) ?? firstOfType(sensors, "Power"),
    vramUsed: find(sensors, "SmallData", ["GPU Memory Used"]),
    vramTotal: find(sensors, "SmallData", ["GPU Memory Total"]),
  };
}

function gpuCard(ctx: Ctx, hardware: UiHardware): CardModel {
  const s = gpuSensors(ctx, hardware);
  const used = ctx.stale ? null : (s.vramUsed?.value ?? null);
  const total = s.vramTotal?.value ?? null;
  const fraction = used !== null && total !== null && total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;

  return emptyCard(
    { id: `gpu:${hardware.id}`, kind: "gpu", kindLabel: "GPU" },
    {
      title: cleanName(hardware.name),
      variant: "normal",
      clickable: true,
      hero: { label: "Temperature", cell: cell(ctx, s.temp?.value, "none", fmt.celsius1) },
      spark: { keys: s.temp ? [s.temp.key] : [], domain: [20, 100], growToFit: false },
      fields: [
        { id: "load", label: "Load", cell: cell(ctx, s.load?.value, "none", fmt.percent0) },
        { id: "core-clock", label: "Core clock", cell: cell(ctx, s.clock?.value, "none", fmt.megahertz0) },
        { id: "power", label: "Power", cell: cell(ctx, s.power?.value, "none", fmt.watts1) },
        { id: "vram", label: "VRAM", cell: cell(ctx, used, "none", (v) => fmt.vram(v, total)), bar: fraction },
      ],
    },
  );
}

// ---- Disk ----

const DISK_SPARK_FLOOR = 10e6; // 10 MB/s

function diskCard(ctx: Ctx, hardware: UiHardware): CardModel {
  const sensors = sensorsOf(ctx, hardware.id);
  const read = find(sensors, "Throughput", ["Read Rate"]);
  const write = find(sensors, "Throughput", ["Write Rate"]);
  const temp = find(sensors, "Temperature", ["Composite Temperature", "Temperature"]) ?? firstOfType(sensors, "Temperature");
  const life = find(sensors, "Level", ["Life"]);
  return emptyCard(
    { id: `disk:${hardware.id}`, kind: "disk", kindLabel: "Disk" },
    {
      title: cleanName(hardware.name),
      variant: "normal",
      clickable: true,
      heroes: [
        { label: null, cell: cell(ctx, read?.value, "admin", (v) => fmt.megabytesPerSecond1(v, "MB/s read")) },
        { label: null, cell: cell(ctx, write?.value, "admin", (v) => fmt.megabytesPerSecond1(v, "MB/s write")) },
      ],
      spark: {
        // Always [read, write]: the sparkline draws the second one dashed, so a missing sensor keeps its slot.
        keys: [read?.key ?? "", write?.key ?? ""],
        domain: [0, DISK_SPARK_FLOOR],
        growToFit: true,
      },
      fields: [
        { id: "temperature", label: "Temperature", cell: cell(ctx, temp?.value, "admin", fmt.celsius0) },
        { id: "smart", label: "SMART health", cell: cell(ctx, life?.value, "admin", fmt.lifeLeft0) },
      ],
    },
  );
}

// ---- Motherboard ----

function fanFooter(zero: number): string | null {
  if (zero === 0) return null;
  return zero === 1 ? "1 more fan header reads 0 RPM." : `${zero} more fan headers read 0 RPM.`;
}

/** The fan bars' scale: at least 2000 RPM, or the highest value shown rounded up to the next 500. */
export function fanScale(highest: number): number {
  return Math.max(2000, Math.ceil(highest / 500) * 500);
}

function motherboardCard(ctx: Ctx): CardModel {
  const base = { id: "motherboard", kind: "motherboard" as const, kindLabel: "Motherboard" };
  const board = ctx.frame.hardware.find((h) => h.type === "Motherboard");

  if (!ctx.elevated) {
    return emptyCard(
      { ...base, id: "motherboard-placeholder" },
      { variant: "placeholder", lock: "Needs full sensors", note: "The fan chip needs the helper elevated and PawnIO." },
    );
  }
  if (!pawnIoUsable(ctx)) {
    return emptyCard(
      { ...base, id: "motherboard-placeholder" },
      {
        variant: "placeholder",
        lock: "Needs PawnIO",
        note: ctx.pawnInstalled
          ? "The fan chip is read through PawnIO, whose driver isn't running."
          : "The fan chip is read through PawnIO, which isn't installed.",
      },
    );
  }

  const chips = ctx.frame.hardware.filter((h) => h.type === "SuperIO" || h.type === "EmbeddedController");
  if (chips.length === 0) {
    return emptyCard(
      { ...base, id: "motherboard-empty" },
      { variant: "empty", title: "No fan chip detected", note: "LHM doesn't support this board's fan chip yet." },
    );
  }
  const fans = chips.flatMap((chip) => sensorsOf(ctx, chip.id).filter((s) => s.type === "Fan"));
  if (fans.length === 0) {
    return emptyCard({ ...base, id: "motherboard-empty" }, { variant: "empty", title: "No fans detected" });
  }

  const title = `${board?.name ?? "Motherboard"} · ${chips[0].name}`;
  if (ctx.stale) {
    // Nothing is live: keep the rows, show "—", and don't claim any header reads 0 RPM.
    return emptyCard(base, {
      title,
      variant: "normal",
      clickable: true,
      fans: { rows: fans.map((f) => ({ key: f.key, name: f.name, cell: { kind: "none" }, fraction: 0 })), footer: null },
    });
  }
  const spinning = fans.filter((f) => f.value !== null && f.value > 0);
  const scale = fanScale(Math.max(0, ...spinning.map((f) => f.value as number)));
  return emptyCard(base, {
    title,
    variant: "normal",
    clickable: true,
    fans: {
      rows: spinning.map((f) => ({
        key: f.key,
        name: f.name,
        cell: { kind: "value", ...fmt.rpm0(f.value) },
        fraction: Math.min(1, (f.value as number) / scale),
      })),
      // Only a reading of 0 counts: a header with no reading (null) isn't claimed to read 0 RPM.
      footer: fanFooter(fans.filter((f) => f.value === 0).length),
    },
  });
}

// ---- History chart ----

const COLORS: HistorySeries["color"][] = ["accent", "s2", "s3"];
const DASHES = ["none", "6 4", "2 3"];

function historySeries(
  ctx: Ctx,
  index: number,
  id: string,
  name: string,
  sensor: UiSensor | undefined,
  needs: Needs,
  format: (v: number) => fmt.Parts,
): HistorySeries {
  const c = cell(ctx, sensor?.value, needs, format);
  const locked = c.kind === "locked" ? c.label : null;
  return {
    id,
    name,
    color: COLORS[index],
    dash: DASHES[index],
    key: locked === null && sensor ? sensor.key : null,
    cell: c,
    locked,
  };
}

function buildHistory(ctx: Ctx): HistoryMetric[] {
  const { frame } = ctx;
  const cpu = frame.hardware.find((h) => h.type === "Cpu");
  const cpuS = cpu ? cpuSensors(sensorsOf(ctx, cpu.id)) : undefined;
  const gpus = gpuOrder(frame)
    .map((id) => frame.hardware.find((h) => h.id === id))
    .filter((h): h is UiHardware => h !== undefined)
    .map((hardware) => ({ title: cleanName(hardware.name), s: gpuSensors(ctx, hardware) }));
  const drive = frame.hardware.find((h) => h.type === "Storage");
  const driveTemp = drive
    ? (find(sensorsOf(ctx, drive.id), "Temperature", ["Composite Temperature", "Temperature"]) ??
      firstOfType(sensorsOf(ctx, drive.id), "Temperature"))
    : undefined;

  const temperatures: HistorySeries[] = [];
  if (cpu) temperatures.push(historySeries(ctx, temperatures.length, "cpu-package-temp", "CPU package", cpuS?.temp, "pawnio", fmt.celsius1));
  if (gpus[0]) temperatures.push(historySeries(ctx, temperatures.length, "gpu1-temp", gpus[0].title, gpus[0].s.temp, "none", fmt.celsius1));
  // Reduced mode names the missing drive so the lock explains it; full mode with no drive just omits the row.
  if (drive) temperatures.push(historySeries(ctx, temperatures.length, "drive-temp", cleanName(drive.name), driveTemp, "admin", fmt.celsius0));
  else if (!ctx.elevated) temperatures.push(historySeries(ctx, temperatures.length, "drive-temp", "Drive", undefined, "admin", fmt.celsius0));

  const loads: HistorySeries[] = [];
  if (cpu) loads.push(historySeries(ctx, loads.length, "cpu-total-load", "CPU total", cpuS?.load, "none", fmt.percent0));
  gpus.slice(0, 2).forEach((gpu, i) => loads.push(historySeries(ctx, loads.length, `gpu${i + 1}-load`, gpu.title, gpu.s.load, "none", fmt.percent0)));

  const powers: HistorySeries[] = [];
  if (cpu) powers.push(historySeries(ctx, powers.length, "cpu-package-power", "CPU package", cpuS?.power, "pawnio", fmt.watts1));
  gpus.slice(0, 2).forEach((gpu, i) => powers.push(historySeries(ctx, powers.length, `gpu${i + 1}-power`, gpu.title, gpu.s.power, "none", fmt.watts1)));

  return [
    { id: "temperatures", label: "Temperatures", domain: [20, 100], axis: ["100 °C", "60", "20"], series: temperatures },
    { id: "load", label: "Load", domain: [0, 100], axis: ["100 %", "50", "0"], series: loads },
    { id: "power", label: "Power", domain: [0, 200], axis: ["200 W", "100", "0"], series: powers },
  ];
}

// ---- The dashboard ----

const STARTING: DashboardModel = { starting: true, summary: "", cards: [], history: [] };

export function buildDashboard(frame: UiFrame | null, status: SensorStatus, options: BuildOptions = {}): DashboardModel {
  if (frame === null) return STARTING;

  const byHw = new Map<string, UiSensor[]>();
  for (const sensor of frame.sensors) {
    const list = byHw.get(sensor.hw);
    if (list) list.push(sensor);
    else byHw.set(sensor.hw, [sensor]);
  }
  const ctx: Ctx = { frame, ...accessOf(frame, status), stale: options.stale === true, byHw };

  const cards: CardModel[] = [];
  const cpus = frame.hardware.filter((h) => h.type === "Cpu");
  for (const cpu of cpus) cards.push(cpuCard(ctx, cpu));
  cards.push(memoryCard(ctx));

  const gpus = gpuOrder(frame)
    .map((id) => frame.hardware.find((h) => h.id === id))
    .filter((h): h is UiHardware => h !== undefined);
  if (gpus.length === 0) {
    cards.push(
      emptyCard(
        { id: "gpu-empty", kind: "gpu", kindLabel: "GPU" },
        { variant: "empty", title: "No GPU detected", note: "LHM found no graphics adapter it can read." },
      ),
    );
  }
  for (const gpu of gpus) cards.push(gpuCard(ctx, gpu));

  const drives = frame.hardware.filter((h) => h.type === "Storage");
  if (!ctx.elevated) {
    cards.push(
      emptyCard(
        { id: "disk-placeholder", kind: "disk", kindLabel: "Disks" },
        {
          variant: "placeholder",
          lock: "Needs full sensors",
          note: "Drives, throughput, temperature and SMART health are read by the elevated helper.",
        },
      ),
    );
  } else if (drives.length === 0) {
    cards.push(emptyCard({ id: "disk-empty", kind: "disk", kindLabel: "Disk" }, { variant: "empty", title: "No drives detected" }));
  } else {
    for (const drive of drives) cards.push(diskCard(ctx, drive));
  }
  cards.push(motherboardCard(ctx));

  // Header: CPU · board · memory · each GPU in card order · each drive. Missing parts are left out.
  const board = frame.hardware.find((h) => h.type === "Motherboard");
  const parts = [
    ...cpus.map((c) => cleanName(c.name)),
    ...(board ? [board.name] : []),
    ...(frame.memory.length > 0 ? [memoryText(frame, true)] : []),
    ...gpus.map((g) => cleanName(g.name)),
    ...(ctx.elevated ? drives.map((d) => cleanName(d.name)) : []),
  ];

  return { starting: false, summary: parts.join(" · "), cards, history: buildHistory(ctx) };
}

// ---- Drill-down: card scopes and groups ----

/** The hardware ids a card's drill-down lists, in LHM order. Empty for an unknown or placeholder card. */
export function componentScope(frame: UiFrame, cardId: string): string[] {
  const separator = cardId.indexOf(":");
  const kind = separator === -1 ? cardId : cardId.slice(0, separator);
  const hardwareId = separator === -1 ? "" : cardId.slice(separator + 1);
  const exists = (id: string) => frame.hardware.some((h) => h.id === id);

  switch (kind) {
    case "cpu":
    case "gpu":
    case "disk":
      return exists(hardwareId) ? [hardwareId] : [];
    case "memory":
      // /ram, /vram and the DIMMs.
      return frame.hardware.filter((h) => h.type === "Memory").map((h) => h.id);
    case "motherboard": {
      // /motherboard and everything below it (its SuperIO and embedded controllers).
      const board = frame.hardware.find((h) => h.type === "Motherboard");
      if (!board) return [];
      const below = new Set([board.id]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const h of frame.hardware) {
          if (!below.has(h.id) && h.parent !== null && below.has(h.parent)) {
            below.add(h.id);
            changed = true;
          }
        }
      }
      return frame.hardware.filter((h) => below.has(h.id)).map((h) => h.id);
    }
    default:
      return [];
  }
}

const GROUP_ORDER = [
  "Fan",
  "Temperature",
  "Voltage",
  "Clock",
  "Load",
  "Power",
  "Current",
  "Data",
  "SmallData",
  "Throughput",
  "Level",
  "Factor",
  "Timing",
  "Control",
];

const GROUP_LABELS: Record<string, string> = {
  Fan: "Fans",
  Temperature: "Temperatures",
  Voltage: "Voltages",
  Clock: "Clocks",
  Load: "Loads",
  Power: "Power",
  Current: "Currents",
  Data: "Data",
  SmallData: "Small data",
  Throughput: "Throughput",
  Level: "Levels",
  Factor: "Factors",
  Timing: "Timings",
  Control: "Controls",
};

/** A plural group label ("Fans"); unknown types get an "s". */
export function groupLabel(type: string): string {
  return GROUP_LABELS[type] ?? `${type}s`;
}

export interface SensorGroup {
  type: string;
  label: string;
  sensors: UiSensor[];
  /** Set when the group needs more than the helper has and none of its values is live: the card shows no rows. */
  lock: LockLabel | null;
}

export interface DrillSection {
  /** The hardware heading, only when the scope has more than one hardware item with sensors. */
  heading: string | null;
  groups: SensorGroup[];
}

/**
 * Which drill-down groups PawnIO serves: the UI's copy of the helper's RF3 table (`helper/Availability.cs`). The helper
 * owns validity (it sends `null`); this only picks the lock label for a group whose values are all `null`.
 */
function groupNeeds(hardwareType: string, sensorType: string): Needs {
  switch (hardwareType) {
    case "Cpu":
      return sensorType === "Load" ? "none" : "pawnio";
    case "Motherboard":
    case "SuperIO":
    case "EmbeddedController":
      return "pawnio";
    case "GpuIntel":
      return sensorType === "Power" ? "pawnio" : "none";
    default:
      return "none";
  }
}

function groupByType(hardware: UiHardware, sensors: UiSensor[], access: Access): SensorGroup[] {
  const byType = new Map<string, UiSensor[]>();
  for (const sensor of sensors) {
    const list = byType.get(sensor.type);
    if (list) list.push(sensor);
    else byType.set(sensor.type, [sensor]);
  }
  const rank = (type: string) => {
    const index = GROUP_ORDER.indexOf(type);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...byType.keys()]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    // Rows keep LHM's `index` order (the sort is stable, so equal indices keep frame order).
    .map((type) => {
      const rows = [...byType.get(type)!].sort((a, b) => a.index - b.index);
      const lock = rows.every((s) => s.value === null) ? lockFor(access, groupNeeds(hardware.type, type)) : null;
      return { type, label: groupLabel(type), sensors: rows, lock };
    });
}

/**
 * The drill-down list: grouped by SensorType, in the stated order. A scope with several hardware items that have sensors
 * (Memory: `/ram`, `/vram`, the DIMMs) is grouped by hardware first, with the hardware name as a heading, because two
 * rows named "Memory Used" can't otherwise be told apart.
 */
export function drillSections(frame: UiFrame, scope: string[], status: SensorStatus): DrillSection[] {
  const access = accessOf(frame, status);
  const withSensors = scope
    .map((id) => ({ hardware: frame.hardware.find((h) => h.id === id), sensors: frame.sensors.filter((s) => s.hw === id) }))
    .filter((entry): entry is { hardware: UiHardware; sensors: UiSensor[] } => entry.hardware !== undefined && entry.sensors.length > 0);
  if (withSensors.length <= 1) {
    return [{ heading: null, groups: withSensors.flatMap((entry) => groupByType(entry.hardware, entry.sensors, access)) }];
  }
  return withSensors.map((entry) => ({ heading: cleanName(entry.hardware.name), groups: groupByType(entry.hardware, entry.sensors, access) }));
}

/** The page title's component name: the hardware's own name for CPU, GPU and Disk; the kind for Memory and Motherboard. */
export function componentName(frame: UiFrame, cardId: string): string {
  const [kind, ...rest] = cardId.split(":");
  const hardwareId = rest.join(":");
  if (kind === "memory") return "Memory";
  if (kind === "motherboard") return "Motherboard";
  const hardware = frame.hardware.find((h) => h.id === hardwareId);
  return hardware ? cleanName(hardware.name) : "Sensors";
}
