"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Layers, ListChecks, RotateCcw, Sparkles, X } from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Mascot } from "@/components/rewards/mascot";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/ui/markdown-text";
import { fetchSharedItem, signupHref, type SharedItemView } from "@/lib/api/referrals";
import { rememberReferral } from "@/lib/attribution";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/growth";

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

function MakeYourOwn({ refCode }: { refCode: string | null }) {
  const { t } = useI18n();
  return (
    <section className="mt-6 rounded-2xl border border-accent/20 bg-accent-soft p-5 text-center">
      <Sparkles className="mx-auto size-6 text-accent" fill="currentColor" />
      <h2 className="mt-2 text-[18px] font-bold tracking-tight">{t("share.ctaTitle")}</h2>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-snug text-muted-foreground">{t("share.ctaBody")}</p>
      <Link href={signupHref(refCode)} className="mt-4 inline-block">
        <Button size="lg" className="gap-2 text-[15px]">
          {t("share.ctaButton")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </section>
  );
}

/** One question at a time; answers are marked on the device (public practice). */
function QuizRunner({ item }: { item: SharedItemView }) {
  const { t } = useI18n();
  const qs = item.questions;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null));
  const [done, setDone] = useState(false);
  const score = picked.filter((p, i) => p === qs[i]?.correctIndex).length;

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Mascot pose={score / qs.length >= 0.6 ? "trophy" : "think"} className="mx-auto h-[96px]" />
        <p className="mt-3 text-[22px] font-bold tabular-nums">{fill(t("share.score"), { n: score, total: qs.length })}</p>
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => {
            setPicked(qs.map(() => null));
            setIndex(0);
            setDone(false);
          }}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {t("share.again")}
        </Button>
      </div>
    );
  }

  const q = qs[index];
  const answer = picked[index];
  const answered = answer !== null;
  const last = index === qs.length - 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <p className="text-[12px] font-semibold text-muted-foreground">{fill(t("share.questionOf"), { n: index + 1, total: qs.length })}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((index + (answered ? 1 : 0)) / qs.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-[17px] font-semibold leading-snug">
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
                onClick={() => setPicked((p) => p.map((v, j) => (j === index ? i : v)))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-[14.5px] transition-colors",
                  !answered && "border-border hover:border-accent/50 hover:bg-accent-soft/40",
                  answered && isRight && "border-success/50 bg-success/10",
                  answered && isPicked && !isRight && "border-rose/50 bg-rose/10",
                  answered && !isRight && !isPicked && "border-border opacity-70",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[12px] font-bold",
                    answered && isRight ? "border-success bg-success text-white" : answered && isPicked ? "border-rose bg-rose text-white" : "border-border-strong text-muted-foreground",
                  )}
                >
                  {answered && isRight ? <Check className="size-3.5" strokeWidth={3} /> : answered && isPicked ? <X className="size-3.5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
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
        <div className="mt-4 rounded-xl bg-muted/50 px-3.5 py-3 text-[13.5px] leading-snug" role="status">
          <p className={cn("font-semibold", answer === q.correctIndex ? "text-success" : "text-rose")}>
            {t(answer === q.correctIndex ? "share.correct" : "share.incorrect")}
          </p>
          {q.explanation && (
            <p className="mt-1 text-muted-foreground">
              <MathText text={q.explanation} />
            </p>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button disabled={!answered} onClick={() => (last ? setDone(true) : setIndex(index + 1))}>
          {t(last ? "share.seeResult" : "share.next")}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DeckRunner({ item }: { item: SharedItemView }) {
  const { t } = useI18n();
  const cards = item.cards;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const card = cards[index];
  const go = (to: number) => {
    setFlipped(false);
    if (to >= cards.length) setDone(true);
    else setIndex(Math.max(0, to));
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Mascot pose="trophy" className="mx-auto h-[96px]" />
        <p className="mt-3 text-[20px] font-bold">{t("share.deckDone")}</p>
        <Button variant="ghost" className="mt-2" onClick={() => { setIndex(0); setDone(false); }}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {t("share.again")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-semibold text-muted-foreground">{fill(t("share.cardOf"), { n: index + 1, total: cards.length })}</p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={t(flipped ? "share.showQuestion" : "share.showAnswer")}
        className={cn(
          "mt-2 flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border p-6 text-center transition-colors sm:min-h-[260px]",
          flipped ? "border-accent/50 bg-card ring-1 ring-accent/20" : "border-border bg-card hover:border-accent/40",
        )}
      >
        <span className="text-[18px] font-semibold leading-snug">
          <MathText text={flipped ? card.back : card.front} />
        </span>
        <span className="mt-4 text-[12px] font-semibold text-accent-dim">{t(flipped ? "share.showQuestion" : "share.showAnswer")}</span>
      </button>
      <div className="mt-3 flex justify-between">
        <Button variant="ghost" disabled={index === 0} onClick={() => go(index - 1)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {t("share.prev")}
        </Button>
        <Button onClick={() => go(index + 1)}>
          {t("share.next")}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Public, read-only practice for a shared quiz or flashcard deck (/s/<token>). */
export default function SharedItemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["shared-item", token],
    queryFn: () => fetchSharedItem(token),
    retry: 1,
    staleTime: Infinity,
  });

  // A signup after practising credits the person who shared it.
  useEffect(() => {
    if (data?.referralCode) rememberReferral(data.referralCode);
  }, [data?.referralCode]);

  const isQuiz = data?.kind === "MCQ_POOL";
  const empty = !!data && (isQuiz ? data.questions.length === 0 : data.cards.length === 0);

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/landing" aria-label="Scribe home">
          <ScribeLogo />
        </Link>
        <Link href={signupHref(data?.referralCode)} className="text-[13px] font-semibold text-accent-dim hover:underline">
          {t("share.ctaButton")}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : isError || !data ? (
          <div className="text-center">
            <Mascot pose="sleep" className="mx-auto h-[100px]" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">{t("share.notFound")}</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{t("share.notFoundBody")}</p>
            <MakeYourOwn refCode={null} />
          </div>
        ) : (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
              {isQuiz ? <ListChecks className="size-3.5" /> : <Layers className="size-3.5" />}
              {t(isQuiz ? "share.quiz" : "share.deck")}
              {data.topic && <span className="font-medium">· {data.topic}</span>}
            </p>
            <h1 className="mt-2.5 text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
              <MathText text={data.title} />
            </h1>
            {data.sharerFirstName && (
              <p className="mt-1 text-[13.5px] text-muted-foreground">{t("share.byName").replace("{name}", data.sharerFirstName)}</p>
            )}
            <div className="mt-5">
              {empty ? (
                <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">{t("share.empty")}</p>
              ) : isQuiz ? (
                <QuizRunner item={data} />
              ) : (
                <DeckRunner item={data} />
              )}
            </div>
            {isQuiz && !empty && <p className="mt-3 text-center text-[11.5px] text-faint">{t("share.practice")}</p>}
            <MakeYourOwn refCode={data.referralCode} />
          </>
        )}
      </main>
    </div>
  );
}
