import type { Series } from "../sensors/history";

type Domain = [number, number];

const one = (n: number) => n.toFixed(1);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Frames further apart than this (the UI watchdog's 3 × 1 s) had no readings in between: the line breaks. */
const MAX_GAP_MS = 3000;

interface Point {
  x: number;
  y: number;
}

/** Splits a series into runs of non-null points. A `null` value or a time gap over `MAX_GAP_MS` ends the run. */
function segments(s: Series, domain: Domain, w: number, h: number, nowMs: number, windowMs: number): Point[][] {
  const [low, high] = domain;
  const span = high - low;
  const start = nowMs - windowMs;
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (let i = 0; i < s.t.length; i++) {
    const value = s.v[i];
    if (value === null || !Number.isFinite(value)) {
      if (run.length > 0) runs.push(run);
      run = [];
      continue;
    }
    if (run.length > 0 && s.t[i] - s.t[i - 1] > MAX_GAP_MS) {
      runs.push(run);
      run = [];
    }
    // x follows frame time over the window; y follows the domain, clamped, so a spike can't leave the chart.
    const x = clamp01((s.t[i] - start) / windowMs) * w;
    const y = h - (span > 0 ? clamp01((value - low) / span) : 0) * h;
    run.push({ x, y });
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** `M x y L x y …`, one `M` per run of points. Coordinates have one decimal. */
export function linePath(s: Series, domain: Domain, w: number, h: number, nowMs: number, windowMs: number): string {
  return segments(s, domain, w, h, nowMs, windowMs)
    .map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${one(p.x)} ${one(p.y)}`).join(""))
    .join("");
}

/**
 * The same points, each run closed to the baseline on its own (`… L x_end h L x_start h Z`). Closing one multi-`M` path
 * only once would fill the wrong region. A single point has no area.
 */
export function areaPath(s: Series, domain: Domain, w: number, h: number, nowMs: number, windowMs: number): string {
  return segments(s, domain, w, h, nowMs, windowMs)
    .filter((run) => run.length >= 2)
    .map((run) => {
      const line = run.map((p, i) => `${i === 0 ? "M" : "L"}${one(p.x)} ${one(p.y)}`).join("");
      const first = run[0];
      const last = run[run.length - 1];
      return `${line}L${one(last.x)} ${one(h)}L${one(first.x)} ${one(h)}Z`;
    })
    .join("");
}
