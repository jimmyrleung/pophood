import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import reduced from "./test/fixtures/frame-reduced.json";
import { liveReduced } from "./test/builders";
import type { UiFrame } from "./sensors/protocol";
import { SensorStoreContext, createSensorStore } from "./sensors/store";
import { Shell } from "./App";

vi.mock("./sensors/commands", () => ({
  enableFullSensors: vi.fn().mockResolvedValue(undefined),
  retrySensors: vi.fn().mockResolvedValue(undefined),
  openPawnIoSite: vi.fn().mockResolvedValue(undefined),
}));

function renderShell() {
  const store = createSensorStore();
  store.applyEvent({ kind: "status", status: liveReduced() });
  store.applyEvent({ kind: "frame", frame: reduced as UiFrame });
  return render(
    <SensorStoreContext.Provider value={store}>
      <Shell />
    </SensorStoreContext.Provider>,
  );
}

describe("Shell navigation (T13 BUG-01)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens every page at the top, not at the previous page's scroll offset", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    renderShell();
    scrollTo.mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "All sensors" })[0]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("sensors");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "About and licenses" }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    scrollTo.mockClear();
    fireEvent.click(screen.getAllByRole("button", { name: "Dashboard" })[0]);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
