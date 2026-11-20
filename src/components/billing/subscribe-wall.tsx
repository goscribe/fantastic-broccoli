"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Lock, Trophy, Zap } from "lucide-react";
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
import { useAuthUser } from "@/lib/api/auth";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { AskParentLink, PassDisclosure } from "./pass-options";
import Link from "next/link";
import { AskParentDialog } from "./ask-parent-dialog";


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
  const [asking, setAsking] = useState(false);

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

  // Monthly plans as cards; exam passes ("pay once") as their own block below.
  const monthly = plans.filter((p) => p.kind !== "pass");
  const passes = plans.filter((p) => p.kind === "pass");
  // Students are price-sensitive: lead with the cheapest paid plan.
  const featured = [...monthly].sort((a, b) => a.priceDollars - b.priceDollars)[0];
  const freeCaps = caps?.caps;
  const trialDays = caps?.trialDays ?? 0;
  const postSession = open === "post-session";
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
      className="fixed inset-0 z-[200] flex justify-center overflow-y-auto bg-background/95 px-4 py-5 backdrop-blur-md sm:py-8"
    >
      <div className="my-auto w-full max-w-4xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            {postSession ? (
              <>
                <Trophy className="h-3.5 w-3.5" />
                First session done, {user.name.split(" ")[0] || "nice"}
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                You&apos;ve used up the free plan
              </>
            )}
          </span>
          <h1
            id="subscribe-wall-title"
            className="mt-3 text-2xl font-bold tracking-tight sm:mt-4 sm:text-4xl"
          >
            {postSession
              ? "Nice work. Want to keep this pace every day?"
              : "Keep going — from $5 a month"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-[13px] text-muted-foreground sm:mt-3 sm:text-base">
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
                {trialDays > 0 ? ` — the first ${trialDays} days are free.` : "."}
              </>
            )}
          </p>
        </div>

        <div
          className={cn(
            "mt-6 grid gap-4 sm:mt-8",
            monthly.length > 1 ? "sm:grid-cols-2" : "sm:max-w-md sm:mx-auto",
          )}
        >
          {monthly.map((plan) => {
            const isFeatured = plan.id === featured?.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex-col rounded-3xl border p-5 sm:p-6",
                  // Phones show only the featured plan here; the rest are on /pricing.
                  isFeatured
                    ? "flex border-accent bg-card shadow-xl shadow-accent/20 ring-2 ring-accent"
                    : "hidden border-border bg-card/80 sm:flex",
                )}
              >
                {isFeatured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">
                    <Zap className="h-3 w-3" />
                    Student price
                  </span>
                )}
                <p className="text-lg font-semibold capitalize">{plan.name}</p>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                  {plan.description}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight sm:mt-4 sm:text-4xl">
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
                <ul className="mt-3 space-y-2 text-sm sm:mt-5 sm:space-y-2.5">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {plan.monthlyTokens.toLocaleString()} tokens every month
                  </li>
                  {PAID_PERKS.map((perk, i) => (
                    // Two lines on a phone keep the plan, its button and the
                    // other ways to pay on the first screen.
                    <li key={perk} className={cn("items-start gap-2", i === 0 ? "flex" : "hidden sm:flex")}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={isFeatured ? "primary" : "outline"}
                  className="mt-4 w-full sm:mt-6"
                  disabled={switching !== null}
                  onClick={() => choose(plan.id)}
                >
                  {switching === plan.id
                    ? "Opening checkout…"
                    : trialDays > 0
                      ? `Start ${trialDays}-day free trial`
                      : `Get ${plan.name.charAt(0).toUpperCase()}${plan.name.slice(1)}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-3 max-w-md space-y-2.5 sm:mt-4">
          <PassDisclosure passes={passes} busyId={switching} onBuy={choose} />
          <AskParentLink onOpen={() => setAsking(true)} />
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          {trialDays > 0
            ? `Card required · $0 today · billing starts after ${trialDays} days unless you cancel · secure hosted checkout`
            : "Secure hosted checkout · cancel anytime"}
        </p>

        <div className="mt-6 flex items-center justify-center gap-4 sm:mt-8">
          {monthly.length > 1 && (
            <Link
              href="/pricing"
              className="text-xs text-faint underline-offset-2 hover:text-muted-foreground hover:underline sm:hidden"
            >
              All plans
            </Link>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-faint underline-offset-2 hover:text-muted-foreground hover:underline"
          >
            {postSession ? "Not now, keep studying free" : "Not now"}
          </button>
        </div>
      </div>
      {asking && (
        <AskParentDialog
          plans={[...passes, ...monthly.filter((p) => p.id === featured?.id)]}
          defaultPlanId={passes[0]?.id ?? featured?.id}
          defaultFirstName={user.name.split(" ")[0] ?? ""}
          onClose={() => setAsking(false)}
        />
      )}
    </div>
  );
}
