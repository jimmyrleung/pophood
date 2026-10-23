import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAWNIO_INSTALLED, PAWNIO_MISSING, liveElevated, liveReduced, status, stopped } from "../test/builders";
import type { SensorStatus } from "../sensors/protocol";
import { SensorStoreContext, createSensorStore } from "../sensors/store";
import { BlockingPanel, panelFor } from "./BlockingPanel";
import { PAWNIO_MISSING_NOTE, REDUCED_BODY, StatusBanner, UAC_HINT, bannerFor } from "./StatusBanner";

const commands = vi.hoisted(() => ({
  enableFullSensors: vi.fn(),
  retrySensors: vi.fn(),
  openPawnIoSite: vi.fn(),
}));
vi.mock("../sensors/commands", () => commands);

beforeEach(() => {
  commands.enableFullSensors.mockReset().mockResolvedValue(undefined);
  commands.retrySensors.mockReset().mockResolvedValue(undefined);
  commands.openPawnIoSite.mockReset().mockResolvedValue(undefined);
});

function renderWith(current: SensorStatus, ui = <StatusBanner />) {
  const store = createSensorStore();
  store.applyEvent({ kind: "status", status: current });
  return render(<SensorStoreContext.Provider value={store}>{ui}</SensorStoreContext.Provider>);
}

