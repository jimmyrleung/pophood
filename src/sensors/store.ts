import { Channel, invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useSyncExternalStore } from "react";
import { appendFrame, type History, type Series } from "./history";
import { INITIAL_STATUS, type SensorEvent, type SensorStatus, type UiFrame } from "./protocol";

/** Everything a component can read. A new object per change, so `useSyncExternalStore` sees a stable snapshot. */
export interface Snapshot {
  status: SensorStatus;
  frame: UiFrame | null;
  /** True when values must not be shown as live: the phase isn't `live`, or frames stopped arriving. */
  stale: boolean;
  history: History;
}

export interface SensorStore {
  /** Subscribes to the core's Channel. Returns a dispose function. Never throws. */
  start(): Promise<() => void>;
  /** Applies one event as if it had arrived on the Channel. */
  applyEvent(event: SensorEvent): void;
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
}

const WATCHDOG_INTERVAL_MS = 1000;
const WATCHDOG_PERIODS = 3;

export function createSensorStore(): SensorStore {
  const history: History = new Map();
  const listeners = new Set<() => void>();
  let status: SensorStatus = INITIAL_STATUS;
  let frame: UiFrame | null = null;
  let stale = true;
  let lastFrameAt = 0;
  let snapshot: Snapshot = { status, frame, stale, history };

  function publish() {
    snapshot = { status, frame, stale, history };
    for (const listener of listeners) listener();
  }

  function applyEvent(event: SensorEvent) {
    if (event.kind === "status") {
      status = event.status;
      // A status change during a stall must not make the last values look live again.
      stale = status.phase !== "live" || frameIsLate();
      // A stopped helper with a blocking notice leaves nothing to show: the app is a shell with a panel.
      if (status.phase === "stopped" && status.notice !== null) frame = null;
    } else {
      appendFrame(history, event.frame);
      frame = event.frame;
      lastFrameAt = Date.now();
      stale = false;
    }
    publish();
  }

  function frameIsLate(): boolean {
    return frame !== null && Date.now() - lastFrameAt > WATCHDOG_PERIODS * frame.periodMs;
  }

  // Backstop for a source that died without the supervisor saying so yet, and for a stalled Channel.
  function watchdog() {
    if (stale) return;
    if (frameIsLate()) {
      stale = true;
      publish();
    }
  }

  async function start() {
    const channel = new Channel<SensorEvent>();
    channel.onmessage = applyEvent;
    const timer = setInterval(watchdog, WATCHDOG_INTERVAL_MS);
    try {
      await invoke("subscribe_sensors", { onEvent: channel });
    } catch {
      // No supervisor answered (or the webview reloaded mid-call): keep the initial "starting" status.
    }
    return () => {
      clearInterval(timer);
      channel.onmessage = () => {};
    };
  }

  return {
    start,
    applyEvent,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const SensorStoreContext = createContext<SensorStore | null>(null);

function useStore(): SensorStore {
  const store = useContext(SensorStoreContext);
  if (store === null) throw new Error("SensorStoreProvider is missing");
  return store;
}

function useSnapshot(): Snapshot {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useSensorStatus(): SensorStatus {
  return useSnapshot().status;
}

export function useFrame(): { frame: UiFrame | null; stale: boolean } {
  const { frame, stale } = useSnapshot();
  return { frame, stale };
}

/**
 * The last 10 minutes of several sensors (a hook can't be called in a loop), in the order of `keys`; `undefined` where
 * there is none yet. Re-reads on every frame, because the arrays are mutated in place.
 */
export function useSeriesList(keys: string[]): (Series | undefined)[] {
  const { history } = useSnapshot();
  return keys.map((key) => history.get(key));
}
