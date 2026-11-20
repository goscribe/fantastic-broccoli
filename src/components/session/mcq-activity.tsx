"use client";

import { useEffect, useRef, useState } from "react";
import { McqOptionBody, McqQuestionBody, optionsHaveFigures } from "@/components/session/mcq-rich";
import { McqContent } from "@/types";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useReportCurrentItem } from "@/lib/current-item";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { FeedbackCard } from "@/components/session/feedback-card";
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
}

export function McqActivity({
  activityId,
  content,
  draft,
  onAnswer,
  onComplete,
  onAllAnswered,
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

  // Bring the result into view above the bottom bar on short phone screens.
  useEffect(() => {
    if (!revealed || !newUi) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [revealed, index, newUi]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    goTo(index + 1);
  };

  return (
    <div className="space-y-4">
      <ConfettiBurst burst={burst} />
      <div className="flex items-center justify-between gap-4">
        {index > 0 && (
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
        <span className={cn("text-xs text-muted-foreground tabular-nums", newUi && "text-[13px] font-semibold")} aria-live="polite">
          {t("session.question")} {index + 1} {t("session.of")}{" "}
          {content.questions.length}
          {index > 0 && ` · ${correctCount} ${t("session.correctSoFar")}`}
        </span>
        <div className={cn("flex gap-1", newUi ? "w-24 shrink-0 sm:w-32" : "w-32")} aria-hidden>
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
      </div>

      <p className={newUi ? "text-[18px] font-bold leading-[1.35] sm:text-[20px]" : "text-sm font-medium leading-relaxed"}>
        <McqQuestionBody text={question.question} figures={question.figures} options={question.options} />
      </p>

      <div className={optionsHaveFigures(question.options) ? "grid grid-cols-2 gap-2" : newUi ? "space-y-2.5" : "space-y-2"}>
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => !revealed && setSelected(i)}
            disabled={revealed}
            className={cn(
              newUi
                ? "min-h-[52px] w-full touch-manipulation text-left rounded-[14px] border bg-card px-3.5 py-3 text-[15px] font-medium leading-snug transition-colors duration-150 active:scale-[0.99] motion-reduce:active:scale-100 sm:px-4"
                : "w-full text-left p-3 rounded-lg border text-sm",
              !revealed && selected === i && (newUi ? "border-accent bg-accent-soft" : "border-accent bg-accent/5"),
              !revealed && selected !== i && "border-border hover:border-accent/30 hover:bg-muted/30",
              revealed && i === question.correctIndex && "border-success bg-success/5",
              revealed && selected === i && i !== question.correctIndex && "border-red-500 bg-red-500/5",
              revealed && selected !== i && i !== question.correctIndex && "opacity-50",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  newUi ? "flex h-7 w-7 items-center justify-center rounded-lg text-[13px] font-semibold flex-shrink-0" : "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                  !revealed && selected === i && "bg-accent text-accent-foreground",
                  !revealed && selected !== i && "bg-muted text-muted-foreground",
                  revealed && i === question.correctIndex && "bg-success text-white",
                  revealed && selected === i && i !== question.correctIndex && "bg-red-500 text-white",
                )}
              >
                {newUi ? i + 1 : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 min-w-0">
                <McqOptionBody text={option} figures={question.figures} />
              </span>
              {revealed && i === question.correctIndex && (
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              )}
              {revealed && selected === i && i !== question.correctIndex && (
                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {!revealed && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size={newUi ? "lg" : "sm"}
            className={newUi ? "w-full rounded-xl sm:w-auto" : undefined}
            onClick={handleSubmit}
            disabled={selected === null}
          >
            {t("session.checkAnswer")}
          </Button>
        </div>
      )}

      {revealed && newUi && (
        <div ref={feedbackRef} className="scroll-mb-28">
        <FeedbackCard
          ok={isCorrect}
          title={isCorrect ? t("session.correct") : t("session.notQuite")}
          message={<MarkdownText text={question.explanation} />}
          primary={isLast ? t("session.finishQuiz") : t("session.nextQuestion")}
          onPrimary={handleNext}
          note={isCorrect ? undefined : t("today.savedToMistakes")}
        />
        </div>
      )}
      {revealed && !newUi && (
        <div className="pt-3 border-t border-border">
          <p
            className={cn(
              "font-medium text-xs mb-1",
              isCorrect ? "text-success" : "text-red-500",
            )}
          >
            {isCorrect ? t("session.correct") : t("session.notQuite")}
          </p>
          <p className="text-xs text-muted-foreground leading-5">
            <MarkdownText text={question.explanation} />
          </p>
          <div className="flex justify-end mt-3">
            <Button variant="ghost" size="sm" onClick={handleNext}>
              {isLast ? t("session.finishQuiz") : t("session.nextQuestion")}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
