import { invoke } from "@tauri-apps/api/core";

export const enableFullSensors = (): Promise<void> => invoke("enable_full_sensors");
export const retrySensors = (): Promise<void> => invoke("retry_sensors");
/** Rejects with a message when the default browser can't be opened. */
export const openPawnIoSite = (): Promise<void> => invoke("open_pawnio_site");
