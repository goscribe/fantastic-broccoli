"use client";

import { useState } from "react";
import { FlashcardContent } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { progressPercent } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, ArrowRight } from "lucide-react";

interface FlashcardActivityProps {
  content: FlashcardContent;
  onCardResult: (index: number, known: boolean) => void;
  onComplete: () => void;
}

export function FlashcardActivity({
  content,
  onCardResult,
  onComplete,
}: FlashcardActivityProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(
    content.cards.map((c) => c.known),
  );

  const card = content.cards[currentIndex];
  const reviewed = results.filter((r) => r !== null).length;
  const isFinished = reviewed === content.cards.length;

  if (!card || isFinished) {
    const correct = results.filter((r) => r === true).length;
    return (
      <Card className="text-center py-6">
        <p className="text-lg font-semibold mb-1">Session complete</p>
        <p className="text-sm text-muted-foreground mb-4">
          {correct}/{content.cards.length} cards known
        </p>
        <ProgressBar
          value={progressPercent(correct, content.cards.length)}
          className="max-w-xs mx-auto mb-4"
          showLabel
        />
        <Button variant="primary" size="sm" onClick={onComplete}>
          Continue <ArrowRight className="h-3 w-3 ml-1" />
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
          Card {currentIndex + 1} of {content.cards.length}
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
        className="w-full"
      >
        <Card className="min-h-[160px] flex items-center justify-center cursor-pointer hover:border-accent/20">
          <div className="text-center px-4">
            {!flipped ? (
              <>
                <p className="text-base font-medium">{card.front}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Tap to reveal
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">
                  Answer
                </p>
                <p className="text-sm leading-relaxed">{card.back}</p>
              </>
            )}
          </div>
        </Card>
      </button>

      {flipped && (
        <div className="flex justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleResult(false)}
          >
            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
            Didn&apos;t know
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleResult(true)}
          >
            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
            Knew it
          </Button>
        </div>
      )}
    </div>
  );
}
