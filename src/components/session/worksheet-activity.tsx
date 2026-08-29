"use client";

import { useState } from "react";
import { PartMarking, WorksheetContent, WorksheetPart } from "@/types";
import { markWorksheetAnswer } from "@/lib/api/study";
import { toast } from "@/lib/toast";
import { recordWorksheetQuestionProgress } from "@/lib/api/study-session";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { WorksheetFigureCard } from "@/components/graphics/worksheet-figures";
import { FigureView } from "@/components/session/reading-activity";
import { MarkdownText, MathText } from "@/components/ui/markdown-text";
import { DrawingCanvas } from "@/components/ui/drawing-canvas";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Loader2, PenLine, X } from "lucide-react";

interface WorksheetActivityProps {
  activityId: string;
  content: WorksheetContent;
  draft?: Record<string, unknown>;
  onComplete: () => void;
}

interface WorksheetDraft {
  stepIndex: number;
  answers: Record<string, string>;
  drawings: Record<string, string | null>;
  markings: Record<string, PartMarking>;
  checkedSteps: Record<number, boolean>;
}

const isPartCorrect = (part: WorksheetPart, value: string) => {
  if (!part.answer) return value.trim().length > 0;
  if (part.type === "text")
    return value.trim().toLowerCase().includes(part.answer.toLowerCase());
  return value.trim().toLowerCase() === part.answer.toLowerCase();
};

/** Marking without an LLM markscheme — all-or-nothing on the expected answer. */
const localMarking = (part: WorksheetPart, value: string): PartMarking => {
  const marks = part.marks ?? 1;
  const correct = isPartCorrect(part, value);
  return {
    points: [],
    achievedPoints: correct ? marks : 0,
    totalPoints: marks,
    correct,
  };
};

