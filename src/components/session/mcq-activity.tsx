"use client";

import { useState } from "react";
import { McqContent } from "@/types";
import { useActivityDraft } from "@/lib/use-activity-draft";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface McqActivityProps {
  activityId: string;
  content: McqContent;
  draft?: Record<string, unknown>;
  onAnswer: (questionIndex: number, selectedIndex: number) => void;
  onComplete: () => void;
}

export function McqActivity({
  activityId,
  content,
  draft,
  onAnswer,
  onComplete,
}: McqActivityProps) {
  const { t } = useI18n();
  const restored = draft as
    | Partial<{ index: number; correctCount: number }>
    | undefined;
  const [index, setIndex] = useState(
    Math.min(restored?.index ?? 0, content.questions.length - 1),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(restored?.correctCount ?? 0);
  const [burst, setBurst] = useState(0);

  useActivityDraft(activityId, { index, correctCount });

  const question = content.questions[index];
  const isLast = index === content.questions.length - 1;
  const isCorrect = selected === question.correctIndex;

  const handleSubmit = () => {
    if (selected === null) return;
    onAnswer(index, selected);
    if (selected === question.correctIndex) {
      setCorrectCount((c) => c + 1);
      setBurst((b) => b + 1);
    }
    setRevealed(true);
  };

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  };

  return (
    <div className="space-y-4">
      <ConfettiBurst burst={burst} />
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("session.question")} {index + 1} {t("session.of")}{" "}
          {content.questions.length}
          {index > 0 && ` · ${correctCount} ${t("session.correctSoFar")}`}
        </span>
        <div className="flex gap-1 w-32">
          {content.questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < index ? "bg-accent" : i === index ? "bg-accent/40" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <p className="text-sm font-medium leading-relaxed">
        <MarkdownText text={question.question} />
      </p>

      <div className="space-y-2">
        {question.options.map((option, i) => (
          <button
            key={i}
            type="button"
            onClick={() => !revealed && setSelected(i)}
            disabled={revealed}
            className={cn(
              "w-full text-left p-3 rounded-lg border text-sm",
              !revealed && selected === i && "border-accent bg-accent/5",
              !revealed && selected !== i && "border-border hover:border-accent/30 hover:bg-muted/30",
              revealed && i === question.correctIndex && "border-success bg-success/5",
              revealed && selected === i && i !== question.correctIndex && "border-red-500 bg-red-500/5",
              revealed && selected !== i && i !== question.correctIndex && "opacity-50",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
                  !revealed && selected === i && "bg-accent text-accent-foreground",
                  !revealed && selected !== i && "bg-muted text-muted-foreground",
                  revealed && i === question.correctIndex && "bg-success text-white",
                  revealed && selected === i && i !== question.correctIndex && "bg-red-500 text-white",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 min-w-0">
                <MarkdownText text={option} />
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
            size="sm"
            onClick={handleSubmit}
            disabled={selected === null}
          >
            {t("session.checkAnswer")}
          </Button>
        </div>
      )}

      {revealed && (
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
