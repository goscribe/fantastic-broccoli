"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Sparkles, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlanCaps,
  fetchPlanOptions,
  switchPlan,
  SESSION_COMPLETED_EVENT,
  type PlanCaps,
  type PlanOption,
} from "@/lib/api/account";
import { useAuthUser } from "@/lib/api/auth";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Seconds the "continue free" link stays locked after the wall appears. */
const FREE_LINK_DELAY_S = 5;

/** Routes where the wall must never render (billing surfaces, verification). */
const EXEMPT_PREFIXES = ["/pricing", "/settings", "/verify-email"];

/** Delay before the post-session wall covers the debrief the learner just earned. */
const POST_SESSION_DELAY_MS = 4000;

/** One dismissal per user per browser tab — the wall comes back on the next login. */
const dismissedKey = (userId: string) => `scribe-subscribe-wall-dismissed:${userId}`;
/** The "you finished your first session" wall shows once per user per device. */
const postSessionKey = (userId: string) =>
  `scribe-subscribe-wall-post-session:${userId}`;

function wasDismissed(userId: string): boolean {
  try {
    return sessionStorage.getItem(dismissedKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(userId: string) {
  try {
    sessionStorage.setItem(dismissedKey(userId), "1");
  } catch {
    // Storage unavailable; the wall simply re-shows.
  }
}

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

type WallVariant = "signup" | "post-session";

const PAID_PERKS = [
  "Unlimited workspaces, study sessions and tests",
  "Strongest AI model on every activity",
  "Thousands of tokens a month — study daily, not once",
  "Daily recall sessions built from what you missed",
];

/**
 * Full-screen plan picker shown to every free-plan user on first load after
 * signup and again on each new login until they pick a paid plan, plus once
 * more right after their first completed study session. Nothing is charged
 * until the user picks a plan and completes Stripe checkout (7-day trial
 * first when the account hasn't used one).
 */
export function SubscribeWall() {
  const pathname = usePathname();
  const { user } = useAuthUser();
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [open, setOpen] = useState<WallVariant | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(FREE_LINK_DELAY_S);
  const [switching, setSwitching] = useState<string | null>(null);

  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!user || user.isAdmin || exempt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = (variant: WallVariant, delayMs = 0) =>
      Promise.all([fetchPlanCaps(), fetchPlanOptions()])
        .then(([nextCaps, nextPlans]) => {
          if (cancelled || nextCaps.paid) return;
          const show =
            variant === "post-session"
              ? nextCaps.completedSessions >= 1 && !postSessionShown(user.id)
              : !wasDismissed(user.id);
          if (!show) return;
          setCaps(nextCaps);
          setPlans(nextPlans.filter((p) => p.priceDollars > 0));
          const reveal = () => {
            if (cancelled) return;
            if (variant === "post-session") markPostSessionShown(user.id);
            setSecondsLeft(FREE_LINK_DELAY_S);
            setOpen(variant);
          };
          if (delayMs > 0) timer = setTimeout(reveal, delayMs);
          else reveal();
        })
        .catch(() => {});

    // Login wall first; if it was already dismissed and the learner has
    // finished a session since, ask again.
    if (!wasDismissed(user.id)) load("signup");
    else if (!postSessionShown(user.id)) load("post-session");

    const onCompleted = () => {
      if (!postSessionShown(user.id)) load("post-session", POST_SESSION_DELAY_MS);
    };
    window.addEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    };
  }, [user, exempt]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const timer = setInterval(
      () => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)),
      1000,
    );
    return () => {
      clearInterval(timer);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !user || exempt) return null;

  const dismiss = () => {
    markDismissed(user.id);
    setOpen(null);
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

  const featured =
    plans.find((p) => /pro/i.test(p.name)) ?? plans[plans.length - 1];
  const freeCaps = caps?.caps;
  const trialDays = caps?.trialDays ?? 0;
  const postSession = open === "post-session";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-wall-title"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-background/95 px-4 py-8 backdrop-blur-md"
    >
      <div className="w-full max-w-4xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            {postSession ? (
              <>
                <Trophy className="h-3.5 w-3.5" />
                First session done, {user.name.split(" ")[0] || "nice"}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Welcome to Scribe, {user.name.split(" ")[0] || "there"}
              </>
            )}
          </span>
          <h1
            id="subscribe-wall-title"
            className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {postSession
              ? "That was your one free session. Keep the streak going?"
              : trialDays > 0
                ? `Start your ${trialDays}-day free trial`
                : "Pick your plan to start studying"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            {postSession ? (
              <>
                The free plan stops here:{" "}
                <strong className="text-foreground">
                  {freeCaps?.studySessions ?? 1} study session,{" "}
                  {freeCaps?.workspaces ?? 1} workspace, {freeCaps?.flashcardTests ?? 1}{" "}
                  test
                </strong>
                . Tomorrow&apos;s recall session, unlimited sessions and the
                strongest AI are one tap away
                {trialDays > 0 ? ` — free for ${trialDays} days.` : "."}
              </>
            ) : (
              <>
                The free plan stops at{" "}
                <strong className="text-foreground">
                  {freeCaps?.workspaces ?? 1} workspace, {freeCaps?.studySessions ?? 1}{" "}
                  study session and {freeCaps?.flashcardTests ?? 1} test
                </strong>
                . Serious about your grades? Go unlimited and get the strongest
                AI on every question
                {trialDays > 0 ? ` — try it free for ${trialDays} days.` : "."}
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
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-3xl border p-6",
                  isFeatured
                    ? "border-accent bg-card shadow-xl shadow-accent/20 ring-2 ring-accent"
                    : "border-border bg-card/80",
                )}
              >
                {isFeatured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
                    <Zap className="h-3 w-3" />
                    Most popular
                  </span>
                )}
                <p className="text-lg font-semibold">{plan.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <p className="mt-4 text-4xl font-bold tracking-tight">
                  {trialDays > 0 ? "$0" : `$${plan.priceDollars}`}
                  <span className="text-sm font-normal text-faint">
                    {trialDays > 0 ? " today" : " / month"}
                  </span>
                </p>
                {trialDays > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    then ${plan.priceDollars}/month after {trialDays} days —
                    cancel anytime before, pay nothing
                  </p>
                )}
                <ul className="mt-5 space-y-2.5 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {plan.monthlyTokens.toLocaleString()} tokens every month
                  </li>
                  {PAID_PERKS.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={isFeatured ? "primary" : "outline"}
                  className="mt-6 w-full"
                  disabled={switching !== null}
                  onClick={() => choose(plan.id)}
                >
                  {switching === plan.id
                    ? "Opening checkout…"
                    : trialDays > 0
                      ? `Start ${trialDays}-day free trial`
                      : `Get ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          {trialDays > 0
            ? `Card required · $0 today · billing starts after ${trialDays} days unless you cancel · secure checkout by Stripe`
            : "Secure checkout by Stripe · cancel anytime"}
        </p>

        <div className="mt-8 flex justify-center">
          {secondsLeft > 0 ? (
            <span className="text-xs text-faint">
              Free plan available in {secondsLeft}s…
            </span>
          ) : (
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-faint underline-offset-2 hover:text-muted-foreground hover:underline"
            >
              {postSession
                ? "Not now, I'll stay on the limited free plan"
                : "No thanks, I'll stay on the limited free plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
