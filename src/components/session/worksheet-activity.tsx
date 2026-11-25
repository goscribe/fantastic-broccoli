"use client";

import { useNewUi } from "@/lib/new-ui";
import { McqOptions, PaperBar, SourcesPanel, wordCount } from "@/components/session/paper-parts";
import "@/lib/i18n/practice-paper";
import { useEffect, useRef, useState } from "react";
import { PartMarking, WorksheetContent } from "@/types";
import { markWorksheetAnswer } from "@/lib/api/study";
import {
  resolvePartMarking,
  serverCanMarkPart,
} from "@/lib/worksheet-marking";
import {
  answerGuideFor,
  earlierAnswers,
  firstStepFor,
  modelAnswerFor,
  nextHelp,
  partsToMark,
  promptWithoutMarks,
  skippedMarking,
  stepScore,
  type HelpLevel,
} from "@/lib/worksheet-flow";
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
import "@/lib/i18n/voice";
import { VoiceAnswerButton } from "@/components/session/voice-scribe";
import "@/lib/i18n/written-work";
import { cn } from "@/lib/utils";
import { ItemDots, PlayPrimary, playField, playLink } from "@/components/session/play-ui";
import { LongAnswerActivity } from "@/components/session/long-answer-activity";
import { isLongAnswer } from "@/lib/long-answer";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lightbulb, Loader2, PenLine, SkipForward, Undo2, X } from "lucide-react";

interface WorksheetActivityProps {
  activityId: string;
  content: WorksheetContent;
  draft?: Record<string, unknown>;
  /** The plan's estimate; shown as "3 questions · ~6 min". */
  estimatedMinutes?: number;
  onComplete: () => void;
  /** The part marker (the server's); design previews pass a stand-in. */
  mark?: typeof markWorksheetAnswer;
}

/** Intros longer than this start collapsed, so the first question is on screen. */
const LONG_INTRO_CHARS = 320;

/** "3 questions · ~6 min": every part counts as a question (the composer caps them at 3). */
export function worksheetSummary(content: WorksheetContent, estimatedMinutes?: number) {
  const questions = content.steps.reduce((n, st) => n + st.parts.length, 0);
  const minutes = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : Math.max(2, questions * 2);
  return { questions, minutes };
}

interface WorksheetDraft {
  stepIndex: number;
  answers: Record<string, string>;
  drawings: Record<string, string | null>;
  markings: Record<string, PartMarking>;
  checkedSteps: Record<number, boolean>;
  skipped: Record<string, boolean>;
  /** Help asked for per part: 1 the hint, 2 the first step too. */
  help: Record<string, HelpLevel>;
}

/** A worksheet, or a long-answer question (one extended response) stored as one. */
export function WorksheetActivity(props: WorksheetActivityProps) {
  return isLongAnswer(props.content) ? <LongAnswerActivity {...props} /> : <WorksheetQuestions {...props} />;
}

