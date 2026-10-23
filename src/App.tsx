import { useLayoutEffect, useState } from "react";
import { About } from "./pages/About";
import { Dashboard } from "./pages/Dashboard";
import { SensorList } from "./pages/SensorList";
import { SensorStoreProvider } from "./sensors/StoreProvider";
import { useSensorStatus } from "./sensors/store";
import { Sidebar, type Page } from "./shell/Sidebar";

const DASHBOARD: Page = { page: "dashboard" };

export function Shell() {
  const status = useSensorStatus();
  const [page, setPage] = useState<Page>(DASHBOARD);

  // The whole document scrolls, so without this a new page would open at the previous page's offset (T13, BUG-01).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <div className="app">
      <Sidebar page={page} status={status} onNavigate={setPage} />
      <main className="main">
        {page.page === "dashboard" && <Dashboard onOpenCard={(cardId) => setPage({ page: "sensors", cardId })} />}
        {page.page === "sensors" && <SensorList cardId={page.cardId} onBack={() => setPage(DASHBOARD)} />}
        {page.page === "about" && <About onBack={() => setPage(DASHBOARD)} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SensorStoreProvider>
      <Shell />
    </SensorStoreProvider>
  );
}
