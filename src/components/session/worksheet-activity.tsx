"use client";

import { useNewUi } from "@/lib/new-ui";
import { useEffect, useRef, useState } from "react";
import { PartMarking, WorksheetContent } from "@/types";
import { markWorksheetAnswer } from "@/lib/api/study";
import {
  resolvePartMarking,
  serverCanMarkPart,
} from "@/lib/worksheet-marking";
import { toast } from "@/lib/toast";
import { recordWorksheetQuestionProgress } from "@/lib/api/study-session";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useItemNav, useReportCurrentItem } from "@/lib/current-item";
import { WorksheetFigureCard } from "@/components/graphics/worksheet-figures";
import { FigureView } from "@/components/session/reading-activity";
import { MarkdownText, MathText } from "@/components/ui/markdown-text";
import { DrawingCanvas } from "@/components/ui/drawing-canvas";
import { RichAnswerField } from "@/components/ui/rich-answer-field";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/habits";
import { cn } from "@/lib/utils";
import { ItemDots, PlayPrimary, playField, playLink } from "@/components/session/play-ui";
import { ArrowLeft, ArrowRight, Check, Loader2, PenLine, SkipForward, Undo2, X } from "lucide-react";

interface WorksheetActivityProps {
  activityId: string;
  content: WorksheetContent;
  draft?: Record<string, unknown>;
  /** The plan's estimate; shown as "3 questions · ~6 min". */
  estimatedMinutes?: number;
  onComplete: () => void;
}

/** Intros longer than this start collapsed, so the first question is on screen. */
const LONG_INTRO_CHARS = 320;

/** "3 questions · ~6 min": every part counts as a question (the composer caps them at 3). */
export function worksheetSummary(content: WorksheetContent, estimatedMinutes?: number) {
  const questions = content.steps.reduce((n, st) => n + st.parts.length, 0);
  const minutes = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : Math.max(2, questions * 2);
  return { questions, minutes };
}

/** Marking for a part the learner chose to skip: no marks, no server call. */
function skippedMarking(marks: number): PartMarking {
  return { points: [], achievedPoints: 0, totalPoints: marks, correct: false };
}

interface WorksheetDraft {
  stepIndex: number;
  answers: Record<string, string>;
  drawings: Record<string, string | null>;
  markings: Record<string, PartMarking>;
  checkedSteps: Record<number, boolean>;
  skipped: Record<string, boolean>;
}

