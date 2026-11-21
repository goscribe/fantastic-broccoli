"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { ItemDots, MarkBadge, playLink, playQuiet } from "@/components/session/play-ui";
import { TryCat } from "@/components/try/try-cat";
import { MathText } from "@/components/ui/markdown-text";
import { useAuthUser } from "@/lib/api/auth";
import { claimTry, clearPendingTry, fetchTry, submitTry, type TryAttempt } from "@/lib/api/anon";
import { SESSION_COMPLETED_EVENT } from "@/lib/api/account";
import { reportActivationConversion } from "@/lib/gtag";
import { getReferral } from "@/lib/attribution";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/try";
import { scoreTone, trySignupHref } from "@/lib/try";
import { cn } from "@/lib/utils";

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

/** The one purple thing on a screen: the session player's chunky button. */
const primary =
  "btn-chunky inline-flex h-[52px] w-full touch-manipulation items-center justify-center rounded-[var(--r-button)] bg-accent px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-accent-dim disabled:opacity-40 disabled:shadow-none sm:w-auto sm:min-w-[220px]";

function Shell({ children, attemptId, showSave }: { children: React.ReactNode; attemptId: string; showSave: boolean }) {
  const { t } = useI18n();
  return (
    <div className="design-root app-brand min-h-dvh bg-white text-foreground">
      <header className="mx-auto flex min-h-11 w-full max-w-2xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
        {showSave && (
          <Link href={trySignupHref(attemptId, { ref: getReferral() })} className={playLink}>
            {t("try.saveProgress")}
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

/**
 * One question at a time, in the session player's own look (the question on
 * the page, soft lettered answer pills, no panel). Each answer is marked as
 * soon as it's tapped; the "why" is what the free account unlocks.
 */
function Quiz({ attempt, onFinished }: { attempt: TryAttempt; onFinished: (answers: (number | null)[]) => void }) {
  const { t } = useI18n();
  const qs = attempt.questions;
  const [answers, setAnswers] = useState<(number | null)[]>(() => qs.map((_, i) => attempt.answers[i] ?? null));
  const [index, setIndex] = useState(() => {
    const next = answers.findIndex((a) => a === null);
    return next === -1 ? qs.length - 1 : next;
  });
  const q = qs[index];
  const answer = answers[index];
  const answered = answer !== null;
  const right = answer === q.correctIndex;
  const last = index === qs.length - 1;
  const signup = trySignupHref(attempt.id, { ref: getReferral() });

  const pick = (option: number) => {
    if (answered) return;
    const next = answers.map((a, i) => (i === index ? option : a));
    setAnswers(next);
    // Progress is saved so signing up mid-quiz keeps it; failures don't block the quiz.
    void submitTry(attempt.id, next, false).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">
          {fill(t("try.questionOf"), { n: index + 1, total: qs.length })}
        </p>
        <ItemDots current={index} states={qs.map((item, i) => (answers[i] === null ? "todo" : answers[i] === item.correctIndex ? "right" : "wrong"))} />
      </div>
      <p key={`q-${index}`} className="life-rise text-[20px] font-extrabold leading-[1.3] sm:text-[22px]">
        <MathText text={q.question} />
      </p>
      <ul key={`o-${index}`} className="life-rise space-y-3" style={{ ["--i" as string]: 1 }}>
        {q.options.map((opt, i) => {
          const isRight = i === q.correctIndex;
          const isPicked = i === answer;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={answered}
                onClick={() => pick(i)}
                className={cn(
                  "min-h-[60px] w-full touch-manipulation rounded-[30px] px-3.5 py-3 text-left text-[15.5px] font-semibold leading-snug text-foreground ring-inset transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-4",
                  !answered && "bg-muted hover:bg-[var(--edge)]",
                  answered && isRight && "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500",
                  answered && isPicked && !isRight && "life-shake bg-rose-50 text-rose-900 ring-2 ring-rose-400",
                  answered && !isRight && !isPicked && "bg-muted opacity-55",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[13.5px] font-extrabold",
                      answered && isRight ? "bg-emerald-600 text-white" : answered && isPicked ? "bg-rose-600 text-white" : "bg-card text-foreground",
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <MathText text={opt} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        // No panel: the result sits on the page under the answers, as in the session player.
        <div className={cn("relative pb-2 pt-4", right ? "design-bounce" : "life-rise")} role="status">
          <TryCat pose={right ? "cheer" : "think"} className={cn("pointer-events-none absolute right-0 top-3 h-[58px] sm:h-[76px]", right && "cat-cheer")} />
          <div className="flex items-center gap-3 pr-16 sm:pr-20">
            <MarkBadge ok={right} />
            <span className={cn("text-[20px] font-extrabold", right ? "text-emerald-800" : "text-rose-800")}>{t(right ? "try.correct" : "try.incorrect")}</span>
          </div>
          <p className="mt-2.5">
            <Link href={signup} className={playLink}>
              {t("try.whyLocked")}
              <span className="font-semibold text-muted-foreground">· {t("try.whyLockedHint")}</span>
            </Link>
          </p>
          <div className="mt-3 flex sm:justify-end">
            <button type="button" onClick={() => (last ? onFinished(answers) : setIndex(index + 1))} className={primary}>
              {t(last ? "try.seeResults" : "try.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Results, in the end-of-session screen's language: the scene with the cat
 * and the score, then the one ask on the page itself (save your results),
 * then each answer as its own card.
 */
function Results({ attempt }: { attempt: TryAttempt }) {
  const { t } = useI18n();
  const total = attempt.questions.length;
  const correct = attempt.correct ?? attempt.questions.filter((q, i) => attempt.answers[i] === q.correctIndex).length;
  const tone = scoreTone(correct, total);
  const ref = getReferral();
  return (
    <div>
      <section
        className="hero-card life-rise relative isolate w-full overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-5 pt-[176px] sm:min-h-[292px] sm:px-9 sm:pb-8 sm:pt-8"
        aria-labelledby="try-score-title"
      >
        <div aria-hidden className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[160px] sm:inset-0 sm:h-auto">
          <div className="absolute bottom-[20px] left-1/2 h-[118px] -translate-x-1/2 sm:bottom-[7%] sm:left-auto sm:right-[9%] sm:h-[196px] sm:translate-x-0">
            <span className="hero-field__ground" />
            <TryCat pose={tone === "great" ? "trophy" : tone === "good" ? "cheer" : "think"} priority className={cn("relative h-full", tone === "keep" ? "cat-peek" : "cat-cheer")} />
          </div>
        </div>
        <p className="hero-eyebrow relative text-[13.5px] font-extrabold line-clamp-1 sm:max-w-[58%]">
          <MathText text={attempt.title} /> · Quick 5
        </p>
        <h1 id="try-score-title" className="relative mt-1.5 text-balance text-[30px] font-extrabold leading-[1.08] tracking-tight sm:max-w-[58%] sm:text-[38px]">
          {t(tone === "great" ? "try.toneGreat" : tone === "good" ? "try.toneGood" : "try.toneKeep")}
        </h1>
        <p className="relative mt-4 flex items-baseline gap-3 sm:mt-6" role="status">
          <span className="finish-score text-[60px] font-extrabold leading-[0.9] tracking-tight tabular-nums sm:text-[76px]" aria-hidden>
            {correct}/{total}
          </span>
          <span className="text-[15px] font-bold leading-tight text-foreground/75">{fill(t("try.resultsScore"), { correct, total })}</span>
        </p>
      </section>

      <section className="life-rise mt-6 px-1 sm:mt-8" style={{ ["--i" as string]: 1 }}>
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-[24px]">{t("try.saveTitle")}</h2>
        <p className="mt-1.5 max-w-xl text-[15.5px] font-semibold leading-snug text-muted-foreground">{fill(t("try.saveBody"), { title: attempt.title })}</p>
        <div className="mt-4 flex flex-col gap-x-5 gap-y-1 sm:flex-row sm:items-center">
          <Link href={trySignupHref(attempt.id, { ref })} className={primary}>
            {t("try.saveCta")}
          </Link>
          <Link href={trySignupHref(attempt.id, { login: true, ref })} className={cn(playLink, "justify-center")}>
            {t("try.haveAccount")}
          </Link>
        </div>
        <p className="mt-2 text-center text-[13px] font-semibold text-muted-foreground sm:text-left">{t("try.saveFootnote")}</p>
      </section>

      <h2 className="mt-9 px-1 text-[13.5px] font-extrabold text-muted-foreground">{t("try.reviewHeading")}</h2>
      <ol className="mt-2.5 space-y-3">
        {attempt.questions.map((q, i) => {
          const pick = attempt.answers[i];
          const right = pick === q.correctIndex;
          return (
            <li key={i} className="life-rise rounded-[var(--r-card)] border border-border bg-card p-4 shadow-[var(--card-shadow)] sm:p-5" style={{ ["--i" as string]: i + 2 }}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white", right ? "bg-emerald-600" : "bg-rose-600")} aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none">
                    <path d={right ? "M5 12.5l4.5 4.5L19 7.5" : "M7 7l10 10M17 7L7 17"} stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-bold leading-snug">
                    <MathText text={q.question} />
                  </p>
                  <p className="mt-1.5 text-[14px] text-muted-foreground">
                    {t("try.yourAnswer")}:{" "}
                    <span className={cn("font-bold", right ? "text-emerald-800" : "text-rose-800")}>
                      {pick === null ? t("try.skipped") : <MathText text={q.options[pick] ?? ""} />}
                    </span>
                  </p>
                  {!right && (
                    <p className="mt-0.5 text-[14px] text-muted-foreground">
                      {t("try.rightAnswer")}: <span className="font-bold text-foreground"><MathText text={q.options[q.correctIndex] ?? ""} /></span>
                    </p>
                  )}
                  <Link href={trySignupHref(attempt.id, { ref })} className={cn(playLink, "-mb-2 mt-0.5 min-h-10 text-[13.5px]")}>
                    {t("try.explanationLocked")}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <Link href="/landing#try" className={playQuiet}>
          {t("try.makeAnother")}
        </Link>
      </div>
    </div>
  );
}

/**
 * An anonymous Quick 5 (/try/<id>): the quiz, then results with "save your
 * results and see why". Signup sends the visitor back here; signed in, the
 * attempt is claimed into their account and they land on the same quiz's
 * results screen inside the app.
 */
export default function TryAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuthUser();
  const [claimState, setClaimState] = useState<"idle" | "claiming" | "failed" | "gone">("idle");
  const claimStarted = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["try", attemptId],
    queryFn: () => fetchTry(attemptId),
    retry: false,
    staleTime: 60_000,
  });

  const claim = async () => {
    if (!user) return;
    setClaimState("claiming");
    try {
      const { workspaceId, sessionId } = await claimTry(attemptId);
      clearPendingTry();
      const finished = data?.finished ?? true;
      if (finished) {
        // The claimed Quick 5 is their first finished session: activation.
        reportActivationConversion(user.id);
        window.dispatchEvent(new Event(SESSION_COMPLETED_EVENT));
      }
      router.replace(`/workspace/${workspaceId}/session/${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/expired or does not exist/.test(message)) {
        clearPendingTry();
        setClaimState("gone");
      } else {
        setClaimState("failed");
      }
    }
  };

  useEffect(() => {
    if (authLoading || !user || claimStarted.current) return;
    claimStarted.current = true;
    void claim();
    // claim reads the latest data/user; it runs once per signed-in visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const finish = async (answers: (number | null)[]) => {
    const prev = queryClient.getQueryData<TryAttempt>(["try", attemptId]);
    const local = prev ? { ...prev, answers, finished: true } : null;
    if (local) queryClient.setQueryData(["try", attemptId], local);
    try {
      const scored = await submitTry(attemptId, answers, true);
      if (local) queryClient.setQueryData(["try", attemptId], { ...local, correct: scored.correct });
    } catch {
      /* the results still show; the score is recomputed from the server key on claim */
    }
  };

  if (user && claimState !== "gone") {
    return (
      <Shell attemptId={attemptId} showSave={false}>
        <div className="flex flex-col items-center py-16 text-center" role="status" aria-live="polite">
          <TryCat pose="book" className="cat-peek h-[112px]" />
          {claimState === "failed" ? (
            <>
              <p className="mt-4 text-[17px] font-extrabold">{t("try.claimFailed")}</p>
              <button type="button" onClick={() => void claim()} className={cn(primary, "mt-5 w-auto")}>
                {t("try.retry")}
              </button>
            </>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-[17px] font-extrabold">
              <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
              {t("try.claiming")}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell attemptId={attemptId} showSave={!!data && !data.finished}>
      {isLoading || authLoading ? (
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-full bg-muted" />
          <div className="h-72 animate-pulse rounded-[var(--r-panel)] bg-muted" />
        </div>
      ) : isError || !data || claimState === "gone" ? (
        <div className="py-8 text-center">
          <TryCat pose="sleep" className="mx-auto h-[112px]" />
          <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight">{t("try.notFound")}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[15.5px] font-semibold leading-snug text-muted-foreground">{t("try.notFoundBody")}</p>
          <Link href="/landing#try" className={cn(primary, "mt-5")}>
            {t("try.makeAnother")}
          </Link>
        </div>
      ) : data.finished ? (
        <Results attempt={data} />
      ) : (
        <>
          <p className="text-[13.5px] font-extrabold text-muted-foreground">Quick 5</p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]">
            <MathText text={data.title} />
          </h1>
          <div className="mt-6">
            <Quiz attempt={data} onFinished={(a) => void finish(a)} />
          </div>
        </>
      )}
    </Shell>
  );
}
