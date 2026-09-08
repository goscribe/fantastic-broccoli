"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlanCaps,
  fetchPlanOptions,
  switchPlan,
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

/** One dismissal per user per browser tab — the wall comes back on the next login. */
const dismissedKey = (userId: string) => `scribe-subscribe-wall-dismissed:${userId}`;

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

const PAID_PERKS = [
  "Unlimited workspaces, study sessions and tests",
  "Strongest AI model on every activity",
  "Thousands of tokens a month — study daily, not once",
  "Daily recall sessions built from what you missed",
];

/**
 * Full-screen plan picker shown to every free-plan user on first load after
 * signup and again on each new login until they pick a paid plan. Nothing is
 * charged until the user picks a plan and completes Stripe checkout.
 */
export function SubscribeWall() {
  const pathname = usePathname();
  const { user } = useAuthUser();
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(FREE_LINK_DELAY_S);
  const [switching, setSwitching] = useState<string | null>(null);

  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!user || user.isAdmin || exempt || wasDismissed(user.id)) return;
    let cancelled = false;
    Promise.all([fetchPlanCaps(), fetchPlanOptions()])
      .then(([nextCaps, nextPlans]) => {
        if (cancelled || nextCaps.paid) return;
        setCaps(nextCaps);
        setPlans(nextPlans.filter((p) => p.priceDollars > 0));
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
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
    setOpen(false);
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
            <Sparkles className="h-3.5 w-3.5" />
            Welcome to Scribe, {user.name.split(" ")[0] || "there"}
          </span>
          <h1
            id="subscribe-wall-title"
            className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Pick your plan to start studying
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            The free plan stops at{" "}
            <strong className="text-foreground">
              {freeCaps?.workspaces ?? 1} workspace, {freeCaps?.studySessions ?? 1}{" "}
              study session and {freeCaps?.flashcardTests ?? 1} test
            </strong>
            . Serious about your grades? Go unlimited and get the strongest AI
            on every question.
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
                  ${plan.priceDollars}
                  <span className="text-sm font-normal text-faint"> / month</span>
                </p>
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
                    : `Get ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          Secure checkout by Stripe · cancel anytime
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
              No thanks, I&apos;ll stay on the limited free plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
