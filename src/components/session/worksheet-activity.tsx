"use client";

import { useState } from "react";
import { WorksheetContent, WorksheetPart } from "@/types";
import { WorksheetFigureCard } from "@/components/graphics/worksheet-figures";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";

interface WorksheetActivityProps {
  content: WorksheetContent;
  onComplete: () => void;
}

const isPartCorrect = (part: WorksheetPart, value: string) => {
  if (!part.answer) return value.trim().length > 0;
  if (part.type === "text")
    return value.trim().toLowerCase().includes(part.answer.toLowerCase());
  return value.trim().toLowerCase() === part.answer.toLowerCase();
};

export function WorksheetActivity({
  content,
  onComplete,
}: WorksheetActivityProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  const step = content.steps[stepIndex];
  const checked = !!checkedSteps[stepIndex];
  const isLastStep = stepIndex === content.steps.length - 1;
  const key = (partIdx: number) => `${stepIndex}-${partIdx}`;

  const totalMarks = step.parts.reduce((s, p) => s + (p.marks ?? 1), 0);
  const earnedMarks = step.parts.reduce(
    (s, p, i) => s + (isPartCorrect(p, answers[key(i)] ?? "") ? (p.marks ?? 1) : 0),
    0,
  );
  const allAnswered = step.parts.every((_, i) => (answers[key(i)] ?? "").trim());

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Step header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        {content.source?.generatedByAi && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent-dim mb-2">
            <Sparkles className="h-3 w-3" />
            Generated from {content.source.file}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">
            Question {stepIndex + 1} — {step.title}
          </p>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {stepIndex + 1} of {content.steps.length} · {totalMarks} marks
          </span>
        </div>
        <div className="flex gap-1 mt-3">
          {content.steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < stepIndex || checkedSteps[i]
                  ? "bg-accent"
                  : i === stepIndex
                    ? "bg-accent/40"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {step.intro && (
          <p className="text-sm leading-6 text-foreground">{step.intro}</p>
        )}

        {step.figure && <WorksheetFigureCard data={step.figure} />}

        {/* Sub-questions */}
        <div className="space-y-4">
          {step.parts.map((part, i) => {
            const value = answers[key(i)] ?? "";
            const correct = isPartCorrect(part, value);
            return (
              <div key={part.label} className="flex gap-3">
                <span className="mt-1.5 h-6 w-6 shrink-0 rounded-full bg-muted text-[11px] font-bold flex items-center justify-center">
                  {part.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm leading-6">{part.prompt}</p>
                    <span className="text-[11px] text-faint shrink-0 tabular-nums">
                      [{part.marks ?? 1}]
                    </span>
                  </div>
                  {part.type === "true_false" ? (
                    <div className="flex gap-2 mt-2">
                      {["True", "False"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={checked && correct}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [key(i)]: opt }))
                          }
                          className={cn(
                            "px-4 py-1.5 rounded-lg border text-sm font-medium",
                            value === opt
                              ? checked
                                ? correct
                                  ? "border-accent bg-accent-soft text-accent-dim"
                                  : "border-rose bg-rose/5 text-rose"
                                : "border-foreground bg-foreground text-background"
                              : "border-border-strong bg-background hover:border-foreground/40",
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={value}
                      rows={part.type === "numeric" ? 1 : 2}
                      disabled={checked && correct}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [key(i)]: e.target.value }))
                      }
                      placeholder={
                        part.type === "numeric"
                          ? "Your value…"
                          : "Your working and answer…"
                      }
                      className={cn(
                        "mt-2 w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none",
                        checked
                          ? correct
                            ? "border-accent bg-accent-soft/50"
                            : "border-rose bg-rose/5"
                          : "border-border-strong bg-background focus:border-accent/60",
                      )}
                    />
                  )}
                  {checked && !correct && part.answer && (
                    <p className="text-xs text-rose mt-1.5">
                      Expected: {part.answer}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          {checked ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {earnedMarks}/{totalMarks} marks on this question
            </p>
          ) : (
            <span />
          )}
          {checked ? (
            isLastStep ? (
              <Button size="sm" onClick={onComplete}>
                Finish worksheet
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStepIndex((s) => s + 1)}>
                Next question
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )
          ) : (
            <Button
              size="sm"
              disabled={!allAnswered}
              onClick={() =>
                setCheckedSteps((c) => ({ ...c, [stepIndex]: true }))
              }
            >
              Check answers
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