function WorksheetQuestions({
  activityId,
  content,
  draft,
  estimatedMinutes,
  onComplete,
  mark = markWorksheetAnswer,
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
  const [help, setHelp] = useState<Record<string, HelpLevel>>(restored?.help ?? {});
  const [modelOpen, setModelOpen] = useState<Record<string, boolean>>({});
  /** The part a "Check this part" is marking (the spinner goes on its button). */
  const [checkingPart, setCheckingPart] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState<Record<number, boolean>>({});
  // Redesign: one part of a question on screen at a time (per question, so Back returns to it).
  const [partAt, setPartAt] = useState<Record<number, number>>({});
  const [markingInFlight, setMarkingInFlight] = useState(false);
  const firstInput = useRef<HTMLTextAreaElement>(null);

  const step = content.steps[stepIndex];
  // One part per screen: the answer box on screen is the only one (and the
  // only one the microphone writes into). The question's stem stays above it.
  const onePart = newUi && step.parts.length > 1;
  const partIndex = onePart ? Math.min(partAt[stepIndex] ?? 0, step.parts.length - 1) : 0;
  const lastPart = !onePart || partIndex === step.parts.length - 1;
  const goPart = (i: number) => setPartAt((p) => ({ ...p, [stepIndex]: i }));

  useReportCurrentItem(activityId, stepIndex);
  // The player's bottom bar moves between parts, then questions, here first.
  useItemNav(activityId, {
    canNext: () => !lastPart || stepIndex < content.steps.length - 1,
    canBack: () => partIndex > 0 || stepIndex > 0,
    next: () => (lastPart ? setStepIndex((i) => Math.min(i + 1, content.steps.length - 1)) : goPart(partIndex + 1)),
    back: () => (partIndex > 0 ? goPart(partIndex - 1) : setStepIndex((i) => Math.max(i - 1, 0))),
  });
  useActivityDraft(activityId, {
    stepIndex,
    answers,
    drawings,
    markings,
    checkedSteps,
    skipped,
    help,
  });

  const checked = !!checkedSteps[stepIndex];
  const isLastStep = stepIndex === content.steps.length - 1;
  const key = (partIdx: number) => `${stepIndex}-${partIdx}`;
  /** Questions the learner has already seen are revisitable. */
  const visited = (i: number) =>
    i <= stepIndex || !!checkedSteps[i] || !!checkedSteps[i - 1];

  const { earned: earnedMarks, total: totalMarks } = stepScore(step, (i) => markings[key(i)]);
  const answered = (i: number) => !!((answers[key(i)] ?? "").trim() || drawings[key(i)]);
  const marked = (i: number) => !!markings[key(i)];
  // Marking never waits for every part: unanswered parts end as skipped. With
  // nothing answered (or marked) the button skips the question.
  const nothingDone = step.parts.every((_, i) => !answered(i) && !marked(i));
  const toMark = partsToMark(step, { answered, marked });
  const summary = worksheetSummary(content, estimatedMinutes);
  const introLong = (step.intro?.length ?? 0) > LONG_INTRO_CHARS;

  // The first question is answerable straight away: focus its box on a
  // desktop (not on touch, where the keyboard would cover the question).
  useEffect(() => {
    if (checkedSteps[stepIndex]) return;
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    firstInput.current?.focus({ preventScroll: true });
    // Only when the question (or the part on screen) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, partIndex]);

  /** Marks one part (server for typed answers with a scheme, local for choices); null when it could not be decided. */
  const markOne = async (i: number): Promise<PartMarking | null> => {
    const part = step.parts[i];
    const value = answers[key(i)] ?? "";
    const drawing = drawings[key(i)] ?? undefined;
    // Choice parts stay on the local check. Typed parts with a mark scheme
    // (or a drawing) are decided by the server; a failed local comparison
    // must not record them as wrong while that marker can run.
    if (!serverCanMarkPart(part, drawing)) return resolvePartMarking(part, value, { serverCanDecide: false });
    try {
      const serverMarking = await mark({
        activityId,
        stepIndex,
        partIndex: i,
        answer: value,
        answerImage: drawing,
        // The earlier parts' answers: a later part is marked error carried forward.
        earlier: earlierAnswers(step, i, (k) => answers[key(k)] ?? ""),
      });
      return resolvePartMarking(part, value, { serverMarking, serverCanDecide: true });
    } catch {
      toast.error(t("session.markingFallback"), { id: "marking-fallback" });
      return resolvePartMarking(part, value, { serverCanDecide: true });
    }
  };

  /** Marks these parts together; true when every one was decided. */
  const markParts = async (indices: number[]) => {
    if (indices.length === 0) return true;
    setMarkingInFlight(true);
    const results = await Promise.all(indices.map(markOne));
    setMarkings((m) => {
      const next = { ...m };
      indices.forEach((partIdx, n) => {
        const r = results[n];
        if (r) next[key(partIdx)] = r;
      });
      return next;
    });
    indices.forEach((partIdx, n) => {
      const part = step.parts[partIdx];
      const r = results[n];
      if (!r || !part.worksheetQuestionId) return;
      recordWorksheetQuestionProgress({
        problemId: part.worksheetQuestionId,
        completed: true,
        answer: answers[key(partIdx)] ?? "",
        correct: r.correct,
      }).catch(() => {});
    });
    setMarkingInFlight(false);
    return results.every(Boolean);
  };

  /** "Check this part": marks the one part now, so feedback comes as the student goes. */
  const checkPart = async (i: number) => {
    setCheckingPart(key(i));
    const ok = await markParts([i]);
    setCheckingPart(null);
    if (!ok) toast.error(t("written.retryMarking"), { id: "part-marking-retry" });
  };

  /**
   * "Check answers" / "Finish question": marks what is answered and not yet
   * marked; every part left blank ends as skipped (no marks, its model answer
   * shown). Never waits for all parts.
   */
  const checkStep = async () => {
    const ok = await markParts(toMark);
    // A typed answer the marker could not decide stays unmarked (retry), never wrong.
    if (!ok) return;
    setMarkings((m) => {
      const next = { ...m };
      step.parts.forEach((part, i) => {
        if (!next[key(i)]) next[key(i)] = skippedMarking(part);
      });
      return next;
    });
    setSkipped((sk) => {
      const next = { ...sk };
      step.parts.forEach((_, i) => {
        if (!answered(i)) next[key(i)] = true;
      });
      return next;
    });
    setCheckedSteps((c) => ({ ...c, [stepIndex]: true }));
  };

  /** Skip moves on: the next part (or the question's check when it was the last). */
  const skipPart = (i: number) => {
    const was = !!skipped[key(i)];
    setSkipped((sk) => ({ ...sk, [key(i)]: !was }));
    if (!was && onePart && i === partIndex && !lastPart) goPart(partIndex + 1);
  };

  const paper = content.paper;
  /** Papers title their questions "Question n", already in the counter above. */
  const stepTitle = step.title.replace(/^question\s*\d+\s*[—–:.-]?\s*/i, "") || (paper ? "" : step.title);

  return (
    <div>
      {paper && <PaperBar activityId={activityId} paper={paper} section={step.section} showInstructions={stepIndex === 0} />}
      {/* Step header */}
      {newUi ? (
        <div>
          <div className="flex min-h-6 items-center justify-between gap-4">
            <p data-scroll-line className="text-small font-semibold tabular-nums text-muted-foreground" aria-live="polite">
              {t("session.question")} {stepIndex + 1} {t("session.of")} {content.steps.length} · {totalMarks} {t(totalMarks === 1 ? "paper.mark" : "session.marks")}
              {content.steps.length === 1 && !paper && ` · ~${summary.minutes} ${t("session.min")}`}
            </p>
            <ItemDots current={stepIndex} states={content.steps.map((_, i) => (checkedSteps[i] ? "done" : "todo"))} />
          </div>
          {stepTitle && (
            <p key={`ws-${stepIndex}`} className="life-rise mt-3 text-[20px] font-extrabold leading-[1.3] sm:text-[22px]">
              <MathText text={stepTitle} />
            </p>
          )}
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
            {totalMarks} {t(totalMarks === 1 ? "paper.mark" : "session.marks")}
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
              data-dictation-stem
              className={cn(
                newUi ? "text-read text-foreground" : "text-ui text-foreground",
                // Clamped only when long, and never so short that the givens hide behind "Show more".
                introLong && !introOpen[stepIndex] && "line-clamp-6",
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
        {step.sources && step.sources.length > 0 && <SourcesPanel sources={step.sources} />}

        {/* Which part is on screen, and how each one stands: answered, marked right or wrong. */}
        {onePart && (
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t("worksheet.parts")}>
            {step.parts.map((part, i) => {
              const m = markings[key(i)];
              return (
                <button
                  key={part.label}
                  type="button"
                  role="tab"
                  aria-selected={i === partIndex}
                  aria-label={`${t("worksheet.part")} ${part.label}`}
                  disabled={markingInFlight}
                  onClick={() => goPart(i)}
                  className={cn(
                    "grid size-9 touch-manipulation place-items-center rounded-full text-[13.5px] font-extrabold ring-inset transition-colors",
                    i === partIndex
                      ? "bg-accent text-white"
                      : m && answered(i)
                        ? m.correct
                          ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                          : "bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                        : answered(i)
                          ? "bg-accent-soft text-accent"
                          : "bg-muted text-foreground hover:bg-[var(--edge)]",
                  )}
                >
                  {part.label}
                </button>
              );
            })}
            <span className="ml-1 text-small font-semibold text-muted-foreground">
              {t("worksheet.partOf").replace("{n}", String(partIndex + 1)).replace("{m}", String(step.parts.length))}
            </span>
          </div>
        )}

        {/* Sub-questions */}
        <div className={newUi ? "space-y-7" : "space-y-4"}>
          {step.parts.map((part, i) => {
            if (onePart && i !== partIndex) return null;
            const value = answers[key(i)] ?? "";
            const marking = markings[key(i)];
            const correct = marking?.correct ?? false;
            const partial =
              !!marking && !marking.correct && marking.achievedPoints > 0;
            const isSkipped = !!skipped[key(i)] && !value.trim() && !drawings[key(i)];
            // Marked on its own ("Check this part") or with the question.
            const isMarked = !!marking && !isSkipped;
            const guide = answerGuideFor(part);
            const level = help[key(i)] ?? 0;
            const offer = nextHelp(part, level);
            const firstStep = firstStepFor(part);
            const model = modelAnswerFor(part);
            const busy = checkingPart === key(i);
            return (
              <div key={part.label} className="flex gap-3" data-dictation-label={part.label} data-dictation-prompt={part.prompt}>
                <span className={cn("shrink-0 flex items-center justify-center font-bold", newUi ? "size-8 rounded-full bg-muted text-[13.5px] font-extrabold text-foreground" : "mt-1.5 h-6 w-6 rounded-full bg-muted text-[11px]")}>
                  {part.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={newUi ? "pt-0.5 text-read font-semibold" : "text-ui"}>
                      <MarkdownText text={promptWithoutMarks(part.prompt, part.marks ?? 1)} />
                    </p>
                    <span className={newUi ? "shrink-0 text-small font-bold tabular-nums text-muted-foreground" : "text-caption text-faint shrink-0 tabular-nums"}>
                      {isMarked
                        ? `${marking.achievedPoints}/${marking.totalPoints}`
                        : `[${part.marks ?? 1}]`}
                    </span>
                  </div>
                  {/* How much to write, sized to the marks. */}
                  {!isMarked && !isSkipped && part.type !== "mcq" && part.type !== "true_false" && (
                    <p className="mt-1 text-small font-semibold text-muted-foreground" data-testid="ws-guide">
                      {part.marks ?? 1} {t((part.marks ?? 1) === 1 ? "paper.mark" : "session.marks")} · {"text" in guide ? guide.text : t(guide.key)}
                    </p>
                  )}
                  {part.type === "mcq" && part.options?.length ? (
                    <McqOptions
                      options={part.options}
                      value={value}
                      answer={part.answer}
                      checked={checked}
                      disabled={checked || markingInFlight}
                      onPick={(letter) => setAnswers((a) => ({ ...a, [key(i)]: letter }))}
                    />
                  ) : part.type === "true_false" ? (
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
                  ) : checked && isSkipped ? null : (
                    // The mic sits right beside the box it writes into.
                    <div className="flex items-start gap-2">
                    <div className={cn("min-w-0 flex-1", newUi && part.type === "numeric" && "sm:max-w-[280px]")}>
                    <RichAnswerField
                      textareaRef={i === partIndex ? firstInput : undefined}
                      value={value}
                      rows={part.type === "numeric" ? 1 : part.type === "essay" ? 12 : 2}
                      media={part.type !== "numeric"}
                      disabled={isMarked || markingInFlight}
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
                              (isMarked || (checked && isSkipped)) &&
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
                              isMarked || (checked && isSkipped)
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
                    </div>
                    {newUi && !isMarked && !checked && <VoiceAnswerButton compact className="mt-3 size-12" />}
                    </div>
                  )}

                  {/* Help a stuck student can ask for: a nudge, then the first step. Free. */}
                  {!isMarked && !checked && level > 0 && (
                    <div className="life-rise mt-3 space-y-2 rounded-2xl bg-accent-soft/60 px-4 py-3 text-ui" data-testid="ws-help" data-calculator-ignore>
                      {part.hint && (
                        <p>
                          <span className="font-extrabold">{t("written.hintLabel")}: </span>
                          <MathText text={part.hint} />
                        </p>
                      )}
                      {level >= 2 && firstStep && (
                        <p>
                          <span className="font-extrabold">{t("written.firstStepLabel")}: </span>
                          <MathText text={firstStep} />
                        </p>
                      )}
                    </div>
                  )}
                  {!isMarked && !checked && (
                    <div className={newUi ? "mt-1 flex flex-wrap items-center gap-x-5" : "mt-1.5 flex items-center gap-4"}>
                      {offer && !isSkipped && part.type !== "mcq" && part.type !== "true_false" && (
                        <button
                          type="button"
                          disabled={markingInFlight}
                          onClick={() => setHelp((h) => ({ ...h, [key(i)]: (offer === "hint" ? 1 : 2) as HelpLevel }))}
                          className={newUi ? "flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-accent hover:text-foreground" : "flex items-center gap-1.5 text-xs text-accent-dim hover:text-foreground"}
                        >
                          <Lightbulb className="h-3.5 w-3.5" />
                          {t(offer === "hint" ? "written.hint" : "written.firstStep")}
                        </button>
                      )}
                      {/* Partial submission: one part is marked now; the rest can wait or be skipped. */}
                      {answered(i) && !onePart && (step.parts.length > 1 || !newUi) && (
                        <button
                          type="button"
                          disabled={markingInFlight}
                          onClick={() => checkPart(i)}
                          className={newUi ? "flex min-h-10 items-center gap-1.5 text-[13.5px] font-bold text-foreground hover:text-accent disabled:opacity-50" : "flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-accent"}
                          data-testid="ws-check-part"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          {t(busy ? "written.checking" : "written.checkPart")}
                        </button>
                      )}
                      {part.type === "essay" && (
                        <span className="min-h-10 text-[13px] font-semibold tabular-nums text-muted-foreground flex items-center">
                          {t("paper.words").replace("{n}", String(wordCount(value)))}
                        </span>
                      )}
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
                          onClick={() => skipPart(i)}
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
                  {/* Skipped parts show their model answer once the question is checked. */}
                  {checked && isSkipped && (
                    <div className="mt-2" data-testid="ws-skipped-model">
                      <p className={newUi ? "text-small font-semibold text-muted-foreground" : "text-caption text-muted-foreground"}>
                        {model ? t("written.skippedModel") : t("habit.wsSkipped")}
                      </p>
                      {model && (
                        <div className={cn("mt-1.5 rounded-2xl bg-muted px-4 py-3", newUi ? "text-ui" : "text-caption")}>
                          <MarkdownText text={model} />
                        </div>
                      )}
                    </div>
                  )}
                  {part.type === "text" && drawingOpen[key(i)] && (
                    <DrawingCanvas
                      className="mt-2"
                      disabled={isMarked || markingInFlight}
                      onChange={(dataUrl) =>
                        setDrawings((d) => ({ ...d, [key(i)]: dataUrl }))
                      }
                    />
                  )}

                  {/* Mark scheme (redesign): lines on the page under the answer, a tick or a cross per mark; no table. */}
                  {newUi && isMarked && marking.points.length > 0 && (
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
                                {/* Earned points say why too: error carried forward, or a unit to add. */}
                                {point.feedback && (
                                  <p className={cn("mt-0.5 text-muted-foreground", earned ? "text-small" : "text-ui")}>
                                    <MarkdownText text={point.feedback} />
                                  </p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {marking.figureNote && <p className="mt-2 text-small font-semibold text-muted-foreground">{marking.figureNote}</p>}
                    </div>
                  )}
                  {/* Markscheme breakdown (LLM-marked parts) */}
                  {!newUi && isMarked && marking.points.length > 0 && (
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

                  {isMarked &&
                    marking.points.length === 0 &&
                    !correct &&
                    part.answer && (
                      <p className={cn(newUi ? "mt-2 text-ui font-bold" : "text-caption mt-1.5", newUi ? "text-rose-800" : "text-red-600 dark:text-red-400")}>
                        {t("session.expected")} {part.answer}
                      </p>
                    )}
                  {/* After an attempt: the full-marks answer, one tap away. */}
                  {isMarked && model && (marking.points.length > 0 || correct) && (
                    <div className="mt-3">
                      <button
                        type="button"
                        aria-expanded={!!modelOpen[key(i)]}
                        onClick={() => setModelOpen((o) => ({ ...o, [key(i)]: !o[key(i)] }))}
                        className={newUi ? cn(playLink, "min-h-10 text-[13.5px]") : "flex items-center gap-1 text-xs font-semibold text-accent-dim hover:underline"}
                      >
                        {t(modelOpen[key(i)] ? "written.hideModel" : "written.modelAnswer")}
                        <ChevronDown className={cn("ml-1 size-4 transition-transform", modelOpen[key(i)] && "rotate-180")} aria-hidden />
                      </button>
                      {modelOpen[key(i)] && (
                        <div className={cn("mt-1.5 rounded-2xl bg-muted px-4 py-3", newUi ? "text-ui" : "text-caption")} data-testid="ws-model">
                          <MarkdownText text={model} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {newUi ? (
          <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-center gap-4 sm:justify-start">
              {(partIndex > 0 || stepIndex > 0) && (
                <button
                  type="button"
                  disabled={markingInFlight}
                  onClick={() => (partIndex > 0 ? goPart(partIndex - 1) : setStepIndex((s) => s - 1))}
                  className={playLink}
                >
                  {t("session.back")}
                </button>
              )}
              {checked && (
                <p className="text-ui font-extrabold tabular-nums text-foreground" role="status">
                  {earnedMarks}/{totalMarks} <span className="font-semibold text-muted-foreground">{t("session.marksOnQuestion")}</span>
                </p>
              )}
            </div>
            {!lastPart ? (
              // Not the last part yet: check this one (partial submission) or move on.
              answered(partIndex) && !marked(partIndex) ? (
                <PlayPrimary disabled={markingInFlight} onClick={() => checkPart(partIndex)}>
                  {checkingPart === key(partIndex) ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t("written.checking")}
                    </>
                  ) : (
                    t("written.checkPart")
                  )}
                </PlayPrimary>
              ) : (
                <PlayPrimary disabled={markingInFlight} onClick={() => goPart(partIndex + 1)}>
                  {t("worksheet.nextPart")}
                  <ArrowRight className="ml-1.5 size-4" />
                </PlayPrimary>
              )
            ) : checked ? (
              <PlayPrimary onClick={isLastStep ? onComplete : () => setStepIndex((s) => s + 1)}>
                {t(isLastStep ? "session.finishWorksheet" : "session.nextQuestion")}
                <ArrowRight className="ml-1.5 size-4" />
              </PlayPrimary>
            ) : (
              <PlayPrimary disabled={markingInFlight} onClick={checkStep}>
                {markingInFlight ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("session.marking")}
                  </>
                ) : nothingDone ? (
                  t("habit.wsSkipQuestion")
                ) : toMark.length > 0 ? (
                  t("session.checkAnswers")
                ) : (
                  t("written.finishQuestion")
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
              disabled={markingInFlight}
              onClick={checkStep}
            >
              {markingInFlight ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t("session.marking")}
                </>
              ) : nothingDone ? (
                t("habit.wsSkipQuestion")
              ) : toMark.length > 0 ? (
                t("session.checkAnswers")
              ) : (
                t("written.finishQuestion")
              )}
            </Button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