export function WorksheetActivity({
  activityId,
  content,
  draft,
  estimatedMinutes,
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
  const [skipped, setSkipped] = useState<Record<string, boolean>>(
    restored?.skipped ?? {},
  );
  const [introOpen, setIntroOpen] = useState<Record<number, boolean>>({});
  const [markingInFlight, setMarkingInFlight] = useState(false);
  const firstInput = useRef<HTMLTextAreaElement>(null);

  useReportCurrentItem(activityId, stepIndex);
  // The player's bottom bar moves between questions here first.
  useItemNav(activityId, {
    canNext: () => stepIndex < content.steps.length - 1,
    canBack: () => stepIndex > 0,
    next: () => setStepIndex((i) => Math.min(i + 1, content.steps.length - 1)),
    back: () => setStepIndex((i) => Math.max(i - 1, 0)),
  });
  useActivityDraft(activityId, {
    stepIndex,
    answers,
    drawings,
    markings,
    checkedSteps,
    skipped,
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
  const answered = (i: number) => !!((answers[key(i)] ?? "").trim() || drawings[key(i)]);
  // Every part either answered or skipped; skipping all of them skips the question.
  const allAnswered = step.parts.every((_, i) => answered(i) || skipped[key(i)]);
  const allSkipped = step.parts.every((_, i) => skipped[key(i)] && !answered(i));
  const summary = worksheetSummary(content, estimatedMinutes);
  const introLong = (step.intro?.length ?? 0) > LONG_INTRO_CHARS;

  // The first question is answerable straight away: focus its box on a
  // desktop (not on touch, where the keyboard would cover the question).
  useEffect(() => {
    if (checkedSteps[stepIndex]) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    firstInput.current?.focus({ preventScroll: true });
    // Only when the question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const checkStep = async () => {
    setMarkingInFlight(true);
    const results = await Promise.all(
      step.parts.map(async (part, i) => {
        const value = answers[key(i)] ?? "";
        const drawing = drawings[key(i)] ?? undefined;
        if (skipped[key(i)] && !value.trim() && !drawing) return skippedMarking(part.marks ?? 1);
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
      if (skipped[key(i)] && !answered(i)) return; // not attempted
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
      {newUi ? (
        <div>
          <div className="flex min-h-6 items-center justify-between gap-4">
            <p data-scroll-line className="text-small font-semibold tabular-nums text-muted-foreground" aria-live="polite">
              {t("session.question")} {stepIndex + 1} {t("session.of")} {content.steps.length} · {totalMarks} {t("session.marks")}
              {content.steps.length === 1 && ` · ~${summary.minutes} ${t("session.min")}`}
            </p>
            <ItemDots current={stepIndex} states={content.steps.map((_, i) => (checkedSteps[i] ? "done" : "todo"))} />
          </div>
          <p key={`ws-${stepIndex}`} className="life-rise mt-3 text-[20px] font-extrabold leading-[1.3] sm:text-[22px]">
            <MathText text={step.title.replace(/^question\s*\d+\s*[—–:.-]?\s*/i, "")} />
          </p>
        </div>
      ) : (
      <div className="pb-4 border-b border-border">
        <p className="mb-1.5 text-caption font-medium text-muted-foreground tabular-nums">
          {(summary.questions === 1 ? t("habit.wsSummaryOne") : t("habit.wsSummary"))
            .replace("{n}", String(summary.questions))
            .replace("{m}", String(summary.minutes))}
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-ui font-semibold">
            {t("session.question")} {stepIndex + 1} —{" "}
            <MathText
              text={step.title.replace(/^question\s*\d+\s*[—–:.-]?\s*/i, "")}
            />
          </p>
          <span className="text-caption text-muted-foreground shrink-0 tabular-nums">
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
      )}

      <div className={newUi ? "space-y-5 pb-2 pt-3" : "py-5 space-y-5"}>
        {step.intro && (
          <div>
            <div
              className={cn(
                newUi ? "text-read text-foreground" : "text-ui text-foreground",
                introLong && !introOpen[stepIndex] && "line-clamp-3",
              )}
            >
              <MarkdownText text={step.intro} />
            </div>
            {introLong && (
              <button
                type="button"
                onClick={() => setIntroOpen((o) => ({ ...o, [stepIndex]: !o[stepIndex] }))}
                className={newUi ? cn(playLink, "min-h-9 text-[13.5px]") : "mt-1 text-xs font-semibold text-accent-dim hover:underline"}
              >
                {t(introOpen[stepIndex] ? "habit.wsShowLess" : "habit.wsShowMore")}
              </button>
            )}
          </div>
        )}

        {step.figure && <WorksheetFigureCard data={step.figure} />}
        {step.figures?.map((figure) => (
          <FigureView key={figure.id} figure={figure} />
        ))}

        {/* Sub-questions */}
        <div className={newUi ? "space-y-7" : "space-y-4"}>
          {step.parts.map((part, i) => {
            const value = answers[key(i)] ?? "";
            const marking = markings[key(i)];
            const correct = marking?.correct ?? false;
            const partial =
              !!marking && !marking.correct && marking.achievedPoints > 0;
            const isSkipped = !!skipped[key(i)] && !value.trim() && !drawings[key(i)];
            return (
              <div key={part.label} className="flex gap-3" data-dictation-label={part.label} data-dictation-prompt={part.prompt}>
                <span className={cn("shrink-0 flex items-center justify-center font-bold", newUi ? "size-8 rounded-full bg-muted text-[13.5px] font-extrabold text-foreground" : "mt-1.5 h-6 w-6 rounded-full bg-muted text-[11px]")}>
                  {part.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={newUi ? "pt-0.5 text-read font-semibold" : "text-ui"}>
                      <MarkdownText text={part.prompt} />
                    </p>
                    <span className={newUi ? "shrink-0 text-small font-bold tabular-nums text-muted-foreground" : "text-caption text-faint shrink-0 tabular-nums"}>
                      {checked && marking
                        ? `${marking.achievedPoints}/${marking.totalPoints}`
                        : `[${part.marks ?? 1}]`}
                    </span>
                  </div>
                  {part.type === "true_false" ? (
                    <div className={newUi ? "mt-3 flex gap-2.5" : "flex gap-2 mt-2"}>
                      {["True", "False"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={checked && correct}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [key(i)]: opt }))
                          }
                          className={cn(
                            newUi
                              ? "h-12 min-w-[104px] touch-manipulation rounded-full px-6 text-[15.5px] font-extrabold ring-inset transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none"
                              : "px-4 py-1.5 rounded-lg border text-sm font-medium",
                            newUi
                              ? value === opt
                                ? checked
                                  ? correct
                                    ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                                    : "life-shake bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                                  : "life-pop bg-[color-mix(in_srgb,var(--accent)_10%,#fff)] ring-2 ring-accent"
                                : "bg-muted text-foreground hover:bg-[var(--edge)]"
                              : value === opt
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
                    <RichAnswerField
                      textareaRef={i === 0 ? firstInput : undefined}
                      value={value}
                      rows={part.type === "numeric" ? 1 : 2}
                      disabled={(checked && correct) || markingInFlight}
                      onChange={(v) => {
                        setAnswers((a) => ({ ...a, [key(i)]: v }));
                        // Typing un-skips the part.
                        if (v.trim()) setSkipped((sk) => (sk[key(i)] ? { ...sk, [key(i)]: false } : sk));
                      }}
                      placeholder={
                        isSkipped && !checked
                          ? t("habit.wsSkippedPlaceholder")
                          : part.type === "numeric"
                            ? t("session.numericPlaceholder")
                            : t("session.textPlaceholder")
                      }
                      className={
                        newUi
                          ? cn(
                              playField,
                              "mt-3",
                              part.type === "numeric" && "sm:max-w-[280px]",
                              checked &&
                                (isSkipped
                                  ? "opacity-70"
                                  : correct
                                    ? "bg-emerald-50 ring-2 ring-emerald-500 disabled:text-emerald-900"
                                    : partial
                                      ? "bg-card ring-2 ring-[var(--edge)]"
                                      : "bg-rose-50 ring-2 ring-rose-400"),
                            )
                          : cn(
                              "mt-2 w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none",
                              checked
                                ? isSkipped
                                  ? "border-border bg-muted/40"
                                  : correct
                                    ? "border-success bg-success/5"
                                    : partial
                                      ? "border-amber bg-amber/5"
                                      : "border-red-500 bg-red-500/5"
                                : "border-border-strong bg-background focus:border-accent/60",
                              isSkipped && !checked && "border-dashed bg-muted/30",
                            )
                      }
                    />
                  )}

                  {!checked && (
                    <div className={newUi ? "mt-1 flex flex-wrap items-center gap-x-5" : "mt-1.5 flex items-center gap-4"}>
                      {part.type === "text" && !drawingOpen[key(i)] && (
                        <button
                          type="button"
                          onClick={() =>
                            setDrawingOpen((d) => ({ ...d, [key(i)]: true }))
                          }
                          className={newUi ? "flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-muted-foreground hover:text-foreground" : "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"}
                        >
                          <PenLine className="h-3 w-3" />
                          {t("session.addDrawing")}
                        </button>
                      )}
                      {!answered(i) && (
                        <button
                          type="button"
                          disabled={markingInFlight}
                          aria-pressed={isSkipped}
                          onClick={() =>
                            setSkipped((sk) => ({ ...sk, [key(i)]: !sk[key(i)] }))
                          }
                          className={newUi ? "flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-muted-foreground hover:text-foreground" : "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"}
                        >
                          {isSkipped ? (
                            <>
                              <Undo2 className="h-3 w-3" />
                              {t("habit.wsUndoSkip")}
                            </>
                          ) : (
                            <>
                              <SkipForward className="h-3 w-3" />
                              {t("habit.wsSkipPart")}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {checked && isSkipped && (
                    <p className={newUi ? "mt-2 text-small font-semibold text-muted-foreground" : "mt-1.5 text-caption text-muted-foreground"}>{t("habit.wsSkipped")}</p>
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

                  {/* Mark scheme (redesign): lines on the page under the answer, a tick or a cross per mark; no table. */}
                  {newUi && checked && marking && marking.points.length > 0 && (
                    <div className="life-rise mt-4" role="status">
                      <p className="text-small font-extrabold text-foreground">
                        {t("session.markScheme")}
                        <span className="ml-2 font-bold tabular-nums text-muted-foreground">
                          {marking.achievedPoints}/{marking.totalPoints} {t("session.marks")}
                        </span>
                      </p>
                      <ul className="mt-2 space-y-2.5">
                        {marking.points.map((point, j) => {
                          const earned = point.achievedPoints >= point.point;
                          return (
                            <li key={j} className="flex items-start gap-3">
                              <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white", earned ? "bg-emerald-600" : "bg-rose-500")}>
                                {earned ? <Check className="size-3.5" strokeWidth={3.5} /> : <X className="size-3.5" strokeWidth={3.5} />}
                                <span className="sr-only">{point.achievedPoints}/{point.point}</span>
                              </span>
                              <div className="min-w-0 flex-1 text-ui">
                                <MarkdownText text={point.requirements} />
                                {point.feedback && !earned && (
                                  <p className="mt-0.5 text-ui text-muted-foreground">
                                    <MarkdownText text={point.feedback} />
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {/* Markscheme breakdown (LLM-marked parts) */}
                  {!newUi && checked && marking && marking.points.length > 0 && (
                    <div className={newUi ? "mt-3 rounded-2xl border border-border bg-card overflow-hidden shadow-[0_8px_24px_-16px_rgba(17,17,20,.2)]" : "mt-2 rounded-lg border border-border overflow-hidden"}>
                      <div className={cn("flex items-center justify-between border-b border-border", newUi ? "px-4 py-2.5" : "bg-muted/60 px-3 py-1.5")}>
                        <p className={newUi ? "text-small font-semibold" : "text-caption font-semibold uppercase tracking-wide text-muted-foreground"}>
                          {t("session.markScheme")}
                        </p>
                        <span
                          className={cn(
                            newUi ? "text-caption font-bold tabular-nums rounded-full px-2.5 py-1" : "text-caption font-bold tabular-nums rounded-full px-2 py-0.5",
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
                                <p className={newUi ? "flex-1 min-w-0 text-small" : "flex-1 min-w-0 text-caption leading-5"}>
                                  <MarkdownText text={point.requirements} />
                                </p>
                                <span className="shrink-0 flex items-center gap-1 text-caption font-semibold tabular-nums">
                                  {earned ? (
                                    <Check className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
                                  ) : (
                                    <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                  )}
                                  {point.achievedPoints}/{point.point}
                                </span>
                              </div>
                              {point.feedback && !earned && (
                                <p className={newUi ? "mt-1.5 pl-10 text-small leading-5 text-muted-foreground" : "mt-1 pl-8 text-caption leading-4 text-muted-foreground"}>
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
                      <p className={cn(newUi ? "mt-2 text-ui font-bold" : "text-caption mt-1.5", isSkipped ? "text-muted-foreground" : newUi ? "text-rose-800" : "text-red-600 dark:text-red-400")}>
                        {t("session.expected")} {part.answer}
                      </p>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {newUi ? (
          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-4 sm:justify-start">
              {stepIndex > 0 && (
                <button type="button" disabled={markingInFlight} onClick={() => setStepIndex((s) => s - 1)} className={playLink}>
                  {t("session.back")}
                </button>
              )}
              {checked && (
                <p className="text-ui font-extrabold tabular-nums text-foreground" role="status">
                  {earnedMarks}/{totalMarks} <span className="font-semibold text-muted-foreground">{t("session.marksOnQuestion")}</span>
                </p>
              )}
            </div>
            {checked ? (
              <PlayPrimary onClick={isLastStep ? onComplete : () => setStepIndex((s) => s + 1)}>
                {t(isLastStep ? "session.finishWorksheet" : "session.nextQuestion")}
                <ArrowRight className="ml-1.5 size-4" />
              </PlayPrimary>
            ) : (
              <PlayPrimary disabled={!allAnswered || markingInFlight} onClick={checkStep}>
                {markingInFlight ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("session.marking")}
                  </>
                ) : allSkipped ? (
                  t("habit.wsSkipQuestion")
                ) : (
                  t("session.checkAnswers")
                )}
              </PlayPrimary>
            )}
          </div>
        ) : (
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
              <p className="text-caption text-muted-foreground tabular-nums">
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
              ) : allSkipped ? (
                t("habit.wsSkipQuestion")
              ) : (
                t("session.checkAnswers")
              )}
            </Button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
