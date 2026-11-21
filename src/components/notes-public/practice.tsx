"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthUser } from "@/lib/api/auth";
import { trackNoteEvent } from "@/lib/api/public-notes";
import { shouldPrompt, topicKey, topicScore, totalAnswered } from "@/lib/notes-public/progress";
import { Check, RotateCcw, X } from "lucide-react";
import { paywallHref } from "@/lib/notes-public/gate";
import { cn } from "@/lib/utils";
import { usePracticeProgress } from "./practice-store";
import { bandCelebrates, resultBand, type ResultBand } from "@/lib/session-result";
import { useCountUp } from "@/lib/use-count-up";

/**
 * The interactive layer of a public topic-note page. Everything a crawler
 * needs (stems, options, answers, explanations) is server-rendered and passed
 * in as nodes; this only adds tapping, feedback, the running score, progress
 * in localStorage, "next question", and the soft signup prompt (an inline
 * card after the question just answered, so it never covers the page).
 */

interface PracticeCtx {
  courseId: string;
  topicId: string;
  key: string;
  ids: string[];
  signupHref: string;
  signedIn: boolean;
}

const Ctx = createContext<PracticeCtx | null>(null);
const useCtx = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("PracticeProvider missing");
  return c;
};

const searchReferrer = () => {
  try {
    return /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\./.test(new URL(document.referrer).hostname);
  } catch {
    return false;
  }
};

