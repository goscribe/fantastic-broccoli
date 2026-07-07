"use client";

import { useState } from "react";
import { ClozeContent } from "@/types";
import { markClozeAnswers } from "@/lib/api/study";
import { recordFlashcardAttempt } from "@/lib/api/study-session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";

interface ClozeActivityProps {
  activityId: string;
  content: ClozeContent;
  onComplete: () => void;
}

interface BlankResult {
  correct: boolean;
  feedback: string;
}

export function ClozeActivity({
  activityId,
  content,
  onComplete,
}: ClozeActivityProps) {
  const passage = content.passages[0];
  const parts = passage.textWithBlanks.split("___");
  const [answers, setAnswers] = useState<string[]>(
    passage.answers.map(() => ""),
  );
  const [results, setResults] = useState<BlankResult[] | null>(null);
  const [marking, setMarking] = useState(false);

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
      marked = passage.answers.map((_, i) => localResult(i));
    }
    setResults(marked);
    recordProgress(marked);
    setMarking(false);
  };

  const checked = results !== null;
  const isCorrect = (i: number) => results?.[i]?.correct ?? false;
  const allCorrect = checked && passage.answers.every((_, i) => isCorrect(i));
  const correctCount = passage.answers.filter((_, i) => isCorrect(i)).length;
  const feedbacks = (results ?? []).filter((r) => !r.correct && r.feedback);

  return (
    <div>
      <p className="text-sm font-semibold mb-4">
        Fill in the missing terms from memory
      </p>

      <p className="text-[15px] leading-8 text-foreground">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
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
                  "mx-1 inline-block w-32 rounded-lg border px-2.5 py-1 text-sm text-center font-medium focus:outline-none",
                  checked
                    ? isCorrect(i)
                      ? "border-accent bg-accent-soft text-accent-dim"
                      : "border-rose bg-rose/5 text-rose"
                    : "border-border-strong bg-background focus:border-accent/60",
                )}
              />
            )}
          </span>
        ))}
      </p>

      {checked && !allCorrect && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {correctCount}/{passage.answers.length} correct — fix the red ones
            and check again.
          </p>
          {feedbacks.map((r, i) => (
            <p key={i} className="text-xs text-rose">
              {r.feedback}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-5">
        {checked && allCorrect ? (
          <Button size="sm" onClick={onComplete}>
            Continue
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={checkAnswers}
            disabled={marking || answers.some((a) => !a.trim())}
          >
            {marking && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {marking ? "Marking…" : "Check answers"}
          </Button>
        )}
      </div>
    </div>
  );
}
