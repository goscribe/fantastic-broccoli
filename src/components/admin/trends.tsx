"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminApi,
  TREND_RANGES,
  type TrendMetric,
  type TrendRange,
  type Trends,
} from "@/lib/api/admin";
import {
  bucketAt,
  bucketLabel,
  chartGeometry,
  formatTrendChange,
  formatTrendValue,
  trendTone,
} from "@/lib/admin-trends";
import { cn } from "@/lib/utils";

const RANGE_LABELS: Record<TrendRange, { short: string; long: string }> = {
  "3d": { short: "3D", long: "3 days" },
  "1w": { short: "1W", long: "7 days" },
  "1m": { short: "1M", long: "28 days" },
  "3m": { short: "3M", long: "13 weeks" },
  "6m": { short: "6M", long: "26 weeks" },
  "1y": { short: "1Y", long: "52 weeks" },
};

const W = 300;
const H = 72;

const TONE_TEXT = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
} as const;
const TONE_STROKE = { good: "#16a34a", bad: "#dc2626", flat: "var(--accent)" } as const;

function TrendCard({ metric, trends }: { metric: TrendMetric; trends: Trends }) {
  const [hover, setHover] = useState<number | null>(null);
  const tone = trendTone(metric.change, metric.better);
  const stroke = TONE_STROKE[tone ?? "flat"];
  const g = chartGeometry(metric.series, metric.previousSeries, W, H);
  const hovered = hover !== null ? g.points[hover] : null;
  const gradient = `trend-fill-${metric.key}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p
        className="text-[12px] font-medium text-faint"
        title={metric.description}
      >
        {metric.label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <p className="text-2xl font-bold tabular-nums">
          {formatTrendValue(metric.current, metric.unit)}
        </p>
        {metric.change && tone ? (
          <p className={cn("text-[13px] font-semibold tabular-nums", TONE_TEXT[tone])}>
            {formatTrendChange(metric.change)}
          </p>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {metric.previous === null
          ? "No earlier period to compare with"
          : `${formatTrendValue(metric.previous, metric.unit)} in the period before`}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${metric.label} over the last ${RANGE_LABELS[trends.range].long}: ${formatTrendValue(metric.current, metric.unit)}`}
        className="mt-3 h-[72px] w-full touch-none overflow-visible"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(bucketAt(e.clientX - box.left, box.width, metric.series.length));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.area.map((d, i) => (
          <path key={`a${i}`} d={d} fill={`url(#${gradient})`} />
        ))}
        {g.previous.map((d, i) => (
          <path
            key={`p${i}`}
            d={d}
            fill="none"
            stroke="var(--faint)"
            strokeWidth="1.25"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {g.current.map((d, i) => (
          <path
            key={`c${i}`}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hover !== null && (
          <line
            x1={(g.points[hover] ?? { x: (hover / Math.max(1, metric.series.length - 1)) * W }).x}
            x2={(g.points[hover] ?? { x: (hover / Math.max(1, metric.series.length - 1)) * W }).x}
            y1="0"
            y2={H}
            stroke="var(--border-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={hovered.y}
            y2={hovered.y}
            stroke={stroke}
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <p className="mt-2 flex min-h-[18px] justify-between gap-2 border-t border-border pt-2 text-[11px] text-faint">
        {hover !== null ? (
          <>
            <span>{bucketLabel(trends.bucketStarts[hover], trends.bucketHours)}</span>
            <span className="tabular-nums text-foreground">
              {formatTrendValue(metric.series[hover], metric.unit)}
              {metric.previousSeries ? (
                <span className="text-faint">
                  {" "}
                  · before {formatTrendValue(metric.previousSeries[hover], metric.unit)}
                </span>
              ) : null}
            </span>
          </>
        ) : (
          <>
            <span>
              {trends.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span>Now</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Overview section: each headline number over a chosen range, drawn against
 * the same-length period before it, so it is visible whether it is improving.
 */
export function TrendsSection() {
  const [range, setRange] = useState<TrendRange>("1m");
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin", "trends", range],
    queryFn: () => adminApi.getTrends(range),
    placeholderData: keepPreviousData,
  });
  const long = RANGE_LABELS[range].long;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Trends</h2>
          <p className="text-[13px] text-muted-foreground">
            {data && data.metrics.every((m) => m.previous === null)
              ? `Last ${long}. The data does not go back far enough to compare with the ${long} before. Real users only.`
              : `Last ${long} (solid line) against the ${long} before (dashed). Green is better, red is worse. Real users only.`}
          </p>
        </div>
        <div
          role="group"
          aria-label="Trend range"
          className={cn(
            "flex rounded-full border border-border bg-card p-0.5 transition-opacity",
            isFetching && !isLoading && "opacity-60",
          )}
        >
          {TREND_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              aria-label={`Last ${RANGE_LABELS[r].long}`}
              onClick={() => setRange(r)}
              className={cn(
                "h-8 rounded-full px-3 text-[13px] font-semibold tabular-nums",
                r === range
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABELS[r].short}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Trends could not be loaded: {(error as Error).message}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data
            ? data.metrics.map((m) => <TrendCard key={m.key} metric={m} trends={data} />)
            : Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-7 w-20" />
                  <Skeleton className="mt-4 h-[72px] w-full" />
                </div>
              ))}
        </div>
      )}
    </section>
  );
}
