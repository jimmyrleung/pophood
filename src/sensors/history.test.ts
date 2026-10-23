import { describe, expect, it } from "vitest";
import { frame, sensor } from "../test/builders";
import { appendFrame, WINDOW_MS, type History } from "./history";

const cpu = (value: number | null) => sensor("/amdcpu/0/temperature/2", "Core (Tctl/Tdie)", value);
const load = (value: number | null) => sensor("/amdcpu/0/load/0", "CPU Total", value, "Load");

describe("history (UT-21)", () => {
  it("appends one point per sensor per frame, keyed by sensor key", () => {
    const history: History = new Map();
    appendFrame(history, frame(1000, [cpu(40), load(10)]));
    appendFrame(history, frame(2000, [cpu(41), load(11)]));

    expect(history.get(cpu(0).key)).toEqual({ t: [1000, 2000], v: [40, 41] });
    expect(history.get(load(0).key)).toEqual({ t: [1000, 2000], v: [10, 11] });
  });

  it("keeps null values, so a line can break", () => {
    const history: History = new Map();
    appendFrame(history, frame(1000, [cpu(40)]));
    appendFrame(history, frame(2000, [cpu(null)]));
    appendFrame(history, frame(3000, [cpu(42)]));
    expect(history.get(cpu(0).key)?.v).toEqual([40, null, 42]);
  });

  it("trims points older than 10 minutes, relative to the newest frame", () => {
    const history: History = new Map();
    for (let i = 0; i <= 700; i++) appendFrame(history, frame(i * 1000, [cpu(i)]));

    const series = history.get(cpu(0).key)!;
    const newest = 700_000;
    expect(series.t[series.t.length - 1]).toBe(newest);
    expect(series.t[0]).toBe(newest - WINDOW_MS);
    expect(series.t.length).toBe(601);
    expect(series.v.length).toBe(series.t.length);
  });

  it("keeps a point exactly at the window edge", () => {
    const history: History = new Map();
    appendFrame(history, frame(0, [cpu(1)]));
    appendFrame(history, frame(WINDOW_MS, [cpu(2)]));
    expect(history.get(cpu(0).key)?.t).toEqual([0, WINDOW_MS]);
    appendFrame(history, frame(WINDOW_MS + 1, [cpu(3)]));
    expect(history.get(cpu(0).key)?.t).toEqual([WINDOW_MS, WINDOW_MS + 1]);
  });

  it("deletes a series whose newest point has aged out", () => {
    const history: History = new Map();
    appendFrame(history, frame(1000, [cpu(40), load(10)]));
    // Later frames no longer carry the CPU temperature sensor.
    appendFrame(history, frame(1000 + WINDOW_MS + 1, [load(11)]));

    expect(history.has(cpu(0).key)).toBe(false);
    expect(history.get(load(0).key)?.t).toEqual([1000 + WINDOW_MS + 1]);
  });

  it("starts a series for a sensor that appears late", () => {
    const history: History = new Map();
    appendFrame(history, frame(1000, [cpu(40)]));
    appendFrame(history, frame(2000, [cpu(41), load(5)]));
    expect(history.get(load(0).key)).toEqual({ t: [2000], v: [5] });
  });
});
