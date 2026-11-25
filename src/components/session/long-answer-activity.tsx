"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Loader2, X } from "lucide-react";
import type { PartMarking, WorksheetContent } from "@/types";
import { markWorksheetAnswer } from "@/lib/api/study";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { toast } from "@/lib/toast";
import { MarkdownText, MathText } from "@/components/ui/markdown-text";
import { RichAnswerField } from "@/components/ui/rich-answer-field";
import { hasAnswerBlocks } from "@/lib/rich-answer";
import { PlayPrimary, playLink } from "@/components/session/play-ui";
import { wordCount } from "@/components/session/paper-parts";
import { aimWords, answerSegments, groupPoints, needsReview, promptParts } from "@/lib/long-answer";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/long-answer";
import "@/lib/i18n/written-work";
import { cn } from "@/lib/utils";
import { VoiceAnswerButton } from "@/components/session/voice-scribe";

type Marker = typeof markWorksheetAnswer;

interface LongAnswerActivityProps {
  activityId: string;
  content: WorksheetContent;
  draft?: Record<string, unknown>;
  estimatedMinutes?: number;
  onComplete: () => void;
  /** Design previews pass a stand-in marker; the session uses the server's. */
  mark?: Marker;
}

interface LongAnswerDraft {
  answer: string;
  marking: PartMarking | null;
}

/**
 * A long-answer question: the command term and marks up top ("Explain … [6]"),
 * a roomy writing area with a word count, "Submit for marking", then the
 * marked answer — the words that earned each mark highlighted, the points hit
 * and missed, and the model answer behind a disclosure. One question, so no
 * card around it; purple only on the main button.
 */
