"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthUser } from "@/lib/api/auth";
import { trackNoteEvent } from "@/lib/api/public-notes";
import { shouldPrompt, topicKey, topicScore, totalAnswered } from "@/lib/notes-public/progress";
import { cn } from "@/lib/utils";
import { usePracticeProgress } from "./practice-store";

/**
 * The interactive layer of a public topic-note page. Everything a crawler
 * needs (stems, options, answers, explanations) is server-rendered and passed
 * in as nodes; this only adds tapping, feedback, the running score, progress
 * in localStorage, "next question", and the soft signup prompt.
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
  children,
}: {
  courseId: string;
  topicId: string;
  questionIds: string[];
  signupHref: string;
  children: ReactNode;
}) {
  const { user } = useAuthUser();
  const value = useMemo(
    () => ({ courseId, topicId, key: topicKey(courseId, topicId), ids: questionIds, signupHref, signedIn: !!user }),
    [courseId, topicId, questionIds, signupHref, user],
  );
  useEffect(() => {
    trackNoteEvent("notes.viewed", courseId, topicId, { viewportWidth: window.innerWidth, fromSearch: searchReferrer() });
  }, [courseId, topicId]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <SignupPrompt />
    </Ctx.Provider>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DIFFICULTY_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

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

export function PracticeCard(p: CardProps) {
  const ctx = useCtx();
  const { progress, answer } = usePracticeProgress();
  const answers = progress.topics[ctx.key]?.answers ?? {};
  const chosen = answers[p.id];
  const answered = chosen !== undefined;
  const right = answered && chosen === p.correctIndex;
  const detailsRef = useRef<HTMLDetailsElement>(null);

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
      placement: p.placement === "inline" ? "inline" : undefined,
    });
  };

  return (
    <div
      id={`pq-${p.id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-card px-4 py-4 sm:px-5",
        p.placement === "inline" ? "border-accent/30" : "border-border",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-muted-foreground">
        <span>{p.placement === "inline" ? "Quick check" : `Question ${p.number}`}</span>
        <span aria-hidden="true">·</span>
        <span>{DIFFICULTY_LABEL[p.difficulty]}</span>
        {p.commandTerm && (
          <>
            <span aria-hidden="true">·</span>
            <span>{p.commandTerm}</span>
          </>
        )}
        <span className="ml-auto tabular-nums">[{p.marks}]</span>
      </p>
      <div className="mt-2 text-[16px] font-semibold leading-snug sm:text-[16.5px]">{p.stem}</div>
      <ol className="mt-3 flex flex-col gap-2" aria-label="Options">
        {p.options.map((o, i) => {
          const isKey = i === p.correctIndex;
          const isChosen = chosen === i;
          return (
            <li key={i}>
              <button
                type="button"
                data-option
                onClick={() => pick(i)}
                aria-disabled={answered}
                aria-pressed={isChosen}
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-[15.5px] leading-snug transition-colors",
                  !answered && "border-border hover:border-accent hover:bg-accent-soft/40 active:bg-accent-soft",
                  answered && isKey && "border-[#16a34a] bg-[#16a34a]/10",
                  answered && isChosen && !isKey && "border-[#dc2626] bg-[#dc2626]/10",
                  answered && !isKey && !isChosen && "border-border opacity-70",
                )}
              >
                <span
                  className={cn(
                    "mt-px flex size-6 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-bold",
                    answered && isKey ? "border-[#16a34a] bg-[#16a34a] text-white" : answered && isChosen ? "border-[#dc2626] bg-[#dc2626] text-white" : "border-border-strong text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1">{o}</span>
                {answered && isKey && <span className="sr-only"> (correct answer)</span>}
                {answered && isChosen && !isKey && <span className="sr-only"> (your answer)</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <div aria-live="polite">
        {answered && (
          <p className={cn("mt-3 text-[15px] font-bold", right ? "text-[#15803d]" : "text-[#b91c1c]")}>
            {right ? "Correct!" : `Not quite — the answer is ${LETTERS[p.correctIndex]}.`}
          </p>
        )}
      </div>
      {/* In the HTML for everyone (and readable without JavaScript); opens once answered. */}
      <details ref={detailsRef} className="group mt-2">
        <summary
          className={cn(
            "inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[14px] font-semibold text-accent [&::-webkit-details-marker]:hidden",
            answered && "hidden",
          )}
        >
          Show answer and explanation
        </summary>
        <div className="mt-1 rounded-xl bg-muted/50 px-4 py-3 text-[15px] leading-snug">
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            Answer: {LETTERS[p.correctIndex]} · Worked explanation
          </p>
          <div className="mt-1">{p.explanation}</div>
        </div>
      </details>
      {answered && (
        <button
          type="button"
          onClick={() => scrollToNext(ctx.ids, p.id, { ...answers, [p.id]: chosen })}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[14.5px] font-semibold text-white hover:bg-accent-dim"
        >
          Next question <span aria-hidden="true">↓</span>
        </button>
      )}
    </div>
  );
}

