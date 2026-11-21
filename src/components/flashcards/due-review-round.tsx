"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { FlashcardRound } from "@/components/session/flashcard-activity";
import { ItemDots, PlayDone } from "@/components/session/play-ui";
import { buttonClass } from "@/components/ui/button";
import { recordFlashcardAttempt } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/finish";
import "@/lib/i18n/flashcards";

/**
 * The daily review, played with the session player's flashcard: tap to turn
 * the card over, then "Didn't know" / "Knew it". Each answer is recorded
 * against the card's spaced-repetition schedule, as before.
 */
export function DueReviewRound({ cards }: { cards: { front: string; back: string; flashcardId: string }[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(() => cards.map(() => null));
  // When the current card came on screen (set in an effect and on every move), for time-on-card.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const goTo = (i: number) => {
    setFlipped(false);
    setIndex(i);
    shownAt.current = Date.now();
  };

  const answer = (known: boolean) => {
    const card = cards[index];
    const next = [...results];
    next[index] = known;
    setResults(next);
    recordFlashcardAttempt({ flashcardId: card.flashcardId, isCorrect: known, timeSpentMs: Date.now() - shownAt.current })
      .then(() => queryClient.invalidateQueries({ queryKey: ["due-review-count"] }))
      .catch(() => {});
    // On to the next card not yet answered; none left ends the round.
    const order = [...cards.keys()];
    const after = [...order.slice(index + 1), ...order.slice(0, index)].find((i) => next[i] === null);
    if (after !== undefined) goTo(after);
  };

  if (results.every((r) => r !== null)) {
    const known = results.filter(Boolean).length;
    return (
      <PlayDone
        title={t("finish.cardsDone")}
        sub={`${known}/${cards.length} ${t("session.cardsKnown")}`}
        pose={known * 2 >= cards.length ? "cheer" : "book"}
        action={
          <>
            {t("fc.backToFlashcards")} <ArrowRight className="ml-1.5 size-4" />
          </>
        }
        onAction={() => router.push("/flashcards")}
      >
        <ItemDots className="!w-40 sm:!w-48" states={results.map((r) => (r ? "right" : "wrong"))} />
        <button
          type="button"
          onClick={() => {
            setResults(cards.map(() => null));
            goTo(0);
          }}
          className={buttonClass({ variant: "ghost", size: "sm", className: "-ml-3.5 mt-2" })}
        >
          {t("fc.studyAgain")}
        </button>
      </PlayDone>
    );
  }

  return <FlashcardRound cards={cards} index={index} flipped={flipped} results={results} onFlip={() => setFlipped((f) => !f)} onGoTo={goTo} onResult={answer} />;
}
