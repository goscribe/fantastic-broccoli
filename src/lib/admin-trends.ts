/**
 * Pure helpers for the admin overview's trend charts (`admin.getTrends`):
 * number formatting, whether a change is an improvement, and the geometry of
 * the line chart.
 */
export type TrendUnit = "count" | "percent" | "money";
export type TrendChange = { value: number; kind: "percent" | "points" };
export type TrendTone = "good" | "bad" | "flat";

/** Money arrives in cents. */
export function formatTrendValue(value: number | null, unit: TrendUnit): string {
  if (value === null) return "–";
  if (unit === "percent") return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (unit === "money") {
    const dollars = value / 100;
    return `$${dollars.toLocaleString("en-US", {
      minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value.toLocaleString("en-US");
}

/** "+12.5%" for counts and money, "−3.1 pts" for percentages. */
export function formatTrendChange(change: TrendChange): string {
  const sign = change.value > 0 ? "+" : change.value < 0 ? "−" : "";
  const size = Math.abs(change.value).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${sign}${size}${change.kind === "points" ? " pts" : "%"}`;
}

/** Whether a change is an improvement, given which direction is better for the metric. */
export function trendTone(change: TrendChange | null, better: "up" | "down"): TrendTone | null {
  if (!change) return null;
  if (change.value === 0) return "flat";
  return change.value > 0 === (better === "up") ? "good" : "bad";
}

/** "6 h to Nov 19, 21:00", "Day to Nov 19, 21:00", "Week to Nov 19". Buckets end at the time the range was loaded. */
export function bucketLabel(start: Date, bucketHours: number, timeZone?: string): string {
  const end = new Date(start.getTime() + bucketHours * 60 * 60 * 1000);
  const day = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  if (bucketHours >= 168) return `Week to ${day}`;
  const time = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${bucketHours >= 24 ? "Day" : `${bucketHours} h`} to ${day}, ${time}`;
}

export type ChartGeometry = {
  /** One SVG path per unbroken run of points; gaps (null) split the line. */
  current: string[];
  previous: string[];
  /** Closed shapes under the current line, one per run. */
  area: string[];
  /** Position of each current point, null where there is no value. */
  points: Array<{ x: number; y: number } | null>;
};

const PAD = 4;

/**
 * Lays both series out on one scale that starts at zero, so the two lines can
 * be compared by height. A single point sits in the middle of the chart.
 */
export function chartGeometry(
  series: Array<number | null>,
  previousSeries: Array<number | null> | null,
  width: number,
  height: number,
): ChartGeometry {
  const all = [...series, ...(previousSeries ?? [])].filter((v): v is number => v !== null);
  const max = Math.max(0, ...all);
  const x = (i: number, n: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => (max === 0 ? height - PAD : height - PAD - (v / max) * (height - 2 * PAD));
  const place = (values: Array<number | null>) =>
    values.map((v, i) => (v === null ? null : { x: round(x(i, values.length)), y: round(y(v)) }));
  const runs = (points: Array<{ x: number; y: number } | null>) => {
    const out: Array<Array<{ x: number; y: number }>> = [];
    let run: Array<{ x: number; y: number }> = [];
    for (const p of points) {
      if (p) run.push(p);
      else if (run.length) {
        out.push(run);
        run = [];
      }
    }
    if (run.length) out.push(run);
    return out;
  };
  const line = (run: Array<{ x: number; y: number }>) =>
    run.length === 1
      ? `M${run[0].x - 1.5},${run[0].y} L${run[0].x + 1.5},${run[0].y}`
      : run.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const points = place(series);
  const currentRuns = runs(points);
  return {
    current: currentRuns.map(line),
    previous: previousSeries ? runs(place(previousSeries)).map(line) : [],
    area: currentRuns
      .filter((run) => run.length > 1)
      .map((run) => `${line(run)} L${run[run.length - 1].x},${height} L${run[0].x},${height} Z`),
    points,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Index of the bucket under a pointer at `offsetX` in a chart `width` wide. */
export function bucketAt(offsetX: number, width: number, buckets: number): number {
  if (buckets <= 1 || width <= 0) return 0;
  return Math.min(buckets - 1, Math.max(0, Math.round((offsetX / width) * (buckets - 1))));
}
