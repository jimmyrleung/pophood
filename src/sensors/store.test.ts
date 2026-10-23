import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { frame, liveReduced, sensor, status, stopped } from "../test/builders";
import type { SensorEvent } from "./protocol";

// The real Channel and invoke only exist inside Tauri.
const mocks = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: unknown) => Promise<unknown>>(),
  channels: [] as { onmessage: (event: unknown) => void }[],
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  Channel: class {
    onmessage: (event: unknown) => void = () => {};
    constructor() {
      mocks.channels.push(this);
    }
  },
}));

const { createSensorStore } = await import("./store");

const cpu = (value: number | null) => sensor("/amdcpu/0/temperature/2", "Core (Tctl/Tdie)", value);
const send = (event: SensorEvent) => mocks.channels[mocks.channels.length - 1].onmessage(event);

beforeEach(() => {
  mocks.channels.length = 0;
  mocks.invoke.mockReset();
  mocks.invoke.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sensor store (UT-21)", () => {
  it("starts as 'starting' and stale, with nothing to show", () => {
    const snapshot = createSensorStore().getSnapshot();
    expect(snapshot.status.phase).toBe("starting");
    expect(snapshot.stale).toBe(true);
    expect(snapshot.frame).toBeNull();
    expect(snapshot.history.size).toBe(0);
  });

  it("subscribes through subscribe_sensors with a channel and applies what arrives", async () => {
    const store = createSensorStore();
    const dispose = await store.start();

    expect(mocks.invoke).toHaveBeenCalledWith("subscribe_sensors", { onEvent: mocks.channels[0] });
    send({ kind: "status", status: liveReduced() });
    send({ kind: "frame", frame: frame(1000, [cpu(40)]) });

    const snapshot = store.getSnapshot();
    expect(snapshot.status.phase).toBe("live");
    expect(snapshot.frame?.t).toBe(1000);
    expect(snapshot.stale).toBe(false);
    dispose();
  });

  it("keeps the initial status when no supervisor answers", async () => {
    mocks.invoke.mockRejectedValue("command subscribe_sensors not found");
    const store = createSensorStore();
    const dispose = await store.start();
    expect(store.getSnapshot().status.phase).toBe("starting");
    dispose();
  });

  it("notifies subscribers with a new snapshot object per change", () => {
    const store = createSensorStore();
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
    const before = store.getSnapshot();
    store.applyEvent({ kind: "status", status: liveReduced() });
    unsubscribe();
    store.applyEvent({ kind: "status", status: status() });

    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBe(before);
  });

  it("follows the phase: stale unless live", () => {
    const store = createSensorStore();
    store.applyEvent({ kind: "status", status: liveReduced() });
    expect(store.getSnapshot().stale).toBe(false);
    store.applyEvent({ kind: "status", status: liveReduced({ phase: "reconnecting", restartAttempt: 1 }) });
    expect(store.getSnapshot().stale).toBe(true);
    store.applyEvent({ kind: "status", status: liveReduced() });
    expect(store.getSnapshot().stale).toBe(false);
  });

  it("keeps the last frame while reconnecting, but drops it when stopped with a notice", () => {
    const store = createSensorStore();
    store.applyEvent({ kind: "status", status: liveReduced() });
    store.applyEvent({ kind: "frame", frame: frame(1000, [cpu(40)]) });

    store.applyEvent({ kind: "status", status: liveReduced({ phase: "reconnecting", restartAttempt: 1 }) });
    expect(store.getSnapshot().frame).not.toBeNull();

    store.applyEvent({ kind: "status", status: stopped({ code: "helper_hash_mismatch", detail: "expected a, got b" }) });
    expect(store.getSnapshot().frame).toBeNull();
    expect(store.getSnapshot().stale).toBe(true);
  });

  it("appends history per frame and trims it to 10 minutes of frame time", () => {
    const store = createSensorStore();
    for (let i = 0; i <= 700; i++) store.applyEvent({ kind: "frame", frame: frame(i * 1000, [cpu(i)]) });
    const series = store.getSnapshot().history.get(cpu(0).key)!;
    expect(series.t[0]).toBe(100_000);
    expect(series.t).toHaveLength(601);
  });

  it("marks values stale when no frame arrives for 3 periods, and the next frame clears it", async () => {
    vi.useFakeTimers();
    const store = createSensorStore();
    const dispose = await store.start();
    send({ kind: "status", status: liveReduced() });
    send({ kind: "frame", frame: frame(1000, [cpu(40)]) });
    expect(store.getSnapshot().stale).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(store.getSnapshot().stale).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().stale).toBe(true);
    expect(store.getSnapshot().status.phase).toBe("live");

    send({ kind: "frame", frame: frame(5000, [cpu(41)]) });
    expect(store.getSnapshot().stale).toBe(false);
    dispose();
  });

  it("scales the watchdog with the frame's own period", async () => {
    vi.useFakeTimers();
    const store = createSensorStore();
    const dispose = await store.start();
    send({ kind: "status", status: liveReduced() });
    send({ kind: "frame", frame: frame(1000, [cpu(40)], { periodMs: 250 }) });

    vi.advanceTimersByTime(2000);
    expect(store.getSnapshot().stale).toBe(true);
    dispose();
  });

  it("a status event doesn't make a frame the watchdog flagged look live again", async () => {
    vi.useFakeTimers();
    const store = createSensorStore();
    const dispose = await store.start();
    send({ kind: "status", status: liveReduced() });
    send({ kind: "frame", frame: frame(1000, [cpu(40)]) });
    vi.advanceTimersByTime(4000);
    expect(store.getSnapshot().stale).toBe(true);

    send({ kind: "status", status: liveReduced({ elevation: "prompting" }) });
    expect(store.getSnapshot().stale).toBe(true);
    send({ kind: "frame", frame: frame(5000, [cpu(41)]) });
    expect(store.getSnapshot().stale).toBe(false);
    dispose();
  });

  it("stops the watchdog when disposed", async () => {
    vi.useFakeTimers();
    const store = createSensorStore();
    const dispose = await store.start();
    send({ kind: "status", status: liveReduced() });
    send({ kind: "frame", frame: frame(1000, [cpu(40)]) });
    dispose();

    vi.advanceTimersByTime(60_000);
    expect(store.getSnapshot().stale).toBe(false);
  });
});
