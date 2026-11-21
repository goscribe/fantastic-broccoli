"use client";

import { useNewUi } from "@/lib/new-ui";
import { useState } from "react";
import { FlashcardContent } from "@/types";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { useReportCurrentItem } from "@/lib/current-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { progressPercent } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, ArrowRight, ArrowLeft } from "lucide-react";
import { ItemDots, PlayActions, PlayDone, PlayPrimary, RunBadge, playLink, playQuiet, runOfRight } from "@/components/session/play-ui";
import { cn } from "@/lib/utils";

interface FlashcardActivityProps {
  activityId: string;
  content: FlashcardContent;
  draft?: Record<string, unknown>;
  onCardResult: (index: number, known: boolean) => void;
  onComplete: () => void;
}

export function FlashcardActivity({
  activityId,
  content,
  draft,
  onCardResult,
  onComplete,
}: FlashcardActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const restored = restoredDraft(activityId, draft) as
    | Partial<{ currentIndex: number; results: (boolean | null)[] }>
    | undefined;
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(restored?.currentIndex ?? 0, content.cards.length - 1),
  );
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(
    restored?.results?.length === content.cards.length
      ? restored.results
      : content.cards.map((c) => c.known),
  );

  useReportCurrentItem(activityId, currentIndex);
  useActivityDraft(activityId, { currentIndex, results });

  const card = content.cards[currentIndex];
  const reviewed = results.filter((r) => r !== null).length;
  const isFinished = reviewed === content.cards.length;

  if (newUi && (!card || isFinished)) {
    const correct = results.filter((r) => r === true).length;
    return (
      <PlayDone
        title={t("finish.cardsDone")}
        sub={`${correct}/${content.cards.length} ${t("session.cardsKnown")}`}
        pose={correct * 2 >= content.cards.length ? "cheer" : "book"}
        action={
          <>
            {t("session.continue")} <ArrowRight className="ml-1.5 size-4" />
          </>
        }
        onAction={onComplete}
      >
        <ItemDots className="!w-40 sm:!w-48" states={results.map((r) => (r === true ? "right" : r === false ? "wrong" : "todo"))} />
      </PlayDone>
    );
  }

  if (!card || isFinished) {
    const correct = results.filter((r) => r === true).length;
    return (
      <Card className="text-center py-6">
        <p className="text-lg font-semibold mb-1">
          {t("session.flashcardsComplete")}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {correct}/{content.cards.length} {t("session.cardsKnown")}
        </p>
        <ProgressBar
          value={progressPercent(correct, content.cards.length)}
          className="max-w-xs mx-auto mb-4"
          showLabel
        />
        <Button variant="primary" size="sm" onClick={onComplete}>
          {t("session.continue")} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Card>
    );
  }

  const handleResult = (known: boolean) => {
    const newResults = [...results];
    newResults[currentIndex] = known;
    setResults(newResults);
    onCardResult(currentIndex, known);
    setFlipped(false);
    if (currentIndex < content.cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (newUi) {
    return (
      <FlashcardRound
        cards={content.cards}
        index={currentIndex}
        flipped={flipped}
        results={results}
        onFlip={() => setFlipped(!flipped)}
        onGoTo={(i) => {
          setFlipped(false);
          setCurrentIndex(i);
        }}
        onResult={handleResult}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => {
                setFlipped(false);
                setCurrentIndex(currentIndex - 1);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {t("session.back")}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {t("session.card")} {currentIndex + 1} {t("session.of")}{" "}
            {content.cards.length}
          </span>
        </div>
        <ProgressBar
          value={progressPercent(reviewed, content.cards.length)}
          className="w-24"
          size="sm"
        />
      </div>

      <button
        type="button"
        onClick={() => setFlipped(!flipped)}
        className="relative w-full"
      >
        <span className="relative flex min-h-[160px] w-full cursor-pointer items-center justify-center rounded-2xl border border-border bg-card p-6">
          <div className="text-center px-4">
            {!flipped ? (
              <>
                <p className="text-base font-medium">
                  <MarkdownText text={card.front} />
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("session.tapToReveal")}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("session.answer")}
                </p>
                <p className={newUi ? "text-[17px] leading-relaxed" : "text-sm leading-relaxed"}>
                  <MarkdownText text={card.back} />
                </p>
              </>
            )}
          </div>
        </span>
      </button>

      {flipped ? (
        <div className="flex justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleResult(false)}
          >
            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
            {t("session.didntKnow")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleResult(true)}
          >
            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
            {t("session.knewIt")}
          </Button>
        </div>
      ) : (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentIndex >= content.cards.length - 1}
            onClick={() => {
              setFlipped(false);
              setCurrentIndex(currentIndex + 1);
            }}
          >
            {t("session.nextCard")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * One flashcard on screen (the session player's card): tap to turn it over,
 * then "Didn't know" / "Knew it". Presentational, so the daily review
 * (/flashcards/review) plays exactly the same card as a study session.
 */
export function FlashcardRound({
  cards,
  index,
  flipped,
  results,
  onFlip,
  onGoTo,
  onResult,
}: {
  cards: { front: string; back: string }[];
  index: number;
  flipped: boolean;
  results: (boolean | null)[];
  onFlip: () => void;
  onGoTo: (index: number) => void;
  onResult: (known: boolean) => void;
}) {
  const { t } = useI18n();
  const card = cards[index];
  if (!card) return null;
  return (
    <div className="space-y-4">
      <div className="flex min-h-6 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {index > 0 && (
            <button type="button" onClick={() => onGoTo(index - 1)} className="-my-3 -ml-2 flex min-h-11 items-center gap-1 px-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" />
              {t("session.back")}
            </button>
          )}
          <span data-scroll-line className="text-[13px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">
            {t("session.card")} {index + 1} {t("session.of")} {cards.length}
          </span>
          <RunBadge run={runOfRight(results, index)} />
        </div>
        <ItemDots current={index} states={results.map((r) => (r === true ? "right" : r === false ? "wrong" : "todo"))} />
      </div>

      {/* The card is the one surface on the page; both faces are the same outlined card, and it turns over when tapped. */}
      <button
        type="button"
        key={`${index}-${flipped ? "b" : "f"}`}
        onClick={onFlip}
        aria-label={flipped ? undefined : t("session.tapToReveal")}
        className={cn(
          "play-flip flex min-h-[220px] w-full touch-manipulation flex-col items-center justify-center rounded-[28px] bg-card px-6 py-8 text-center ring-2 ring-inset ring-[var(--edge)] transition-colors sm:min-h-[260px] sm:px-12",
          !flipped && "hover:bg-muted",
        )}
      >
        <span className="mb-3 text-[12.5px] font-extrabold text-muted-foreground">{flipped ? t("session.answer") : t("session.tapToReveal")}</span>
        <span className={cn("block max-w-[34rem] text-foreground [overflow-wrap:anywhere]", flipped ? "text-[18px] font-semibold leading-relaxed sm:text-[19px]" : "text-[21px] font-extrabold leading-snug sm:text-[24px]")}>
          <MarkdownText text={flipped ? card.back : card.front} />
        </span>
      </button>

      {flipped ? (
        <PlayActions>
          <button type="button" onClick={() => onResult(false)} className={playQuiet}>
            {t("session.didntKnow")}
          </button>
          <PlayPrimary onClick={() => onResult(true)}>{t("session.knewIt")}</PlayPrimary>
        </PlayActions>
      ) : (
        <PlayActions>
          {index < cards.length - 1 && (
            <button type="button" onClick={() => onGoTo(index + 1)} className={cn(playLink, "justify-center sm:mr-3")}>
              {t("session.nextCard")}
            </button>
          )}
          <PlayPrimary onClick={onFlip}>{t("finish.showAnswer")}</PlayPrimary>
        </PlayActions>
      )}
    </div>
  );
}
