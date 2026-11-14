"use client";

import { useNewUi } from "@/lib/new-ui";
import { useState } from "react";
import { PartMarking, WorksheetContent } from "@/types";
import { markWorksheetAnswer } from "@/lib/api/study";
import {
  resolvePartMarking,
  serverCanMarkPart,
} from "@/lib/worksheet-marking";
import { toast } from "@/lib/toast";
import { recordWorksheetQuestionProgress } from "@/lib/api/study-session";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useReportCurrentItem } from "@/lib/current-item";
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

export function WorksheetActivity({
  activityId,
  content,
  draft,
  onComplete,
}: WorksheetActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
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

  useReportCurrentItem(activityId, stepIndex);
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
        // Choice parts stay on the local check. Typed parts with a mark
        // scheme (or a drawing) are decided by the server — a failed local
        // comparison must not record them as wrong while that marker can run.
        // When the server returns a result, it wins over the local check.
        const serverCanDecide = serverCanMarkPart(part, drawing);
        if (!serverCanDecide) {
          return resolvePartMarking(part, value, { serverCanDecide: false });
        }
        try {
          const serverMarking = await markWorksheetAnswer({
            activityId,
            stepIndex,
            partIndex: i,
            answer: value,
            answerImage: drawing,
          });
          return resolvePartMarking(part, value, {
            serverMarking,
            serverCanDecide: true,
          });
        } catch {
          toast.error(t("session.markingFallback"), {
            id: "marking-fallback",
          });
          return resolvePartMarking(part, value, { serverCanDecide: true });
        }
      }),
    );
    const decided: PartMarking[] = [];
    for (const result of results) {
      if (!result) {
        // Typed answer didn't match the key, and the AI marker didn't
        // return a decision. Leave the step unmarked rather than wrong.
        setMarkingInFlight(false);
        return;
      }
      decided.push(result);
    }
    setMarkings((m) => {
      const next = { ...m };
      decided.forEach((r, i) => (next[key(i)] = r));
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
                <span className={cn("shrink-0 flex items-center justify-center font-bold", newUi ? "mt-1 h-7 w-7 rounded-lg bg-accent-soft text-[12px] text-accent-dim" : "mt-1.5 h-6 w-6 rounded-full bg-muted text-[11px]")}>
                  {part.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={newUi ? "text-[15px] leading-7" : "text-sm leading-6"}>
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
                            newUi ? "px-5 py-2 rounded-xl border text-[14px] font-semibold" : "px-4 py-1.5 rounded-lg border text-sm font-medium",
                            value === opt
                              ? checked
                                ? correct
                                  ? "border-success bg-success/10 text-green-700 dark:text-green-400"
                                  : "border-red-500 bg-red-500/5 text-red-600 dark:text-red-400"
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
                        newUi ? "mt-2.5 w-full rounded-xl border px-4 py-3 text-[15px] leading-relaxed resize-none transition-colors placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent/15" : "mt-2 w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none",
                        checked
                          ? correct
                            ? "border-success bg-success/5"
                            : partial
                              ? "border-amber bg-amber/5"
                              : "border-red-500 bg-red-500/5"
                          : newUi
                            ? "border-border bg-card focus:border-accent"
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
                    <div className={newUi ? "mt-3 rounded-2xl border border-border bg-card overflow-hidden shadow-[0_8px_24px_-16px_rgba(17,17,20,.2)]" : "mt-2 rounded-lg border border-border overflow-hidden"}>
                      <div className={cn("flex items-center justify-between border-b border-border", newUi ? "px-4 py-2.5" : "bg-muted/60 px-3 py-1.5")}>
                        <p className={newUi ? "text-[13px] font-semibold" : "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"}>
                          {t("session.markScheme")}
                        </p>
                        <span
                          className={cn(
                            newUi ? "text-[12px] font-bold tabular-nums rounded-full px-2.5 py-1" : "text-[11px] font-bold tabular-nums rounded-full px-2 py-0.5",
                            correct
                              ? "bg-success/10 text-green-700 dark:text-green-400"
                              : partial
                                ? "bg-amber/10 text-amber"
                                : "bg-red-500/10 text-red-600 dark:text-red-400",
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
                            <div key={j} className={newUi ? "px-4 py-3" : "px-3 py-2"}>
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={cn(
                                    newUi ? "mt-0.5 shrink-0 h-6 rounded-md px-2 text-[11px] font-bold tabular-nums flex items-center" : "mt-0.5 shrink-0 h-4.5 rounded px-1.5 text-[10px] font-bold tabular-nums flex items-center",
                                    earned
                                      ? "bg-success/10 text-green-700 dark:text-green-400"
                                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                                  )}
                                >
                                  M{j + 1}
                                </span>
                                <p className={newUi ? "flex-1 min-w-0 text-[13.5px] leading-6" : "flex-1 min-w-0 text-xs leading-5"}>
                                  <MarkdownText text={point.requirements} />
                                </p>
                                <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                                  {earned ? (
                                    <Check className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                                  ) : (
                                    <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                  )}
                                  {point.achievedPoints}/{point.point}
                                </span>
                              </div>
                              {point.feedback && !earned && (
                                <p className={newUi ? "mt-1.5 pl-10 text-[13px] leading-5 text-muted-foreground" : "mt-1 pl-8 text-[11px] leading-4 text-muted-foreground"}>
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
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
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
