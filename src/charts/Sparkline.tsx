import type { SparkModel } from "../cards/fields";
import { WINDOW_MS, type Series } from "../sensors/history";
import { useSeriesList } from "../sensors/store";
import { areaPath, linePath } from "./path";

const W = 300;
const H = 60;

function highest(series: (Series | undefined)[]): number {
  let max = 0;
  for (const s of series) if (s) for (const v of s.v) if (v !== null && v > max) max = v;
  return max;
}

interface Props {
  spark: SparkModel;
  /** The right edge of the chart: the newest frame's `t`. */
  nowMs: number;
  /** `area`: one line with a soft fill. `disk`: read (solid) and write (dashed), no fill. */
  variant?: "area" | "disk";
}

/** A 10-minute sparkline of the card's hero, drawn as plain SVG paths over frame time. */
export function Sparkline({ spark, nowMs, variant = "area" }: Props) {
  const series = useSeriesList(spark.keys);
  const domain: [number, number] = spark.growToFit
    ? [spark.domain[0], Math.max(spark.domain[1], highest(series))]
    : spark.domain;

  if (variant === "disk") {
    return (
      <svg
        className="spark"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Read (solid) and write (dashed) throughput, last 10 minutes"
      >
        {series[0] && <path className="spark__line spark__line--accent" d={linePath(series[0], domain, W, H, nowMs, WINDOW_MS)} />}
        {series[1] && (
          <path
            className="spark__line spark__line--s2"
            strokeDasharray="4 3"
            d={linePath(series[1], domain, W, H, nowMs, WINDOW_MS)}
          />
        )}
      </svg>
    );
  }

  const first = series[0];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {first && <path className="spark__area" d={areaPath(first, domain, W, H, nowMs, WINDOW_MS)} />}
      {first && <path className="spark__line spark__line--accent" d={linePath(first, domain, W, H, nowMs, WINDOW_MS)} />}
    </svg>
  );
}
