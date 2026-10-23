// Number formats from the techspec ("Number formats"). Values and units are separated by a space; `null` is "—".
// Memory "GB" means GiB (as Task Manager shows it). Only disk throughput is decimal (MB/s = 1e6 B/s, like CrystalDiskMark).

export const NOT_REPORTED = "—";

const cache = new Map<string, Intl.NumberFormat>();

function number(value: number, decimals: number, grouping: boolean): string {
  const key = `${decimals}:${grouping}`;
  let formatter = cache.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouping,
    });
    cache.set(key, formatter);
  }
  // "-0.0" would be a lie for a value that rounds to zero.
  const text = formatter.format(value);
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

export interface Parts {
  value: string;
  unit: string;
}

const missing: Parts = { value: NOT_REPORTED, unit: "" };

/** Plain number with `decimals` places and thousands separators. */
export function fixed(value: number | null, decimals: number): string {
  return value === null || !Number.isFinite(value) ? NOT_REPORTED : number(value, decimals, true);
}

/** Drill-down format for a sensor of the given LHM `SensorType`, split into value and unit. */
export function formatParts(type: string, value: number | null): Parts {
  if (value === null || !Number.isFinite(value)) return missing;
  switch (type) {
    case "Temperature":
      return { value: number(value, 1, true), unit: "°C" };
    case "Load":
    case "Control":
    case "Level":
      return { value: number(value, 1, true), unit: "%" };
    case "Clock":
      return { value: number(value, 0, true), unit: "MHz" };
    case "Power":
      return { value: number(value, 1, true), unit: "W" };
    case "Voltage":
      return { value: number(value, 3, true), unit: "V" };
    case "Current":
      return { value: number(value, 2, true), unit: "A" };
    case "Fan":
      return { value: number(value, 0, true), unit: "RPM" };
    case "Data":
      return { value: number(value, 1, true), unit: "GB" };
    case "SmallData":
      return { value: number(value, 0, true), unit: "MB" };
    case "Throughput":
      return { value: number(value / 1e6, 1, true), unit: "MB/s" };
    case "Timing":
      return { value: number(value, 3, true), unit: "ns" };
    default:
      // Factor and everything else: 2 dp, no unit.
      return { value: number(value, 2, true), unit: "" };
  }
}

export function formatSensor(type: string, value: number | null): string {
  const { value: text, unit } = formatParts(type, value);
  return unit === "" ? text : `${text} ${unit}`;
}

// ---- Card formats (dashboard cells use fewer decimals than the drill-down) ----

export const percent0 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 0, true), unit: "%" });
export const celsius1 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 1, true), unit: "°C" });
export const celsius0 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 0, true), unit: "°C" });
export const watts1 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 1, true), unit: "W" });
export const megahertz0 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 0, true), unit: "MHz" });
/** MHz → GHz with two decimals: "4.21 GHz avg". */
export const gigahertz2 = (v: number | null): Parts =>
  v === null ? missing : { value: number(v / 1000, 2, true), unit: "GHz avg" };
export const rpm0 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 0, true), unit: "RPM" });
/** Disk throughput in decimal MB/s with the given suffix ("MB/s read"). */
export const megabytesPerSecond1 = (v: number | null, unit: string): Parts =>
  v === null ? missing : { value: number(v / 1e6, 1, true), unit };
export const lifeLeft0 = (v: number | null): Parts => (v === null ? missing : { value: number(v, 0, true), unit: "% life left" });
/** Memory speeds in MT/s are never grouped: "6000", not "6,000". */
export const megatransfers = (v: number | null): Parts =>
  v === null ? missing : { value: number(v, 0, false), unit: "MT/s" };
/** `used / total` in GiB with one decimal: value "14.2", unit "/ 31.1 GB". */
export function gigabytesOf(used: number | null, total: number | null): Parts {
  if (used === null || total === null) return missing;
  return { value: number(used, 1, true), unit: `/ ${number(total, 1, true)} GB` };
}
/** MiB → GiB used / total for VRAM: "0.4" "/ 0.5 GB". */
export function vram(usedMiB: number | null, totalMiB: number | null): Parts {
  return gigabytesOf(usedMiB === null ? null : usedMiB / 1024, totalMiB === null ? null : totalMiB / 1024);
}

/** MT/s without grouping, for headings such as "DDR5-6000". */
export const speedText = (mts: number): string => number(mts, 0, false);
