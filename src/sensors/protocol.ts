// TypeScript mirror of src-tauri/src/sensors/events.rs (the UI contract). Hand-maintained: the shared fixture
// src/test/fixtures/event-frame.json locks the wire shape on both sides (UT-28).

export type Phase = "starting" | "live" | "reconnecting" | "stopped";
export type Elevation = "idle" | "prompting" | "connecting";

export type NoticeCode =
  | "helper_missing"
  | "helper_hash_mismatch"
  | "pipe_squatter"
  | "schema_mismatch"
  | "helper_error"
  | "helper_exited"
  | "full_sensors_lost"
  | "uac_cancelled"
  | "elevation_failed"
  | "elevation_timeout";

export interface Notice {
  code: NoticeCode;
  detail: string | null;
}

export interface PawnIoState {
  installed: boolean;
  version: string | null;
  /** `null` when the helper is unprivileged: the driver isn't checked. */
  loaded: boolean | null;
}

export interface SensorStatus {
  phase: Phase;
  /** From the current connection's hello; `null` before the first one. */
  elevated: boolean | null;
  pawnIo: PawnIoState | null;
  elevation: Elevation;
  notice: Notice | null;
  /** 1..3 while `reconnecting`, otherwise `null`. */
  restartAttempt: number | null;
  helperSha256: string;
}

export interface MemoryModule {
  locator: string;
  sizeGB: number;
  type: string;
  configuredMTs: number | null;
}

export interface UiHardware {
  id: string;
  name: string;
  type: string;
  parent: string | null;
}

export interface UiSensor {
  id: string;
  hw: string;
  name: string;
  type: string;
  index: number;
  /** `null` when the sensor has no value or the helper says it can't be trusted. Never rewritten by the UI. */
  value: number | null;
  /** `id|name`: the stable key labels and history use. */
  key: string;
}

export interface UiFrame {
  seq: number;
  /** Unix ms at the start of the helper's tick. Charts plot this, not the receive time. */
  t: number;
  periodMs: number;
  elevated: boolean;
  memory: MemoryModule[];
  hardware: UiHardware[];
  sensors: UiSensor[];
}

export type SensorEvent =
  | { kind: "status"; status: SensorStatus }
  | { kind: "frame"; frame: UiFrame };

/** What the UI shows before the first status event arrives (and when no supervisor answers). */
export const INITIAL_STATUS: SensorStatus = {
  phase: "starting",
  elevated: null,
  pawnIo: null,
  elevation: "idle",
  notice: null,
  restartAttempt: null,
  helperSha256: "",
};
