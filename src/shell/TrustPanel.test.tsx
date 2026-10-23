import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAWNIO_INSTALLED, PAWNIO_MISSING, liveElevated, liveReduced, status, stopped } from "../test/builders";
import type { SensorStatus } from "../sensors/protocol";
import { TrustPanel, displayPawnIoVersion } from "./TrustPanel";

function row(current: SensorStatus, id: "helper" | "pawnio" | "network") {
  const { container } = render(<TrustPanel status={current} />);
  const element = container.querySelector(`[data-row="${id}"]`) as HTMLElement;
  return { element, text: element.textContent ?? "" };
}

describe("trust panel (UT-27)", () => {
  it("helper live and elevated", () => {
    const { text } = row(liveElevated(), "helper");
    expect(text).toBe("Sensor helper verifiedElevated · read-only");
  });

  it("helper live and unprivileged", () => {
    expect(row(liveReduced(), "helper").text).toBe("Sensor helper verifiedUnprivileged");
  });

  it.each([["starting", status()], ["reconnecting", liveReduced({ phase: "reconnecting", restartAttempt: 1 })]])(
    "helper %s",
    (_, current) => {
      expect(row(current, "helper").text).toBe("Starting sensor helper…");
    },
  );

  it.each([
    ["helper_missing", "Not found next to Pophood"],
    ["helper_hash_mismatch", "Failed verification"],
    ["pipe_squatter", "Connection refused"],
    ["schema_mismatch", "Incompatible"],
    ["helper_error", "Kept stopping"],
    ["helper_exited", "Kept stopping"],
  ] as const)("helper stopped (%s) shows the warning row with a short reason", (code, reason) => {
    const { element, text } = row(stopped({ code, detail: null }), "helper");
    expect(text).toBe(`Sensor helper not running${reason}`);
    expect(element.querySelector("svg")).not.toBeNull();
    expect(element.querySelector(".trust__title--danger")).not.toBeNull();
  });

  it("PawnIO installed shows the version without one trailing .0", () => {
    expect(row(liveReduced({ pawnIo: PAWNIO_INSTALLED }), "pawnio").text).toBe("PawnIO 2.2.0Detected, not managed by Pophood");
  });

  it("PawnIO not installed", () => {
    expect(row(liveReduced({ pawnIo: PAWNIO_MISSING }), "pawnio").text).toBe("PawnIO not installedNeeded for CPU, fans and DIMMs");
  });

  it("PawnIO unknown before the first hello", () => {
    expect(row(status(), "pawnio").text).toBe("PawnIONot checked yet");
  });

  it("network row is always the same", () => {
    for (const current of [status(), liveReduced(), liveElevated(), stopped({ code: "helper_missing", detail: null })]) {
      expect(row(current, "network").text).toBe(
        "No networkPophood makes no connections. Its web view asks Windows about your Microsoft account; Windows may then contact login.live.com.",
      );
    }
  });

  it("shows all three rows", () => {
    render(<TrustPanel status={liveReduced()} />);
    const panel = screen.getByTestId("trust-panel");
    expect(within(panel).getAllByText(/./, { selector: ".trust__title" })).toHaveLength(3);
  });

  it("trims only a trailing .0 of a four-part version", () => {
    expect(displayPawnIoVersion("2.2.0.0")).toBe("2.2.0");
    expect(displayPawnIoVersion("2.2.1.0")).toBe("2.2.1");
    expect(displayPawnIoVersion("2.2.0.3")).toBe("2.2.0.3");
    expect(displayPawnIoVersion("2.2")).toBe("2.2");
    expect(displayPawnIoVersion(null)).toBeNull();
  });
});
