"use client";

import { ItemDots, RunBadge, runOfRight } from "@/components/session/play-ui";
import { useContext, useEffect, useRef, useState } from "react";
import { McqOptionBody, McqQuestionBody, optionsHaveFigures } from "@/components/session/mcq-rich";
import { McqContent } from "@/types";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useItemNav, useReportCurrentItem } from "@/lib/current-item";
import { nextUnanswered } from "@/lib/session-footer";
import "@/lib/i18n/purpose";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { FeedbackCard } from "@/components/session/feedback-card";
import { VoiceAnswerButton, VoiceAnswerContext } from "@/components/session/voice-scribe";
import { useNewUi } from "@/lib/new-ui";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/today";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft } from "lucide-react";

interface McqActivityProps {
  activityId: string;
  content: McqContent;
  draft?: Record<string, unknown>;
  onAnswer: (questionIndex: number, selectedIndex: number) => void;
  onComplete: () => void;
  /**
   * Every question has an answer. Fired once, as soon as the last answer is
   * revealed (or on mount when a restored draft is already complete), so
   * the activity is recorded as finished even if the learner never taps
   * "Finish quiz" (swipes or arrows on to the debrief, closes the tab…).
   */
  onAllAnswered?: () => void;
  /** "Hint" on an unanswered question: opens Copilot for this question (it won't give the answer away). */
  onHint?: (questionIndex: number) => void;
  /** "Why?" under the result: opens Copilot on this question. */
  onWhy?: (questionIndex: number) => void;
  /** The player's bottom bar already has Back (question by question): no second one on the card. */
  hideBack?: boolean;
}

