"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "@/components/session/confidence-slider";
import { answerStartStep, useStartStepRequest, type StartStepRequest } from "@/lib/start-step-client";
import { CONFIDENCE_START } from "@/lib/start-check";
import { confidenceEffectKey, paperAsked, startKind, type StartMode, type StartStepAnswer } from "@/lib/start-step";
import { STUDY_LENGTH_MAX, STUDY_LENGTH_MIN, STUDY_LENGTH_STEP, clampStudyMinutes, colorForMinutes, formatStudyLength, stageForMinutes, studyLengthProgress } from "@/lib/study-length";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/start-check";
import "@/lib/i18n/quick5-confidence";
import "@/lib/i18n/study-length";
import { cn } from "@/lib/utils";

/**
 * The sheet behind the start step: mounted once in <Providers/>, shown
 * before a session is made when there is something to ask that changes it
 * (src/lib/start-step.ts). Bottom sheet on phones, a card on desktop.
 * Closing it is Skip: the session starts as usual.
 */
export function StartStepHost() {
  const request = useStartStepRequest();
  if (!request) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4" onClick={() => answerStartStep(null)}>
      <StartStepSheet key={request.id} request={request} onAnswer={answerStartStep} />
    </div>,
    document.body,
  );
}

type SheetRequest = Pick<StartStepRequest, "what" | "topicNames" | "asks" | "quickStart" | "initialMinutes" | "papers" | "paperId">;

/**
 * One screen, nothing written until Start: practice or just study; how long
 * (first sessions); how confident (once per subject), with a line that says
 * what the rating changes in the session chosen above it; and which paper,
 * only when written questions will follow one. One primary action, and Skip.
 */