export function LongAnswerActivity({ activityId, content, draft, estimatedMinutes, onComplete, mark = markWorksheetAnswer }: LongAnswerActivityProps) {
  const { t } = useI18n();
  const step = content.steps[0];
  const part = step.parts[0];
  const marks = part.marks ?? part.markScheme?.totalPoints ?? 1;
  const restored = restoredDraft(activityId, draft) as Partial<LongAnswerDraft> | undefined;
  const [answer, setAnswer] = useState(restored?.answer ?? "");
  const [marking, setMarking] = useState<PartMarking | null>(restored?.marking ?? null);
  const [inFlight, setInFlight] = useState(false);
  /** Skipped: the model answer is shown before moving on (skipping costs nothing). */
  const [skipped, setSkipped] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useActivityDraft(activityId, { answer, marking });

  useEffect(() => {
    if (marking || typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return;
    box.current?.focus({ preventScroll: true });
    // Once, when the question opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = wordCount(answer);
  const { term, rest } = promptParts(part);
  const minutes = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : marks + 2;

  const submit = async () => {
    setInFlight(true);
    try {
      setMarking(await mark({ activityId, stepIndex: 0, partIndex: 0, answer }));
    } catch {
      toast.error(t("laq.markingFailed"), { id: "laq-marking-failed" });
    } finally {
      setInFlight(false);
    }
  };

  return (
    <div className="space-y-5 pb-2">
      <p data-scroll-line className="text-small font-semibold tabular-nums text-muted-foreground">
        {t("laq.eyebrow").replace("{m}", String(marks)).replace("{min}", String(minutes))}
      </p>

      {step.intro && (
        <div className="text-read text-foreground">
          <MarkdownText text={step.intro} />
        </div>
      )}

      <h2 className="text-[20px] font-semibold leading-[1.35] text-foreground sm:text-[22px]" data-testid="laq-prompt">
        {term && <span className="font-extrabold">{term}</span>}
        <MathText text={rest} />
        <span className="ml-1.5 whitespace-nowrap font-extrabold tabular-nums text-muted-foreground">[{marks}]</span>
      </h2>

      {skipped && !marking ? (
        <div className="life-rise space-y-4" data-testid="laq-skipped">
          <p className="text-small font-semibold text-muted-foreground">{t("written.skippedModel")}</p>
          <div className="text-read text-foreground" data-testid="laq-model">
            <MarkdownText text={part.answer ?? ""} />
          </div>
          <div className="flex sm:justify-end">
            <PlayPrimary onClick={onComplete}>
              {t("laq.continue")}
              <ArrowRight className="ml-1.5 size-4" />
            </PlayPrimary>
          </div>
        </div>
      ) : !marking ? (
        <>
          <div data-dictation-label={part.label} data-dictation-prompt={part.prompt}>
            <p className="sr-only">{t("laq.yourAnswer")}</p>
            {/* The rich answer box (maths, tables, figures): it grows with the answer; its hidden textarea is the one the voice scribe fills. */}
            <div>
              <RichAnswerField
                textareaRef={box}
                value={answer}
                disabled={inFlight}
                onChange={setAnswer}
                placeholder={t("laq.placeholder")}
                rows={8}
                className="block !min-h-[220px] w-full rounded-[20px] bg-muted px-5 py-4 text-[17px] leading-[1.65] text-foreground ring-inset transition-[background-color,box-shadow] duration-150 focus:bg-card focus:outline-none focus:ring-2 focus:ring-[var(--border-strong)] motion-reduce:transition-none sm:text-[18px]"
              />
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-[13.5px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">
              <span data-testid="laq-words">{t(words === 1 ? "laq.word" : "laq.words").replace("{n}", String(words))}</span>
              <span aria-hidden>·</span>
              <span>{t("laq.aim").replace("{n}", String(aimWords(marks)))}</span>
              {/* The mic, right under the box it writes into. */}
              <VoiceAnswerButton className="ml-auto" />
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => (part.answer ? setSkipped(true) : onComplete())} disabled={inFlight} className={cn(playLink, "justify-center text-muted-foreground")}>
              {t("laq.skip")}
            </button>
            <PlayPrimary disabled={!answer.trim() || inFlight} onClick={submit}>
              {inFlight ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("laq.marking")}
                </>
              ) : (
                t("laq.submit")
              )}
            </PlayPrimary>
          </div>
        </>
      ) : (
        <Marked answer={answer} marking={marking} modelAnswer={part.answer} onContinue={onComplete} />
      )}
    </div>
  );
}

function Marked({ answer, marking, modelAnswer, onContinue }: { answer: string; marking: PartMarking; modelAnswer?: string; onContinue: () => void }) {
  const { t } = useI18n();
  const { hit, missed } = groupPoints(marking);
  const segments = answerSegments(answer, marking.points);
  const review = needsReview(marking);
  return (
    <div className="life-rise space-y-6" role="status">
      <div>
        <p className="text-[28px] font-extrabold leading-none tabular-nums text-foreground" data-testid="laq-score">
          {marking.achievedPoints}/{marking.totalPoints}
          <span className="ml-2 text-[16px] font-bold text-muted-foreground">{t("laq.marks")}</span>
        </p>
        {marking.summary && <p className="mt-2.5 text-read text-foreground">{marking.summary}</p>}
        {review && <p className="mt-1.5 text-small font-semibold text-muted-foreground">{t("laq.addedToMistakes")}</p>}
      </div>

      <div>
        <p className="text-small font-extrabold text-foreground">{t("laq.yourAnswer")}</p>
        {hasAnswerBlocks(answer) ? (
          // Tables and figures show as they were written; the quotes that earned marks are listed under each point.
          <div className="mt-2 text-[17px] leading-[1.65] text-foreground sm:text-[18px]" data-testid="laq-answer">
            <MarkdownText text={answer} />
          </div>
        ) : (
        <p className="mt-2 whitespace-pre-wrap text-[17px] leading-[1.65] text-foreground sm:text-[18px]">
          {segments.map((s, i) =>
            s.point === null ? (
              <span key={i}>{s.text}</span>
            ) : (
              <mark key={i} className="rounded-[4px] bg-emerald-100 px-0.5 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-50">
                {s.text}
              </mark>
            ),
          )}
        </p>
        )}
        {marking.figureNote && <p className="mt-2 text-small font-semibold text-muted-foreground">{marking.figureNote}</p>}
      </div>

      {hit.length > 0 && (
        <section>
          <p className="text-small font-extrabold text-foreground">
            {t("laq.earned")} <span className="font-bold tabular-nums text-muted-foreground">{hit.length}</span>
          </p>
          <ul className="mt-2.5 space-y-3">
            {hit.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                  <Check className="size-3.5" strokeWidth={3.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-ui">
                  <MarkdownText text={p.requirements} />
                  {p.quote && <p className="mt-1 text-ui italic text-muted-foreground">“{p.quote}”</p>}
                </div>
                <span className="shrink-0 text-small font-bold tabular-nums text-muted-foreground">{p.achievedPoints}/{p.point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missed.length > 0 && (
        <section>
          <p className="text-small font-extrabold text-foreground">
            {t("laq.missed")} <span className="font-bold tabular-nums text-muted-foreground">{missed.length}</span>
          </p>
          <ul className="mt-2.5 space-y-3">
            {missed.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-rose-500 text-white">
                  <X className="size-3.5" strokeWidth={3.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 text-ui">
                  <MarkdownText text={p.requirements} />
                  {p.feedback && <p className="mt-1 text-ui text-muted-foreground"><MarkdownText text={p.feedback} /></p>}
                  {p.quote && p.achievedPoints > 0 && <p className="mt-1 text-ui italic text-muted-foreground">“{p.quote}”</p>}
                </div>
                <span className="shrink-0 text-small font-bold tabular-nums text-muted-foreground">{p.achievedPoints}/{p.point}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {modelAnswer && (
        <details className="group">
          <summary className={cn(playLink, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
            <span className="group-open:hidden">{t("laq.showModel")}</span>
            <span className="hidden group-open:inline">{t("laq.hideModel")}</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 text-read text-foreground" data-testid="laq-model">
            <MarkdownText text={modelAnswer} />
          </div>
        </details>
      )}

      <div className="flex sm:justify-end">
        <PlayPrimary onClick={onContinue}>
          {t("laq.continue")}
          <ArrowRight className="ml-1.5 size-4" />
        </PlayPrimary>
      </div>
    </div>
  );
}
