"use client";

import { useEffect, useState } from "react";
import { PageHeader, pageShellClass } from "@/components/ui/page-header";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAccountSummary,
  fetchPlanCaps,
  fetchPlanOptions,
  formatBytes,
  switchPlan,
  type AccountSummary,
  type PlanCaps,
  type PlanOption,
} from "@/lib/api/account";
import { useAuthUser } from "@/lib/api/auth";
import { toastError } from "@/lib/toast";
import { BILLING_PAUSED, BILLING_PAUSED_MESSAGE } from "@/lib/billing-paused";
import { planCta, planDescription, planDisplayName, planPriceLabel, planTermsLine } from "@/lib/plan-display";
import { cn } from "@/lib/utils";

function PlanCard({
  plan,
  onSelect,
  switching,
  trialDays,
}: {
  plan: PlanOption;
  onSelect: (id: string) => void;
  switching: boolean;
  /** Free-trial length the account can still use; 0 when unavailable. Only subscriptions have a trial. */
  trialDays: number;
}) {
  const router = useRouter();
  const isCurrent = plan.isActive;
  const paid = plan.priceDollars > 0;
  const price = planPriceLabel(plan);
  const description = planDescription(plan);
  const terms = isCurrent ? null : planTermsLine(plan, trialDays);
  const perks = paid
    ? ["Unlimited subjects, study sessions and tests", "Our strongest AI model on every activity", `${plan.monthlyTokens.toLocaleString()} tokens a month, enough for daily study sessions`, `${formatBytes(plan.storageLimitBytes)} storage`]
    : ["2 subjects, 3 full study sessions and 2 tests", "A free Quick 5 every day", `${plan.monthlyTokens.toLocaleString()} tokens a month`, `${formatBytes(plan.storageLimitBytes)} storage`];
  return (
    <div className={cn("life-card flex flex-col p-5 sm:p-6", isCurrent && "border-border-strong")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-extrabold leading-tight">{planDisplayName(plan.name)}</h2>
        {isCurrent && <span className="shrink-0 text-[13px] font-bold text-accent">Current plan</span>}
      </div>
      {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
      <p className="mt-4 text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
        {price.amount}
        {price.suffix && <span className="text-[14px] font-semibold tracking-normal text-muted-foreground">{price.suffix}</span>}
      </p>
      <p className="mt-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground">{terms}</p>
      <ul className="mt-3 space-y-2 text-[14px]">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.6} />
            {perk}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-5">
        {isCurrent ? (
          <Button className="w-full" variant="secondary" disabled>
            Your plan
          </Button>
        ) : !paid ? (
          <Button className="w-full" variant="secondary" onClick={() => router.push("/settings#plan")}>
            Downgrade to Free
          </Button>
        ) : (
          <Button className="w-full" disabled={switching} onClick={() => onSelect(plan.id)}>
            {planCta(plan, trialDays)}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  useAuthUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchAccountSummary(),
      fetchPlanOptions(),
      fetchPlanCaps().catch(() => null),
    ])
      .then(([acct, nextPlans, nextCaps]) => {
        setSummary(acct);
        setPlans(nextPlans);
        setCaps(nextCaps);
      })
      .finally(() => setLoading(false));
  }, []);

  const trialDays = caps?.trialDays ?? 0;
  const trialEndsAt = caps?.trialEndsAt ? new Date(caps.trialEndsAt) : null;

  const handleSwitch = async (planId: string) => {
    if (BILLING_PAUSED) {
      toastError(
        new Error(BILLING_PAUSED_MESSAGE),
        "Checkout unavailable",
      );
      return;
    }
    setSwitching(true);
    try {
      await switchPlan(planId);
    } catch (err) {
      toastError(err, "Couldn't open checkout");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <main className={pageShellClass}>
      <PageHeader
        back={{ href: "/settings", label: "Settings" }}
        title="Choose your plan"
        subtitle={
          trialDays > 0
            ? `Subscriptions start with a ${trialDays}-day free trial: add a card, pay $0 today, and billing begins after ${trialDays} days unless you cancel. Checkout is handled by our payment provider; Scribe never sees your card.`
            : "Upgrade anytime. Checkout is handled by our payment provider; Scribe never sees your card."
        }
        className="mb-2"
      />
      {BILLING_PAUSED && (
        <p className="mt-3 max-w-2xl rounded-[var(--r-control)] border border-border px-4 py-3 text-[14px] text-foreground" role="status">
          <span className="font-bold">Billing is paused.</span> Our payment provider has suspended card payments while they review our account, so
          checkout is unavailable and nobody is being charged. Every account has Pro for free this month; we will email when billing is back.
        </p>
      )}
      {trialEndsAt && !BILLING_PAUSED && (
        <p className="mt-2 text-[14px] font-semibold text-foreground" role="status">
          Free trial: your first charge is on {trialEndsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}. Cancel before then in
          Settings to pay nothing.
        </p>
      )}

      {/* What you have used: one flat row, no boxes inside a box. */}
      <section className="mt-6 border-y border-border py-4" aria-label="Current usage">
        {loading ? (
          <div className="flex gap-10">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        ) : summary ? (
          <dl className="flex flex-wrap gap-x-12 gap-y-3">
            <div>
              <dt className="text-[13px] font-semibold text-muted-foreground">Storage used</dt>
              <dd className="mt-0.5 text-[16px] font-extrabold tabular-nums">
                {formatBytes(summary.storageUsedBytes)} <span className="text-[13px] font-semibold text-muted-foreground">of {formatBytes(summary.storageLimitBytes)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold text-muted-foreground">Tokens left</dt>
              <dd className="mt-0.5 text-[16px] font-extrabold tabular-nums">
                {summary.tokenBalance.toLocaleString()} <span className="text-[13px] font-semibold text-muted-foreground">of {summary.monthlyTokens.toLocaleString()} this month</span>
              </dd>
            </div>
          </dl>
        ) : null}
        {!loading && summary && summary.monthlyTokens > 0 && summary.tokenBalance <= summary.monthlyTokens * 0.3 && (
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            You&apos;re running low on tokens. Paid plans come with a much bigger monthly allowance, and every session is generated with our
            strongest model.
          </p>
        )}
      </section>

      <section className={cn("mt-6 grid gap-4", plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "sm:grid-cols-2" : "max-w-md")}>
        {loading
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="life-card space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))
          : plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={handleSwitch} switching={switching} trialDays={trialDays} />)}
      </section>
    </main>
  );
}
