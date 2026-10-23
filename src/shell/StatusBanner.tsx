import { useState } from "react";
import { LockIcon, ShieldIcon } from "../icons/Icons";
import { enableFullSensors, openPawnIoSite } from "../sensors/commands";
import type { SensorStatus } from "../sensors/protocol";
import { useSensorStatus } from "../sensors/store";

export type BannerAction = "enable" | "pawnio";

export interface BannerModel {
  /** `reduced` keeps the mockup's "Reduced sensors" banner; `info` is the plain info banner. */
  variant: "reduced" | "info";
  /** The accessible name of the section. */
  label: string;
  title: string | null;
  body: string;
  /** One extra line under the body (a notice, or the PawnIO explanation). */
  note: string | null;
  actions: BannerAction[];
  /** Announced to screen readers when it appears or changes. */
  live: boolean;
}

export const REDUCED_TITLE = "Reduced sensors";
export const REDUCED_BODY =
  "CPU temperature, power and clocks, drives, fans and DIMMs need the sensor helper elevated. Pophood itself never runs as admin.";
export const UAC_HINT = "One UAC prompt · exits when Pophood closes";
export const PAWNIO_MISSING_NOTE =
  "PawnIO isn't installed. Without it, elevation adds only drives; CPU temperature, power and clocks, fans and DIMMs also need PawnIO. Pophood never installs drivers.";
export const PAWNIO_URL = "https://pawnio.eu";

function noticeLine(status: SensorStatus): string | null {
  const notice = status.notice;
  if (notice === null) return null;
  const detail = notice.detail ? ` (${notice.detail})` : "";
  switch (notice.code) {
    case "uac_cancelled":
      return "The UAC prompt was cancelled. Pophood is still in reduced mode.";
    case "elevation_failed":
      return `Full sensors didn't start${detail}. Pophood is still in reduced mode.`;
    case "elevation_timeout":
      return "Full sensors didn't start within 20 seconds. Pophood is still in reduced mode.";
    case "full_sensors_lost":
      return "Full sensors stopped: the elevated helper exited, so Pophood is back in reduced mode.";
    default:
      return null;
  }
}

function info(body: string, note: string | null = null): BannerModel {
  return { variant: "info", label: "Sensor status", title: null, body, note, actions: [], live: true };
}

function reduced(note: string | null, actions: BannerAction[]): BannerModel {
  return { variant: "reduced", label: REDUCED_TITLE, title: REDUCED_TITLE, body: REDUCED_BODY, note, actions, live: false };
}

/**
 * Picks the one banner to show. Rows of the techspec's "UI states not mocked" table are checked top to bottom and the
 * first match wins, so combined states (for example reconnecting with PawnIO missing) show only the highest-priority row.
 * Blocking panels (`stopped`) and the `starting` panel are not banners.
 */
export function bannerFor(status: SensorStatus): BannerModel | null {
  const elevationInFlight = status.elevation !== "idle";

  if (status.phase === "reconnecting") {
    const body = elevationInFlight
      ? "Sensors disconnected · waiting for full sensors…"
      : `Sensors disconnected · restarting the sensor helper (attempt ${status.restartAttempt ?? 1} of 3)…`;
    const note =
      status.elevation === "prompting"
        ? "Waiting for the UAC prompt…"
        : status.elevation === "connecting"
          ? "Connecting to sensors…"
          : null;
    return info(body, note);
  }
  if (status.phase !== "live") return null;

  if (status.elevation === "prompting") return info("Waiting for the UAC prompt…");
  if (status.elevation === "connecting") return info("Connecting to sensors…");

  const pawn = status.pawnIo;
  if (status.elevated === false) {
    const note = noticeLine(status);
    if (note !== null) return reduced(note, ["enable"]);
    if (pawn !== null && !pawn.installed) return reduced(PAWNIO_MISSING_NOTE, ["enable", "pawnio"]);
    return reduced(null, ["enable"]);
  }

  if (status.elevated === true && pawn !== null) {
    if (!pawn.installed) {
      return {
        variant: "info",
        label: "Full sensors",
        title: "Full sensors are on, but PawnIO isn't installed",
        body: "Drives and SMART are live. CPU temperature, power and clocks, fans and DIMMs need PawnIO. Pophood never installs drivers.",
        note: null,
        actions: ["pawnio"],
        live: false,
      };
    }
    if (pawn.loaded === false) {
      return {
        variant: "info",
        label: "Full sensors",
        title: "Full sensors are on, but PawnIO's driver isn't running",
        body: "Drives and SMART are live. CPU temperature, power and clocks, fans and DIMMs need the PawnIO driver; restarting Windows or reinstalling PawnIO usually starts it.",
        note: null,
        actions: [],
        live: false,
      };
    }
  }
  return null;
}

export function StatusBanner() {
  const model = bannerFor(useSensorStatus());
  const [pawnIoFailed, setPawnIoFailed] = useState(false);
  if (model === null) return null;

  const openSite = () => {
    openPawnIoSite().then(
      () => setPawnIoFailed(false),
      () => setPawnIoFailed(true),
    );
  };

  return (
    <section className={`banner banner--${model.variant}`} aria-label={model.label} role={model.live ? "status" : undefined}>
      <div className="banner__main">
        {model.variant === "reduced" ? (
          <LockIcon size={22} className="banner__icon" />
        ) : (
          <ShieldIcon size={22} className="banner__icon" />
        )}
        <div>
          {model.title !== null && <div className="banner__title">{model.title}</div>}
          <div className="banner__body">{model.body}</div>
          {model.note !== null && <div className="banner__note">{model.note}</div>}
          {pawnIoFailed && model.actions.includes("pawnio") && (
            <div className="banner__note">
              Could not open the browser. Copy this address: <code>{PAWNIO_URL}</code>
            </div>
          )}
        </div>
      </div>
      {model.actions.length > 0 && (
        <div className="banner__actions">
          {model.actions.includes("enable") && (
            <>
              <button type="button" className="btn btn--info" onClick={() => void enableFullSensors().catch(() => undefined)}>
                <ShieldIcon />
                Enable full sensors
              </button>
              <span className="banner__hint">{UAC_HINT}</span>
            </>
          )}
          {model.actions.includes("pawnio") && (
            <button type="button" className="btn btn--secondary" onClick={openSite}>
              Get PawnIO (pawnio.eu)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
