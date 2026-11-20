"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Mascot } from "@/components/rewards/mascot";
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

const primary =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim";

function Shell({ children, attemptId, showSave }: { children: React.ReactNode; attemptId: string; showSave: boolean }) {
  const { t } = useI18n();
  return (
    <div className="design-root min-h-dvh bg-white text-foreground">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
        {showSave && (
          <Link href={trySignupHref(attemptId, { ref: getReferral() })} className="text-[13px] font-semibold text-accent-dim hover:underline">
            {t("try.saveProgress")}
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

/** One question at a time with instant marking; the "why" is what the free account unlocks. */
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
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-muted-foreground">{fill(t("try.questionOf"), { n: index + 1, total: qs.length })}</p>
        <div className="flex w-28 gap-1">
          {qs.map((_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", answers[i] !== null ? "bg-accent" : i === index ? "bg-accent/40" : "bg-muted")} />
          ))}
        </div>
      </div>
      <p className="mt-4 text-[18px] font-bold leading-snug">
        <MathText text={q.question} />
      </p>
      <ul className="mt-4 space-y-2">
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
                  "flex min-h-12 w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left text-[15px] font-medium transition-colors",
                  !answered && "border-border hover:border-accent/50 hover:bg-accent-soft/40",
                  answered && isRight && "border-success/50 bg-success/10",
                  answered && isPicked && !isRight && "border-rose/50 bg-rose/10",
                  answered && !isRight && !isPicked && "border-border opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg text-[13px] font-semibold",
                    answered && isRight ? "bg-success text-white" : answered && isPicked ? "bg-rose text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {answered && isRight ? <Check className="size-4" strokeWidth={3} /> : answered && isPicked ? <X className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <MathText text={opt} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3.5 py-3" role="status">
          <p className={cn("text-[14px] font-semibold", answer === q.correctIndex ? "text-success" : "text-rose")}>
            {t(answer === q.correctIndex ? "try.correct" : "try.incorrect")}
          </p>
          <Link href={signup} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-accent/30 bg-white px-3 text-[12.5px] font-semibold text-accent-dim hover:bg-accent-soft">
            <Lock className="size-3.5" />
            {t("try.whyLocked")}
            <span className="font-medium text-faint">· {t("try.whyLockedHint")}</span>
          </Link>
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!answered}
          onClick={() => (last ? onFinished(answers) : setIndex(index + 1))}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-white hover:bg-accent-dim disabled:opacity-40"
        >
          {t(last ? "try.seeResults" : "try.next")}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Results({ attempt }: { attempt: TryAttempt }) {
  const { t } = useI18n();
  const total = attempt.questions.length;
  const correct = attempt.correct ?? attempt.questions.filter((q, i) => attempt.answers[i] === q.correctIndex).length;
  const tone = scoreTone(correct, total);
  const ref = getReferral();
  return (
    <div>
      <div className="text-center">
        <Mascot pose={tone === "great" ? "trophy" : tone === "good" ? "cheer" : "think"} className="mx-auto h-[104px]" />
        <p className="mt-3 text-[30px] font-extrabold tabular-nums tracking-tight">{fill(t("try.resultsScore"), { correct, total })}</p>
        <p className="mt-0.5 text-[15px] text-muted-foreground">{t(tone === "great" ? "try.toneGreat" : tone === "good" ? "try.toneGood" : "try.toneKeep")}</p>
        <div className="mx-auto mt-3 flex w-40 gap-1">
          {attempt.questions.map((q, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", attempt.answers[i] === q.correctIndex ? "bg-success" : "bg-rose/70")} />
          ))}
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-accent/25 bg-accent-soft p-5 text-center sm:p-6">
        <h2 className="text-[19px] font-bold tracking-tight">{t("try.saveTitle")}</h2>
        <p className="mx-auto mt-1 max-w-md text-[14px] leading-snug text-muted-foreground">{fill(t("try.saveBody"), { title: attempt.title })}</p>
        <Link href={trySignupHref(attempt.id, { ref })} className={cn(primary, "mt-4 sm:mx-auto sm:max-w-xs")}>
          {t("try.saveCta")}
          <ArrowRight className="size-4" />
        </Link>
        <p className="mt-2 text-[12px] text-faint">{t("try.saveFootnote")}</p>
        <Link href={trySignupHref(attempt.id, { login: true, ref })} className="mt-1 inline-flex min-h-10 items-center text-[13px] font-semibold text-accent-dim hover:underline">
          {t("try.haveAccount")}
        </Link>
      </section>

      <h3 className="mt-8 text-[13px] font-semibold text-muted-foreground">{t("try.reviewHeading")}</h3>
      <ol className="mt-2 space-y-2.5">
        {attempt.questions.map((q, i) => {
          const pick = attempt.answers[i];
          const right = pick === q.correctIndex;
          return (
            <li key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-2.5">
                <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", right ? "bg-success" : "bg-rose")}>
                  {right ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold leading-snug">
                    <MathText text={q.question} />
                  </p>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {t("try.yourAnswer")}:{" "}
                    <span className={cn("font-semibold", right ? "text-success" : "text-rose")}>
                      {pick === null ? t("try.skipped") : <MathText text={q.options[pick] ?? ""} />}
                    </span>
                  </p>
                  {!right && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {t("try.rightAnswer")}: <span className="font-semibold text-foreground"><MathText text={q.options[q.correctIndex] ?? ""} /></span>
                    </p>
                  )}
                  <Link
                    href={trySignupHref(attempt.id, { ref })}
                    className="mt-2.5 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    <Lock className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">{t("try.explanationLocked")}</span>
                    <span aria-hidden className="hidden h-2 w-24 rounded-full bg-border sm:block" />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 text-center">
        <Link href="/landing#try" className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-[14px] font-semibold text-accent-dim hover:bg-muted">
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
          <Mascot pose="book" className="h-[96px]" />
          {claimState === "failed" ? (
            <>
              <p className="mt-4 text-[15px] font-semibold">{t("try.claimFailed")}</p>
              <button type="button" onClick={() => void claim()} className={cn(primary, "mt-4 w-auto")}>
                {t("try.retry")}
              </button>
            </>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold">
              <Loader2 className="size-4 animate-spin text-accent" />
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
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : isError || !data || claimState === "gone" ? (
        <div className="py-8 text-center">
          <Mascot pose="sleep" className="mx-auto h-[100px]" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("try.notFound")}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{t("try.notFoundBody")}</p>
          <Link href="/landing#try" className={cn(primary, "mx-auto mt-5 max-w-xs")}>
            {t("try.makeAnother")}
          </Link>
        </div>
      ) : (
        <>
          <p className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-dim">Quick 5</p>
          <h1 className="mt-2.5 text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
            <MathText text={data.title} />
          </h1>
          <div className="mt-5">{data.finished ? <Results attempt={data} /> : <Quiz attempt={data} onFinished={(a) => void finish(a)} />}</div>
        </>
      )}
    </Shell>
  );
}
