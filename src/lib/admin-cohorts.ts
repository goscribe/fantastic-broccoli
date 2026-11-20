/** Pure helpers for the admin overview's weekly cohort table (`admin.getWeeklyCohorts`). */

/** "Nov 16 – 22" or "Oct 26 – Nov 1" for a Monday-to-Sunday week (UTC). */
export function weekLabel(weekStart: Date): string {
  const last = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const sameMonth = weekStart.getUTCMonth() === last.getUTCMonth();
  return `${month(weekStart)} ${weekStart.getUTCDate()} – ${sameMonth ? "" : `${month(last)} `}${last.getUTCDate()}`;
}

/**
 * How strongly to tint a cell (0 to 1): its share of the highest value in the
 * same column, so a column reads as a heat strip from week to week.
 */
export function cellTint(pct: number, columnMax: number): number {
  if (columnMax <= 0 || pct <= 0) return 0;
  return Math.round(Math.min(1, pct / columnMax) * 100) / 100;
}

/** Highest percentage in each column across the weeks shown. */
export function columnMaxima(
  cohorts: Array<{ cells: Record<string, { pct: number } | null> }>,
  keys: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = Math.max(0, ...cohorts.map((c) => c.cells[key]?.pct ?? 0));
  return out;
}

export const COHORT_GROUP_LABELS = {
  first7Days: "Got this far in their first 7 days",
  used: "Used",
  cameBack: "Came back",
} as const;

/** Consecutive columns of the same group, for the header row above the column names. */
export function groupSpans<G extends string>(columns: Array<{ group: G }>): Array<{ group: G; span: number }> {
  const out: Array<{ group: G; span: number }> = [];
  for (const c of columns) {
    const last = out[out.length - 1];
    if (last && last.group === c.group) last.span += 1;
    else out.push({ group: c.group, span: 1 });
  }
  return out;
}