export function StartStepSheet({
  request,
  onAnswer,
  initialConfidence = CONFIDENCE_START,
  initialMode = "practice",
  className,
}: {
  request: SheetRequest;
  onAnswer: (answer: StartStepAnswer | null) => void;
  initialConfidence?: number;
  initialMode?: StartMode;
  className?: string;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const confidenceId = useId();
  const [mode, setMode] = useState<StartMode>(initialMode);
  const [minutes, setMinutes] = useState(request.initialMinutes);
  const [confidence, setConfidence] = useState(initialConfidence);
  const [paperId, setPaperId] = useState<string | null>(request.paperId);
  const formRef = useRef<HTMLFormElement>(null);
  const { asks } = request;

  useEffect(() => {
    formRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnswer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAnswer]);

  const kind = startKind({ mode, quickStart: request.quickStart, minutes: asks.length ? minutes : null });
  // What "Practice questions" would be, whichever option is selected: five quick ones, or a full session.
  const practiceKind = startKind({ mode: "practice", quickStart: request.quickStart, minutes: asks.length ? minutes : null });
  const showPaper = paperAsked(asks, kind);
  const confidenceTitle =
    request.topicNames.length > 1
      ? t("startCheck.titleTopics").replace("{n}", String(request.topicNames.length))
      : request.what
        ? t("startCheck.title").replace("{what}", request.what)
        : t("startCheck.titleThis");
  const lengthLabel = formatStudyLength(clampStudyMinutes(minutes), { min: t("studyLength.min"), h: t("studyLength.hour") });
  const lengthColor = colorForMinutes(minutes);

  const submit = () =>
    onAnswer({
      mode,
      ...(asks.length ? { minutes: clampStudyMinutes(minutes) } : {}),
      ...(asks.confidence ? { confidence } : {}),
      ...(showPaper ? { paperId } : {}),
    });

  const modes: { id: StartMode; title: string; sub: string; icon: typeof BookOpen }[] = [
    { id: "practice", title: t("startStep.practice"), sub: t(practiceKind === "quick5" ? "startStep.practiceQuickSub" : "startStep.practiceSub"), icon: PencilLine },
    { id: "study", title: t("startStep.study"), sub: t("startStep.studySub"), icon: BookOpen },
  ];

  return (
    <form
      ref={formRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-start-step
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "relative max-h-[96dvh] w-full max-w-[460px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-xl outline-none animate-fade-up",
        "sm:rounded-[28px] sm:px-7 sm:pb-4 sm:pt-5",
        className,
      )}
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
      <h2 id={titleId} className="text-balance text-center text-[21px] font-extrabold leading-[1.2] tracking-tight sm:text-[23px]">
        {t("startStep.title")}
      </h2>
      <p className="mx-auto mt-1 max-w-[24rem] text-balance text-center text-small font-semibold text-muted-foreground">{t("startStep.sub")}</p>

      {/* Practice, or just study: two options side by side, the same weight. */}
      <fieldset className="mt-3">
        <legend className="sr-only">{t("startStep.modeLegend")}</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {modes.map((m) => {
            const on = mode === m.id;
            const Icon = m.icon;
            return (
              <label
                key={m.id}
                data-mode={m.id}
                className={cn(
                  "flex min-h-[72px] cursor-pointer flex-col gap-1 rounded-[16px] border-2 px-3.5 py-2.5 text-left transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground",
                  on ? "border-foreground bg-muted/60" : "border-border hover:border-border-strong",
                )}
              >
                <input type="radio" name="start-step-mode" className="sr-only" checked={on} onChange={() => setMode(m.id)} />
                <span className="flex items-center gap-2 text-ui font-extrabold leading-5 text-foreground">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {m.title}
                </span>
                <span className="text-small leading-[1.35] text-muted-foreground">{m.sub}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {asks.length && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${titleId}-length`} className="text-ui font-extrabold text-foreground">
              {t("startStep.length")}
            </label>
            <span className="text-ui font-extrabold tabular-nums" style={{ color: lengthColor }}>
              {lengthLabel}
              <span className="ml-2 font-semibold text-muted-foreground">{t(`studyLength.stage.${stageForMinutes(minutes)}`)}</span>
            </span>
          </div>
          <input
            id={`${titleId}-length`}
            type="range"
            min={STUDY_LENGTH_MIN}
            max={STUDY_LENGTH_MAX}
            step={STUDY_LENGTH_STEP}
            value={clampStudyMinutes(minutes)}
            onChange={(e) => setMinutes(clampStudyMinutes(Number(e.target.value)))}
            aria-valuetext={lengthLabel}
            className="study-length-range mt-2.5 w-full"
            style={{ "--study-length-color": lengthColor, "--study-length-fill": `${studyLengthProgress(minutes) * 100}%` } as React.CSSProperties}
          />
        </div>
      )}

      {asks.confidence && (
        <div className="mt-3 border-t border-border pt-3 text-center">
          <h3 id={confidenceId} className="text-balance text-[17px] font-extrabold leading-[1.25] tracking-tight">
            {confidenceTitle}
          </h3>
          {request.topicNames.length > 1 && <p className="mx-auto mt-1 line-clamp-1 max-w-[22rem] text-small font-semibold text-muted-foreground">{request.topicNames.join(" · ")}</p>}
          <div className="-mt-3">
            <ConfidenceSlider value={confidence} onChange={setConfidence} labelledBy={confidenceId} />
          </div>
          {/* What the rating changes in the session chosen above, said as it changes. */}
          <p className="mt-1 min-h-[22px] text-ui font-semibold text-muted-foreground" aria-live="polite" data-confidence-effect>
            {t(confidenceEffectKey(confidence, kind))}
          </p>
        </div>
      )}

      {showPaper && (
        <fieldset className="mt-3 border-t border-border pt-3">
          <legend className="sr-only">{t("startStep.paperLegend")}</legend>
          <p className="text-ui font-extrabold text-foreground" aria-hidden>
            {t("startStep.paperLegend")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ id: null as string | null, name: t("startCheck.paperMix"), blurb: t("startCheck.paperMixSub") }, ...request.papers].map((p) => {
              const on = paperId === p.id;
              return (
                <label
                  key={p.id ?? "mix"}
                  title={p.blurb}
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center rounded-full border-2 px-3.5 text-small font-extrabold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground",
                    on ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-border-strong",
                  )}
                >
                  <input type="radio" name="start-step-paper" className="sr-only" checked={on} onChange={() => setPaperId(p.id)} />
                  {p.name}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-small leading-[1.35] text-muted-foreground" aria-live="polite">
            <span className="font-bold text-foreground">{paperId ? request.papers.find((p) => p.id === paperId)?.blurb : t("startCheck.paperMixSub")}.</span> {t("startStep.paperSub")}
          </p>
        </fieldset>
      )}

      <div className="mt-3 flex flex-col items-center gap-0.5">
        <Button type="submit" size="lg" className="w-full">
          {t(mode === "study" ? "startStep.startStudy" : "startStep.start")}
        </Button>
        <button type="button" onClick={() => onAnswer(null)} className="min-h-11 px-4 text-ui font-bold text-muted-foreground hover:text-foreground">
          {t("startStep.skip")}
        </button>
      </div>
    </form>
  );
}
