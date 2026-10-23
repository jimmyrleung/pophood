import { useEffect, useState, type ReactNode } from "react";
import { SensorStoreContext, createSensorStore } from "./store";

export function SensorStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createSensorStore);

  useEffect(() => {
    // `start()` resolves after the invoke; dispose whichever way the effect ends first.
    let disposed = false;
    let dispose: (() => void) | null = null;
    void store.start().then((stop) => {
      if (disposed) stop();
      else dispose = stop;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, [store]);

  return <SensorStoreContext.Provider value={store}>{children}</SensorStoreContext.Provider>;
}
