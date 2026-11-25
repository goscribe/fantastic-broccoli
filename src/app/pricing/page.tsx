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
import { handleCheckoutFailure } from "@/lib/checkout-landing";
import { BILLING_PAUSED, BILLING_PAUSED_MESSAGE } from "@/lib/billing-paused";
import { planBilling, planCta, planDescription, planDisplayName, planPriceLabel, planTermsLine } from "@/lib/plan-display";
import { UNLIMITED_GRANT_LABEL, hasUnlimitedGrant } from "@/lib/plan-access";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { examPassPitch, freePerks, paidPerks, plural, type ExamPitch, type FreeCaps } from "@/lib/wall";

/** The free plan's caps when the server didn't say (server FREE_TIER_CAPS). */
const DEFAULT_FREE_CAPS: FreeCaps = { workspaces: 2, studySessions: 3, flashcardTests: 2 };
import { cn } from "@/lib/utils";
import { parsePricingQuery, pricingPick } from "@/lib/coursework-access";
import { AskParentBand, PassOptions, type PitchedPass } from "@/components/billing/pass-options";
import { AskParentDialog, payablePlans } from "@/components/billing/ask-parent-dialog";

function PlanCard({
  plan,
  onSelect,
  switching,
  trialDays,
  freeCaps,
  pitch,
  featured,
  picked,
}: {
  /** The one primary on the page: the cheapest subscription (the trial), or the plan the link asked for. */
  featured: boolean;
  /** The plan the link asked for (`?plan=` / `?for=coursework`): marked, outlined in ink, scrolled to. */
  picked?: string | null;
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
    <div
      id={picked ? "picked-plan" : undefined}
      data-picked={picked ? "" : undefined}
      className={cn("life-card flex scroll-mt-24 flex-col p-5 max-md:scroll-mb-24 sm:p-6", isCurrent && "border-border-strong", picked && "border-foreground ring-1 ring-foreground")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-extrabold leading-tight">{planDisplayName(plan.name)}</h2>
        {picked ? (
          <span className="shrink-0 text-[13px] font-bold text-muted-foreground">{picked}</span>
        ) : isCurrent ? (
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
  const pageRouter = useRouter();
  const { user } = useAuthUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [pitched, setPitched] = useState<PitchedPass | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // `?plan=ultra&for=coursework` (a locked Coursework): the plan to pick, from the plans the server lists.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedFor, setPickedFor] = useState<string | null>(null);
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
        // The cheapest pass that covers the student's exam date gets the pitch.
        const locale = typeof navigator !== "undefined" ? navigator.language : "en-GB";
        const passes = nextPlans.filter((p) => p.priceDollars > 0 && planBilling(p) === "once").sort((a, b) => a.priceDollars - b.priceDollars);
        let nextPitched: PitchedPass | null = null;
        for (const pass of today ? passes : []) {
          const pitch = examPassPitch(today!.exams, pass, today!.today, locale);
          if (pitch) {
            nextPitched = { planId: pass.id, pitch };
            break;
          }
        }
        setPitched(nextPitched);
        const query = parsePricingQuery(window.location.search);
        setPickedId(pricingPick(nextPlans, query));
        setPickedFor(query.for);
        setPlans(nextPlans);
      })
      .finally(() => setLoading(false));
  }, []);
  const freeCaps = caps?.caps ?? DEFAULT_FREE_CAPS;
  // Monthly plans as cards; the exam passes ("pay once") in their own section below them.
  const monthlyPlans = plans.filter((p) => planBilling(p) !== "once");
  const passPlans = plans.filter((p) => p.priceDollars > 0 && planBilling(p) === "once");
  const payable = payablePlans(plans);
  // The one primary: the cheapest subscription for someone without a plan; for someone on one, the next plan up (never a downgrade).
  const activePrice = plans.find((p) => p.isActive && p.priceDollars > 0)?.priceDollars ?? 0;
  const featuredId =
    (pickedId && monthlyPlans.some((p) => p.id === pickedId) ? pickedId : null) ??
    [...monthlyPlans]
      .filter((p) => p.priceDollars > activePrice && planBilling(p) !== "once" && !p.isActive)
      .sort((a, b) => a.priceDollars - b.priceDollars)[0]?.id;
  const pickedLabel = pickedFor === "coursework" ? "For coursework" : "Selected";
  useEffect(() => {
    if (loading || !pickedId) return;
    document.getElementById("picked-plan")?.scrollIntoView({ block: "nearest" });
  }, [loading, pickedId]);

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
    setBuying(planId);
    try {
      await switchPlan(planId);
    } catch (err) {
      // Never the provider's words or a dead end: a friendly line, and the first run for a student with no subject yet.
      await handleCheckoutFailure(err, pageRouter);
    } finally {
      setSwitching(false);
      setBuying(null);
    }
  };

  // The top tier, given free by an admin: nothing to choose, buy or upgrade to.
  if (!loading && hasUnlimitedGrant(caps)) {
    return (
      <PageShell>
        <PageHeader back={{ href: "/settings", label: "Settings" }} title="Your plan" className="mb-2" />
        <section className="mt-6 max-w-xl border-y border-border py-5" role="status">
          <p className="text-[18px] font-extrabold">{UNLIMITED_GRANT_LABEL}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            You have everything Scribe offers, free, with no end date. There is nothing to buy and nothing renews.
            {caps?.paid ? " You are still paying for a plan of your own; you can cancel it in Settings and keep everything." : ""}
          </p>
        </section>
      </PageShell>
    );
  }

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

      <section className={cn("mt-6 grid gap-4", monthlyPlans.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : monthlyPlans.length === 3 ? "md:grid-cols-3" : monthlyPlans.length === 2 ? "sm:grid-cols-2" : "max-w-md")}>
        {loading
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="life-card space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ))
          : monthlyPlans.map((plan) => <PlanCard key={plan.id} plan={plan} onSelect={handleSwitch} switching={switching} trialDays={trialDays} freeCaps={freeCaps} pitch={null} featured={plan.id === featuredId} picked={plan.id === pickedId ? pickedLabel : null} />)}
      </section>

      {!loading && (
        <PassOptions
          className="mt-10"
          passes={passPlans}
          busyId={buying}
          disabled={switching}
          onBuy={handleSwitch}
          pitched={pitched}
          pickedId={pickedId}
          pickedLabel={pickedLabel}
        />
      )}
      {!loading && payable.length > 0 && !BILLING_PAUSED && <AskParentBand className="mt-10" onOpen={() => setAsking(true)} />}
      {asking && (
        <AskParentDialog
          plans={payable}
          defaultPlanId={pitched?.planId ?? payable[0]?.id}
          defaultFirstName={user?.name?.split(" ")[0] ?? ""}
          onClose={() => setAsking(false)}
        />
      )}
    </PageShell>
  );
}