describe("banner selection (UT-25)", () => {
  it("shows no banner for starting, stopped, or a fully working elevated helper", () => {
    expect(bannerFor(status())).toBeNull();
    expect(bannerFor(stopped({ code: "helper_missing", detail: null }))).toBeNull();
    expect(bannerFor(liveElevated())).toBeNull();
  });

  it("shows the reduced banner for an unprivileged helper, with the Enable action and the UAC hint", () => {
    renderWith(liveReduced());
    const section = screen.getByRole("region", { name: "Reduced sensors" });
    expect(section.textContent).toContain("Reduced sensors");
    expect(section.textContent).toContain(REDUCED_BODY);
    expect(section.textContent).toContain(UAC_HINT);
    expect(screen.queryByText("Get PawnIO (pawnio.eu)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Enable full sensors" }));
    expect(commands.enableFullSensors).toHaveBeenCalledOnce();
  });

  it("adds the PawnIO line and link when PawnIO is missing", () => {
    renderWith(liveReduced({ pawnIo: PAWNIO_MISSING }));
    expect(screen.getByText(PAWNIO_MISSING_NOTE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable full sensors" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Get PawnIO (pawnio.eu)" }));
    expect(commands.openPawnIoSite).toHaveBeenCalledOnce();
  });

  it("shows the address as text when the browser can't be opened", async () => {
    commands.openPawnIoSite.mockRejectedValue("could not open the browser (code 2)");
    renderWith(liveReduced({ pawnIo: PAWNIO_MISSING }));
    fireEvent.click(screen.getByRole("button", { name: "Get PawnIO (pawnio.eu)" }));
    expect(await screen.findByText("https://pawnio.eu")).toBeTruthy();
    expect(document.querySelector("a[href]")).toBeNull();
  });

  it.each([
    [{ code: "uac_cancelled", detail: null }, "The UAC prompt was cancelled. Pophood is still in reduced mode."],
    [{ code: "elevation_failed", detail: "exit code 3" }, "Full sensors didn't start (exit code 3). Pophood is still in reduced mode."],
    [{ code: "elevation_failed", detail: null }, "Full sensors didn't start. Pophood is still in reduced mode."],
    [{ code: "elevation_timeout", detail: null }, "Full sensors didn't start within 20 seconds. Pophood is still in reduced mode."],
    [{ code: "full_sensors_lost", detail: null }, "Full sensors stopped: the elevated helper exited, so Pophood is back in reduced mode."],
  ] as const)("shows the %j line under the reduced banner", (notice, line) => {
    renderWith(liveReduced({ notice }));
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable full sensors" })).toBeTruthy();
    expect(screen.getByText("Reduced sensors")).toBeTruthy();
  });

  it("the notice row wins over the PawnIO-missing row", () => {
    const model = bannerFor(liveReduced({ pawnIo: PAWNIO_MISSING, notice: { code: "uac_cancelled", detail: null } }))!;
    expect(model.note).toBe("The UAC prompt was cancelled. Pophood is still in reduced mode.");
    expect(model.actions).toEqual(["enable"]);
  });

  it("shows the UAC wait and the connecting banner as status messages with no actions", () => {
    const prompting = bannerFor(liveReduced({ elevation: "prompting" }))!;
    expect(prompting).toMatchObject({ body: "Waiting for the UAC prompt…", actions: [], live: true });
    const connecting = bannerFor(liveReduced({ elevation: "connecting" }))!;
    expect(connecting).toMatchObject({ body: "Connecting to sensors…", actions: [], live: true });

    renderWith(liveReduced({ elevation: "connecting" }));
    expect(screen.getByRole("status").textContent).toContain("Connecting to sensors…");
  });

  it("an elevation in flight wins over a notice and over PawnIO missing", () => {
    const model = bannerFor(
      liveReduced({ elevation: "prompting", pawnIo: PAWNIO_MISSING, notice: { code: "uac_cancelled", detail: null } }),
    )!;
    expect(model.body).toBe("Waiting for the UAC prompt…");
    expect(model.note).toBeNull();
  });

  it("shows the restart attempt while reconnecting", () => {
    const model = bannerFor(liveReduced({ phase: "reconnecting", restartAttempt: 2 }))!;
    expect(model.body).toBe("Sensors disconnected · restarting the sensor helper (attempt 2 of 3)…");
    expect(model.live).toBe(true);
    expect(model.actions).toEqual([]);
  });

  it("reconnecting with PawnIO missing shows only the reconnecting row", () => {
    const model = bannerFor(liveReduced({ phase: "reconnecting", restartAttempt: 1, pawnIo: PAWNIO_MISSING }))!;
    expect(model.body).toContain("Sensors disconnected");
    expect(model.note).toBeNull();
    expect(model.actions).toEqual([]);
  });

  it("reconnecting while elevation is in flight says it is waiting for full sensors, plus the elevation line", () => {
    const connecting = bannerFor(liveReduced({ phase: "reconnecting", restartAttempt: 1, elevation: "connecting" }))!;
    expect(connecting.body).toBe("Sensors disconnected · waiting for full sensors…");
    expect(connecting.note).toBe("Connecting to sensors…");
    const prompting = bannerFor(liveReduced({ phase: "reconnecting", restartAttempt: 1, elevation: "prompting" }))!;
    expect(prompting.note).toBe("Waiting for the UAC prompt…");
  });

  it("elevated without PawnIO: an info banner with the PawnIO link", () => {
    renderWith(liveElevated(PAWNIO_MISSING));
    expect(screen.getByText("Full sensors are on, but PawnIO isn't installed")).toBeTruthy();
    expect(screen.getByText(/Drives and SMART are live\. CPU temperature, power and clocks, fans and DIMMs need PawnIO\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get PawnIO (pawnio.eu)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enable full sensors" })).toBeNull();
  });

  it("elevated with PawnIO installed but its driver not running: an info banner without actions", () => {
    renderWith(liveElevated({ installed: true, version: "2.2.0.0", loaded: false }));
    expect(screen.getByText("Full sensors are on, but PawnIO's driver isn't running")).toBeTruthy();
    expect(screen.getByText(/restarting Windows or reinstalling PawnIO usually starts it/)).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("an unprivileged helper with PawnIO installed gets no PawnIO line", () => {
    expect(bannerFor(liveReduced({ pawnIo: PAWNIO_INSTALLED }))!.note).toBeNull();
  });

  it("section names are the landmarks E2E-22 looks for", () => {
    renderWith(liveReduced());
    expect(screen.getByRole("region", { name: "Reduced sensors" })).toBeTruthy();
  });
});

describe("blocking panels (UT-25)", () => {
  it("has no panel unless the helper is stopped with a notice", () => {
    expect(panelFor(status())).toBeNull();
    expect(panelFor(liveReduced())).toBeNull();
    expect(panelFor(liveReduced({ phase: "reconnecting" }))).toBeNull();
    expect(panelFor(status({ phase: "stopped" }))).toBeNull();
  });

  it.each([
    [{ code: "helper_missing", detail: "C:\\app\\pophood-sensors.exe" }, "Sensor helper not found", "pophood-sensors.exe is missing next to Pophood. Rebuild with npm run build:helper. Pophood never offers to elevate a file it hasn't verified."],
    [{ code: "helper_hash_mismatch", detail: "expected 71c0, got 03ab" }, "Sensor helper failed verification", "Its SHA-256 doesn't match the one this build of Pophood expects, so it wasn't started. expected 71c0, got 03ab"],
    [{ code: "pipe_squatter", detail: null }, "Security warning: sensor connection refused", "Another program answered on the sensor pipe. Pophood disconnected without sending it anything."],
    [{ code: "schema_mismatch", detail: "v2" }, "Sensor helper is incompatible", "The helper speaks a different message format (v2). Rebuild the app and helper from the same checkout."],
    [{ code: "helper_exited", detail: "exit code 3" }, "Sensors stopped", "The sensor helper kept stopping, and 3 restarts didn't help. exit code 3"],
    [{ code: "helper_error", detail: "LhmFailed" }, "Sensors stopped", "The sensor helper kept stopping, and 3 restarts didn't help. LhmFailed"],
  ] as const)("shows the %j panel with Retry", (notice, title, body) => {
    renderWith(stopped(notice), <BlockingPanel />);
    const alert = screen.getByRole("alert");
    expect(alert.querySelector("h2")?.textContent).toBe(title);
    expect(alert.querySelector("p")?.textContent).toBe(body);
    expect(alert.querySelector("svg")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(commands.retrySensors).toHaveBeenCalledOnce();
  });

  it("renders the rebuild command as code", () => {
    renderWith(stopped({ code: "helper_missing", detail: null }), <BlockingPanel />);
    expect(screen.getByText("npm run build:helper").tagName).toBe("CODE");
  });

  it("renders nothing when the helper is fine", () => {
    const { container } = renderWith(liveReduced(), <BlockingPanel />);
    expect(container.textContent).toBe("");
  });
});
