"use client";

import { DECK_LABEL_KEYS } from "@/lib/i18n/flashcards";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import {
  gradeFlashcardTypedAnswer,
  recordFlashcardAttempt,
  type DeckCardProgress,
} from "@/lib/api/study-session";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { Check, RotateCcw, SkipForward, X } from "lucide-react";

type QuestionMode = "mcq" | "type";

interface DeckEntry {
  front: string;
  back: string;
  flashcardId?: string;
}

interface LearnCard extends DeckEntry {
  mode: QuestionMode;
  options?: string[];
}

interface DeckLearnViewProps {
  entries: DeckEntry[];
  frontLabel: string;
  backLabel: string;
  /** Per-card SRS progress, when the deck is backed by pooled flashcards. */
  progress?: DeckCardProgress[];
  /** Called after an attempt is persisted so callers can refetch progress. */
  onAttemptRecorded?: () => void;
}

type CardStatus = "new" | "learning" | "reviewing" | "mastered";

function cardStatus(
  progress: DeckCardProgress["progress"] | undefined,
): CardStatus {
  if (!progress || progress.timesStudied === 0) return "new";
  if (progress.masteryLevel >= 80) return "mastered";
  if (progress.masteryLevel >= 40) return "reviewing";
  return "learning";
}

const STATUS_LABEL_KEY: Record<CardStatus, TranslationKey> = {
  new: "fc.statusNew",
  learning: "fc.statusLearning",
  reviewing: "fc.statusReviewing",
  mastered: "fc.statusMastered",
};

const STATUS_CLASS: Record<CardStatus, string> = {
  new: "bg-accent-soft text-accent",
  learning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  reviewing: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  mastered: "bg-energy-soft text-energy",
};

function isDue(progress: DeckCardProgress["progress"] | undefined): boolean {
  if (!progress || progress.timesStudied === 0) return true;
  if (!progress.nextReviewAt) return true;
  return new Date(progress.nextReviewAt).getTime() <= Date.now();
}

