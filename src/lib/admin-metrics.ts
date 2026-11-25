/**
 * Formatting for the admin Metrics page. Pure, so it is unit-tested.
 */
import type { MetricChange } from "./api/admin-metrics";

export type MetricUnit = "count" | "percent" | "ratio" | "minutes" | "usd" | "cents";

export function formatMetric(value: number | null | undefined, unit: MetricUnit): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (unit) {
    case "percent":
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    case "ratio":
      return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    case "minutes":
      return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} min`;
    case "usd":
    {
      const cents = value !== 0 && Math.abs(value) < 100;
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
    }
    case "cents":
      return formatMetric(value / 100, "usd");
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

/** "+12%", "−3.5 pts"; empty when there is nothing to compare with. */
export function formatChange(change: MetricChange): string {
  if (!change) return "";
  const sign = change.value > 0 ? "+" : change.value < 0 ? "−" : "±";
  const size = Math.abs(change.value).toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${sign}${size}${change.kind === "points" ? " pts" : "%"}`;
}

export type Tone = "good" | "bad" | "flat";

/** Whether a change is an improvement; `better` says which direction is. */
export function changeTone(change: MetricChange, better: "up" | "down" = "up"): Tone | null {
  if (!change) return null;
  if (change.value === 0) return "flat";
  return change.value > 0 === (better === "up") ? "good" : "bad";
}

/** "40% (12/30)", or "—" when nobody is eligible yet. */
export function rateCell(part: number, whole: number, pct: number | null): string {
  if (whole === 0 || pct === null) return "—";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 1 })}% (${part}/${whole})`;
}

export function shortDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * "Tracking since Nov 24" for a number that only exists since a recent
 * event; null when the data reaches back over both periods.
 */
export function trackingNote(firstSeen: Date | string | null | undefined, previousFrom: Date | string, expected?: string): string | null {
  if (!firstSeen) return expected ? `Tracking since ${shortDate(`${expected}T00:00:00Z`)}: no data yet` : "No data yet";
  const first = new Date(firstSeen);
  if (first.getTime() <= new Date(previousFrom).getTime() + 24 * 3600 * 1000) return null;
  return `Tracking since ${shortDate(first)}`;
}

/** Bar widths (0–100) for a list of values against the largest. */
export function barWidths(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 1000) / 10 : 0));
}

/** Label of a 10% score bucket: "0–9%", …, "90–100%" (100% sits in the last one). */
export function scoreBucketLabel(i: number): string {
  return i >= 9 ? "90–100%" : `${i * 10}–${i * 10 + 9}%`;
}

/** "IQR 40–80%" for the middle half of the scores, or "" when there are none. */
export function quartileNote(p25: number | null, p75: number | null): string {
  if (p25 === null || p75 === null) return "";
  const f = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `middle half ${f(p25)}–${f(p75)}%`;
}

/** "SL 3 · HL 5" for a course's level split. */
export function levelSplit(levels: Array<{ level: string; students: number }>): string {
  return levels.map((l) => `${l.level} ${l.students}`).join(" · ");
}