export function McqActivity({
  activityId,
  content,
  draft,
  onAnswer,
  onComplete,
  onAllAnswered,
  onHint,
  onWhy,
  hideBack = false,
}: McqActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const restored = restoredDraft(activityId, draft) as
    | Partial<{
        index: number;
        correctCount: number;
        selected: number | null;
        revealed: boolean;
        answersByQ: (number | null)[];
      }>
    | undefined;
  const [index, setIndex] = useState(
    Math.min(restored?.index ?? 0, content.questions.length - 1),
  );
  const [selected, setSelected] = useState<number | null>(
    restored?.selected ?? null,
  );
  const [revealed, setRevealed] = useState(restored?.revealed ?? false);
  const [correctCount, setCorrectCount] = useState(restored?.correctCount ?? 0);
  const [answersByQ, setAnswersByQ] = useState<(number | null)[]>(
    restored?.answersByQ?.length === content.questions.length
      ? restored.answersByQ
      : content.questions.map(() => null),
  );
  const [burst, setBurst] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  // "Answer out loud" sits with Hint, beside Check answer (only inside the player, which owns the microphone).
  const voiceCtx = useContext(VoiceAnswerContext);
  const voiceOn = newUi && voiceCtx !== null;

  useReportCurrentItem(activityId, index);
  useActivityDraft(activityId, {
    index,
    correctCount,
    selected,
    revealed,
    answersByQ,
  });

  const allAnswered =
    answersByQ.length > 0 && answersByQ.every((a) => a !== null);
  const reportedAllAnswered = useRef(false);
  useEffect(() => {
    if (!allAnswered || reportedAllAnswered.current) return;
    reportedAllAnswered.current = true;
    onAllAnswered?.();
  }, [allAnswered, onAllAnswered]);

  const question = content.questions[index];
  const isLast = index === content.questions.length - 1;
  const isCorrect = selected === question.correctIndex;

  const handleSubmit = () => {
    if (selected === null) return;
    onAnswer(index, selected);
    const right = selected === question.correctIndex;
    if (right) {
      setCorrectCount((c) => c + 1);
      // The redesign cheers in the feedback card itself; full-screen confetti covered the question for 2.6s.
      if (!newUi) setBurst((b) => b + 1);
    }
    // A tiny tap on phones that support it: instant, and no motion.
    try {
      navigator.vibrate?.(right ? 12 : [24, 40, 24]);
    } catch {
      /* not supported */
    }
    setAnswersByQ((prev) => {
      const next = [...prev];
      next[index] = selected;
      return next;
    });
    setRevealed(true);
  };

  const goTo = (i: number) => {
    const past = answersByQ[i] ?? null;
    setIndex(i);
    setSelected(past);
    setRevealed(past !== null);
  };

  // Bring the result into view above the bottom bar on short phone screens,
  // without leaving a line (activity title, "Question 2 of 5", the question,
  // an answer) cut in half at the top edge.
  useEffect(() => {
    if (!revealed || !newUi) return;
    const panel = feedbackRef.current;
    if (!panel) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    let scroller = panel.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (!scroller) {
      panel.scrollIntoView({ block: "nearest", behavior });
      return;
    }
    const delta = scrollDeltaFor(scroller, panel);
    if (delta > 0) scroller.scrollBy({ top: delta, behavior });
  }, [revealed, index, newUi]);

  // The bar under the player moves between questions here; past the last one it moves to the next activity.
  useItemNav(activityId, {
    canNext: () => index < content.questions.length - 1,
    canBack: () => index > 0,
    next: () => goTo(index + 1),
    back: () => goTo(index - 1),
  });

  // A quiz finishes only when every question has an answer: questions passed over come back first.
  const pending = nextUnanswered(answersByQ, index);
  const handleNext = () => {
    if (isLast) {
      if (pending !== null) goTo(pending);
      else onComplete();
      return;
    }
    goTo(index + 1);
  };
  const nextLabel =
    isLast && pending !== null
      ? t("purpose.goToQuestion").replace("{n}", String(pending + 1))
      : isLast
        ? t("session.finishQuiz")
        : t("session.nextQuestion");

  /** Each question's mark so far: true right, false wrong, null not answered. */
  const marks = answersByQ.map((a, i) => (a === null ? null : a === content.questions[i].correctIndex));

  return (
    <div className="space-y-4">
      <ConfettiBurst burst={burst} />
      <div className="flex items-center justify-between gap-4">
        {index > 0 && !(newUi && hideBack) && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground",
              newUi && "-my-3 -ml-2 min-h-11 px-2 text-[13px] font-semibold",
            )}
          >
            <ArrowLeft className="h-3 w-3" />
            {t("session.back")}
          </button>
        )}
        <span data-scroll-line className={cn("text-caption text-muted-foreground tabular-nums", newUi && "text-small font-semibold")} aria-live="polite">
          {t("session.question")} {index + 1} {t("session.of")}{" "}
          {content.questions.length}
          {index > 0 && ` · ${correctCount} ${t("session.correctSoFar")}`}
        </span>
        {newUi && <RunBadge className="mr-auto" run={runOfRight(marks, revealed ? index + 1 : index)} />}
        {newUi ? (
          <ItemDots current={index} states={marks.map((m, i) => (m === null || (i === index && !revealed) ? "todo" : m ? "right" : "wrong"))} />
        ) : (
        <div className="flex gap-1 w-32" aria-hidden>
          {content.questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                newUi ? "h-1.5 flex-1 rounded-full transition-colors duration-300" : "h-1 flex-1 rounded-full",
                // Answered questions fill in; the current one is half-tone.
                (newUi ? answersByQ[i] !== null && i !== index : i < index)
                  ? "bg-accent"
                  : i === index
                    ? revealed && newUi ? "bg-accent" : "bg-accent/40"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
        )}
      </div>

      <p key={`q-${index}`} data-scroll-line data-dictation-stem className={newUi ? "life-rise text-[20px] font-extrabold leading-[1.3] sm:text-[22px]" : "text-ui font-medium"}>
        <McqQuestionBody text={question.question} figures={question.figures} options={question.options} />
      </p>

      <div key={`o-${index}`} style={{ ["--i" as string]: 1 }} className={cn(newUi && "life-rise", optionsHaveFigures(question.options) ? "grid grid-cols-2 gap-2" : newUi ? "space-y-3" : "space-y-2")}>
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            data-scroll-line
            data-voice-choice={String.fromCharCode(65 + i)}
            data-voice-choice-text={option}
            aria-pressed={!revealed ? selected === i : undefined}
            onClick={() => !revealed && setSelected(i)}
            disabled={revealed}
            className={cn(
              newUi
                ? // Soft answer pills, lettered like an exam paper: a tinted fill instead of an outline, a ring once picked, green or rose once marked; a pop when picked, a shake when wrong.
                  "min-h-[60px] w-full touch-manipulation text-left rounded-[30px] px-3.5 py-3 text-ui font-semibold text-foreground ring-inset transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100 sm:px-4"
                : "w-full text-left p-3 rounded-lg border text-sm",
              !revealed && selected === i && (newUi ? "life-pop bg-[color-mix(in_srgb,var(--accent)_10%,#fff)] ring-2 ring-accent" : "border-accent bg-accent/5"),
              !revealed && selected !== i && (newUi ? "bg-muted hover:bg-[var(--edge)]" : "border-border hover:border-accent/30 hover:bg-muted/30"),
              revealed && i === question.correctIndex && (newUi ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500" : "border-success bg-success/5"),
              revealed && selected === i && i !== question.correctIndex && (newUi ? "life-shake bg-rose-50 text-rose-900 ring-2 ring-rose-400" : "border-red-500 bg-red-500/5"),
              revealed && selected !== i && i !== question.correctIndex && (newUi ? "bg-muted opacity-55" : "opacity-50"),
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  newUi ? "flex h-8 w-8 items-center justify-center rounded-full text-small font-extrabold flex-shrink-0" : "flex h-6 w-6 items-center justify-center rounded-full text-caption font-medium flex-shrink-0",
                  !revealed && selected === i && (newUi ? "bg-accent text-accent-foreground" : "bg-accent text-accent-foreground"),
                  !revealed && selected !== i && (newUi ? "bg-card text-foreground" : "bg-muted text-muted-foreground"),
                  revealed && i === question.correctIndex && (newUi ? "bg-emerald-600 text-white" : "bg-success text-white"),
                  revealed && selected === i && i !== question.correctIndex && (newUi ? "bg-rose-600 text-white" : "bg-red-500 text-white"),
                  revealed && selected !== i && i !== question.correctIndex && newUi && "bg-card text-foreground",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 min-w-0">
                <McqOptionBody text={option} figures={question.figures} />
              </span>
              {revealed && i === question.correctIndex && (
                <CheckCircle2 className={cn("flex-shrink-0", newUi ? "h-5 w-5 text-emerald-600" : "h-4 w-4 text-success")} />
              )}
              {revealed && selected === i && i !== question.correctIndex && (
                <XCircle className={cn("flex-shrink-0", newUi ? "h-5 w-5 text-rose-600" : "h-4 w-4 text-red-500")} />
              )}
            </div>
          </button>
        ))}
      </div>

      {!revealed && (
        <div className={cn("flex justify-end", newUi && (onHint || voiceOn) && "flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between")}>
          {newUi && (onHint || voiceOn) && (
            <div className="flex items-center justify-center gap-3 sm:justify-start" data-testid="mcq-aside-actions">
              {voiceOn && <VoiceAnswerButton />}
              {onHint && (
                <button
                  type="button"
                  onClick={() => onHint(index)}
                  className="-my-1 inline-flex min-h-11 items-center justify-center px-2 text-[14px] font-bold text-muted-foreground underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-foreground"
                >
                  {t("purpose.hint")}
                </button>
              )}
            </div>
          )}
          <Button
            variant="primary"
            size={newUi ? "lg" : "sm"}
            className={newUi ? "btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold disabled:shadow-none sm:w-auto sm:min-w-[200px]" : undefined}
            onClick={handleSubmit}
            disabled={selected === null}
          >
            {t("session.checkAnswer")}
          </Button>
        </div>
      )}

      {revealed && newUi && (
        <div ref={feedbackRef} className="scroll-mt-3 scroll-mb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <FeedbackCard
          ok={isCorrect}
          title={isCorrect ? t("session.correct") : t("session.notQuite")}
          message={<MarkdownText text={question.explanation} />}
          primary={nextLabel}
          onPrimary={handleNext}
          note={isCorrect ? undefined : t("today.savedToMistakes")}
          aside={onWhy ? { label: t("purpose.why"), onClick: () => onWhy(index) } : undefined}
        />
        </div>
      )}
      {revealed && !newUi && (
        <div className="pt-3 border-t border-border">
          <p
            className={cn(
              "font-medium text-caption mb-1",
              isCorrect ? "text-success" : "text-red-500",
            )}
          >
            {isCorrect ? t("session.correct") : t("session.notQuite")}
          </p>
          <p className="text-caption text-muted-foreground leading-5">
            <MarkdownText text={question.explanation} />
          </p>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={handleNext}>
              {nextLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * How far to scroll `scroller` so `panel` clears the bottom bar (its
 * scroll-margin-bottom) — then a little further while that would leave a line
 * above it (`h1`, `[data-scroll-line]`) half under the top edge, never so far
 * that the panel's own top goes past its scroll-margin-top.
 */
function scrollDeltaFor(scroller: HTMLElement, panel: HTMLElement): number {
  const box = scroller.getBoundingClientRect();
  const p = panel.getBoundingClientRect();
  const style = getComputedStyle(panel);
  const marginBottom = parseFloat(style.scrollMarginBottom) || 0;
  const marginTop = parseFloat(style.scrollMarginTop) || 0;
  let delta = p.bottom + marginBottom - box.bottom;
  if (delta <= 0) return 0;
  const maxDelta = Math.max(0, p.top - box.top - marginTop);
  const need = delta;
  const cap = Math.max(maxDelta, need);
  const lines = Array.from(scroller.querySelectorAll<HTMLElement>("h1, [data-scroll-line]"))
    .map((el) => ({ r: el.getBoundingClientRect(), lh: parseFloat(getComputedStyle(el).lineHeight) || 0 }))
    .filter(({ r }) => r.height > 0 && r.bottom <= p.top)
    .sort((a, b) => a.r.top - b.r.top);
  for (const { r, lh } of lines) {
    if (r.top - delta >= box.top || r.bottom - delta <= box.top) continue;
    // Cut by the top edge: scroll it fully out of view if the panel allows…
    if (r.bottom - box.top <= cap) {
      delta = r.bottom - box.top;
      continue;
    }
    // …otherwise land on a line break of a multi-line block, never mid-line.
    if (lh > 0) {
      const into = box.top + delta - r.top;
      const down = r.top - box.top + Math.ceil(into / lh) * lh;
      delta = down <= cap ? down : r.top - box.top + Math.floor(into / lh) * lh;
    }
  }
  return Math.min(Math.max(delta, 0), cap);
}
