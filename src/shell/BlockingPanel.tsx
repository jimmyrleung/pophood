import { WarningIcon } from "../icons/Icons";
import { retrySensors } from "../sensors/commands";
import type { SensorStatus } from "../sensors/protocol";
import { useSensorStatus } from "../sensors/store";

export interface PanelModel {
  title: string;
  /** Backticks mark inline code. */
  body: string;
}

/** The blocking panel for a `stopped` helper. Null in every other phase. */
export function panelFor(status: SensorStatus): PanelModel | null {
  if (status.phase !== "stopped" || status.notice === null) return null;
  const detail = status.notice.detail ?? "";
  switch (status.notice.code) {
    case "helper_missing":
      return {
        title: "Sensor helper not found",
        body: "pophood-sensors.exe is missing next to Pophood. Rebuild with `npm run build:helper`. Pophood never offers to elevate a file it hasn't verified.",
      };
    case "helper_hash_mismatch":
      return {
        title: "Sensor helper failed verification",
        body: `Its SHA-256 doesn't match the one this build of Pophood expects, so it wasn't started. ${detail}`.trim(),
      };
    case "pipe_squatter":
      return {
        title: "Security warning: sensor connection refused",
        body: "Another program answered on the sensor pipe. Pophood disconnected without sending it anything.",
      };
    case "schema_mismatch":
      return {
        title: "Sensor helper is incompatible",
        body: `The helper speaks a different message format (${detail || "unknown version"}). Rebuild the app and helper from the same checkout.`,
      };
    case "helper_error":
    case "helper_exited":
      return {
        title: "Sensors stopped",
        body: `The sensor helper kept stopping, and 3 restarts didn't help. ${detail}`.trim(),
      };
    default:
      return null;
  }
}

function renderBody(body: string) {
  return body.split("`").map((part, index) => (index % 2 === 1 ? <code key={index}>{part}</code> : part));
}

export function BlockingPanel() {
  const model = panelFor(useSensorStatus());
  if (model === null) return null;
  return (
    <section className="panel panel--blocking" role="alert" aria-labelledby="blocking-title">
      <WarningIcon size={22} className="panel__icon" />
      <div className="panel__text">
        <h2 id="blocking-title" className="panel__title">
          {model.title}
        </h2>
        <p className="panel__body">{renderBody(model.body)}</p>
      </div>
      <button type="button" className="btn btn--secondary" onClick={() => void retrySensors().catch(() => undefined)}>
        Retry
      </button>
    </section>
  );
}
