"use client";

import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/ui/page-header";
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
import { planBilling, planCta, planDescription, planDisplayName, planPriceLabel, planTermsLine } from "@/lib/plan-display";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { examPassPitch, freePerks, paidPerks, plural, type ExamPitch, type FreeCaps } from "@/lib/wall";

/** The free plan's caps when the server didn't say (server FREE_TIER_CAPS). */
const DEFAULT_FREE_CAPS: FreeCaps = { workspaces: 2, studySessions: 3, flashcardTests: 2 };
import { cn } from "@/lib/utils";

function PlanCard({
  plan,
  onSelect,
  switching,
  trialDays,
  freeCaps,
  pitch,
  featured,
}: {
  /** The one primary on the page: the cheapest subscription (the trial). */
  featured: boolean;
  plan: PlanOption;
  onSelect: (id: string) => void;
  switching: boolean;
  /** The free plan's caps, for its own list. */
  freeCaps: FreeCaps;
  /** The pass pitched by the student's exam date, when they have one. */
  pitch: ExamPitch | null;
  /** Free-trial length the account can still use; 0 when unavailable. Only subscriptions have a trial. */
  trialDays: number;
}) {
  const router = useRouter();
  const isCurrent = plan.isActive;
  const paid = plan.priceDollars > 0;
  const price = planPriceLabel(plan);
  const description = paid && planBilling(plan) === "once" && pitch ? pitch.headline : planDescription(plan);
  const terms = isCurrent ? null : planTermsLine(plan, trialDays);
  const pitched = paid && planBilling(plan) === "once" ? pitch : null;
  const storage = plan.storageLimitBytes > 0 ? [`${formatBytes(plan.storageLimitBytes)} for your notes and files`] : [];
  // Outcomes, not tokens: every line is a fact of the plan (see wall.ts paidPerks / freePerks).
  const perks = paid ? [...paidPerks(plan, { examLine: pitched?.line ?? null }), ...storage] : [...freePerks(freeCaps), ...storage];
  return (
    <div className={cn("life-card flex flex-col p-5 sm:p-6", isCurrent && "border-border-strong")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-extrabold leading-tight">{planDisplayName(plan.name)}</h2>
        {isCurrent ? (
          <span className="shrink-0 text-[13px] font-bold text-muted-foreground">Current plan</span>
        ) : paid && planBilling(plan) === "once" && pitch ? (
          <span className="shrink-0 text-[13px] font-bold text-muted-foreground">For your exam</span>
        ) : null}
      </div>
      {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
      <p className="mt-4 text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
        {paid ? price.amount : "$0"}
        {price.suffix && <span className="text-[14px] font-semibold tracking-normal text-muted-foreground">{price.suffix}</span>}
      </p>
      <p className="mt-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground">{terms}</p>
      <ul className="mt-3 space-y-2 text-[14px]">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2.6} />
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
          <Button className="w-full" variant={featured ? "primary" : "secondary"} disabled={switching} onClick={() => onSelect(plan.id)}>
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
  const [pitch, setPitch] = useState<ExamPitch | null>(null);
  useEffect(() => {
    Promise.all([
      fetchAccountSummary(),
      fetchPlanOptions(),
      fetchPlanCaps().catch(() => null),
      fetchPlanToday().catch(() => null),
    ])
      .then(([acct, nextPlans, nextCaps, today]) => {
        setSummary(acct);
        setCaps(nextCaps);
        const pass = nextPlans.find((p) => p.priceDollars > 0 && planBilling(p) === "once");
        const locale = typeof navigator !== "undefined" ? navigator.language : "en-GB";
        const nextPitch = pass && today ? examPassPitch(today.exams, pass, today.today, locale) : null;
        setPitch(nextPitch);
        // With an exam date the pass sits right after the cheapest subscription (the trial).
        if (nextPitch && pass) {
          const rest = nextPlans.filter((p) => p.id !== pass.id);
          const firstSub = rest.findIndex((p) => p.priceDollars > 0);
          rest.splice(firstSub >= 0 ? firstSub + 1 : rest.length, 0, pass);
          setPlans(rest);
        } else {
          setPlans(nextPlans);
        }
      })
      .finally(() => setLoading(false));
  }, []);
  const freeCaps = caps?.caps ?? DEFAULT_FREE_CAPS;
  // The one primary: the cheapest subscription for someone without a plan; for someone on one, the next plan up (never a downgrade).
  const activePrice = plans.find((p) => p.isActive && p.priceDollars > 0)?.priceDollars ?? 0;
  const featuredId = [...plans]
    .filter((p) => p.priceDollars > activePrice && planBilling(p) !== "once" && !p.isActive)
    .sort((a, b) => a.priceDollars - b.priceDollars)[0]?.id;

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
    <PageShell>
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
            {caps?.caps && (
              <>
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Subjects</dt>
                  <dd className="mt-0.5 text-[16px] font-extrabold tabular-nums">
                    {caps.used.workspaces} <span className="text-[13px] font-semibold text-muted-foreground">of {caps.caps.workspaces}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] font-semibold text-muted-foreground">Full study sessions</dt>
                  <dd className="mt-0.5 text-[16px] font-extrabold tabular-nums">
                    {caps.used.studySessions} <span className="text-[13px] font-semibold text-muted-foreground">of {caps.caps.studySessions}</span>
                  </dd>
                </div>
              </>
            )}
          </dl>
        ) : null}
        {!loading && caps?.caps && caps.used.workspaces >= caps.caps.workspaces && (
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            You have the free plan&apos;s {plural(caps.caps.workspaces, "subject", "subjects")}. They stay free to use; a plan lets you add more.
          </p>
        )}
      </section>

      <section className={cn("mt-6 grid gap-4", plans.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : plans.length === 3 ? "md:grid-cols-3" : plans.length === 2 ? "sm:grid-cols-2" : "max-w-md")}>
        {loading
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="life-card space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))
          : plans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={handleSwitch} switching={switching} trialDays={trialDays} freeCaps={freeCaps} pitch={pitch} featured={plan.id === featuredId} />)}
      </section>
    </PageShell>
  );
}
