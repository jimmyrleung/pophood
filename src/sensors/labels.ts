import { createContext, useContext, useSyncExternalStore } from "react";
import { loadLabels, setLabel } from "./commands";

export const MAX_LABEL_LENGTH = 40;

export interface Labels {
  map: ReadonlyMap<string, string>;
  loadError: string | null;
}

export interface LabelStore {
  start(): Promise<void>;
  save(key: string, text: string, defaultName: string): Promise<void>;
  getSnapshot(): Labels;
  subscribe(listener: () => void): () => void;
}

export function createLabelStore(): LabelStore {
  const listeners = new Set<() => void>();
  let snapshot: Labels = { map: new Map(), loadError: null };

  function publish(next: Labels) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  return {
    async start() {
      try {
        const { labels, problem } = await loadLabels();
        publish({ map: new Map(Object.entries(labels)), loadError: problem });
      } catch (error) {
        publish({ map: new Map(), loadError: String(error) });
      }
    },
    async save(key, text, defaultName) {
      const trimmed = text.trim();
      const label = trimmed === "" || trimmed === defaultName ? null : trimmed;
      await setLabel(key, label);
      const map = new Map(snapshot.map);
      if (label === null) map.delete(key);
      else map.set(key, label);
      publish({ ...snapshot, map });
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const labelStore = createLabelStore();
export const LabelStoreContext = createContext<LabelStore>(labelStore);

export function useLabelStore(): LabelStore {
  return useContext(LabelStoreContext);
}

export function useLabels(): Labels {
  const store = useLabelStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
