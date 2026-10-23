import { useState } from "react";
import { LockIcon } from "../icons/Icons";
import { HistoryChart } from "../charts/LineChart";
import type { HistoryMetric, HistorySeries, MetricId } from "../cards/fields";

interface Props {
  metrics: HistoryMetric[];
  nowMs: number;
}

function LegendRow({ series }: { series: HistorySeries }) {
  const locked = series.locked !== null;
  return (
    <li className="legend__row">
      <svg className="legend__swatch" viewBox="0 0 28 4" aria-hidden="true">
        <path
          className={locked ? "legend__stroke legend__stroke--locked" : `legend__stroke legend__stroke--${series.color}`}
          strokeDasharray={series.dash === "none" ? undefined : series.dash}
          d="M0 2H28"
        />
      </svg>
      <span className="legend__name">{series.name}</span>
      {series.cell.kind === "value" && (
        <span className="legend__value">
          {series.cell.value}
          {series.cell.unit !== "" && <span className="unit"> {series.cell.unit}</span>}
        </span>
      )}
      {series.cell.kind === "locked" && (
        <span className="locked locked--small">
          <LockIcon size={12} />
          {series.cell.label}
        </span>
      )}
      {series.cell.kind === "none" && <span className="not-reported">—</span>}
    </li>
  );
}

/** "Last 10 minutes": a metric switch (Temperatures first), the chart and the legend with each series' current value. */
export function HistoryPanel({ metrics, nowMs }: Props) {
  const [selected, setSelected] = useState<MetricId>("temperatures");
  const metric = metrics.find((m) => m.id === selected) ?? metrics[0];
  if (!metric) return null;

  return (
    <section className="history" aria-label="History">
      <div className="history__header">
        <h2 className="history__title">Last 10 minutes</h2>
        <div className="segmented" role="group" aria-label="Chart metric">
          {metrics.map((m) => (
            <button
              key={m.id}
              type="button"
              className="segmented__button"
              aria-pressed={m.id === metric.id}
              onClick={() => setSelected(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="history__body">
        <div className="history__chart">
          <HistoryChart metricLabel={metric.label} domain={metric.domain} axis={metric.axis} series={metric.series} nowMs={nowMs} />
        </div>
        <ul className="legend">
          {metric.series.map((series) => (
            <LegendRow key={series.id} series={series} />
          ))}
        </ul>
      </div>
    </section>
  );
}
