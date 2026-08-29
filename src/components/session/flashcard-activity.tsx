"use client";

import { useState } from "react";
import { FlashcardContent } from "@/types";
import { restoredDraft, useActivityDraft } from "@/lib/use-activity-draft";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { progressPercent } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, ArrowRight } from "lucide-react";

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

  useActivityDraft(activityId, { currentIndex, results });

  const card = content.cards[currentIndex];
  const reviewed = results.filter((r) => r !== null).length;
  const isFinished = reviewed === content.cards.length;

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("session.card")} {currentIndex + 1} {t("session.of")}{" "}
          {content.cards.length}
        </span>
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
                <p className="text-sm leading-relaxed">
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
