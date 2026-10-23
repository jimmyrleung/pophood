import type { HistorySeries } from "../cards/fields";
import { WINDOW_MS, type Series } from "../sensors/history";
import { useSeriesList } from "../sensors/store";
import { areaPath, linePath } from "./path";

const MINUS = "−"; // U+2212, as in the mockup's "−10 min"

function XLabels() {
  return (
    <div className="chart__x" aria-hidden="true">
      <span>{MINUS}10 min</span>
      <span>{MINUS}5 min</span>
      <span>now</span>
    </div>
  );
}

// ---- History chart (the dashboard's "Last 10 minutes") ----

interface HistoryProps {
  /** For the accessible name: "{metric} over the last 10 minutes". */
  metricLabel: string;
  domain: [number, number];
  /** y-axis labels, top to bottom. */
  axis: [string, string, string];
  series: HistorySeries[];
  nowMs: number;
}

const HW = 600;
const HH = 200;

export function HistoryChart({ metricLabel, domain, axis, series, nowMs }: HistoryProps) {
  // A locked or missing series has no key, so it has no path.
  const drawn = useSeriesList(series.map((s) => s.key ?? ""));

  return (
    <div className="chart">
      <div className="chart__y" aria-hidden="true">
        <span>{axis[0]}</span>
        <span>{axis[1]}</span>
        <span>{axis[2]}</span>
      </div>
      <div className="chart__plot">
        <svg
          className="chart__svg chart__svg--history"
          viewBox={`0 0 ${HW} ${HH}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${metricLabel} over the last 10 minutes`}
        >
          <path className="chart__grid" d={`M0 0H${HW}M0 ${HH / 2}H${HW}M0 ${HH}H${HW}`} />
          {series.map((s, i) => {
            const points = drawn[i];
            if (!points) return null;
            return (
              <path
                key={s.id}
                className={`chart__line chart__line--${s.color}`}
                strokeDasharray={s.dash === "none" ? undefined : s.dash}
                d={linePath(points, domain, HW, HH, nowMs, WINDOW_MS)}
              />
            );
          })}
        </svg>
        <XLabels />
      </div>
    </div>
  );
}

// ---- Drill-down chart (one sensor, no y-axis) ----

const DW = 600;
const DH = 160;

/** The window's min–max padded by 10 %; a flat series sits on the baseline. */
export function detailDomain(series: Series | undefined): [number, number] {
  if (!series) return [0, 1];
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const v of series.v) {
    if (v === null) continue;
    if (v < low) low = v;
    if (v > high) high = v;
  }
  if (!Number.isFinite(low)) return [0, 1];
  if (high === low) return [low, low + 1];
  const pad = (high - low) * 0.1;
  return [low - pad, high + pad];
}

interface DetailProps {
  seriesKey: string;
  label: string;
  nowMs: number;
}

export function DetailChart({ seriesKey, label, nowMs }: DetailProps) {
  const series = useSeriesList([seriesKey])[0];
  const domain = detailDomain(series);
  return (
    <div className="chart chart--detail">
      <div className="chart__plot">
        <svg
          className="chart__svg chart__svg--detail"
          viewBox={`0 0 ${DW} ${DH}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
        >
          <path className="chart__grid" d={`M0 0H${DW}M0 ${DH / 2}H${DW}M0 ${DH}H${DW}`} />
          {series && <path className="chart__area" d={areaPath(series, domain, DW, DH, nowMs, WINDOW_MS)} />}
          {series && <path className="chart__line chart__line--accent" d={linePath(series, domain, DW, DH, nowMs, WINDOW_MS)} />}
        </svg>
        <XLabels />
      </div>
    </div>
  );
}
