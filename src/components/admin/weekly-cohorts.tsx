"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, type WeeklyCohort, type WeeklyCohorts } from "@/lib/api/admin";
import {
  COHORT_GROUP_LABELS,
  cellTint,
  columnMaxima,
  groupSpans,
  weekLabel,
} from "@/lib/admin-cohorts";
import { formatMinutes, pageLabel } from "@/lib/admin-insights";
import { cn } from "@/lib/utils";

const WEEK_OPTIONS = [8, 12] as const;
const TH = "whitespace-nowrap px-3 py-2 text-[12px] font-semibold text-faint";

function FirstVisit({ cohort, data }: { cohort: WeeklyCohort; data: WeeklyCohorts }) {
  const visit = cohort.firstVisit;
  const since = data.pageViewsFrom
    ? data.pageViewsFrom.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] font-medium text-faint">
        First hour after signing up · week of {weekLabel(cohort.weekStart)}
      </p>
      {!visit || visit.trackedUsers === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {visit
            ? "No pages were recorded for this week's signups."
            : since
              ? `Pages have only been recorded since ${since}, so there is nothing for this week.`
              : "No pages have been recorded yet."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {visit.trackedUsers.toLocaleString()} of {cohort.signups.toLocaleString()} signups
            had pages recorded
            {visit.partialTracking && since ? ` (recording began ${since}, part-way through the week)` : ""}.
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Pages they opened, in order</p>
              <ul className="space-y-1.5">
                {visit.paths.map((p) => (
                  <li key={p.pages.join(">")} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{p.pages.map(pageLabel).join(" → ")}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.users} · {p.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold">Where that hour ended</p>
              <ul className="space-y-1.5">
                {visit.lastPages.map((p) => (
                  <li key={p.page} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{pageLabel(p.page)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.users} · {p.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Overview section: one row per signup week showing what that week's new
 * users went on to do, so weeks before and after a change can be compared.
 */
export function WeeklyCohortsSection() {
  const [weeks, setWeeks] = useState<number>(8);
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "weekly-cohorts", weeks],
    queryFn: () => adminApi.getWeeklyCohorts(weeks),
    placeholderData: keepPreviousData,
  });

  const maxima = data ? columnMaxima(data.cohorts, data.columns.map((c) => c.key)) : {};
  const active =
    data?.cohorts.find((c) => c.weekStart.getTime() === selected) ??
    data?.cohorts.find((c) => c.firstVisit && c.firstVisit.trackedUsers > 0) ??
    data?.cohorts[0];

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Weekly cohorts</h2>
          <p className="text-[13px] text-muted-foreground">
            Everyone who signed up in a week, and what they went on to do. Percentages are of
            that week&apos;s signups; a darker cell is a better week for that column. Figures
            marked ↑ can still rise. Select a week to see its first-hour pages.
          </p>
        </div>
        <select
          aria-label="Weeks shown"
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="h-9 rounded-full border border-border bg-card px-3 text-sm"
        >
          {WEEK_OPTIONS.map((w) => (
            <option key={w} value={w}>
              Last {w} weeks
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Weekly cohorts could not be loaded: {(error as Error).message}
        </div>
      ) : isLoading || !data ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className={TH} colSpan={2} />
                  {groupSpans(data.columns).map((g, i) => (
                    <th key={i} colSpan={g.span} className={cn(TH, "border-l border-border")}>
                      {COHORT_GROUP_LABELS[g.group]}
                    </th>
                  ))}
                  <th className={cn(TH, "border-l border-border")} colSpan={2}>
                    Per signup
                  </th>
                </tr>
                <tr className="border-b border-border text-left">
                  <th className={TH}>Signup week</th>
                  <th className={cn(TH, "text-right")}>Signups</th>
                  {data.columns.map((c) => (
                    <th key={c.key} className={cn(TH, "text-right")}>
                      {c.label}
                    </th>
                  ))}
                  <th className={cn(TH, "text-right")}>Sessions</th>
                  <th className={cn(TH, "text-right")}>To first session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.cohorts.map((cohort) => {
                  const isActive = cohort === active;
                  return (
                    <tr
                      key={cohort.weekStart.getTime()}
                      onClick={() => setSelected(cohort.weekStart.getTime())}
                      aria-selected={isActive}
                      className={cn("cursor-pointer hover:bg-card-hover", isActive && "bg-accent-soft/60")}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium">
                        <button type="button" className="text-left" onClick={() => setSelected(cohort.weekStart.getTime())}>
                          {weekLabel(cohort.weekStart)}
                        </button>
                        {cohort.inProgress && (
                          <span className="ml-1.5 text-[11px] font-normal text-faint">so far</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{cohort.signups.toLocaleString()}</td>
                      {data.columns.map((c) => {
                        const cell = cohort.cells[c.key];
                        if (!cell || cohort.signups === 0) {
                          return (
                            <td key={c.key} className="px-3 py-2 text-right text-faint">
                              –
                            </td>
                          );
                        }
                        return (
                          <td
                            key={c.key}
                            title={`${cell.users.toLocaleString()} of ${cohort.signups.toLocaleString()}${cell.partial ? " so far; not everyone has had the full period" : ""}`}
                            className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", cell.partial && "text-muted-foreground")}
                            style={{
                              backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(cellTint(cell.pct, maxima[c.key]) * 28)}%, transparent)`,
                            }}
                          >
                            {cell.pct}%{cell.partial ? " ↑" : ""}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right tabular-nums">{cohort.sessionsPerUser}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {formatMinutes(cohort.medianMinutesToFirstSession)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {active && <FirstVisit cohort={active} data={data} />}
        </>
      )}
    </section>
  );
}
