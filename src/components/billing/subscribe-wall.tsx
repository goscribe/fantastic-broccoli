"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchPlanCaps,
  fetchPlanOptions,
  switchPlan,
  SESSION_COMPLETED_EVENT,
  PLAN_LIMIT_EVENT,
  type PlanCaps,
  type PlanOption,
  type SessionCompletedDetail,
} from "@/lib/api/account";
import { fetchPlanToday } from "@/lib/api/exam-planner";
import { api } from "@/lib/api/trpc-client";
import { fetchStudySessions } from "@/lib/api/study";
import { hasPlanAccess } from "@/lib/plan-access";
import { planBilling, planCta, planDescription, planDisplayName, planPriceLabel, planTermsLine, planTrialDays } from "@/lib/plan-display";
import {
  claimEndScreenAsk,
  noteWallDecision,
  countCompletedFullSessions,
  examPassPitch,
  freePlanSummary,
  limitSentence,
  paidPerks,
  plural,
  postSessionWallDue,
  wallReason,
  type ExamPitch,
  type WallReason,
  type WallVariant,
} from "@/lib/wall";
import { track } from "@/lib/funnel";
import { useAuthUser } from "@/lib/api/auth";
import { toast } from "@/lib/toast";
import { checkoutFailure } from "@/lib/checkout-failure";
import { handleCheckoutFailure } from "@/lib/checkout-landing";
import { cn } from "@/lib/utils";
import { AskParentLink, PassDisclosure } from "./pass-options";
import { AskParentDialog, payablePlans } from "./ask-parent-dialog";

/** Routes where the wall must never render (billing surfaces, verification). */
const EXEMPT_PREFIXES = ["/pricing", "/settings", "/verify-email"];

/** Delay before the post-session wall opens over a full session's end screen, so its result is read first. */
const POST_SESSION_DELAY_MS = 4000;

/** The post-session wall shows once per user per device. */
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

type WallKind = "limit" | "post-session";

interface OpenWall {
  kind: WallKind;
  reason: WallReason;
  variant: WallVariant;
  message: string | null;
}

/** Completed full sessions across the student's subjects (null when they can't be counted). */
async function completedFullSessions(current: { id: string; quickStart: boolean }): Promise<number | null> {
  try {
    // Every subject the student owns, folders included (the tree's flat list).
    const { workspaces } = await api.workspace.getTree.query();
    const ids = (workspaces as { id: string }[]).map((w) => w.id);
    const lists = await Promise.all(ids.map((id) => fetchStudySessions(id)));
    return countCompletedFullSessions(lists.flat(), current);
  } catch {
    return null;
  }
}