export function WorksheetActivity({
  activityId,
  content,
  draft,
  onComplete,
}: WorksheetActivityProps) {
  const { t } = useI18n();
  const restored = restoredDraft(activityId, draft) as Partial<WorksheetDraft> | undefined;
  const [stepIndex, setStepIndex] = useState(restored?.stepIndex ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    restored?.answers ?? {},
  );
  const [drawings, setDrawings] = useState<Record<string, string | null>>(
    restored?.drawings ?? {},
  );
  const [drawingOpen, setDrawingOpen] = useState<Record<string, boolean>>({});
  const [markings, setMarkings] = useState<Record<string, PartMarking>>(
    restored?.markings ?? {},
  );
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>(
    restored?.checkedSteps ?? {},
  );
  const [markingInFlight, setMarkingInFlight] = useState(false);

  useActivityDraft(activityId, {
    stepIndex,
    answers,
    drawings,
    markings,
    checkedSteps,
  });

  const step = content.steps[stepIndex];
  const checked = !!checkedSteps[stepIndex];
  const isLastStep = stepIndex === content.steps.length - 1;
  const key = (partIdx: number) => `${stepIndex}-${partIdx}`;
  /** Questions the learner has already seen are revisitable. */
  const visited = (i: number) =>
    i <= stepIndex || !!checkedSteps[i] || !!checkedSteps[i - 1];

  const totalMarks = step.parts.reduce((s, p) => s + (p.marks ?? 1), 0);
  const earnedMarks = step.parts.reduce(
    (s, _, i) => s + (markings[key(i)]?.achievedPoints ?? 0),
    0,
  );
  const allAnswered = step.parts.every(
    (_, i) => (answers[key(i)] ?? "").trim() || drawings[key(i)],
  );

  const checkStep = async () => {
    setMarkingInFlight(true);
    const results = await Promise.all(
      step.parts.map(async (part, i) => {
        const value = answers[key(i)] ?? "";
        const drawing = drawings[key(i)] ?? undefined;
        // Free-text parts with a markscheme (or a drawing attached) go
        // through LLM marking; numeric / true-false parts are checked locally.
        if (
          part.type !== "text" ||
          (!part.markScheme?.points.length && !drawing)
        ) {
          return localMarking(part, value);
        }
        try {
          return await markWorksheetAnswer({
            activityId,
            stepIndex,
            partIndex: i,
            answer: value,
            answerImage: drawing,
          });
        } catch {
          toast.error(t("session.markingFallback"), {
            id: "marking-fallback",
          });
          return localMarking(part, value);
        }
      }),
    );
    setMarkings((m) => {
      const next = { ...m };
      results.forEach((r, i) => (next[key(i)] = r));
      return next;
    });
    step.parts.forEach((part, i) => {
      if (!part.worksheetQuestionId) return;
      recordWorksheetQuestionProgress({
        problemId: part.worksheetQuestionId,
        completed: true,
        answer: answers[key(i)] ?? "",
        correct: results[i]?.correct ?? false,
      }).catch(() => {});
    });
    setCheckedSteps((c) => ({ ...c, [stepIndex]: true }));
    setMarkingInFlight(false);
  };

  return (
    <div>
      {/* Step header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold">
            {t("session.question")} {stepIndex + 1} —{" "}
            <MathText
              text={step.title.replace(/^question\s*\d+\s*[—–:.-]?\s*/i, "")}
            />
          </p>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {stepIndex + 1} {t("session.of")} {content.steps.length} ·{" "}
            {totalMarks} {t("session.marks")}
          </span>
        </div>
        <div className="flex gap-1 mt-3">
          {content.steps.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={!visited(i) || markingInFlight}
              aria-label={`${t("session.question")} ${i + 1}`}
              onClick={() => setStepIndex(i)}
              className={cn(
                "h-2.5 flex-1 rounded-full py-1 transition-colors",
                visited(i) && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "block h-1 w-full rounded-full",
                  i < stepIndex || checkedSteps[i]
                    ? "bg-accent"
                    : i === stepIndex
                      ? "bg-accent/40"
                      : "bg-muted",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="py-5 space-y-5">
        {step.intro && (
          <p className="text-sm leading-6 text-foreground">
            <MarkdownText text={step.intro} />
          </p>
        )}

        {step.figure && <WorksheetFigureCard data={step.figure} />}
        {step.figures?.map((figure) => (
          <FigureView key={figure.id} figure={figure} />
        ))}

        {/* Sub-questions */}
        <div className="space-y-4">
          {step.parts.map((part, i) => {
            const value = answers[key(i)] ?? "";
            const marking = markings[key(i)];
            const correct = marking?.correct ?? false;
            const partial =
              !!marking && !marking.correct && marking.achievedPoints > 0;
            return (
              <div key={part.label} className="flex gap-3">
                <span className="mt-1.5 h-6 w-6 shrink-0 rounded-full bg-muted text-[11px] font-bold flex items-center justify-center">
                  {part.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm leading-6">
                      <MarkdownText text={part.prompt} />
                    </p>
                    <span className="text-[11px] text-faint shrink-0 tabular-nums">
                      {checked && marking
                        ? `${marking.achievedPoints}/${marking.totalPoints}`
                        : `[${part.marks ?? 1}]`}
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
                          {opt === "True"
                            ? t("session.true")
                            : t("session.false")}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={value}
                      rows={part.type === "numeric" ? 1 : 2}
                      disabled={(checked && correct) || markingInFlight}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [key(i)]: e.target.value }))
                      }
                      placeholder={
                        part.type === "numeric"
                          ? t("session.numericPlaceholder")
                          : t("session.textPlaceholder")
                      }
                      className={cn(
                        "mt-2 w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none",
                        checked
                          ? correct
                            ? "border-accent bg-accent-soft/50"
                            : partial
                              ? "border-amber bg-amber/5"
                              : "border-rose bg-rose/5"
                          : "border-border-strong bg-background focus:border-accent/60",
                      )}
                    />
                  )}

                  {part.type === "text" && !drawingOpen[key(i)] && !checked && (
                    <button
                      type="button"
                      onClick={() =>
                        setDrawingOpen((d) => ({ ...d, [key(i)]: true }))
                      }
                      className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <PenLine className="h-3 w-3" />
                      {t("session.addDrawing")}
                    </button>
                  )}
                  {part.type === "text" && drawingOpen[key(i)] && (
                    <DrawingCanvas
                      className="mt-2"
                      disabled={(checked && correct) || markingInFlight}
                      onChange={(dataUrl) =>
                        setDrawings((d) => ({ ...d, [key(i)]: dataUrl }))
                      }
                    />
                  )}

                  {/* Markscheme breakdown (LLM-marked parts) */}
                  {checked && marking && marking.points.length > 0 && (
                    <div className="mt-2 rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 border-b border-border">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("session.markScheme")}
                        </p>
                        <span
                          className={cn(
                            "text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5",
                            correct
                              ? "bg-accent-soft text-accent-dim"
                              : partial
                                ? "bg-amber/10 text-amber"
                                : "bg-rose/10 text-rose",
                          )}
                        >
                          {marking.achievedPoints}/{marking.totalPoints}{" "}
                          {t("session.marks")}
                        </span>
                      </div>
                      <div className="divide-y divide-border bg-card">
                        {marking.points.map((point, j) => {
                          const earned = point.achievedPoints >= point.point;
                          return (
                            <div key={j} className="px-3 py-2">
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={cn(
                                    "mt-0.5 shrink-0 h-4.5 rounded px-1.5 text-[10px] font-bold tabular-nums flex items-center",
                                    earned
                                      ? "bg-accent-soft text-accent-dim"
                                      : "bg-rose/10 text-rose",
                                  )}
                                >
                                  M{j + 1}
                                </span>
                                <p className="flex-1 min-w-0 text-xs leading-5">
                                  <MarkdownText text={point.requirements} />
                                </p>
                                <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                                  {earned ? (
                                    <Check className="h-3.5 w-3.5 text-accent" />
                                  ) : (
                                    <X className="h-3.5 w-3.5 text-rose" />
                                  )}
                                  {point.achievedPoints}/{point.point}
                                </span>
                              </div>
                              {point.feedback && !earned && (
                                <p className="mt-1 pl-8 text-[11px] leading-4 text-muted-foreground">
                                  <MarkdownText text={point.feedback} />
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {checked &&
                    marking &&
                    marking.points.length === 0 &&
                    !correct &&
                    part.answer && (
                      <p className="text-xs text-rose mt-1.5">
                        {t("session.expected")} {part.answer}
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={markingInFlight}
                onClick={() => setStepIndex((s) => s - 1)}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                {t("session.back")}
              </Button>
            )}
            {checked && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {earnedMarks}/{totalMarks} {t("session.marksOnQuestion")}
              </p>
            )}
          </div>
          {checked ? (
            isLastStep ? (
              <Button size="sm" onClick={onComplete}>
                {t("session.finishWorksheet")}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStepIndex((s) => s + 1)}>
                {t("session.nextQuestion")}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )
          ) : (
            <Button
              size="sm"
              disabled={!allAnswered || markingInFlight}
              onClick={checkStep}
            >
              {markingInFlight ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t("session.marking")}
                </>
              ) : (
                t("session.checkAnswers")
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
