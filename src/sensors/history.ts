import type { UiFrame } from "./protocol";

/** Two parallel arrays, oldest first, so a chart can walk them without allocating. */
export interface Series {
  t: number[];
  v: (number | null)[];
}

export type History = Map<string, Series>;

/** The window the UI keeps and draws (RF10). */
export const WINDOW_MS = 600_000;

/** Index of the first element that is >= `limit` (the array is sorted). */
function firstAtOrAfter(times: number[], limit: number): number {
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (times[mid] < limit) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * Pushes `(t, value)` for every sensor in the frame, then drops points older than `frame.t - WINDOW_MS`.
 * Nulls are kept (they break a line). A series whose points have all aged out is deleted.
 */
export function appendFrame(history: History, frame: UiFrame): void {
  for (const sensor of frame.sensors) {
    let series = history.get(sensor.key);
    if (series === undefined) {
      series = { t: [], v: [] };
      history.set(sensor.key, series);
    }
    series.t.push(frame.t);
    series.v.push(sensor.value);
  }

  const limit = frame.t - WINDOW_MS;
  for (const [key, series] of history) {
    const drop = firstAtOrAfter(series.t, limit);
    if (drop > 0) {
      series.t.splice(0, drop);
      series.v.splice(0, drop);
    }
    if (series.t.length === 0) history.delete(key);
  }
}