/** The cheapest pass that covers the student's exam date, with its pitch, when there is one. */
async function loadExamPitch(plans: PlanOption[]): Promise<{ pitch: ExamPitch; passId: string } | null> {
  const passes = plans.filter((p) => planBilling(p) === "once").sort((a, b) => a.priceDollars - b.priceDollars);
  if (passes.length === 0) return null;
  try {
    const today = await fetchPlanToday();
    const locale = typeof navigator !== "undefined" ? navigator.language : "en-GB";
    for (const pass of passes) {
      const pitch = examPassPitch(today.exams, pass, today.today, locale);
      if (pitch) return { pitch, passId: pass.id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Full-screen plan picker. Never shown on signup or login. It opens:
 * - "limit": blocking, whenever a request is refused by a free-plan cap,
 *   the monthly allowance or a locked topic (see `announcePlanLimit`), with
 *   the reason in plain words and one-tap plans;
 * - "post-session": once per device, a soft nudge on the end screen of the
 *   student's SECOND completed full session or later (`postSessionWallDue`).
 *   Never on the first win, never on a Quick 5 (its end screen asks for a
 *   study time instead), and never while another ask holds the end screen.
 * Every wall reports `wall.shown {reason, variant}`, then `wall.dismissed`
 * or `wall.trial_started`. Nothing is charged until the user picks a plan
 * and completes hosted checkout (7-day trial first on a subscription when
 * the account hasn't used one).
 */
export function SubscribeWall() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();
  const [caps, setCaps] = useState<PlanCaps | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [pitch, setPitch] = useState<ExamPitch | null>(null);
  const [pitchedPassId, setPitchedPassId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState<OpenWall | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const openRef = useRef<OpenWall | null>(null);

  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!user || user.isAdmin || exempt) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /** Resolves true when the wall will show. */
    const load = async (
      kind: WallKind,
      opts: { message?: string | null; delayMs?: number; session?: { id: string; quickStart: boolean } } = {},
    ): Promise<boolean> => {
      try {
        // A Quick 5's end screen gets the habit prompt, not the wall: decide before fetching anything.
        if (kind === "post-session" && (!opts.session || opts.session.quickStart || postSessionShown(user.id))) return false;
        const [nextCaps, nextPlans] = await Promise.all([fetchPlanCaps(), fetchPlanOptions()]);
        if (cancelled || hasPlanAccess(nextCaps)) return false;
        if (kind === "post-session") {
          // Cheap first check (Quick 5s included), then the real count of full sessions.
          const full = nextCaps.completedSessions >= 2 ? await completedFullSessions(opts.session!) : 0;
          const due = postSessionWallDue({
            quickStart: opts.session!.quickStart,
            completedFullSessions: full,
            alreadyShown: postSessionShown(user.id),
            hasAccess: hasPlanAccess(nextCaps),
          });
          if (!due || cancelled) return false;
        }
        const paidPlans = nextPlans.filter((p) => p.priceDollars > 0);
        const nextPitch = await loadExamPitch(paidPlans);
        if (cancelled) return false;
        const reason: WallReason = kind === "post-session" ? "post_session" : wallReason(opts.message);
        const variant: WallVariant = nextPitch?.pitch
          ? "exam_pass"
          : kind === "post-session"
            ? "post_session"
            : reason === "locked_topic"
              ? "locked"
              : "limit";
        setCaps(nextCaps);
        setPlans(paidPlans);
        setPitch(nextPitch?.pitch ?? null);
        setPitchedPassId(nextPitch?.passId ?? null);
        const reveal = () => {
          if (cancelled) return;
          if (kind === "post-session") {
            // One ask per end screen: the habit prompt keeps it if it got there first.
            if (!claimEndScreenAsk(opts.session!.id, "wall")) return;
            markPostSessionShown(user.id);
          }
          const next = { kind, reason, variant, message: opts.message ?? null };
          openRef.current = next;
          setOpen(next);
          track("wall.shown", { reason, variant });
        };
        if (opts.delayMs && opts.delayMs > 0) timer = setTimeout(reveal, opts.delayMs);
        else reveal();
        return true;
      } catch {
        return false;
      }
    };

    const onCompleted = (event: Event) => {
      const detail = (event as CustomEvent<SessionCompletedDetail | undefined>).detail;
      if (!detail?.sessionId) return;
      // Registered so the end screen's reminder ask knows whether the wall is coming.
      noteWallDecision(
        detail.sessionId,
        load("post-session", {
          delayMs: POST_SESSION_DELAY_MS,
          session: { id: detail.sessionId, quickStart: detail.quickStart === true },
        }),
      );
    };
    const onLimit = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      const message = typeof detail === "string" ? detail : null;
      // Claim it: we show the reason. If the wall can't open (paid user out
      // of this month's allowance, caps failed to load), fall back to a toast
      // in plain words so the refusal is never silent.
      event.preventDefault();
      void load("limit", { message }).then((shown) => {
        if (!shown && message && !cancelled) {
          const text = limitSentence(message) ?? message;
          toast.error(text, { id: text });
        }
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
    track("wall.dismissed", { reason: open.reason, variant: open.variant });
    openRef.current = null;
    setOpen(null);
  };

  const choose = async (plan: PlanOption) => {
    // A pass is not a trial: its tap is told apart by the variant.
    track("wall.trial_started", { reason: open.reason, variant: planBilling(plan) === "once" ? "exam_pass" : open.variant });
    setSwitching(plan.id);
    try {
      await switchPlan(plan.id);
    } catch (err) {
      // The wall closes: the student keeps studying free (or goes into the first run with no subject yet).
      const answer = checkoutFailure(err).kind === "answer";
      if (!answer) {
        openRef.current = null;
        setOpen(null);
      }
      await handleCheckoutFailure(err, router);
    } finally {
      setSwitching(null);
    }
  };

  const byPrice = [...plans].sort((a, b) => a.priceDollars - b.priceDollars);
  const subscriptions = byPrice.filter((p) => planBilling(p) !== "once");
  const passes = byPrice.filter((p) => planBilling(p) === "once");
  const pass = passes.find((p) => p.id === pitchedPassId);
  // With an exam date: the trial and the pass for it side by side. Otherwise the
  // subscriptions as cards, and the passes folded into one "Pay once instead" row.
  const shown = pitch && pass ? [...subscriptions.slice(0, 1), pass] : subscriptions.length ? subscriptions : byPrice;
  const otherPasses = passes.filter((p) => !shown.some((s) => s.id === p.id));
  const payable = payablePlans(plans);
  // Students are price-sensitive: lead with the cheapest subscription (the trial).
  const featured = subscriptions[0] ?? byPrice[0];
  const freeCaps = caps?.caps ?? null;
  const used = caps?.used;
  const trialDays = caps?.trialDays ?? 0;
  const postSession = open.kind === "post-session";
  const hasTrialPlan = shown.some((p) => planTrialDays(p, trialDays) > 0);
  const hasOneOffPlan = shown.some((p) => planBilling(p) === "once");
  const limitDetail = limitSentence(open.message, { caps: freeCaps });
  const fromPrice = subscriptions[0] && planBilling(subscriptions[0]) === "month" ? `$${subscriptions[0].priceDollars} a month` : null;
  const eyebrow = postSession
    ? `Nice work, ${user.name.split(" ")[0] || "you"}`
    : open.reason === "locked_topic"
      ? "Included with a plan"
      : open.reason === "plan_limit_workspaces" && freeCaps
        ? `Free plan: ${plural(freeCaps.workspaces, "subject", "subjects")}`
        : "That's the free plan's limit";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscribe-wall-title"
      className="fixed inset-0 z-[200] flex overflow-y-auto bg-background/95 px-4 py-8 backdrop-blur-md"
    >
      <div className="m-auto w-full max-w-4xl">
        <div className="text-center">
          <p className="text-[14px] font-extrabold text-muted-foreground">{eyebrow}</p>
          <h1
            id="subscribe-wall-title"
            className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[36px]"
          >
            {postSession
              ? "Want to keep this pace every day?"
              : pitch
                ? `Keep going until your exam on ${pitch.dateLabel}`
                : fromPrice
                  ? `Keep going from ${fromPrice}`
                  : "Keep going"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground sm:text-[16px]">
            {postSession ? (
              <>
                {freeCaps ? (
                  <>
                    The free plan is <strong className="text-foreground">{freePlanSummary(freeCaps)}</strong>.
                    {used && ` You've started ${used.studySessions} of ${freeCaps.studySessions} full sessions.`}
                  </>
                ) : (
                  "The free plan is one Quick 5 a day and a few full study sessions."
                )}{" "}
                More sessions and our strongest AI are one tap away
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
            shown.length > 1 ? "sm:grid-cols-2" : "sm:max-w-md sm:mx-auto",
            shown.length > 2 && "lg:grid-cols-3",
          )}
        >
          {shown.map((plan) => {
            const isFeatured = plan.id === featured?.id;
            const isPass = planBilling(plan) === "once";
            const pitched = isPass && pitch;
            // Only a subscription has a trial; the pay-once pass is charged today and never renews.
            const planTrial = planTrialDays(plan, trialDays);
            const price = planPriceLabel(plan);
            const description = pitched ? pitch.headline : planDescription(plan);
            return (
              <div
                key={plan.id}
                className={cn("life-card relative flex flex-col p-6", (isFeatured || pitched) && "border-border-strong")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[18px] font-extrabold">{planDisplayName(plan.name)}</p>
                  {isFeatured && <span className="shrink-0 text-[13px] font-bold text-muted-foreground">Student price</span>}
                  {pitched && <span className="shrink-0 text-[13px] font-bold text-muted-foreground">For your exam</span>}
                </div>
                {description && <p className="mt-1 text-[14px] text-muted-foreground">{description}</p>}
                <p className="mt-4 text-[36px] font-extrabold leading-none tracking-tight tabular-nums">
                  {planTrial > 0 ? "$0" : price.amount}
                  <span className="text-[14px] font-semibold tracking-normal text-muted-foreground">{planTrial > 0 ? " today" : price.suffix}</span>
                </p>
                <p className="mt-2 min-h-[2.6em] text-[13px] leading-snug text-muted-foreground">{planTermsLine(plan, trialDays, { afterZeroToday: true })}</p>
                <ul className="mt-4 space-y-2.5 text-[14px]">
                  {paidPerks(plan, { examLine: pitched ? pitch.line : null }).map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.6} />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  variant={isFeatured ? "primary" : "secondary"}
                  className="mt-6 w-full"
                  disabled={switching !== null}
                  onClick={() => choose(plan)}
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
        {(otherPasses.length > 0 || payable.length > 0) && (
          <div className="mx-auto mt-4 max-w-md space-y-1">
            <PassDisclosure passes={otherPasses} busyId={switching} onBuy={(id) => {
              const plan = plans.find((p) => p.id === id);
              if (plan) void choose(plan);
            }} />
            {payable.length > 0 && <AskParentLink onOpen={() => setAsking(true)} />}
          </div>
        )}
        {subscriptions.some((p) => !shown.includes(p)) && (
          <p className="mt-2 text-center text-[13px]">
            <Link href="/pricing" onClick={dismiss} className="font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">
              See all plans
            </Link>
          </p>
        )}

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
      {asking && (
        <AskParentDialog
          plans={payable}
          defaultPlanId={pitchedPassId ?? payable[0]?.id}
          defaultFirstName={user.name.split(" ")[0] ?? ""}
          onClose={() => setAsking(false)}
        />
      )}
    </div>
  );
}
