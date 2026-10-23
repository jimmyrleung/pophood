import { INITIAL_STATUS, type Notice, type PawnIoState, type SensorStatus, type UiFrame, type UiSensor } from "../sensors/protocol";

export const PAWNIO_INSTALLED: PawnIoState = { installed: true, version: "2.2.0.0", loaded: null };
export const PAWNIO_MISSING: PawnIoState = { installed: false, version: null, loaded: null };

export function status(overrides: Partial<SensorStatus> = {}): SensorStatus {
  return { ...INITIAL_STATUS, helperSha256: "71c0e9a4", ...overrides };
}

/** A live, unprivileged helper with PawnIO installed (the owner's usual reduced mode). */
export function liveReduced(overrides: Partial<SensorStatus> = {}): SensorStatus {
  return status({ phase: "live", elevated: false, pawnIo: PAWNIO_INSTALLED, ...overrides });
}

export function liveElevated(pawnIo: PawnIoState = { installed: true, version: "2.2.0.0", loaded: true }): SensorStatus {
  return status({ phase: "live", elevated: true, pawnIo });
}

export function stopped(notice: Notice, overrides: Partial<SensorStatus> = {}): SensorStatus {
  return status({ phase: "stopped", notice, ...overrides });
}

export function sensor(id: string, name: string, value: number | null, type = "Temperature", hw = "/amdcpu/0", index = 0): UiSensor {
  return { id, hw, name, type, index, value, key: `${id}|${name}` };
}

export function frame(t: number, sensors: UiSensor[], overrides: Partial<UiFrame> = {}): UiFrame {
  return { seq: 1, t, periodMs: 1000, elevated: false, memory: [], hardware: [], sensors, ...overrides };
}
