import { describe, expect, it } from "vitest";
import type { Series } from "../sensors/history";
import { areaPath, linePath } from "./path";

const W = 600;
const H = 200;
const WINDOW = 600_000;
const NOW = 1_000_000;
const DOMAIN: [number, number] = [0, 100];

const series = (points: [number, number | null][]): Series => ({ t: points.map(([t]) => t), v: points.map(([, v]) => v) });

// UT-22
describe("linePath and areaPath (UT-22)", () => {
  it("maps time to x over the window: the oldest edge is 0, now is the width", () => {
    const s = series([[NOW - WINDOW, 50], [NOW - WINDOW / 2, 50], [NOW, 50]]);
    // Minutes apart, so each point is its own run (gaps over 3 s break the line).
    expect(linePath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M0.0 100.0M300.0 100.0M600.0 100.0");
  });

  it("maps the domain to y: the low end is the baseline, the high end is the top", () => {
    const s = series([[NOW - 2000, 0], [NOW - 1000, 100], [NOW, 25]]);
    expect(linePath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M598.0 200.0L599.0 0.0L600.0 150.0");
  });

  it("clamps values to the domain", () => {
    const s = series([[NOW - 1000, -50], [NOW, 500]]);
    expect(linePath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M599.0 200.0L600.0 0.0");
  });

  it("clamps points outside the window to the edges", () => {
    const s = series([[NOW - WINDOW - 5000, 10], [NOW + 5000, 10]]);
    expect(linePath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M0.0 180.0M600.0 180.0");
  });

  it("starts a new M after a null, so the line breaks", () => {
    const s = series([[NOW - 3000, 10], [NOW - 2000, 20], [NOW - 1000, null], [NOW, 30]]);
    const d = linePath(s, DOMAIN, W, H, NOW, WINDOW);
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).toBe("M597.0 180.0L598.0 160.0M600.0 140.0");
  });

  it("starts a new M after a gap over 3 s between frames, and keeps a 3 s step joined", () => {
    const gap = series([[NOW - 60_000, 10], [NOW - 59_000, 10], [NOW - 1000, 20], [NOW, 20]]);
    expect(linePath(gap, DOMAIN, W, H, NOW, WINDOW).match(/M/g)).toHaveLength(2);
    expect(areaPath(gap, DOMAIN, W, H, NOW, WINDOW).split("Z").filter(Boolean)).toHaveLength(2);
    const step = series([[NOW - 3000, 10], [NOW, 20]]);
    expect(linePath(step, DOMAIN, W, H, NOW, WINDOW).match(/M/g)).toHaveLength(1);
  });

  it("an all-null or empty series is an empty path", () => {
    expect(linePath(series([[NOW, null]]), DOMAIN, W, H, NOW, WINDOW)).toBe("");
    expect(linePath(series([]), DOMAIN, W, H, NOW, WINDOW)).toBe("");
    expect(areaPath(series([]), DOMAIN, W, H, NOW, WINDOW)).toBe("");
  });

  it("uses one decimal in every coordinate", () => {
    const s = series([[NOW - 333, 33.333], [NOW, 66.666]]);
    for (const number of linePath(s, DOMAIN, W, H, NOW, WINDOW).match(/\d+(\.\d+)?/g)!) {
      expect(number).toMatch(/^\d+\.\d$/);
    }
  });

  it("an area closes one run to the baseline", () => {
    const s = series([[NOW - 1000, 50], [NOW, 100]]);
    expect(areaPath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M599.0 100.0L600.0 0.0L600.0 200.0L599.0 200.0Z");
  });

  it("a series with a gap gives two closed area segments, each ending on the baseline, with nothing filled across the gap", () => {
    const s = series([[NOW - 5000, 10], [NOW - 4000, 20], [NOW - 3000, null], [NOW - 2000, 30], [NOW - 1000, 40]]);
    const d = areaPath(s, DOMAIN, W, H, NOW, WINDOW);
    const segments = d.split("Z").filter(Boolean);
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      expect(segment.startsWith("M")).toBe(true);
      expect(segment.match(/M/g)).toHaveLength(1);
      // The last two points of each closed segment are on the baseline (y = 200.0).
      const points = segment.match(/[ML][\d.]+ [\d.]+/g)!;
      expect(points.at(-1)!.endsWith(" 200.0")).toBe(true);
      expect(points.at(-2)!.endsWith(" 200.0")).toBe(true);
    }
    // The first segment ends before the gap's x, the second starts after it.
    const firstXs = segments[0].match(/[ML]([\d.]+)/g)!.map((p) => Number(p.slice(1)));
    const secondXs = segments[1].match(/[ML]([\d.]+)/g)!.map((p) => Number(p.slice(1)));
    expect(Math.max(...firstXs)).toBeLessThan(Math.min(...secondXs));
  });

  it("a single point has no area, and no visible line", () => {
    const s = series([[NOW, 50]]);
    expect(areaPath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("");
    expect(linePath(s, DOMAIN, W, H, NOW, WINDOW)).toBe("M600.0 100.0");
  });

  it("a degenerate domain draws on the baseline instead of dividing by zero", () => {
    const s = series([[NOW - 1000, 5], [NOW, 5]]);
    expect(linePath(s, [0, 0], W, H, NOW, WINDOW)).toBe("M599.0 200.0L600.0 200.0");
  });
});