/** Running score: sticky at the top of the practice section. */
export function PracticeScore({ inlineCount }: { inlineCount: number }) {
  const ctx = useCtx();
  const { progress, reset } = usePracticeProgress();
  const s = topicScore(progress, ctx.key, ctx.ids);
  const pct = s.total ? Math.round((s.answered / s.total) * 100) : 0;
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:top-2 sm:mx-0 sm:rounded-xl sm:border sm:px-4">
      <div className="flex items-center gap-3 text-[14px] font-semibold">
        <span className="tabular-nums">
          Score {s.correct}/{s.answered}
        </span>
        <span className="text-muted-foreground tabular-nums">
          · {s.answered} of {s.total} answered
        </span>
        {s.answered > 0 && (
          <button type="button" onClick={() => reset(ctx.key)} className="ml-auto text-[13px] font-semibold text-accent hover:text-accent-dim">
            Start again
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {inlineCount > 0 && s.answered === 0 && (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Includes the {inlineCount === 1 ? "quick check" : `${inlineCount} quick checks`} in the note above.</p>
      )}
    </div>
  );
}

/** Shown when every question is answered: the score and where to go next. */
export function PracticeDone({ nextTopic, quick5 }: { nextTopic: ReactNode; quick5: ReactNode }) {
  const ctx = useCtx();
  const { progress } = usePracticeProgress();
  const s = topicScore(progress, ctx.key, ctx.ids);
  return (
    <div id="practice-score" className="scroll-mt-24">
      {s.total > 0 && s.answered === s.total && (
        <div className="rounded-2xl bg-accent-soft px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <Image src={s.correct / s.total >= 0.7 ? "/design/cat2-trophy.png" : "/design/cat2-think.png"} alt="" width={72} height={80} unoptimized className="h-20 w-auto shrink-0" />
            <div>
              <p className="text-[20px] font-bold leading-tight">
                You scored {s.correct}/{s.total}
              </p>
              <p className="mt-1 text-[14.5px] text-muted-foreground">
                {s.correct === s.total ? "Full marks. On to the next topic." : s.correct / s.total >= 0.7 ? "Strong. Review the ones you missed, then move on." : "Reread the sections above, then try again."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {nextTopic}
            {quick5}
          </div>
        </div>
      )}
    </div>
  );
}

/** Soft, dismissible prompt after a few answers. Never blocks the page. */
function SignupPrompt() {
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
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="signup-prompt-title"
      className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-border bg-card p-4 shadow-[0_8px_30px_rgba(20,10,60,0.18)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[360px]"
    >
      <button type="button" onClick={dismissPrompt} aria-label="Dismiss" className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="flex gap-3 pr-6">
        <Image src="/design/cat2-cheer.png" alt="" width={56} height={66} unoptimized className="h-16 w-auto shrink-0" />
        <div>
          <p id="signup-prompt-title" className="text-[16px] font-bold leading-snug">
            {s.correct * 2 >= s.answered ? `${s.correct}/${s.answered} so far. Keep your progress?` : `${s.answered} questions done. Keep your progress?`}
          </p>
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
            Free account: save your scores, and get questions made from your own notes and slides.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={ctx.signupHref}
          onClick={() => trackNoteEvent("notes.signup_clicked", ctx.courseId, ctx.topicId, { placement: "prompt", answered: s.answered })}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-accent px-4 text-[14.5px] font-semibold text-white hover:bg-accent-dim"
        >
          Create a free account
        </Link>
        <button type="button" onClick={dismissPrompt} className="h-10 rounded-xl px-3 text-[14.5px] font-semibold text-muted-foreground hover:bg-muted">
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * "Start a Quick 5 on this topic": signed-in learners start it in the app;
 * visitors go to sign up (a Quick 5 needs an account).
 */
export function StartQuick5({ courseId, topicId, level, placement, variant = "primary" }: { courseId: string; topicId: string; level?: "SL" | "HL"; placement: "header" | "practice_end" | "note_cta"; variant?: "primary" | "secondary" }) {
  const ctx = useContext(Ctx);
  const { user } = useAuthUser();
  const [busy, setBusy] = useState(false);
  const cls = cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold transition-colors disabled:opacity-60",
    variant === "primary" ? "bg-accent text-white hover:bg-accent-dim" : "border border-border-strong bg-card hover:border-accent hover:text-accent",
  );
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
    } catch {
      setBusy(false);
      window.location.href = "/courses";
    }
  };
  return (
    <a href={ctx?.signupHref ?? "/signup?from=notes"} onClick={onClick} className={cls} aria-busy={busy}>
      {busy ? "Starting…" : "Start a Quick 5 on this topic"}
      {!busy && <span aria-hidden="true">→</span>}
    </a>
  );
}
