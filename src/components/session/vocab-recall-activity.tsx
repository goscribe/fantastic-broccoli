"use client";

import { ItemDots, PlayActions, PlayDone, PlayPrimary, playField, playQuiet } from "@/components/session/play-ui";
import { useNewUi } from "@/lib/new-ui";
import { useState } from "react";
import { VocabRecallContent } from "@/types";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useReportCurrentItem } from "@/lib/current-item";
import { MathText } from "@/components/ui/markdown-text";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import { Check, X, ArrowRight, RotateCcw } from "lucide-react";
import { textareaClass } from "@/components/ui/input";

interface VocabRecallActivityProps {
  activityId: string;
  content: VocabRecallContent;
  draft?: Record<string, unknown>;
  onTermResult?: (index: number, correct: boolean, answer?: string) => void;
  onComplete: () => void;
}

interface VocabDraft {
  queue: number[];
  position: number;
  missed: number[];
  learned: number[];
  round: number;
  attempts: number;
  answer: string;
  revealed: boolean;
}

/**
 * Loops through the vocabulary until every term is recalled: terms marked
 * "missed" are re-queued into another round, and the activity only
 * completes once all terms have been recalled correctly at least once.
 */
export function VocabRecallActivity({
  activityId,
  content,
  draft,
  onTermResult,
  onComplete,
}: VocabRecallActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const restored = restoredDraft(activityId, draft) as Partial<VocabDraft> | undefined;
  const allIndices = content.terms.map((_, i) => i);
  const [queue, setQueue] = useState<number[]>(
    restored?.queue?.length ? restored.queue : allIndices,
  );
  const [position, setPosition] = useState(restored?.position ?? 0);
  const [missed, setMissed] = useState<number[]>(restored?.missed ?? []);
  const [learned, setLearned] = useState<Set<number>>(
    new Set(restored?.learned ?? []),
  );
  const [round, setRound] = useState(restored?.round ?? 1);
  const [attempts, setAttempts] = useState(restored?.attempts ?? 0);
  const [answer, setAnswer] = useState(restored?.answer ?? "");
  const [revealed, setRevealed] = useState(restored?.revealed ?? false);
  const [burst, setBurst] = useState(0);

  useActivityDraft(activityId, {
    queue,
    position,
    missed,
    learned: [...learned],
    round,
    attempts,
    answer,
    revealed,
  });

  const total = content.terms.length;
  const done = learned.size === total;
  const termIndex = queue[position];
  useReportCurrentItem(activityId, termIndex ?? 0);
  const term = content.terms[termIndex];

  const mark = (correct: boolean) => {
    onTermResult?.(termIndex, correct, answer.trim() || undefined);
    setAttempts((n) => n + 1);

    const nextMissed = correct ? missed : [...missed, termIndex];
    if (correct) {
      setLearned((prev) => new Set(prev).add(termIndex));
      setBurst((b) => b + 1);
    } else {
      setMissed(nextMissed);
    }

    setAnswer("");
    setRevealed(false);

    if (position < queue.length - 1) {
      setPosition(position + 1);
    } else if (nextMissed.length > 0) {
      setQueue(nextMissed);
      setMissed([]);
      setPosition(0);
      setRound((r) => r + 1);
    }
  };

  if (newUi && done) {
    return (
      <PlayDone
        title={`${t("session.allPrefix")} ${total} ${t("session.termsRecalled")}`}
        sub={
          attempts === total
            ? t("session.perfectRecall")
            : `${t("session.took")} ${attempts} ${t("session.attemptsAcross")} ${round} ${round > 1 ? t("session.roundsNoun") : t("session.roundNoun")} ${t("session.trickyResurface")}`
        }
        action={
          <>
            {t("session.continue")} <ArrowRight className="ml-1.5 size-4" />
          </>
        }
        onAction={onComplete}
      />
    );
  }

  if (newUi) {
    return (
      <div className="space-y-4">
        <div className="flex min-h-6 items-center justify-between gap-4">
          <p data-scroll-line className="text-small font-semibold tabular-nums text-muted-foreground" aria-live="polite">
            {t("session.defineFromMemory")}
            {round > 1 && ` · ${t("session.round")} ${round}`}
            {` · ${learned.size} / ${total} ${t("session.learnt")}`}
          </p>
          <ItemDots current={termIndex} states={content.terms.map((_, i) => (learned.has(i) ? "right" : missed.includes(i) ? "wrong" : "todo"))} />
        </div>

        <p key={`t-${termIndex}-${round}`} data-scroll-line className="life-rise text-[26px] font-extrabold leading-[1.2] tracking-tight sm:text-[30px]">
          <MathText text={term.term} />
        </p>

        {revealed ? (
          <div>
            <p className="mb-1 text-caption font-extrabold text-muted-foreground">{t("finish.yourAnswer")}</p>
            <p className="whitespace-pre-wrap text-read text-foreground/80">{answer}</p>
          </div>
        ) : (
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("session.definitionPlaceholder")}
            aria-label={t("session.definitionPlaceholder")}
            rows={3}
            className={playField}
          />
        )}

        {!revealed ? (
          <PlayActions>
            <PlayPrimary onClick={() => setRevealed(true)} disabled={!answer.trim()}>
              {t("session.checkMyAnswer")}
            </PlayPrimary>
          </PlayActions>
        ) : (
          // The model answer sits on the page under yours, marked by a bar of the accent; you mark yourself with two pills.
          <div className="life-rise space-y-5">
            <div className="border-l-[3px] border-accent pl-4">
              <p className="mb-1 text-caption font-extrabold text-accent-dim">{t("session.modelDefinition")}</p>
              <p className="text-read font-semibold text-foreground">
                <MathText text={term.definition} />
              </p>
            </div>
            <p className="text-small font-semibold text-muted-foreground">{t("session.compareHint")}</p>
            <PlayActions>
              <button type="button" onClick={() => mark(false)} className={playQuiet}>
                {t("session.missedIt")}
              </button>
              <PlayPrimary onClick={() => mark(true)}>{t("session.gotIt")}</PlayPrimary>
            </PlayActions>
          </div>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="py-8 text-center">
        <ConfettiBurst burst={burst} />
        <p className="text-lg font-bold tracking-tight">
          {t("session.allPrefix")} {total} {t("session.termsRecalled")}
        </p>
        <p className="text-ui text-muted-foreground mt-1 mb-6">
          {attempts === total
            ? t("session.perfectRecall")
            : `${t("session.took")} ${attempts} ${t("session.attemptsAcross")} ${round} ${round > 1 ? t("session.roundsNoun") : t("session.roundNoun")} ${t("session.trickyResurface")}`}
        </p>
        <Button size="sm" onClick={onComplete}>
          {t("session.continue")}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ConfettiBurst burst={burst} />
      <div className="flex items-center justify-between mb-5">
        <p className={newUi ? "text-ui font-semibold text-muted-foreground" : "text-ui font-semibold"}>
          {t("session.defineFromMemory")}
        </p>
        <div className="flex items-center gap-3">
          {round > 1 && (
            <span className="flex items-center gap-1 text-caption font-semibold text-accent">
              <RotateCcw className="h-3 w-3" />
              {t("session.round")} {round}
            </span>
          )}
          <span className="text-caption text-muted-foreground tabular-nums">
            {learned.size} / {total} {t("session.learnt")}
          </span>
        </div>
      </div>

      <p className={newUi ? "mb-5 text-[23px] font-bold leading-[1.3]" : "text-xl font-bold tracking-tight mb-4"}>
        <MathText text={term.term} />
      </p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t("session.definitionPlaceholder")}
        rows={3}
        disabled={revealed}
        className={newUi ? cn(textareaClass, "px-4 py-3 text-[15px]") : "w-full rounded-xl border border-border bg-background p-3.5 text-sm text-foreground focus:outline-none focus:border-accent/50 placeholder:text-faint resize-none"}
      />

      {!revealed ? (
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            onClick={() => setRevealed(true)}
            disabled={!answer.trim()}
          >
            {t("session.checkMyAnswer")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className={newUi ? "rounded-2xl bg-accent-soft p-5" : "rounded-xl bg-accent-soft border border-accent/20 p-4"}>
            <p className={newUi ? "mb-1.5 text-caption font-semibold text-accent-dim" : "text-caption font-semibold text-accent mb-1.5"}>
              {t("session.modelDefinition")}
            </p>
            <p className={newUi ? "text-read text-foreground" : "text-ui text-foreground"}>
              <MathText text={term.definition} />
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground">
              {t("session.compareHint")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => mark(false)}
                className={cn(
                  newUi ? "flex h-10 items-center gap-1.5 rounded-xl border border-border px-4 text-[13.5px] font-semibold" : "flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold",
                  "text-muted-foreground hover:border-rose hover:text-rose",
                )}
              >
                <X className="h-3.5 w-3.5" />
                {t("session.missedIt")}
              </button>
              <button
                type="button"
                onClick={() => mark(true)}
                className={newUi ? "flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13.5px] font-semibold text-white hover:bg-accent-dim" : "flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-dim"}
              >
                <Check className="h-3.5 w-3.5" />
                {t("session.gotIt")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
