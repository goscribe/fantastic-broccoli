"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import {
  EmptyRow,
  PageHeader,
  StatCard,
  Table,
  TableSkeletonRows,
  Td,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

const WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function usd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function perInterval(interval: string | null): string {
  switch (interval) {
    case "year":
      return "/yr";
    case "week":
      return "/wk";
    case "day":
      return "/day";
    default:
      return "/mo";
  }
}

export default function AdminCostsPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "costs", days],
    queryFn: () =>
      adminApi.getCostAnalytics(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      ),
  });

  const { data: projection, isLoading: projectionLoading } = useQuery({
    queryKey: ["admin", "projected-income"],
    queryFn: () => adminApi.getProjectedIncome(),
  });

  const rate = projection?.conversion.rate ?? null;
  const hasHistory = rate !== null;

  const margin = data?.grossMarginUsd ?? 0;
  const costPerToken =
    data && data.tokens.spent > 0 ? data.estCostUsd / data.tokens.spent : 0;

  return (
    <div>
      <PageHeader
        title="Costs & economics"
        description="Subscription revenue against the estimated LLM spend of everything users generated."
        action={
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                type="button"
                onClick={() => setDays(w.days)}
                className={cn(
                  "rounded-md px-3 py-1 text-[13px] font-medium",
                  days === w.days
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={usd(data?.revenue.mrrUsd ?? 0)}
          hint={`${data?.revenue.activePaidSubs ?? 0} active paid subs`}
          loading={isLoading}
        />
        <StatCard
          label="Collected in window"
          value={usd(data?.revenue.collectedUsd ?? 0)}
          hint={`${usd(data?.revenue.topupCollectedUsd ?? 0)} from top-ups`}
          loading={isLoading}
        />
        <StatCard
          label="Est. LLM cost"
          value={usd(data?.estCostUsd ?? 0)}
          hint={
            costPerToken > 0
              ? `≈ ${usd(costPerToken)} per app token spent`
              : undefined
          }
          loading={isLoading}
        />
        <StatCard
          label="Est. gross margin"
          value={`${margin < 0 ? "-" : ""}${usd(Math.abs(margin))}`}
          hint="MRR minus estimated LLM cost"
          loading={isLoading}
        />
      </div>

      <p className="mt-3 text-[12px] text-muted-foreground">
        Cost figures are estimates derived from each pipeline&apos;s call
        structure (model calls and typical context size) — not measured provider
        usage. Treat them as directional.
      </p>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Projected income</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          What the open 7-day free trials are worth once they end. Trials are
          card-required, so every trial not cancelled before it ends charges the
          plan price on day 7. &ldquo;Expected&rdquo; applies the conversion
          rate of trials that have already finished; &ldquo;if all convert&rdquo;
          is the ceiling.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Projected MRR"
            value={
              !projection
                ? usd(0)
                : hasHistory
                  ? usd(projection.projectedMrrUsd ?? 0)
                  : usd(projection.mrrUsd + projection.trials.grossMonthlyUsd)
            }
            hint={
              projection
                ? hasHistory
                  ? `${usd(projection.mrrUsd)} today + ${usd(
                      projection.expectedTrialMonthlyUsd ?? 0,
                    )} expected from trials`
                  : `${usd(projection.mrrUsd)} today + all open trials; no finished trials yet to weight by`
                : undefined
            }
            loading={projectionLoading}
          />
          <StatCard
            label="Trial upside (if all convert)"
            value={usd(projection?.trials.grossMonthlyUsd ?? 0)}
            hint={
              projection
                ? `${projection.trials.open} open trial${
                    projection.trials.open === 1 ? "" : "s"
                  }${
                    projection.trials.cancelling > 0
                      ? `, ${projection.trials.cancelling} set to cancel`
                      : ""
                  } · adds ${usd(projection.trials.grossMonthlyUsd)}/mo`
                : undefined
            }
            loading={projectionLoading}
          />
          <StatCard
            label="Trial conversion"
            value={hasHistory ? pct(rate) : "—"}
            hint={
              projection
                ? hasHistory
                  ? `${projection.conversion.converted} of ${projection.conversion.completed} finished trials paid`
                  : "No trial has reached day 7 yet"
                : undefined
            }
            loading={projectionLoading}
          />
          <StatCard
            label="Next 30 days"
            value={
              hasHistory && projection
                ? usd(projection.next30d.totalExpectedUsd ?? 0)
                : usd(
                    (projection?.next30d.renewalsUsd ?? 0) +
                      (projection?.next30d.trialFirstPaymentsGrossUsd ?? 0),
                  )
            }
            hint={
              projection
                ? `${usd(projection.next30d.renewalsUsd)} from ${
                    projection.next30d.renewalsCount
                  } renewal${
                    projection.next30d.renewalsCount === 1 ? "" : "s"
                  } + ${
                    hasHistory
                      ? `${usd(
                          projection.next30d.trialFirstPaymentsExpectedUsd ?? 0,
                        )} expected`
                      : `up to ${usd(
                          projection.next30d.trialFirstPaymentsGrossUsd,
                        )}`
                  } from ${projection.next30d.trialsEnding} trial${
                    projection.next30d.trialsEnding === 1 ? "" : "s"
                  } ending`
                : undefined
            }
            loading={projectionLoading}
          />
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold">Open trials</h3>
        <Table
          headers={[
            "User",
            "Plan",
            "Trial ends",
            "First charge",
            "Adds to MRR",
            "Status",
          ]}
        >
          {projectionLoading ? (
            <TableSkeletonRows cols={6} rows={3} />
          ) : !projection?.upcomingTrials.length ? (
            <EmptyRow colSpan={6}>No open trials.</EmptyRow>
          ) : (
            projection.upcomingTrials.map((t) => (
              <tr key={t.subscriptionId} className="hover:bg-muted/40">
                <Td>
                  <span className="font-medium">{t.email ?? t.userId}</span>
                </Td>
                <Td className="text-muted-foreground">
                  {t.plan} ({usd(t.firstPaymentUsd)}
                  {perInterval(t.interval)})
                </Td>
                <Td className="tabular-nums">
                  {new Date(t.trialEndsAt).toLocaleDateString()}
                  <span className="ml-1 text-muted-foreground">
                    ({t.daysLeft === 0 ? "today" : `${t.daysLeft}d`})
                  </span>
                </Td>
                <Td className="tabular-nums">{usd(t.firstPaymentUsd)}</Td>
                <Td className="tabular-nums">{usd(t.monthlyUsd)}/mo</Td>
                <Td
                  className={cn(
                    t.cancelsAtEnd ? "text-red-500" : "text-emerald-600",
                  )}
                >
                  {t.cancelsAtEnd ? "Cancels at end" : "Will convert"}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Plans</h2>
        <Table
          headers={["Plan", "Price", "Tokens/mo", "Active subs", "Total subs"]}
        >
          {isLoading ? (
            <TableSkeletonRows cols={5} rows={3} />
          ) : !data?.revenue.plans.length ? (
            <EmptyRow colSpan={5}>No plans configured.</EmptyRow>
          ) : (
            data.revenue.plans.map((plan) => (
              <tr key={plan.name} className="hover:bg-muted/40">
                <Td>
                  <span className="font-medium">{plan.name}</span>
                </Td>
                <Td className="tabular-nums">{usd(plan.priceUsd)}</Td>
                <Td className="tabular-nums">
                  {plan.monthlyTokens.toLocaleString()}
                </Td>
                <Td className="tabular-nums">{plan.activeSubs}</Td>
                <Td className="tabular-nums text-muted-foreground">
                  {plan.totalSubs}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Token ledger</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          {(data?.tokens.granted ?? 0).toLocaleString()} granted ·{" "}
          {(data?.tokens.spent ?? 0).toLocaleString()} spent by{" "}
          {data?.tokens.spenders ?? 0} users. Per-user spend: p50{" "}
          {data?.tokens.p50 ?? 0} · p90 {data?.tokens.p90 ?? 0} · p99{" "}
          {data?.tokens.p99 ?? 0} · max {data?.tokens.max ?? 0}.
        </p>
        <Table headers={["Operation", "Count", "Tokens", "Est. cost"]}>
          {isLoading ? (
            <TableSkeletonRows cols={4} rows={4} />
          ) : !data?.operations.length ? (
            <EmptyRow colSpan={4}>No spend in this window.</EmptyRow>
          ) : (
            data.operations.map((op) => (
              <tr key={op.label} className="hover:bg-muted/40">
                <Td>
                  <span className="font-medium">{op.label}</span>
                </Td>
                <Td className="tabular-nums">{op.count.toLocaleString()}</Td>
                <Td className="tabular-nums text-muted-foreground">
                  {op.tokens.toLocaleString()}
                </Td>
                <Td className="tabular-nums">{usd(op.estCostUsd)}</Td>
              </tr>
            ))
          )}
        </Table>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Heaviest users</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          Top 20 by estimated cost. Margin compares one month of plan revenue
          against their spend in this window.
        </p>
        <Table
          headers={[
            "User",
            "Plan",
            "Tokens",
            "Operations",
            "Est. cost",
            "Margin",
          ]}
        >
          {isLoading ? (
            <TableSkeletonRows cols={6} rows={6} />
          ) : !data?.topSpenders.length ? (
            <EmptyRow colSpan={6}>No spend in this window.</EmptyRow>
          ) : (
            data.topSpenders.map((row) => (
              <tr key={row.userId} className="hover:bg-muted/40">
                <Td>
                  <span className="font-medium">
                    {row.email ?? row.userId}
                  </span>
                </Td>
                <Td className="text-muted-foreground">
                  {row.plan}
                  {row.monthlyRevenueUsd > 0
                    ? ` (${usd(row.monthlyRevenueUsd)}/mo)`
                    : ""}
                </Td>
                <Td className="tabular-nums">
                  {row.tokensSpent.toLocaleString()}
                </Td>
                <Td className="tabular-nums text-muted-foreground">
                  {row.operations}
                </Td>
                <Td className="tabular-nums">{usd(row.estCostUsd)}</Td>
                <Td
                  className={cn(
                    "tabular-nums",
                    row.marginUsd < 0 ? "text-red-500" : "text-emerald-600",
                  )}
                >
                  {row.marginUsd < 0 ? "-" : ""}
                  {usd(Math.abs(row.marginUsd))}
                </Td>
              </tr>
            ))
          )}
        </Table>
      </section>
    </div>
  );
}
