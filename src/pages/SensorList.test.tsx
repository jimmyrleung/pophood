import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import full from "../test/fixtures/frame-full.json";
import reduced from "../test/fixtures/frame-reduced.json";
import { liveElevated, liveReduced, sensor, stopped } from "../test/builders";
import type { SensorStatus, UiFrame } from "../sensors/protocol";
import { SensorStoreContext, createSensorStore } from "../sensors/store";
import { About } from "./About";
import { SensorList } from "./SensorList";

const FULL = full as UiFrame;
const REDUCED = reduced as UiFrame;

function setup(
  cardId: string,
  frame: UiFrame | null = FULL,
  onBack = vi.fn(),
  status: SensorStatus = { ...liveElevated(), helperSha256: "ad65be57" },
) {
  const store = createSensorStore();
  store.applyEvent({ kind: "status", status });
  if (frame) store.applyEvent({ kind: "frame", frame });
  const view = render(
    <SensorStoreContext.Provider value={store}>
      <SensorList cardId={cardId} onBack={onBack} />
    </SensorStoreContext.Provider>,
  );
  return { ...view, store, onBack };
}

const list = () => screen.getByRole("region", { name: "Sensor list" });
const detail = () => screen.getByRole("region", { name: "Sensor detail" });
/** The card whose title heading is `title`. */
const card = (title: string) => within(list()).getByRole("heading", { name: title }).closest(".group") as HTMLElement;
const pressedRow = () => within(list()).getByRole("button", { pressed: true });
/** The full frame as it would arrive after the reduced one (the reduced fixture is 100 s after the full one). */
const fullAfterReduced = (): UiFrame => ({ ...structuredClone(FULL), t: REDUCED.t + 1000 });
const send = (store: ReturnType<typeof createSensorStore>, status: SensorStatus, frame: UiFrame) =>
  act(() => {
    store.applyEvent({ kind: "status", status });
    store.applyEvent({ kind: "frame", frame });
  });

