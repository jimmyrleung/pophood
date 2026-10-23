import { describe, expect, it } from "vitest";
import * as fmt from "./format";

// UT-23: every row of the "Number formats" table.
describe("number formats (UT-23)", () => {
  it.each([
    ["Temperature", 38, "38.0 °C"],
    ["Load", 12.34, "12.3 %"],
    ["Control", 50, "50.0 %"],
    ["Level", 97, "97.0 %"],
    ["Clock", 4668, "4,668 MHz"],
    ["Power", 62.3, "62.3 W"],
    ["Voltage", 1.244, "1.244 V"],
    ["Current", 1.2, "1.20 A"],
    ["Fan", 1142, "1,142 RPM"],
    ["Data", 14.23, "14.2 GB"],
    ["SmallData", 2429, "2,429 MB"],
    ["Throughput", 419652.34, "0.4 MB/s"],
    ["Timing", 0.416, "0.416 ns"],
    ["Factor", 46.5, "46.50"],
    ["Whatever", 3, "3.00"],
  ])("%s %d → %s", (type, value, expected) => {
    expect(fmt.formatSensor(type, value)).toBe(expected);
  });

  it("null is a dash, for every type", () => {
    for (const type of ["Temperature", "Load", "Clock", "Power", "Voltage", "Current", "Fan", "Data", "SmallData", "Throughput", "Timing", "Factor"]) {
      expect(fmt.formatSensor(type, null)).toBe("—");
      expect(fmt.formatParts(type, null)).toEqual({ value: "—", unit: "" });
    }
  });

  it("throughput is decimal MB/s (1e6), like CrystalDiskMark", () => {
    expect(fmt.formatSensor("Throughput", 1_000_000)).toBe("1.0 MB/s");
    expect(fmt.formatSensor("Throughput", 123_456_789)).toBe("123.5 MB/s");
  });

  it("splits value and unit for rendering", () => {
    expect(fmt.formatParts("Temperature", 38)).toEqual({ value: "38.0", unit: "°C" });
    expect(fmt.formatParts("Factor", 46.5)).toEqual({ value: "46.50", unit: "" });
  });

  it("never prints a negative zero", () => {
    expect(fmt.formatSensor("Temperature", -0.04)).toBe("0.0 °C");
  });

  it("memory speeds in MT/s are never grouped", () => {
    expect(fmt.megatransfers(6000)).toEqual({ value: "6000", unit: "MT/s" });
    expect(fmt.speedText(6000)).toBe("6000");
    expect(fmt.speedText(10400)).toBe("10400");
  });

  it("card formats use fewer decimals than the drill-down", () => {
    expect(fmt.percent0(12.34)).toEqual({ value: "12", unit: "%" });
    expect(fmt.celsius1(65.62501)).toEqual({ value: "65.6", unit: "°C" });
    expect(fmt.celsius0(31)).toEqual({ value: "31", unit: "°C" });
    expect(fmt.watts1(70.76107)).toEqual({ value: "70.8", unit: "W" });
    expect(fmt.megahertz0(2550)).toEqual({ value: "2,550", unit: "MHz" });
    expect(fmt.gigahertz2(4210)).toEqual({ value: "4.21", unit: "GHz avg" });
    expect(fmt.rpm0(1744.186)).toEqual({ value: "1,744", unit: "RPM" });
    expect(fmt.megabytesPerSecond1(12_400_000, "MB/s read")).toEqual({ value: "12.4", unit: "MB/s read" });
    expect(fmt.lifeLeft0(97)).toEqual({ value: "97", unit: "% life left" });
  });

  it("gigabytes are GiB with one decimal", () => {
    expect(fmt.gigabytesOf(14.2, 31.1)).toEqual({ value: "14.2", unit: "/ 31.1 GB" });
    expect(fmt.gigabytesOf(null, 31.1)).toEqual({ value: "—", unit: "" });
    expect(fmt.vram(512, 512)).toEqual({ value: "0.5", unit: "/ 0.5 GB" });
    expect(fmt.vram(2429, 16311)).toEqual({ value: "2.4", unit: "/ 15.9 GB" });
  });

  it("non-finite values read as a dash", () => {
    expect(fmt.fixed(Number.NaN, 1)).toBe("—");
    expect(fmt.formatSensor("Load", Number.POSITIVE_INFINITY)).toBe("—");
  });
});
