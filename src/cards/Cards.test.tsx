import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import full from "../test/fixtures/frame-full.json";
import noPawnio from "../test/fixtures/frame-elevated-no-pawnio.json";
import reduced from "../test/fixtures/frame-reduced.json";
import { liveElevated, liveReduced } from "../test/builders";
import type { SensorStatus, UiFrame } from "../sensors/protocol";
import { SensorStoreContext, createSensorStore } from "../sensors/store";
import { DashboardCard } from "./DashboardCard";
import { buildDashboard, type CardModel } from "./fields";

function renderCard(frame: UiFrame, status: SensorStatus, cardId: string, onOpen = vi.fn()) {
  const card = buildDashboard(frame, status).cards.find((c) => c.id === cardId) as CardModel;
  expect(card, `card ${cardId}`).toBeDefined();
  const store = createSensorStore();
  store.applyEvent({ kind: "status", status });
  store.applyEvent({ kind: "frame", frame });
  const view = render(
    <SensorStoreContext.Provider value={store}>
      <DashboardCard card={card} nowMs={frame.t} onOpen={onOpen} />
    </SensorStoreContext.Provider>,
  );
  return { ...view, onOpen, card };
}

const FULL = full as UiFrame;
const REDUCED = reduced as UiFrame;
const NO_PAWNIO = noPawnio as UiFrame;

describe("cards render (UT-24)", () => {
  it("a locked field never renders a digit, and shows its lock text", () => {
    const { container } = renderCard(REDUCED, liveReduced(), "cpu:/amdcpu/0");
    const locked = container.querySelectorAll(".locked");
    expect(locked.length).toBe(4); // Package temperature, Effective clock, Package power, Hottest core
    for (const element of locked) {
      expect(element.textContent).toBe("Needs full sensors");
      expect(element.textContent).not.toMatch(/\d/);
      expect(element.querySelector("svg")).not.toBeNull();
    }
    // The hero is the total load.
    expect(container.querySelector(".hero__value")?.textContent).toBe("15");
  });

  it("'Needs PawnIO' replaces the lock text when elevated without PawnIO", () => {
    const status = liveElevated({ installed: false, version: null, loaded: false });
    const { container } = renderCard(NO_PAWNIO, status, "cpu:/amdcpu/0");
    const texts = [...container.querySelectorAll(".locked")].map((e) => e.textContent);
    expect(texts).toEqual(["Needs PawnIO", "Needs PawnIO", "Needs PawnIO", "Needs PawnIO"]);
  });

  it("placeholder cards show the lock and the reason, and aren't clickable", () => {
    const { container, onOpen } = renderCard(REDUCED, liveReduced(), "disk-placeholder");
    expect(screen.getByText("Disks")).toBeTruthy();
    expect(screen.getByText("Needs full sensors")).toBeTruthy();
    expect(screen.getByText("Drives, throughput, temperature and SMART health are read by the elevated helper.")).toBeTruthy();
    const article = container.querySelector("article")!;
    expect(article.className).toContain("card--placeholder");
    expect(article.className).not.toContain("card--clickable");
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(article);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("empty cards are not clickable either", () => {
    const frame = structuredClone(NO_PAWNIO);
    frame.hardware = frame.hardware.filter((h) => h.type !== "Storage");
    frame.sensors = frame.sensors.filter((s) => !s.hw.startsWith("/nvme"));
    const { container, onOpen } = renderCard(frame, liveElevated({ installed: false, version: null, loaded: false }), "disk-empty");
    expect(screen.getByText("No drives detected")).toBeTruthy();
    fireEvent.click(container.querySelector("article")!);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("a normal card opens on a click anywhere, and 'All sensors' opens it once", () => {
    const { container, onOpen } = renderCard(FULL, liveElevated(), "gpu:/gpu-nvidia/0");
    fireEvent.click(container.querySelector(".hero")!);
    expect(onOpen).toHaveBeenCalledWith("gpu:/gpu-nvidia/0");
    onOpen.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "All sensors" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("the CPU card shows the hero, the sparkline and four fields", () => {
    const { container } = renderCard(FULL, liveElevated(), "cpu:/amdcpu/0");
    expect(container.querySelector(".card__kind")?.textContent).toBe("CPU");
    expect(container.querySelector(".card__title")?.textContent).toBe("AMD Ryzen 9 9900X");
    expect(container.querySelector(".hero__value")?.textContent).toBe("65.6");
    expect(container.querySelector(".hero__label")?.textContent).toBe("Package temperature");
    expect(container.querySelector("svg.spark")).not.toBeNull();
    expect(container.querySelectorAll(".field")).toHaveLength(4);
    expect(container.textContent).toContain("0.66 GHz avg");
    expect(container.textContent).toContain("62.5 °C · CCD1");
  });

  it("the Memory card shows one field and the inferred OC chip with its caption", () => {
    const { container } = renderCard(FULL, liveElevated(), "memory");
    expect(screen.getByText("Likely on · inferred")).toBeTruthy();
    expect(screen.getByText("Inferred: configured 6000 MT/s is above the SPD JEDEC speed of 4800 MT/s.")).toBeTruthy();
    expect(container.textContent).toContain("6000 MT/s");
  });

  it("the Memory card in reduced mode has no chip and no caption", () => {
    renderCard(REDUCED, liveReduced(), "memory");
    expect(screen.queryByText(/inferred/i)).toBeNull();
  });

  it("the GPU card draws the VRAM bar", () => {
    const { container } = renderCard(FULL, liveElevated(), "gpu:/gpu-nvidia/0");
    expect(container.querySelector(".bar__fill--muted")).not.toBeNull();
    expect(container.textContent).toContain("2.4 / 15.9 GB");
  });

  it("the Disk card has two heroes and the two-line sparkline", () => {
    const { container } = renderCard(FULL, liveElevated(), "disk:/nvme/0");
    expect(container.querySelectorAll(".heroes__item")).toHaveLength(2);
    const spark = container.querySelector("svg.spark")!;
    expect(spark.getAttribute("role")).toBe("img");
    expect(spark.getAttribute("aria-label")).toBe("Read (solid) and write (dashed) throughput, last 10 minutes");
    expect(container.textContent).toContain("MB/s read");
    expect(container.textContent).toContain("MB/s write");
    expect(container.textContent).toContain("97 % life left");
  });

  it("the Motherboard card lists spinning fans with bars, a footer, and no sparkline", () => {
    const { container } = renderCard(FULL, liveElevated(), "motherboard");
    expect(container.querySelectorAll(".fan")).toHaveLength(2);
    expect(container.querySelector("svg.spark")).toBeNull();
    expect(container.textContent).toContain("1,744 RPM");
    expect(container.textContent).toContain("4 more fan headers read 0 RPM.");
    expect(container.querySelector(".card__title")?.textContent).toBe("Gigabyte B850 EAGLE WIFI6E · ITE IT8696E");
  });

  it("a missing value is a dash with no digits, not a 0", () => {
    const frame = structuredClone(FULL);
    for (const s of frame.sensors) if (s.hw === "/nvme/0") s.value = null;
    const { container } = renderCard(frame, liveElevated(), "disk:/nvme/0");
    expect(container.querySelectorAll(".not-reported").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".heroes")?.textContent).not.toMatch(/\d/);
  });
});
