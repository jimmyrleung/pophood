import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import full from "../test/fixtures/frame-full.json";
import reduced from "../test/fixtures/frame-reduced.json";
import { liveElevated, liveReduced, status, stopped } from "../test/builders";
import type { NoticeCode, SensorStatus, UiFrame } from "../sensors/protocol";
import { SensorStoreContext, createSensorStore } from "../sensors/store";
import { Dashboard } from "./Dashboard";

vi.mock("../sensors/commands", () => ({
  enableFullSensors: vi.fn().mockResolvedValue(undefined),
  retrySensors: vi.fn().mockResolvedValue(undefined),
  openPawnIoSite: vi.fn().mockResolvedValue(undefined),
}));

const FULL = full as UiFrame;
const REDUCED = reduced as UiFrame;

function renderDashboard(current: SensorStatus, frame: UiFrame | null, onOpenCard = vi.fn()) {
  const store = createSensorStore();
  store.applyEvent({ kind: "status", status: current });
  if (frame) store.applyEvent({ kind: "frame", frame });
  const view = render(
    <SensorStoreContext.Provider value={store}>
      <Dashboard onOpenCard={onOpenCard} />
    </SensorStoreContext.Provider>,
  );
  return { ...view, store, onOpenCard };
}

describe("Dashboard (UT-25, dashboard parts)", () => {
  it("shows 'Starting the sensor helper…' in place of the cards, with no history panel", () => {
    const { container } = renderDashboard(status(), null);
    expect(screen.getByRole("status").textContent).toContain("Starting the sensor helper…");
    expect(container.querySelector(".grid")).toBeNull();
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
  });

  it.each([
    ["helper_missing"],
    ["helper_hash_mismatch"],
    ["pipe_squatter"],
    ["schema_mismatch"],
    ["helper_exited"],
    ["helper_error"],
  ] as [NoticeCode][])("under the %s blocking panel there is no history and no cards", (code) => {
    const { container, store } = renderDashboard(liveReduced(), FULL);
    act(() => store.applyEvent({ kind: "status", status: stopped({ code, detail: "x" }) }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
    expect(container.querySelector(".grid")).toBeNull();
    expect(screen.queryByText(/Readings refresh every second/)).toBeNull();
  });

  it("renders the full frame's cards in order, the history panel and the footnote, with no Run buttons", () => {
    const { container } = renderDashboard(liveElevated(), FULL);
    const titles = [...container.querySelectorAll(".card__title")].map((e) => e.textContent);
    expect(titles).toEqual([
      "AMD Ryzen 9 9900X",
      "2 × 16 GB DDR5",
      "NVIDIA GeForce RTX 5060 Ti",
      "AMD Radeon Graphics",
      "KINGSTON SNV3S1000G",
      "Gigabyte B850 EAGLE WIFI6E · ITE IT8696E",
    ]);
    expect(screen.getByRole("region", { name: "History" })).toBeTruthy();
    expect(screen.getByText("Readings refresh every second. The last 10 minutes are kept in memory only.")).toBeTruthy();
    expect(screen.queryByText(/Run all|Run one test/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Run/ })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dashboard");
    expect(container.querySelector(".page-sub")?.textContent).toContain("AMD Ryzen 9 9900X · Gigabyte B850 EAGLE WIFI6E");
  });

  it("renders the reduced frame with the placeholders and the banner, and no CPU number except the load", () => {
    const { container } = renderDashboard(liveReduced(), REDUCED);
    expect(screen.getByRole("region", { name: "Reduced sensors" })).toBeTruthy();
    expect(container.querySelectorAll(".card--placeholder")).toHaveLength(2);
    const cpu = container.querySelector("article")!;
    const fieldTexts = [...cpu.querySelectorAll(".field")].map((f) => f.textContent);
    expect(fieldTexts[0]).toBe("Package temperatureNeeds full sensors");
    expect(fieldTexts.slice(1).every((t) => t?.includes("Needs full sensors"))).toBe(true);
  });

  it("opens a card's drill-down from 'All sensors'", () => {
    const { onOpenCard } = renderDashboard(liveElevated(), FULL);
    fireEvent.click(screen.getAllByRole("button", { name: "All sensors" })[0]);
    expect(onOpenCard).toHaveBeenCalledWith("cpu:/amdcpu/0");
  });

  it("switches the history chart with the segmented control, Temperatures first", () => {
    renderDashboard(liveElevated(), FULL);
    const group = screen.getByRole("group", { name: "Chart metric" });
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual(["Temperatures", "Load", "Power"]);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(screen.getByRole("img", { name: "Temperatures over the last 10 minutes" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByRole("button", { name: "Load" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Load over the last 10 minutes" })).toBeTruthy();
  });

  it("the legend shows the current values", () => {
    renderDashboard(liveElevated(), FULL);
    const legend = screen.getByRole("region", { name: "History" }).querySelector(".legend")!;
    expect(legend.textContent).toContain("CPU package65.6 °C");
    expect(legend.textContent).toContain("NVIDIA GeForce RTX 5060 Ti30.4 °C");
  });

  it("the reduced legend shows the lock label for a series that needs full sensors", () => {
    renderDashboard(liveReduced(), REDUCED);
    const legend = screen.getByRole("region", { name: "History" }).querySelector(".legend")!;
    expect(legend.textContent).toContain("CPU packageNeeds full sensors");
    expect(legend.textContent).toContain("DriveNeeds full sensors");
  });

  it("while reconnecting the cards stay, but every live value is a dash", () => {
    const { container, store } = renderDashboard(liveElevated(), FULL);
    act(() => store.applyEvent({ kind: "status", status: liveReduced({ phase: "reconnecting", restartAttempt: 1 }) }));
    expect(screen.getByRole("status").textContent).toContain("restarting the sensor helper (attempt 1 of 3)");
    const cpu = container.querySelector("article")!;
    expect(cpu.querySelector(".hero .not-reported")?.textContent).toBe("—");
    expect(container.querySelector(".grid")).not.toBeNull();
  });
});
