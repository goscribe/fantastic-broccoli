"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, type ActiveUsersPoint } from "@/lib/api/admin";
import {
  EmptyRow,
  StatCard,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { barHeights, biggestDropOff, formatMinutes } from "@/lib/admin-insights";
import { formatRelativeDate } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ActiveUsersChart({ series }: { series: ActiveUsersPoint[] }) {
  const heights = barHeights(series.map((p) => p.dau));
  const peak = Math.max(0, ...series.map((p) => p.dau));
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[12px] font-medium uppercase tracking-wide text-faint">
          Daily active users
        </p>
        <p className="text-[12px] text-muted-foreground">
          Peak {peak.toLocaleString()} · days are UTC
        </p>
      </div>
      <div
        role="img"
        aria-label={`Daily active users from ${first?.date} to ${last?.date}, peak ${peak}`}
        className="flex h-32 items-end gap-[2px]"
      >
        {series.map((p, i) => (
          <div
            key={p.date}
            title={`${shortDay(p.date)}: ${p.dau} active, ${p.signups} signed up`}
            className="flex h-full flex-1 items-end"
          >
            <div
              className="w-full rounded-t-sm bg-accent"
              style={{ height: `${Math.max(heights[i], p.dau > 0 ? 3 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-[11px] text-faint">
        <span>{first ? shortDay(first.date) : ""}</span>
        <span>{last ? shortDay(last.date) : ""}</span>
      </div>
    </div>
  );
}

/**
 * Overview section: who is active, how far new signups get, which features
 * are used, what fails, and who was on the site most recently.
 */
export function ProductAnalyticsSection() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "product-analytics", days],
    queryFn: () => adminApi.getProductAnalytics(days),
    placeholderData: keepPreviousData,
  });

  const drop = data ? biggestDropOff(data.funnel.steps) : null;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Product analytics</h2>
          <p className="text-[13px] text-muted-foreground">
            Real users only: admins, internal test accounts and deleted
            accounts are left out.
          </p>
        </div>
        <select
          aria-label="Analytics period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-9 rounded-full border border-border bg-card px-3 text-sm"
        >
          {RANGES.map((r) => (
            <option key={r} value={r}>
              Last {r} days
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Product analytics could not be loaded: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active today"
              value={(data?.activeUsers.today ?? 0).toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label="Active, last 7 days"
              value={(data?.activeUsers.last7Days ?? 0).toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label="Active, last 30 days"
              value={(data?.activeUsers.last30Days ?? 0).toLocaleString()}
              loading={isLoading}
            />
            <StatCard
              label={`Signups, last ${days} days`}
              value={(data?.funnel.signups ?? 0).toLocaleString()}
              hint={
                data
                  ? `${data.funnel.verifiedEmail.pct}% verified their email`
                  : undefined
              }
              loading={isLoading}
            />
          </div>

          {isLoading || !data ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <ActiveUsersChart series={data.activeUsers.series} />
          )}

          <h3 className="mb-1 mt-8 text-[15px] font-semibold">
            Activation funnel
          </h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            How far the {data?.funnel.signups ?? 0} people who signed up in this
            period got. Each step counts anyone who did it at least once, in any
            order. &ldquo;Stopped here&rdquo; is the furthest step a person
            reached.
          </p>
          <Table
            headers={[
              "Step",
              "Users",
              "Of signups",
              "Of previous step",
              "Stopped here",
            ]}
          >
            {isLoading ? (
              <TableSkeletonRows cols={5} rows={6} />
            ) : !data || data.funnel.signups === 0 ? (
              <EmptyRow colSpan={5}>No signups in this period.</EmptyRow>
            ) : (
              data.funnel.steps.map((step) => (
                <tr key={step.key}>
                  <Td className="w-[40%]">
                    <p className="font-medium">{step.label}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, step.pctOfSignups)}%` }}
                      />
                    </div>
                  </Td>
                  <Td className="tabular-nums">{step.users.toLocaleString()}</Td>
                  <Td className="tabular-nums">{step.pctOfSignups}%</Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {step.pctOfPrevious === null ? "—" : `${step.pctOfPrevious}%`}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {step.stoppedHere.toLocaleString()}
                  </Td>
                </tr>
              ))
            )}
          </Table>
          {data && data.funnel.signups > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Biggest drop-off"
                value={drop ? `−${drop.pct}%` : "None"}
                hint={
                  drop
                    ? `${drop.lost} lost between “${drop.from}” and “${drop.to}”`
                    : "No step lost anyone"
                }
              />
              <StatCard
                label="Came back another day"
                value={`${data.funnel.returnedLaterDay.pct}%`}
                hint={`${data.funnel.returnedLaterDay.users} of ${data.funnel.signups} signups`}
              />
              <StatCard
                label="Paid"
                value={`${data.funnel.paid.pct}%`}
                hint={`${data.funnel.paid.users} of ${data.funnel.signups} signups`}
              />
              <StatCard
                label="Time to first session"
                value={formatMinutes(data.funnel.medianMinutesToFirstSession)}
                hint="Median, from signup"
              />
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[15px] font-semibold">Feature usage</h3>
              <p className="mb-3 text-[13px] text-muted-foreground">
                Share of the {data?.activeUsers.inWindow ?? 0} users active in
                this period who used each feature.
              </p>
              <Table headers={["Feature", "Users", "Of active", "Volume"]}>
                {isLoading ? (
                  <TableSkeletonRows cols={4} rows={6} />
                ) : (
                  (data?.features ?? []).map((f) => (
                    <tr key={f.key}>
                      <Td className="font-medium">{f.label}</Td>
                      <Td className="tabular-nums">{f.users.toLocaleString()}</Td>
                      <Td className="tabular-nums">{f.pctOfActive}%</Td>
                      <Td className="text-muted-foreground">
                        {f.events.toLocaleString()} {f.unit}
                      </Td>
                    </tr>
                  ))
                )}
              </Table>
            </div>

            <div>
              <h3 className="mb-1 text-[15px] font-semibold">
                Where people hit errors
              </h3>
              <p className="mb-3 text-[13px] text-muted-foreground">
                Actions that failed most, by people affected.{" "}
                <Link href="/admin/logs" className="text-accent hover:underline">
                  Activity logs
                </Link>{" "}
                have the individual failures.
              </p>
              <Table headers={["Action", "Users", "Failures", "Failure rate"]}>
                {isLoading ? (
                  <TableSkeletonRows cols={4} rows={6} />
                ) : !data?.failingActions.length ? (
                  <EmptyRow colSpan={4}>Nothing failed in this period.</EmptyRow>
                ) : (
                  data.failingActions.map((a) => (
                    <tr key={a.path}>
                      <Td>
                        <p className="font-medium">{a.label}</p>
                        <p className="text-[12px] text-faint">{a.path}</p>
                      </Td>
                      <Td className="tabular-nums">{a.users.toLocaleString()}</Td>
                      <Td className="tabular-nums">
                        {a.failures.toLocaleString()}
                      </Td>
                      <Td className="tabular-nums text-muted-foreground">
                        {a.failureRate}% of {a.calls.toLocaleString()}
                      </Td>
                    </tr>
                  ))
                )}
              </Table>
            </div>
          </div>

          <h3 className="mb-1 mt-8 text-[15px] font-semibold">
            Recently active users
          </h3>
          <p className="mb-3 text-[13px] text-muted-foreground">
            Open one to see what they did, visit by visit.
          </p>
          <Table headers={["User", "Last active", "Active days", "Requests", ""]}>
            {isLoading ? (
              <TableSkeletonRows cols={5} rows={5} />
            ) : !data?.recentlyActive.length ? (
              <EmptyRow colSpan={5}>Nobody was active in this period.</EmptyRow>
            ) : (
              data.recentlyActive.map((u) => (
                <tr key={u.userId} className="hover:bg-muted/40">
                  <Td>
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="font-medium hover:text-accent"
                    >
                      {u.name ?? "—"}
                    </Link>
                    <p className="text-[12px] text-muted-foreground">
                      {u.email ?? "—"}
                    </p>
                  </Td>
                  <Td className="text-muted-foreground">
                    {formatRelativeDate(u.lastActiveAt)}
                  </Td>
                  <Td className="tabular-nums">
                    {u.activeDays} of {days}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {u.requests.toLocaleString()}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/users/${u.userId}`}
                      className="text-[13px] text-accent hover:underline"
                    >
                      Activity
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </>
      )}
    </section>
  );
}