describe("SensorList", () => {
  it("titles the page with the component and counts its sensors", () => {
    const { container } = setup("cpu:/amdcpu/0");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AMD Ryzen 9 9900X sensors");
    const count = FULL.sensors.filter((s) => s.hw === "/amdcpu/0").length;
    expect(container.querySelector(".page-sub")?.textContent).toBe(`AMD Ryzen 9 9900X · ${count} sensors`);
  });

  it("shows the Motherboard hardware names and its Controls group", () => {
    const { container } = setup("motherboard");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Motherboard sensors");
    expect(container.querySelector(".page-sub")?.textContent).toMatch(/^Gigabyte B850 EAGLE WIFI6E · ITE IT8696E · \d+ sensors$/);
    expect(card("Controls · 6")).toBeTruthy();
    expect(card("Fans · 6")).toBeTruthy();
  });

  it("selects the first row on open and shows its detail", () => {
    setup("motherboard");
    const pressed = within(list()).getAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(1);
    // Fans come first, so the first row is Fan #1 (1,744 RPM).
    expect(pressed[0].textContent).toContain("Fan #1");
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Fan #1");
    expect(detail().textContent).toContain("/lpc/it8696e/0/fan/0");
    expect(detail().textContent).toContain("1,744 RPM");
    expect(detail().textContent).toContain("now · refreshes every second");
    expect(within(detail()).getByRole("img", { name: "Fan #1 over the last 10 minutes" })).toBeTruthy();
  });

  it("selecting another row changes the detail, and aria-pressed follows", () => {
    setup("motherboard");
    fireEvent.click(within(list()).getByRole("button", { name: /Fan #5.*RPM/ }));
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Fan #5");
    expect(within(list()).getByRole("button", { name: /Fan #5.*RPM/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(list()).getByRole("button", { name: /Fan #1.*RPM/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("mutes rows that read 0 RPM", () => {
    setup("motherboard");
    const idle = within(list()).getByRole("button", { name: /Fan #2.*RPM/ });
    expect(idle.querySelector(".row__value--muted")).not.toBeNull();
    const spinning = within(list()).getByRole("button", { name: /Fan #1.*RPM/ });
    expect(spinning.querySelector(".row__value--muted")).toBeNull();
  });

  it("shows Min and Max over the last 10 minutes, and they change as frames arrive", () => {
    const { store } = setup("motherboard");
    const stat = (label: string) => within(detail()).getByText(label).parentElement!.querySelector("dd")!.textContent;
    expect(stat("Min (10 min)")).toBe("1,744 RPM");
    expect(stat("Max (10 min)")).toBe("1,744 RPM");
    expect(stat("Unit")).toBe("RPM");

    const next = structuredClone(FULL);
    next.t += 1000;
    next.sensors.find((s) => s.id === "/lpc/it8696e/0/fan/0")!.value = 2100;
    act(() => store.applyEvent({ kind: "frame", frame: next }));
    expect(stat("Min (10 min)")).toBe("1,744 RPM");
    expect(stat("Max (10 min)")).toBe("2,100 RPM");
    expect(detail().textContent).toContain("2,100 RPM");
  });

  it("groups the Memory page by hardware, so the two 'Memory Used' rows are told apart", () => {
    setup("memory");
    expect(within(list()).getByText("Virtual Memory")).toBeTruthy();
    expect(within(list()).getByText("Total Memory")).toBeTruthy();
    expect(within(list()).getAllByText("Memory Used")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Memory sensors");
  });

  it("the breadcrumb goes back to the Dashboard", () => {
    const { onBack } = setup("memory");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.textContent).toContain("Dashboard / Memory");
    fireEvent.click(within(nav).getByRole("button", { name: "Dashboard" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows dashes instead of values when the data is stale", () => {
    const { store } = setup("disk:/nvme/0");
    act(() => store.applyEvent({ kind: "status", status: { ...liveElevated(), phase: "reconnecting", restartAttempt: 1 } }));
    expect(detail().textContent).toContain("—");
    expect(within(list()).getAllByRole("button").every((b) => b.textContent?.endsWith("—"))).toBe(true);
  });

  it("says so when there is no data yet", () => {
    setup("cpu:/amdcpu/0", null);
    expect(screen.getByText("No sensor data yet.")).toBeTruthy();
  });

  it("falls back to the first row if the selected sensor leaves the frame", () => {
    const { store } = setup("motherboard");
    fireEvent.click(within(list()).getByRole("button", { name: /Fan #5.*RPM/ }));
    const next = structuredClone(FULL);
    next.t += 1000;
    next.sensors = next.sensors.filter((s) => s.id !== "/lpc/it8696e/0/fan/4");
    act(() => store.applyEvent({ kind: "frame", frame: next }));
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Fan #1");
  });
});

describe("drill-down page (UT-39)", () => {
  const custom = (sensors: UiFrame["sensors"], elevated: boolean): UiFrame => ({
    ...FULL,
    elevated,
    hardware: [{ id: "/x", type: "Cpu", name: "X", parent: null }],
    memory: [],
    sensors,
  });
  const many = (type: string, n: number, value: number | null) =>
    Array.from({ length: n }, (_, i) => sensor(`/x/${type}/${i}`, `${type} #${i}`, value, type, "/x", i));

  it("(a) shows one card per group, with level-2 titles; a Controls row selects as dashes", () => {
    setup("motherboard");
    for (const title of ["Fans · 6", "Temperatures · 3", "Voltages · 2", "Controls · 6"]) {
      expect(card(title).querySelector("h2")?.textContent).toBe(title);
    }
    fireEvent.click(within(card("Controls · 6")).getAllByRole("button")[0]);
    expect(detail().querySelector(".detail__value")?.textContent).toBe("—");
  });

  it("(a) puts the Memory card titles at level 3 under each hardware heading", () => {
    setup("memory");
    const titles = within(list()).getAllByRole("heading", { level: 3 });
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every((h) => h.classList.contains("group__title"))).toBe(true);
    expect(within(list()).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toContain("Total Memory");
  });

  it("(b) locks the reduced CPU's groups, selects CPU Total, and moves to the package temperature after elevation", () => {
    const { store, container } = setup("cpu:/amdcpu/0", REDUCED, vi.fn(), liveReduced());
    // The header counts the locked sensors too.
    const count = REDUCED.sensors.filter((s) => s.hw === "/amdcpu/0").length;
    expect(container.querySelector(".page-sub")?.textContent).toMatch(new RegExp(`· ${count} sensors$`));
    const banner = screen.getByRole("region", { name: "Reduced sensors" });
    expect(within(banner).getByRole("button", { name: /Enable full sensors/ })).toBeTruthy();
    expect(card("Clocks · 3").textContent).toContain("Needs full sensors");
    expect(within(card("Clocks · 3")).queryAllByRole("button")).toHaveLength(0);
    expect(pressedRow().textContent).toContain("CPU Total");
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("CPU Total");

    send(store, liveElevated(), fullAfterReduced());
    expect(screen.queryByRole("region", { name: "Reduced sensors" })).toBeNull();
    expect(within(card("Clocks · 3")).getAllByRole("button")).toHaveLength(3);
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Core (Tctl/Tdie)");
  });

  it("(c) falls back when the clicked clock locks, and comes back when it unlocks", () => {
    const { store } = setup("cpu:/amdcpu/0");
    fireEvent.click(within(list()).getByRole("button", { name: /^Cores \(Average\)\d/ }));
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Cores (Average)");

    const reducedLater: UiFrame = { ...structuredClone(REDUCED), t: FULL.t + 100_000 };
    send(store, liveReduced(), reducedLater);
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("CPU Total");
    expect(within(list()).queryByRole("button", { name: /^Cores \(Average\)\d/ })).toBeNull();

    send(store, liveElevated(), fullAfterReduced());
    expect(within(detail()).getByRole("heading", { level: 2 }).textContent).toBe("Cores (Average)");
  });

  it("(d) splits only an unlocked group of more than 8 rows", () => {
    const elevated = custom([...many("Load", 9, 10), ...many("Clock", 8, 4000)], true);
    const { unmount } = setup("cpu:/x", elevated);
    expect(card("Loads · 9").classList.contains("group--split")).toBe(true);
    expect(card("Clocks · 8").classList.contains("group--split")).toBe(false);
    unmount();

    setup("cpu:/x", custom(many("Clock", 9, null), false), vi.fn(), liveReduced());
    expect(card("Clocks · 9").textContent).toContain("Needs full sensors");
    expect(card("Clocks · 9").classList.contains("group--split")).toBe(false);
  });

  it("(e) shows the caption in the panel's place when the scope has no sensors", () => {
    const { store } = setup("motherboard");
    send(store, liveReduced(), { ...structuredClone(REDUCED), t: FULL.t + 100_000 });
    expect(detail().textContent).toContain("This component has no sensors in the current frame.");
  });

  it("(f) keeps a locked card locked and shows dashes when stale, under the reconnecting banner", () => {
    const { store } = setup("cpu:/amdcpu/0", REDUCED, vi.fn(), liveReduced());
    act(() => store.applyEvent({ kind: "status", status: liveReduced({ phase: "reconnecting", restartAttempt: 1 }) }));
    expect(screen.getByRole("status", { name: "Sensor status" }).textContent).toContain("Sensors disconnected");
    expect(card("Clocks · 3").textContent).toContain("Needs full sensors");
    expect(within(card("Loads · 4")).getAllByRole("button").every((b) => b.textContent?.endsWith("—"))).toBe(true);
  });

  it("(g) renders when the first frame arrives and when a blocking stop clears it, with no hook-order error", () => {
    const { store } = setup("cpu:/amdcpu/0", null);
    expect(screen.getByText("No sensor data yet.")).toBeTruthy();
    act(() => store.applyEvent({ kind: "frame", frame: FULL }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("AMD Ryzen 9 9900X sensors");
    act(() => store.applyEvent({ kind: "status", status: stopped({ code: "helper_missing", detail: null }) }));
    expect(screen.getByText("No sensor data yet.")).toBeTruthy();
  });
});

describe("About", () => {
  it("shows the versions, the expected helper hash and the notices, with no links", () => {
    const store = createSensorStore();
    store.applyEvent({ kind: "status", status: { ...liveElevated(), helperSha256: "ad65be571a30" } });
    const { container } = render(
      <SensorStoreContext.Provider value={store}>
        <About onBack={() => {}} />
      </SensorStoreContext.Provider>,
    );
    expect(screen.getByRole("region", { name: "Versions" }).textContent).toContain("0.1.1");
    expect(screen.getByText("LHM 0.9.6 @ 3d331e3")).toBeTruthy();
    expect(screen.getByText("ad65be571a30")).toBeTruthy();
    expect(container.querySelector("pre")?.textContent).toContain("LibreHardwareMonitor 0.9.6");
    expect(container.querySelector("pre")?.textContent).toContain("https://github.com/LibreHardwareMonitor/LibreHardwareMonitor");
    expect(container.querySelector("a[href]")).toBeNull();
  });
});