export function PracticeProvider({
  courseId,
  topicId,
  questionIds,
  signupHref,
  trackView = true,
  children,
}: {
  courseId: string;
  topicId: string;
  questionIds: string[];
  signupHref: string;
  /** False for a provider nested in an outer one (the unlocked view of a locked topic), so the view is counted once. */
  trackView?: boolean;
  children: ReactNode;
}) {
  const { user } = useAuthUser();
  const value = useMemo(
    () => ({ courseId, topicId, key: topicKey(courseId, topicId), ids: questionIds, signupHref, signedIn: !!user }),
    [courseId, topicId, questionIds, signupHref, user],
  );
  useEffect(() => {
    if (!trackView) return;
    trackNoteEvent("notes.viewed", courseId, topicId, { viewportWidth: window.innerWidth, fromSearch: searchReferrer() });
  }, [courseId, topicId, trackView]);
  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;
const DIFFICULTY_LEVEL = { easy: 1, medium: 2, hard: 3 } as const;

export interface CardProps {
  id: string;
  number: number;
  difficulty: "easy" | "medium" | "hard";
  commandTerm: string | null;
  marks: number;
  correctIndex: number;
  stem: ReactNode;
  options: ReactNode[];
  explanation: ReactNode;
  placement: "inline" | "practice";
}

function scrollToNext(ids: string[], from: string, answered: Record<string, number>) {
  const start = ids.indexOf(from);
  const next = [...ids.slice(start + 1), ...ids.slice(0, start)].find((id) => !(id in answered) && id !== from);
  const el = document.getElementById(next ? `pq-${next}` : "practice-score");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (next) (el?.querySelector("button[data-option]") as HTMLButtonElement | null)?.focus({ preventScroll: true });
}

/** A small burst in the cat's orange and cream for a right answer (feedback; off under reduced motion). */
function Sparkles() {
  return (
    <span className="pointer-events-none absolute left-5 top-5" aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <span
          key={a}
          className="nl-sparkle size-2 rounded-full"
          style={{ "--a": `${a}deg`, "--d": `${38 + (i % 3) * 10}px`, background: i % 2 ? "var(--flame)" : "var(--hl)", animationDelay: `${i * 18}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

export function PracticeCard(p: CardProps) {
  const ctx = useCtx();
  const { progress, answer, lastAnswered } = usePracticeProgress();
  const answers = progress.topics[ctx.key]?.answers ?? {};
  const chosen = answers[p.id];
  const answered = chosen !== undefined;
  const right = answered && chosen === p.correctIndex;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  // Answered just now (as opposed to restored from an earlier visit): play the feedback motion.
  const fresh = answered && lastAnswered === p.id;
  const inline = p.placement === "inline";

  useEffect(() => {
    if (answered && detailsRef.current) detailsRef.current.open = true;
  }, [answered]);

  const pick = (i: number) => {
    if (answered) return;
    const correct = i === p.correctIndex;
    answer(ctx.key, p.id, i, correct);
    const score = topicScore(progress, ctx.key, ctx.ids);
    trackNoteEvent("notes.practice_answered", ctx.courseId, ctx.topicId, {
      correct,
      answered: score.answered + 1,
      totalAnswered: totalAnswered(progress) + 1,
      difficulty: p.difficulty,
      placement: inline ? "inline" : undefined,
    });
  };
  const left = ctx.ids.some((id) => id !== p.id && !(id in answers));

  return (
    <div id={`pq-${p.id}`} className={cn("scroll-mt-24", inline ? "nl-well !rounded-[var(--r-card)] px-3.5 pb-4 pt-4 sm:px-5 sm:pb-5" : "nl-q")} data-nl-reveal="">
      <div className="flex items-center gap-2.5 px-0.5">
        {inline ? (
          <>
            <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized loading="lazy" className="-my-2 h-[58px] w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold leading-tight text-foreground">Quick check</p>
              <p className="text-[13px] font-bold text-muted-foreground">One question on the part you just read</p>
            </div>
          </>
        ) : (
          <span className="shrink-0 text-[19px] font-black tabular-nums leading-none text-foreground" aria-label={`Question ${p.number}`}>
            {p.number}.
          </span>
        )}
        <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-bold text-muted-foreground", inline ? "ml-auto justify-end" : "min-w-0 flex-1")}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <span key={n} className={cn("w-[5px] rounded-full", n <= DIFFICULTY_LEVEL[p.difficulty] ? "bg-foreground" : "bg-[var(--border-strong)]")} style={{ height: 5 + n * 3 }} />
              ))}
            </span>
            {DIFFICULTY_LABEL[p.difficulty]}
          </span>
          {p.commandTerm && !inline && (
            <>
              <span aria-hidden="true">·</span>
              <span>{p.commandTerm}</span>
            </>
          )}
          {!inline && (
            <span className="nl-marks">
              [{p.marks} {p.marks === 1 ? "mark" : "marks"}]
            </span>
          )}
        </p>
      </div>
      <div className="mt-3 px-0.5 text-[18px] font-extrabold leading-[1.35] text-foreground sm:text-[19px]">{p.stem}</div>
      <ol className="mt-3.5 flex flex-col gap-2.5" aria-label="Options">
        {p.options.map((o, i) => {
          const isKey = i === p.correctIndex;
          const isChosen = chosen === i;
          const state = !answered ? "idle" : isKey ? "right" : isChosen ? "wrong" : "dim";
          return (
            <li key={i}>
              <button
                type="button"
                data-option
                data-state={state}
                onClick={() => pick(i)}
                aria-disabled={answered}
                aria-pressed={isChosen}
                className={cn("nl-opt", fresh && isChosen && (isKey ? "nl-pop" : "nl-shake"))}
              >
                <span className="nl-letter" aria-hidden="true">
                  {state === "right" ? <Check className="size-4" strokeWidth={3.5} /> : state === "wrong" ? <X className="size-4" strokeWidth={3.5} /> : LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1">{o}</span>
                {answered && isKey && <span className="sr-only"> (correct answer)</span>}
                {answered && isChosen && !isKey && <span className="sr-only"> (your answer)</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {/* The result sits on the page under the options: a badge, the cat reacting, the explanation, the way on. No tinted panel. */}
      <div className={cn("relative", answered && "mt-5 px-0.5", fresh && "nl-up")}>
        <div aria-live="polite">
          {answered && (
            <div className="relative flex items-center gap-3">
              {fresh && right && <Sparkles />}
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-white", right ? "bg-[var(--ok)]" : "bg-[var(--no)]", fresh && right && "nl-pop")} aria-hidden="true">
                {right ? <Check className="size-6" strokeWidth={3.5} /> : <X className="size-6" strokeWidth={3.5} />}
              </span>
              <p className={cn("min-w-0 flex-1 text-[20px] font-extrabold leading-tight", right ? "text-[var(--ok-ink)]" : "text-[var(--no-ink)]")}>
                {right ? "Correct!" : `Not quite. The answer is ${LETTERS[p.correctIndex]}.`}
              </p>
              <Image src={right ? "/design/cat3-cheer.webp" : "/design/cat3-think.webp"} alt="" width={363} height={400} unoptimized className={cn("-my-2 h-[64px] w-auto shrink-0 sm:h-[76px]", fresh && "nl-cat-in")} />
            </div>
          )}
        </div>
        {/* In the HTML for everyone (and readable without JavaScript); opens once answered. */}
        <details ref={detailsRef} className={cn("group", answered ? "mt-2" : "mt-3")}>
          <summary
            className={cn(
              "inline-flex min-h-10 cursor-pointer list-none items-center gap-1 px-0.5 text-[14.5px] font-extrabold text-foreground underline decoration-border-strong underline-offset-4 [&::-webkit-details-marker]:hidden",
              answered && "hidden",
            )}
          >
            Show answer and explanation
          </summary>
          <div className={cn("text-[16px] leading-[1.55] text-foreground", !answered && "nl-well mt-1 px-4 py-3")}>
            <p className="text-[13px] font-extrabold text-muted-foreground">
              Answer: {LETTERS[p.correctIndex]} · Worked explanation
            </p>
            <div className="mt-1">{p.explanation}</div>
          </div>
        </details>
        {/* One main button on the page: the question just answered carries it; earlier ones keep a quiet link. */}
        {answered &&
          (lastAnswered === p.id ? (
            <button type="button" onClick={() => scrollToNext(ctx.ids, p.id, { ...answers, [p.id]: chosen })} className="nl-btn mt-4 w-full sm:w-auto">
              {left ? "Next question" : "See your score"} <span aria-hidden="true">↓</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => scrollToNext(ctx.ids, p.id, { ...answers, [p.id]: chosen })}
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-[14.5px] font-bold text-foreground underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-current"
            >
              {left ? "Next question" : "See your score"} <span aria-hidden="true">↓</span>
            </button>
          ))}
      </div>
      {lastAnswered === p.id && <SignupNudge className="mt-4" />}
    </div>
  );
}

/** Running score: sticky at the top of the practice section. One dot per question, and a run of right answers. */
export function PracticeScore({ inlineCount }: { inlineCount: number }) {
  const ctx = useCtx();
  const { progress, reset, streak } = usePracticeProgress();
  const s = topicScore(progress, ctx.key, ctx.ids);
  const t = progress.topics[ctx.key];
  const firstOpen = ctx.ids.find((id) => !(t && id in t.answers));
  return (
    <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-[color-mix(in_srgb,var(--page,#fff)_94%,transparent)] px-1 py-3 backdrop-blur">
      <div className="flex min-h-8 items-center gap-2.5">
        <p className="text-[15px] font-extrabold tabular-nums">
          <span className="text-[22px] font-black leading-none text-foreground">{s.correct}</span>
          <span className="text-muted-foreground"> right</span>
          <span className="ml-2 font-bold text-muted-foreground">
            {s.answered} of {s.total} answered
          </span>
        </p>
        {streak >= 2 && (
          <span key={streak} className="nl-pop inline-flex items-center text-[13px] font-extrabold text-[var(--flame-ink)]">
            {streak} in a row
          </span>
        )}
        {s.answered > 0 && (
          <button type="button" onClick={() => reset(ctx.key)} className="ml-auto inline-flex min-h-8 items-center gap-1 text-[13px] font-extrabold text-muted-foreground hover:text-foreground" aria-label="Start again">
            <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Start again</span>
          </button>
        )}
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
        {ctx.ids.map((id) => {
          const st = t && id in t.answers ? (t.correct[id] ? "right" : "wrong") : id === firstOpen ? "next" : "open";
          return (
            <li key={id} className="nl-dot" data-s={st}>
              {st === "right" ? <Check strokeWidth={4} /> : st === "wrong" ? <X strokeWidth={4} /> : null}
            </li>
          );
        })}
      </ol>
      {inlineCount > 0 && s.answered === 0 && (
        <p className="mt-2 text-[13px] font-semibold text-muted-foreground">Includes the {inlineCount === 1 ? "quick check" : `${inlineCount} quick checks`} in the note above.</p>
      )}
    </div>
  );
}

const BAND_CAT: Record<ResultBand, [src: string, w: number, h: number]> = {
  perfect: ["/design/cat3-trophy.webp", 413, 400],
  strong: ["/design/cat3-cheer.webp", 363, 400],
  okay: ["/design/cat3-pencil.webp", 360, 400],
  rough: ["/design/cat3-think.webp", 383, 400],
  done: ["/design/cat3-book.webp", 363, 400],
};
const BAND_LINE: Record<ResultBand, [title: string, sub: string]> = {
  perfect: ["Flawless!", "Full marks. On to the next topic."],
  strong: ["Nailed it!", "Strong. Look over the ones you missed, then move on."],
  okay: ["Nice work!", "Most of it stuck. Look over the ones you missed while it's fresh."],
  rough: ["Good effort", "That was a tough one. Reread the parts above, then have another go."],
  done: ["Practice complete", ""],
};
/** Confetti in the tile colours and the cat's orange; no purple. */
const CONFETTI_COLORS = ["#f6a53b", "#ffd166", "#34b27b", "#4f8df7", "#ef5d7a", "#ffffff"];

/** Thrown from the cat, once, on a strong score. Positions are fixed, so server and client agree. */
function Confetti({ count = 38 }: { count?: number }) {
  return (
    <span aria-hidden="true" className="nl-confetti">
      {Array.from({ length: count }, (_, i) => {
        const angle = (-200 + (220 * i) / (count - 1) + ((i * 37) % 17) - 8) * (Math.PI / 180);
        const reach = 110 + ((i * 53) % 150);
        const long = i % 3 !== 0;
        return (
          <span
            key={i}
            style={{
              width: long ? 6 : 8,
              height: long ? 12 : 8,
              borderRadius: long ? 2 : 999,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              "--x": `${Math.round(Math.cos(angle) * reach)}px`,
              "--y": `${Math.round(Math.sin(angle) * reach)}px`,
              "--r": `${((i * 71) % 300) - 150}deg`,
              "--i": i,
            } as React.CSSProperties}
          />
        );
      })}
    </span>
  );
}

function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value, 900)}</>;
}

/**
 * Shown when every question is answered. One moment in the notes index's own
 * language: the landscape for the reader's time of day, the cat reacting to
 * the score, the score counting up; then each answer as a dot and where to go
 * next. Encouraging at every score.
 */
export function PracticeDone({ nextTopic, quick5 }: { nextTopic: ReactNode; quick5: ReactNode }) {
  const ctx = useCtx();
  const { progress, lastAnswered, reset } = usePracticeProgress();
  const s = topicScore(progress, ctx.key, ctx.ids);
  const done = s.total > 0 && s.answered === s.total;
  const band = resultBand(s.total ? s.correct / s.total : null);
  const [cat, catW, catH] = BAND_CAT[band];
  const [title, sub] = BAND_LINE[band];
  const t = progress.topics[ctx.key];
  const missed = s.total - s.correct;
  return (
    <div id="practice-score" className="scroll-mt-24">
      {/* After a reload there is no "question just answered" to sit under, so the prompt waits here. */}
      {!lastAnswered && <SignupNudge className="mb-4" />}
      {done && (
        <div data-practice-done data-band={band}>
          <section className="hero-card nl-up relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-5 pt-[176px] sm:min-h-[280px] sm:px-9 sm:pb-8 sm:pt-8" aria-labelledby="practice-done-title">
            <div aria-hidden="true" className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[160px] sm:inset-0 sm:h-auto">
              <div className="absolute bottom-[20px] left-1/2 h-[118px] -translate-x-1/2 sm:bottom-[7%] sm:left-auto sm:right-[9%] sm:h-[190px] sm:translate-x-0">
                <span className="hero-field__ground" />
                {bandCelebrates(band) && <Confetti />}
                <Image src={cat} alt="" width={catW} height={catH} unoptimized className="nl-cat-in relative h-full w-auto" />
              </div>
            </div>
            <p className="hero-eyebrow relative text-[13.5px] font-extrabold">Practice complete</p>
            <h3 id="practice-done-title" className="relative mt-1.5 text-[30px] font-black leading-[1.08] tracking-[-0.02em] sm:max-w-[58%] sm:text-[38px]">
              {title}
            </h3>
            <p className="relative mt-1.5 text-[15.5px] font-semibold leading-snug text-foreground/75 sm:max-w-[52%]">{sub}</p>
            <p className="relative mt-4 flex items-baseline gap-3 sm:mt-6" role="status">
              <span className="nl-score text-[60px] font-black leading-[0.9] tracking-[-0.03em] tabular-nums sm:text-[76px]">
                <CountUp value={s.correct} />
                <span className="text-[0.5em] text-muted-foreground"> / {s.total}</span>
              </span>
              <span className="text-[15px] font-bold leading-tight text-foreground/75">right</span>
            </p>
          </section>

          <div className="nl-stagger mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 px-1" style={{ "--i": 2 } as React.CSSProperties}>
            <ol className="flex flex-wrap items-center gap-[7px]" aria-label={`${s.correct} right, ${missed} to look over`}>
              {ctx.ids.map((id, i) => (
                <li key={id} aria-hidden="true" style={{ "--i": i } as React.CSSProperties} className={cn("nl-findot size-3.5 rounded-full", t?.correct[id] ? "bg-[var(--ok)]" : "border-[2.5px] border-[var(--no)]")} />
              ))}
            </ol>
            {missed > 0 && <span className="text-[13.5px] font-bold text-muted-foreground">{missed} to look over</span>}
          </div>

          <div className="nl-stagger mt-6 flex flex-col items-stretch gap-3 px-1 sm:flex-row sm:flex-wrap sm:items-center" style={{ "--i": 4 } as React.CSSProperties}>
            {nextTopic}
            {quick5}
          </div>
          <button
            type="button"
            onClick={() => {
              reset(ctx.key);
              document.getElementById("practice")?.scrollIntoView({ block: "start" });
            }}
            className="nl-stagger mt-2 inline-flex min-h-11 items-center gap-1.5 px-1 text-[14.5px] font-extrabold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            Try these questions again
          </button>
        </div>
      )}
    </div>
  );
}

/** Soft, dismissible prompt after a few answers: a card in the flow of the page, never over it. */
function SignupNudge({ className }: { className?: string }) {
  const ctx = useCtx();
  const { progress, dismissPrompt } = usePracticeProgress();
  const s = topicScore(progress, ctx.key, ctx.ids);
  const [now] = useState(() => Date.now());
  const show = shouldPrompt(progress, s.answered, now, ctx.signedIn);
  const tracked = useRef(false);
  useEffect(() => {
    if (show && !tracked.current) {
      tracked.current = true;
      trackNoteEvent("notes.signup_prompt_shown", ctx.courseId, ctx.topicId, { answered: s.answered });
    }
  }, [show, ctx.courseId, ctx.topicId, s.answered]);
  if (!show) return null;
  return (
    <aside aria-labelledby="signup-prompt-title" className={cn("nl-up relative rounded-[var(--r-card)] bg-muted px-4 pb-4 pt-4", className)}>
      <button type="button" onClick={dismissPrompt} aria-label="Dismiss" className="absolute right-1.5 top-1.5 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <Image src="/design/cat3-wave.webp" alt="" width={352} height={400} unoptimized className="h-[60px] w-auto shrink-0" />
        <div>
          <p id="signup-prompt-title" className="text-[17px] font-extrabold leading-snug">
            {s.correct * 2 >= s.answered ? `${s.correct}/${s.answered} so far. Keep your progress?` : `${s.answered} questions done. Keep your progress?`}
          </p>
          <p className="mt-0.5 text-[14.5px] font-semibold leading-snug text-muted-foreground">Free account: save your scores, and get questions made from your own notes and slides.</p>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={ctx.signupHref}
          onClick={() => trackNoteEvent("notes.signup_clicked", ctx.courseId, ctx.topicId, { placement: "prompt", answered: s.answered })}
          className="nl-btn nl-btn-sm flex-1 sm:flex-none"
        >
          Create a free account
        </Link>
        <button type="button" onClick={dismissPrompt} className="min-h-10 px-1 text-[14.5px] font-extrabold text-muted-foreground hover:text-foreground">
          Not now
        </button>
      </div>
    </aside>
  );
}

/**
 * "Start a Quick 5 on this topic": signed-in learners start it in the app;
 * visitors go to sign up (a Quick 5 needs an account).
 */
export function StartQuick5({ courseId, topicId, level, placement, variant = "primary", className }: { courseId: string; topicId: string; level?: "SL" | "HL"; placement: "header" | "practice_end" | "note_cta"; variant?: "primary" | "secondary"; className?: string }) {
  const ctx = useContext(Ctx);
  const { user } = useAuthUser();
  const [busy, setBusy] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    trackNoteEvent("notes.quick5_clicked", courseId, topicId, { placement });
    if (!user) return; // follow the link to sign up
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { coursesApi } = await import("@/lib/api/courses");
      const { workspaceId, sessionId } = await coursesApi.startTopic({ courseId, topicId, ...(level ? { level } : {}), mode: "quick5" });
      window.location.href = `/workspace/${workspaceId}/session/${sessionId}`;
    } catch (err) {
      setBusy(false);
      // A locked topic without a plan or pass (paid gate): straight to the paywall.
      const { isPlanLimitError } = await import("@/lib/api/plan-limit");
      if (isPlanLimitError(err)) {
        trackNoteEvent("notes.unlock_clicked", courseId, topicId, { placement, signedIn: true });
        window.location.href = paywallHref(courseId, topicId);
        return;
      }
      window.location.href = "/courses";
    }
  };
  return (
    <a href={ctx?.signupHref ?? "/signup?from=notes"} onClick={onClick} className={cn(variant === "primary" ? "nl-btn" : "nl-btn-ghost", busy && "opacity-60", className)} aria-busy={busy}>
      {busy ? "Starting…" : "Start a Quick 5 on this topic"}
      {!busy && <span aria-hidden="true">→</span>}
    </a>
  );
}