function buildLearnCards(
  entries: DeckEntry[],
  progressByCard: Map<string, DeckCardProgress["progress"]>,
): LearnCard[] {
  // Due cards first (never studied or past their SRS review date), like the
  // old scribe learn flow; shuffled within each group.
  const shuffled = [...entries]
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => {
      const dueA = isDue(a.flashcardId ? progressByCard.get(a.flashcardId) : undefined);
      const dueB = isDue(b.flashcardId ? progressByCard.get(b.flashcardId) : undefined);
      return Number(dueB) - Number(dueA);
    });
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
  progress,
  onAttemptRecorded,
}: DeckLearnViewProps) {
  const { t } = useI18n();
  const front = t(DECK_LABEL_KEYS[frontLabel] ?? frontLabel);
  const back = t(DECK_LABEL_KEYS[backLabel] ?? backLabel);
  const progressByCard = useMemo(
    () =>
      new Map(
        (progress ?? []).map((p) => [p.flashcardId, p.progress] as const),
      ),
    [progress],
  );

  const [round, setRound] = useState(0);
  const cards = useMemo(
    () => buildLearnCards(entries, progressByCard),
    // Rebuild on restart and when the deck changes (not on progress refetch,
    // which would reshuffle mid-session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, round],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [gradingReason, setGradingReason] = useState("");
  const [grading, setGrading] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const [cardStartTime, setCardStartTime] = useState(() => Date.now());

  const card = cards[currentIndex];
  const status = card?.flashcardId
    ? cardStatus(progressByCard.get(card.flashcardId))
    : null;

  const resetCard = () => {
    setSelectedOption(null);
    setTypedAnswer("");
    setShowFeedback(false);
    setIsCorrect(false);
    setGradingReason("");
    setCardStartTime(Date.now());
  };

  const restart = () => {
    setRound((r) => r + 1);
    setCurrentIndex(0);
    setScore({ correct: 0, total: 0 });
    setFinished(false);
    resetCard();
  };

  const checkAnswer = async () => {
    if (!card || showFeedback || grading) return;
    let correct = false;
    let reason = "";
    if (card.mode === "mcq") {
      if (selectedOption === null) return;
      correct = card.options![selectedOption] === card.back;
    } else {
      if (!typedAnswer.trim()) return;
      if (card.flashcardId) {
        setGrading(true);
        try {
          const result = await gradeFlashcardTypedAnswer({
            flashcardId: card.flashcardId,
            userAnswer: typedAnswer,
          });
          correct = result.isCorrect;
          reason = result.reason;
        } catch {
          correct =
            typedAnswer.trim().toLowerCase() === card.back.trim().toLowerCase();
        } finally {
          setGrading(false);
        }
      } else {
        correct =
          typedAnswer.trim().toLowerCase() === card.back.trim().toLowerCase();
      }
    }
    setIsCorrect(correct);
    setGradingReason(reason);
    setShowFeedback(true);
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
    if (card.flashcardId) {
      recordFlashcardAttempt({
        flashcardId: card.flashcardId,
        isCorrect: correct,
        timeSpentMs: Date.now() - cardStartTime,
      })
        .then(() => onAttemptRecorded?.())
        .catch(() => {});
    }
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
            {t(
              percentage >= 80
                ? "fc.excellent"
                : percentage >= 60
                  ? "fc.goodJob"
                  : "fc.keepPracticing",
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{t("fc.roundComplete")}</p>
        </div>
        <div>
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {score.correct}
            <span className="text-muted-foreground"> / {score.total}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fc.percentCorrect").replace("{pct}", String(percentage))}
          </p>
        </div>
        <ProgressBar value={percentage} className="max-w-xs mx-auto" />
        <Button onClick={restart}>{t("fc.studyAgain")}</Button>
      </div>
    );
  }

  if (!card) return null;

  const percentComplete =
    ((currentIndex + (showFeedback ? 1 : 0)) / cards.length) * 100;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span>
              {t("fc.questionOf")
                .replace("{n}", String(currentIndex + 1))
                .replace("{total}", String(cards.length))}
            </span>
            {status && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  STATUS_CLASS[status],
                )}
              >
                {t(STATUS_LABEL_KEY[status])}
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title={t("fc.newSessionTitle")}
            >
              <RotateCcw className="h-3 w-3" />
              {t("fc.newSession")}
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
            <span>{Math.round(percentComplete)}%</span>
          </span>
        </div>
        <ProgressBar value={percentComplete} size="sm" />
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {front}
          </p>
          <p className="text-lg md:text-xl font-medium leading-relaxed">
            <MarkdownText text={card.front} />
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            {card.mode === "mcq"
              ? t("fc.chooseOne")
              : t("fc.typeThe").replace("{label}", back.toLowerCase())}
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
                placeholder={t("fc.typeAnswerPlaceholder")}
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
                    {t("fc.correctLabel").replace(
                      "{label}",
                      back.toLowerCase(),
                    )}{" "}
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
            {t(isCorrect ? "fc.correctFeedback" : "fc.incorrectFeedback")}
            {gradingReason && (
              <p className="mt-1.5 text-xs font-normal opacity-90">
                {gradingReason}
              </p>
            )}
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
                grading ||
                (card.mode === "mcq"
                  ? selectedOption === null
                  : !typedAnswer.trim())
              }
            >
              {t(grading ? "fc.checking" : "fc.checkAnswer")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title={t("fc.skipCard")}
              onClick={nextCard}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button className="flex-1" onClick={nextCard}>
            {t(currentIndex < cards.length - 1 ? "fc.nextQuestion" : "fc.finish")}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-faint">
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
          Enter
        </kbd>
        <span className="mx-1.5">{t("fc.kbCheckNext")}</span>
        {card.mode === "mcq" && (
          <>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">
              1–4
            </kbd>
            <span className="ml-1.5">{t("fc.kbSelect")}</span>
          </>
        )}
      </p>
    </div>
  );
}
