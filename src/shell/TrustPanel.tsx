import type { ReactNode } from "react";
import { NoNetworkIcon, PawnIoIcon, ShieldCheckIcon, ShieldIcon, WarningIcon } from "../icons/Icons";
import type { NoticeCode, SensorStatus } from "../sensors/protocol";

/** "2.2.0.0" → "2.2.0": a trailing ".0" is dropped from a four-part version. */
export function displayPawnIoVersion(version: string | null): string | null {
  if (version === null) return null;
  const parts = version.split(".");
  return parts.length === 4 && parts[3] === "0" ? parts.slice(0, 3).join(".") : version;
}

const STOPPED_REASONS: Partial<Record<NoticeCode, string>> = {
  helper_missing: "Not found next to Pophood",
  helper_hash_mismatch: "Failed verification",
  pipe_squatter: "Connection refused",
  schema_mismatch: "Incompatible",
  helper_error: "Kept stopping",
  helper_exited: "Kept stopping",
};

interface RowModel {
  id: string;
  icon: ReactNode;
  title: string;
  sub: string | null;
  danger?: boolean;
}

export function trustRows(status: SensorStatus): RowModel[] {
  let helper: RowModel;
  switch (status.phase) {
    case "live":
      helper = {
        id: "helper",
        icon: <ShieldCheckIcon className="icon--ok" />,
        title: "Sensor helper verified",
        sub: status.elevated ? "Elevated · read-only" : "Unprivileged",
      };
      break;
    case "stopped":
      helper = {
        id: "helper",
        icon: <WarningIcon />,
        title: "Sensor helper not running",
        sub: (status.notice && STOPPED_REASONS[status.notice.code]) || "Stopped",
        danger: true,
      };
      break;
    default:
      helper = { id: "helper", icon: <ShieldIcon />, title: "Starting sensor helper…", sub: null };
  }

  const pawn = status.pawnIo;
  let pawnRow: RowModel;
  if (pawn === null) {
    pawnRow = { id: "pawnio", icon: <PawnIoIcon />, title: "PawnIO", sub: "Not checked yet" };
  } else if (pawn.installed) {
    const version = displayPawnIoVersion(pawn.version);
    pawnRow = {
      id: "pawnio",
      icon: <PawnIoIcon />,
      title: version === null ? "PawnIO" : `PawnIO ${version}`,
      sub: "Detected, not managed by Pophood",
    };
  } else {
    pawnRow = { id: "pawnio", icon: <PawnIoIcon />, title: "PawnIO not installed", sub: "Needed for CPU, fans and DIMMs" };
  }

  const network: RowModel = {
    id: "network",
    icon: <NoNetworkIcon />,
    title: "No network",
    sub: "Pophood makes no connections. Its web view asks Windows about your Microsoft account; Windows may then contact login.live.com.",
  };
  return [helper, pawnRow, network];
}

export function TrustPanel({ status }: { status: SensorStatus }) {
  return (
    <div className="trust" data-testid="trust-panel">
      {trustRows(status).map((row) => (
        <div className="trust__row" key={row.id} data-row={row.id}>
          {row.icon}
          <div>
            <div className={row.danger ? "trust__title trust__title--danger" : "trust__title"}>{row.title}</div>
            {row.sub !== null && <div>{row.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
