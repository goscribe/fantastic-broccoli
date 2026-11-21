"use client";

import { useNewUi } from "@/lib/new-ui";
import { useState } from "react";
import { ClozeContent } from "@/types";
import { markClozeAnswers } from "@/lib/api/study";
import { toast } from "@/lib/toast";
import { recordFlashcardAttempt } from "@/lib/api/study-session";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { InlineMarkdown, MathText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";
import { FeedbackCard } from "@/components/session/feedback-card";
import { PlayActions, PlayPrimary } from "@/components/session/play-ui";

interface ClozeActivityProps {
  activityId: string;
  sessionId?: string;
  content: ClozeContent;
  draft?: Record<string, unknown>;
  onComplete: () => void;
}

interface BlankResult {
  correct: boolean;
  feedback: string;
}

export function ClozeActivity({
  activityId,
  sessionId,
  content,
  draft,
  onComplete,
}: ClozeActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const passage = content.passages[0];
  const parts = passage.textWithBlanks.split(/_{2,}|\{\{blank\}\}/g);
  const restored = restoredDraft(activityId, draft) as
    | Partial<{ answers: string[]; results: BlankResult[] | null }>
    | undefined;
  const [answers, setAnswers] = useState<string[]>(
    restored?.answers?.length === passage.answers.length
      ? restored.answers
      : passage.answers.map(() => ""),
  );
  const [results, setResults] = useState<BlankResult[] | null>(
    restored?.results ?? null,
  );
  const [marking, setMarking] = useState(false);
  const [burst, setBurst] = useState(0);

  useActivityDraft(activityId, { answers, results });

  const localResult = (i: number): BlankResult => ({
    correct:
      answers[i].trim().toLowerCase() === passage.answers[i].toLowerCase(),
    feedback: "",
  });

  const recordProgress = (marked: BlankResult[]) => {
    passage.flashcardIds?.forEach((flashcardId, i) => {
      if (!flashcardId) return;
      recordFlashcardAttempt({
        flashcardId,
        isCorrect: marked[i]?.correct ?? false,
        studySessionId: sessionId,
        fromQuiz: true,
      }).catch(() => {});
    });
  };

  const checkAnswers = async () => {
    setMarking(true);
    let marked: BlankResult[];
    try {
      marked = await markClozeAnswers({
        activityId,
        passageIndex: 0,
        answers,
      });
    } catch {
      toast.error(t("session.markingFallback"), {
        id: "marking-fallback",
      });
      marked = passage.answers.map((_, i) => localResult(i));
    }
    setResults(marked);
    recordProgress(marked);
    if (marked.length > 0 && marked.every((r) => r.correct)) {
      setBurst((b) => b + 1);
    }
    setMarking(false);
  };

  const checked = results !== null;
  const isCorrect = (i: number) => results?.[i]?.correct ?? false;
  const allCorrect = checked && passage.answers.every((_, i) => isCorrect(i));
  const correctCount = passage.answers.filter((_, i) => isCorrect(i)).length;
  const feedbacks = (results ?? []).filter((r) => !r.correct && r.feedback);

  if (newUi) {
    return (
      <div>
        <p data-scroll-line className="mb-4 text-small font-semibold text-muted-foreground">
          {t("session.clozeInstruction")}
        </p>

        {/* The sentence sits on the page; each gap is a soft pill to type in, green once right, rose while it still needs fixing. */}
        <p className="text-[19px] font-semibold leading-[2.7] text-foreground sm:text-[20px]">
          {parts.map((part, i) => (
            <span key={i}>
              <InlineMarkdown text={part} />
              {i < passage.answers.length && (
                <input
                  type="text"
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !marking && answers.every((a) => a.trim())) void checkAnswers();
                  }}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`${t("session.clozeInstruction")} ${i + 1}`}
                  readOnly={marking || (checked && isCorrect(i))}
                  style={{ width: `${Math.max(8, Math.min(18, Math.max(answers[i].length, passage.answers[i].length) + 4))}ch` }}
                  className={cn(
                    "mx-1.5 inline-block h-11 max-w-full rounded-full px-4 text-center align-middle text-[17px] font-extrabold ring-inset transition-[background-color,box-shadow] duration-150 focus:outline-none motion-reduce:transition-none",
                    checked
                      ? isCorrect(i)
                        ? "life-pop bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                        : "life-shake bg-rose-50 text-rose-900 ring-2 ring-rose-400 focus:ring-rose-500"
                      : "bg-muted text-foreground focus:bg-card focus:ring-2 focus:ring-accent",
                  )}
                />
              )}
            </span>
          ))}
        </p>

        {checked && allCorrect ? (
          <FeedbackCard
            ok
            title={t("session.correct")}
            primary={t("session.continue")}
            onPrimary={onComplete}
          />
        ) : (
          <>
            {checked && (
              <div className="life-rise mt-4 space-y-1.5" role="status">
                <p className="text-ui font-bold text-foreground">
                  {correctCount}/{passage.answers.length} {t("session.clozeFixHint")}
                </p>
                {feedbacks.map((r, i) => (
                  <p key={i} className="text-ui text-foreground/80">
                    <MathText text={r.feedback} />
                  </p>
                ))}
              </div>
            )}
            <PlayActions className="mt-5">
              <PlayPrimary onClick={checkAnswers} disabled={marking || answers.some((a) => !a.trim())}>
                {marking && <Loader2 className="mr-2 size-4 animate-spin" />}
                {marking ? t("session.marking") : t("session.checkAnswers")}
              </PlayPrimary>
            </PlayActions>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <ConfettiBurst burst={burst} />
      <p className={newUi ? "mb-5 text-ui font-semibold text-muted-foreground" : "text-ui font-semibold mb-4"}>
        {t("session.clozeInstruction")}
      </p>

      <p className={newUi ? "text-read leading-[2.3] text-foreground" : "text-ui leading-8 text-foreground"}>
        {parts.map((part, i) => (
          <span key={i}>
            <InlineMarkdown text={part} />
            {i < passage.answers.length && (
              <input
                type="text"
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                disabled={marking || (checked && isCorrect(i))}
                className={cn(
                  newUi ? "mx-1 inline-block w-36 rounded-xl border-2 px-3 py-1.5 text-[15px] text-center font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent/15" : "mx-1 inline-block w-32 rounded-lg border px-2.5 py-1 text-sm text-center font-medium focus:outline-none",
                  checked
                    ? isCorrect(i)
                      ? "border-success bg-success/10 text-green-700 dark:text-green-400"
                      : "border-red-500 bg-red-500/5 text-red-600 dark:text-red-400"
                    : newUi
                      ? "border-dashed border-border bg-card focus:border-accent"
                      : "border-border-strong bg-background focus:border-accent/60",
                )}
              />
            )}
          </span>
        ))}
      </p>

      {checked && !allCorrect && (
        <div className="mt-4 space-y-1.5">
          <p className={newUi ? "text-small font-semibold text-muted-foreground" : "text-caption text-muted-foreground"}>
            {correctCount}/{passage.answers.length} {t("session.clozeFixHint")}
          </p>
          {feedbacks.map((r, i) => (
            <p key={i} className={newUi ? "text-small text-red-600 dark:text-red-400" : "text-caption text-red-600 dark:text-red-400"}>
              <MathText text={r.feedback} />
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-5">
        {checked && allCorrect ? (
          <Button size="sm" onClick={onComplete}>
            {t("session.continue")}
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={checkAnswers}
            disabled={marking || answers.some((a) => !a.trim())}
          >
            {marking && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {marking ? t("session.marking") : t("session.checkAnswers")}
          </Button>
        )}
      </div>
    </div>
  );
}
