"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, SkipForward, X } from "lucide-react";

type QuestionMode = "mcq" | "type";

interface LearnCard {
  front: string;
  back: string;
  mode: QuestionMode;
  options?: string[];
}

interface DeckLearnViewProps {
  entries: { front: string; back: string }[];
  frontLabel: string;
  backLabel: string;
}

function buildLearnCards(
  entries: { front: string; back: string }[],
): LearnCard[] {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.map((card) => {
    const mode: QuestionMode =
      entries.length >= 4 && Math.random() < 0.6 ? "mcq" : "type";
    let options: string[] | undefined;
    if (mode === "mcq") {
      const wrong = entries
        .map((c) => c.back)
        .filter((b) => b !== card.back)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      options = [...wrong, card.back].sort(() => Math.random() - 0.5);
    }
    return { ...card, mode, options };
  });
}

/** Learn mode: mixed multiple-choice and typed-answer exercises with feedback. */
export function DeckLearnView({
  entries,
  frontLabel,
  backLabel,
}: DeckLearnViewProps) {
  const [round, setRound] = useState(0);
  const cards = useMemo(
    () => buildLearnCards(entries),
    // Rebuild on restart and when the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, round],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);

  const card = cards[currentIndex];

  const resetCard = () => {
    setSelectedOption(null);
    setTypedAnswer("");
    setShowFeedback(false);
    setIsCorrect(false);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setCurrentIndex(0);
    setScore({ correct: 0, total: 0 });
    setFinished(false);
    resetCard();
  };

  const checkAnswer = () => {
    if (!card || showFeedback) return;
    let correct = false;
    if (card.mode === "mcq") {
      if (selectedOption === null) return;
      correct = card.options![selectedOption] === card.back;
    } else {
      if (!typedAnswer.trim()) return;
      correct =
        typedAnswer.trim().toLowerCase() === card.back.trim().toLowerCase();
    }
    setIsCorrect(correct);
    setShowFeedback(true);
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetCard();
    } else {
      setFinished(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (showFeedback) nextCard();
        else checkAnswer();
      } else if (card?.mode === "mcq" && !showFeedback) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= (card.options?.length ?? 0)) {
          setSelectedOption(num - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFeedback, selectedOption, typedAnswer, currentIndex, card]);

  if (finished) {
    const percentage =
      score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="rounded-3xl border border-border bg-card px-6 py-14 text-center space-y-6">
        <div className="space-y-1.5">
          <p className="text-4xl">
            {percentage >= 80 ? "🎉" : percentage >= 60 ? "👏" : "💪"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {percentage >= 80
              ? "Excellent work"
              : percentage >= 60
                ? "Good job"
                : "Keep practicing"}
          </h2>
          <p className="text-sm text-muted-foreground">Round complete</p>
        </div>
        <div>
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {score.correct}
            <span className="text-muted-foreground"> / {score.total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {percentage}% correct
          </p>
        </div>
        <ProgressBar value={percentage} className="max-w-xs mx-auto" />
        <Button onClick={restart}>Study again</Button>
      </div>
    );
  }

  if (!card) return null;

  const progress =
    ((currentIndex + (showFeedback ? 1 : 0)) / cards.length) * 100;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Question {currentIndex + 1} of {cards.length}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="Start a new session with a fresh shuffle"
            >
              <RotateCcw className="h-3 w-3" />
              New session
            </button>
            {score.total > 0 && (
              <>
                <span className="inline-flex items-center gap-1 font-medium text-energy">
                  <Check className="h-3 w-3" /> {score.correct}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-rose">
                  <X className="h-3 w-3" /> {score.total - score.correct}
                </span>
              </>
            )}
            <span>{Math.round(progress)}%</span>
          </span>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {frontLabel}
          </p>
          <p className="text-lg md:text-xl font-medium leading-relaxed">
            <MarkdownText text={card.front} />
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {card.mode === "mcq" ? "Choose one" : `Type the ${backLabel.toLowerCase()}`}
          </p>

          {card.mode === "mcq" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {card.options!.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrectOption = showFeedback && option === card.back;
                const isWrongSelection =
                  showFeedback && isSelected && option !== card.back;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => !showFeedback && setSelectedOption(index)}
                    disabled={showFeedback}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      !showFeedback &&
                        (isSelected
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-card hover:bg-muted/50"),
                      isCorrectOption &&
                        "border-energy/50 bg-energy-soft",
                      isWrongSelection && "border-rose/50 bg-rose/10",
                      showFeedback &&
                        !isCorrectOption &&
                        !isWrongSelection &&
                        "border-border opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                        isCorrectOption
                          ? "bg-energy/15 text-energy"
                          : isWrongSelection
                            ? "bg-rose/15 text-rose"
                            : isSelected
                              ? "bg-accent/15 text-accent"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1 min-w-0 leading-relaxed">
                      <MarkdownText text={option} />
                    </span>
                    {isCorrectOption && (
                      <Check className="h-4 w-4 shrink-0 text-energy" />
                    )}
                    {isWrongSelection && (
                      <X className="h-4 w-4 shrink-0 text-rose" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (showFeedback) nextCard();
                    else checkAnswer();
                  }
                }}
                placeholder="Type your answer…"
                disabled={showFeedback}
                autoFocus
                className={cn(
                  "w-full rounded-xl border bg-card px-4 py-3 text-base outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/30",
                  showFeedback && isCorrect && "border-energy/50 bg-energy-soft",
                  showFeedback && !isCorrect && "border-rose/50 bg-rose/5",
                  !showFeedback && "border-border focus:border-border-strong",
                )}
              />
              {showFeedback && !isCorrect && (
                <div className="rounded-xl bg-energy-soft px-4 py-3 text-sm">
                  <span className="font-semibold text-energy">
                    Correct {backLabel.toLowerCase()}:{" "}
                  </span>
                  <MarkdownText text={card.back} />
                </div>
              )}
            </div>
          )}
        </div>

        {showFeedback && (
          <div
            className={cn(
              "rounded-xl px-4 py-3 text-center text-sm font-medium",
              isCorrect ? "bg-energy-soft text-energy" : "bg-rose/10 text-rose",
            )}
          >
            {isCorrect ? "Correct — nice work." : "Not quite — keep going."}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!showFeedback ? (
          <>
            <Button
              className="flex-1"
              onClick={checkAnswer}
              disabled={
                card.mode === "mcq"
                  ? selectedOption === null
                  : !typedAnswer.trim()
              }
            >
              Check answer
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Skip card"
              onClick={nextCard}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button className="flex-1" onClick={nextCard}>
            {currentIndex < cards.length - 1 ? "Next question" : "Finish"}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-faint">
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
          Enter
        </kbd>
        <span className="mx-1.5">check / next</span>
        {card.mode === "mcq" && (
          <>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
              1–4
            </kbd>
            <span className="ml-1.5">select</span>
          </>
        )}
      </p>
    </div>
  );
}
