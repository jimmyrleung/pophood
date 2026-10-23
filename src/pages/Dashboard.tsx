import { useMemo } from "react";
import { DashboardCard } from "../cards/DashboardCard";
import { buildDashboard } from "../cards/fields";
import { useFrame, useSensorStatus } from "../sensors/store";
import { BlockingPanel, panelFor } from "../shell/BlockingPanel";
import { StatusBanner } from "../shell/StatusBanner";
import { HistoryPanel } from "./HistoryPanel";

interface Props {
  /** Opens the drill-down of a card. */
  onOpenCard: (cardId: string) => void;
}

export function Dashboard({ onOpenCard }: Props) {
  const status = useSensorStatus();
  const { frame, stale } = useFrame();
  const model = useMemo(() => buildDashboard(frame, status, { stale }), [frame, status, stale]);
  const blocked = panelFor(status) !== null;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          {model.summary !== "" && <p className="page-sub">{model.summary}</p>}
        </div>
      </header>

      <StatusBanner />

      {blocked ? (
        // A blocking notice replaces the grid and the history, so old history never sits next to "stopped".
        <BlockingPanel />
      ) : model.starting || frame === null ? (
        <section className="panel panel--info" role="status">
          <div className="panel__text">
            <h2 className="panel__title">Starting the sensor helper…</h2>
          </div>
        </section>
      ) : (
        <>
          <div className="grid">
            {model.cards.map((card) => (
              <DashboardCard key={card.id} card={card} nowMs={frame.t} onOpen={onOpenCard} />
            ))}
          </div>
          <HistoryPanel metrics={model.history} nowMs={frame.t} />
          <p className="footnote">Readings refresh every second. The last 10 minutes are kept in memory only.</p>
        </>
      )}
    </>
  );
}
