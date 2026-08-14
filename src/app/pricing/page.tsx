"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAccountSummary,
  fetchPlanOptions,
  formatBytes,
  switchPlan,
  type AccountSummary,
  type PlanOption,
} from "@/lib/api/account";
import { useAuthUser } from "@/lib/api/auth";

function PlanCard({
  plan,
  onSelect,
  switching,
}: {
  plan: PlanOption;
  onSelect: (id: string) => void;
  switching: boolean;
}) {
  const isCurrent = plan.isActive;
  return (
    <div
      className={`flex flex-col rounded-2xl border p-5 ${
        isCurrent ? "border-accent bg-accent-soft/40" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{plan.name}</p>
        {isCurrent && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
            Current
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">{plan.description}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {plan.priceDollars === 0 ? "Free" : `$${plan.priceDollars}`}
        {plan.priceDollars > 0 && (
          <span className="text-sm font-normal text-faint"> / month</span>
        )}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-accent" />
          {formatBytes(plan.storageLimitBytes)} storage
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 text-accent" />
          {plan.monthlyTokens} tokens / month
        </li>
      </ul>
      <div className="mt-5">
        <Button
          className="w-full"
          variant={isCurrent ? "outline" : "primary"}
          disabled={isCurrent || switching}
          onClick={() => onSelect(plan.id)}
        >
          {isCurrent
            ? "Your plan"
            : plan.priceDollars === 0
              ? "Switch to Free"
              : `Switch to ${plan.name}`}
        </Button>
      </div>
    </div>
  );
}

export default function PricingPage() {
  useAuthUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    Promise.all([fetchAccountSummary(), fetchPlanOptions()])
      .then(([acct, nextPlans]) => {
        setSummary(acct);
        setPlans(nextPlans);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSwitch = async (planId: string) => {
    setSwitching(true);
    try {
      await switchPlan(planId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Plan</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Choose your plan
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Your storage and monthly token allowance are shown below. Upgrade anytime — checkout is handled securely by Stripe.
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Settings
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Current usage</p>
        {loading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : summary ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-[12px] text-faint">Storage</p>
              <p className="mt-1 text-lg font-semibold">
                {formatBytes(summary.storageUsedBytes)}
              </p>
              <p className="text-[12px] text-muted-foreground">
                of {formatBytes(summary.storageLimitBytes)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-[12px] text-faint">Tokens</p>
              <p className="mt-1 text-lg font-semibold">{summary.tokenBalance}</p>
              <p className="text-[12px] text-muted-foreground">
                of {summary.monthlyTokens} / month
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-8 grid max-w-xl gap-4 sm:grid-cols-1">
        {loading
          ? Array.from({ length: 1 }, (_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))
          : plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelect={handleSwitch}
                switching={switching}
              />
            ))}
      </section>
    </main>
  );
}
