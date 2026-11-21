"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlanCaps,
  fetchPlanOptions,
  switchPlan,
  SESSION_COMPLETED_EVENT,
  PLAN_LIMIT_EVENT,
  PLAN_LIMIT_ERROR_PREFIX,
  type PlanCaps,
  type PlanOption,
} from "@/lib/api/account";
import { hasPlanAccess } from "@/lib/plan-access";
import { planBilling, planCta, planDescription, planDisplayName, planPriceLabel, planTermsLine, planTrialDays } from "@/lib/plan-display";
import { useAuthUser } from "@/lib/api/auth";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";


/** Routes where the wall must never render (billing surfaces, verification). */
const EXEMPT_PREFIXES = ["/pricing", "/settings", "/verify-email"];

/** Delay before the post-session wall covers the debrief the learner just earned. */
const POST_SESSION_DELAY_MS = 4000;

/** The "you finished your first session" wall shows once per user per device. */
const postSessionKey = (userId: string) =>
  `scribe-subscribe-wall-post-session:${userId}`;

function postSessionShown(userId: string): boolean {
  try {
    return localStorage.getItem(postSessionKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markPostSessionShown(userId: string) {
  try {
    localStorage.setItem(postSessionKey(userId), "1");
  } catch {
    // Storage unavailable; the wall simply re-shows.
  }
}

type WallVariant = "limit" | "post-session";

const PAID_PERKS = [
  "Unlimited workspaces, study sessions and tests",
  "Strongest AI model on every activity",
  "Spaced review that brings back what you'd forget",
  "Daily recall sessions built from what you missed",
];

/**
 * Full-screen plan picker. Never shown on signup or login (that sent most
 * new users away before they tried anything). It opens:
 * - "limit": blocking, whenever a request is refused by a free-plan cap or
 *   runs out of tokens (see `toastError` → `announcePlanLimit`), with the
 *   server's reason and one-tap plans;
 * - "post-session": once per device, a soft nudge after the first completed
 *   study session.
 * Nothing is charged until the user picks a plan and completes hosted
 * checkout (7-day trial first when the account hasn't used one).
 */
export function SubscribeWall() {
  const pathname = usePathname();
  const { user } = useAuthUser();
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [open, setOpen] = useState<WallVariant | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!user || user.isAdmin || exempt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /** Resolves true when the wall will show. */
    const load = (variant: WallVariant, delayMs = 0): Promise<boolean> =>
      Promise.all([fetchPlanCaps(), fetchPlanOptions()])
        .then(([nextCaps, nextPlans]) => {
          if (cancelled || hasPlanAccess(nextCaps)) return false;
          if (
            variant === "post-session" &&
            (nextCaps.completedSessions < 1 || postSessionShown(user.id))
          ) {
            return false;
          }
          setCaps(nextCaps);
          setPlans(nextPlans.filter((p) => p.priceDollars > 0));
          const reveal = () => {
            if (cancelled) return;
            if (variant === "post-session") markPostSessionShown(user.id);
            setOpen(variant);
          };
          if (delayMs > 0) timer = setTimeout(reveal, delayMs);
          else reveal();
          return true;
        })
        .catch(() => false);

    const onCompleted = () => load("post-session", POST_SESSION_DELAY_MS);
    const onLimit = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      const message = typeof detail === "string" ? detail : null;
      // Claim it: we show the reason. If the wall can't open (paid user out
      // of tokens, caps failed to load), fall back to the server's message
      // so the refusal is never silent.
      event.preventDefault();
      setReason(message);
      void load("limit").then((shown) => {
        if (!shown && message && !cancelled) toast.error(message, { id: message });
      });
    };
    window.addEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(SESSION_COMPLETED_EVENT, onCompleted);
      window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
    };
  }, [user, exempt]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !user || exempt) return null;

  const dismiss = () => {
    setOpen(null);
    setReason(null);
  };

  const choose = async (planId: string) => {
    setSwitching(planId);
    try {
      await switchPlan(planId);
    } catch (err) {
      toastError(err, "Could not start checkout. Please try again.");
    } finally {
      setSwitching(null);
    }
  };

  // Students are price-sensitive: lead with the cheapest paid plan.
  const featured = [...plans].sort((a, b) => a.priceDollars - b.priceDollars)[0];
  const freeCaps = caps?.caps;
  const trialDays = caps?.trialDays ?? 0;
  const postSession = open === "post-session";
  const hasTrialPlan = plans.some((p) => planTrialDays(p, trialDays) > 0);
  const hasOneOffPlan = plans.some((p) => planBilling(p) === "once");
  const rawDetail = reason?.startsWith(PLAN_LIMIT_ERROR_PREFIX)
    ? reason.slice(PLAN_LIMIT_ERROR_PREFIX.length).replace(/^[:\s]+/, "")
    : reason;
  // Keep the server's first sentence (what ran out); the upsell is on this screen already.
  const firstSentence = rawDetail?.split(/(?<=\.)\s/)[0];
  const limitDetail = firstSentence
    ? firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-wall-title"
      className="fixed inset-0 z-[200] flex overflow-y-auto bg-background/95 px-4 py-8 backdrop-blur-md"
    >
      <div className="m-auto w-full max-w-4xl">
        <div className="text-center">
          <p className="text-[14px] font-extrabold text-accent">
            {postSession ? <>First session done, {user.name.split(" ")[0] || "nice"}</> : <>You&apos;ve used up the free plan</>}
          </p>
          <h1
            id="subscribe-wall-title"
            className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[36px]"
          >
            {postSession
              ? "Nice work. Want to keep this pace every day?"
              : "Keep going — from $5 a month"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground sm:text-[16px]">
            {postSession ? (
              <>
                The free plan is{" "}
                <strong className="text-foreground">
                  one Quick 5 a day, {freeCaps?.studySessions ?? 1} full study
                  session, {freeCaps?.workspaces ?? 1} workspace and{" "}
                  {freeCaps?.flashcardTests ?? 1} test
                </strong>
                . Unlimited sessions right now and the strongest AI are one tap
                away
                {trialDays > 0 ? ` — free for ${trialDays} days.` : "."}
              </>
            ) : (
              <>
                {limitDetail ?? "That's as far as the free plan goes."}{" "}
                Pick a plan to keep studying right now
                {!hasTrialPlan ? "." : hasOneOffPlan ? `. Subscriptions start with ${trialDays} days free.` : ` — the first ${trialDays} days are free.`}
              </>
            )}
          </p>
        </div>

        <div
          className={cn(
            "mt-8 grid gap-4",
            plans.length > 1 ? "sm:grid-cols-2" : "sm:max-w-md sm:mx-auto",
          )}
        >
          {plans.map((plan) => {
            const isFeatured = plan.id === featured?.id;
            // Only a subscription has a trial; the pay-once pass is charged today and never renews.
            const planTrial = planTrialDays(plan, trialDays);
            const price = planPriceLabel(plan);
            const description = planDescription(plan);
            return (
              <div
                key={plan.id}
                className={cn("life-card relative flex flex-col p-6", isFeatured && "border-accent ring-1 ring-accent")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[18px] font-extrabold">{planDisplayName(plan.name)}</p>
                  {isFeatured && <span className="shrink-0 text-[13px] font-extrabold text-accent">Student price</span>}
                </div>
                {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
                <p className="mt-4 text-[36px] font-extrabold leading-none tracking-tight tabular-nums">
                  {planTrial > 0 ? "$0" : price.amount}
                  <span className="text-[14px] font-semibold tracking-normal text-muted-foreground">{planTrial > 0 ? " today" : price.suffix}</span>
                </p>
                <p className="mt-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground">{planTermsLine(plan, trialDays, { afterZeroToday: true })}</p>
                <ul className="mt-4 space-y-2.5 text-[14px]">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.6} />
                    {plan.monthlyTokens.toLocaleString()} tokens every month
                  </li>
                  {PAID_PERKS.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.6} />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={isFeatured ? "primary" : "secondary"}
                  className="mt-6 w-full"
                  disabled={switching !== null}
                  onClick={() => choose(plan.id)}
                >
                  {switching === plan.id ? "Opening checkout…" : planCta(plan, trialDays)}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          {[
            hasTrialPlan ? `Free trial: card required, $0 today, billing starts after ${trialDays} days unless you cancel` : null,
            hasOneOffPlan ? "A pass is one payment today, with no renewal" : null,
            hasTrialPlan ? "Secure hosted checkout" : "Secure hosted checkout, cancel anytime",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 px-3 text-[14px] font-bold text-muted-foreground hover:text-foreground"
          >
            {postSession ? "Not now, keep studying free" : "Not now"}
          </button>
        </div>
      </div>
    </div>
  );
}
