"use client";

import { useState } from "react";
import { ClozeContent } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface ClozeActivityProps {
  content: ClozeContent;
  onComplete: () => void;
}

export function ClozeActivity({ content, onComplete }: ClozeActivityProps) {
  const passage = content.passages[0];
  const parts = passage.textWithBlanks.split("___");
  const [answers, setAnswers] = useState<string[]>(
    passage.answers.map(() => ""),
  );
  const [checked, setChecked] = useState(false);

  const isCorrect = (i: number) =>
    answers[i].trim().toLowerCase() === passage.answers[i].toLowerCase();
  const allCorrect = passage.answers.every((_, i) => isCorrect(i));
  const correctCount = passage.answers.filter((_, i) => isCorrect(i)).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
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
                disabled={checked && isCorrect(i)}
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
        <p className="text-xs text-muted-foreground mt-4">
          {correctCount}/{passage.answers.length} correct — fix the red ones
          and check again.
        </p>
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
            onClick={() => setChecked(true)}
            disabled={answers.some((a) => !a.trim())}
          >
            Check answers
          </Button>
        )}
      </div>
    </div>
  );
}
