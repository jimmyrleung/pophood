import { describe, expect, it } from "vitest";
import fixture from "../test/fixtures/event-frame.json";
import type { SensorEvent, UiFrame } from "./protocol";

// UT-28 (TypeScript half): the shared fixture is the wire shape. src-tauri/src/sensors/events.rs asserts the Rust half.
describe("event-frame.json (UT-28)", () => {
  const event = fixture as SensorEvent;

  it("is a frame event", () => {
    expect(event.kind).toBe("frame");
  });

  it("carries the UiFrame fields with the expected types", () => {
    if (event.kind !== "frame") throw new Error("not a frame");
    const frame: UiFrame = event.frame;
    expect(typeof frame.seq).toBe("number");
    expect(typeof frame.t).toBe("number");
    expect(typeof frame.periodMs).toBe("number");
    expect(typeof frame.elevated).toBe("boolean");
    expect(Object.keys(frame).sort()).toEqual(["elevated", "hardware", "memory", "periodMs", "sensors", "seq", "t"]);
  });

  it("locks the memory module field names sizeGB and configuredMTs", () => {
    if (event.kind !== "frame") throw new Error("not a frame");
    const module = event.frame.memory[0];
    expect(Object.keys(module).sort()).toEqual(["configuredMTs", "locator", "sizeGB", "type"]);
    expect(module.sizeGB).toBe(16);
    expect(module.configuredMTs).toBe(6000);
  });

  it("gives every sensor a key (id|name) and keeps null values", () => {
    if (event.kind !== "frame") throw new Error("not a frame");
    for (const s of event.frame.sensors) {
      expect(Object.keys(s).sort()).toEqual(["hw", "id", "index", "key", "name", "type", "value"]);
      expect(s.key).toBe(`${s.id}|${s.name}`);
    }
    expect(event.frame.sensors.some((s) => s.value === null)).toBe(true);
    expect(event.frame.sensors.some((s) => typeof s.value === "number")).toBe(true);
  });

  it("describes hardware with a nullable parent", () => {
    if (event.kind !== "frame") throw new Error("not a frame");
    expect(Object.keys(event.frame.hardware[0]).sort()).toEqual(["id", "name", "parent", "type"]);
    expect(event.frame.hardware[0].parent).toBeNull();
  });
});
