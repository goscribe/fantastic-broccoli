"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";

interface DeckCardsViewProps {
  entries: { front: string; back: string }[];
  frontLabel: string;
  backLabel: string;
}

/** Quizlet-style browse mode: one large 3D flip card with navigation. */
export function DeckCardsView({
  entries,
  frontLabel,
  backLabel,
}: DeckCardsViewProps) {
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const defaultOrder = useMemo(() => entries.map((_, i) => i), [entries]);
  const order =
    shuffledOrder?.length === entries.length ? shuffledOrder : defaultOrder;

  const count = entries.length;
  const card = entries[order[currentIndex] ?? 0];

  const goPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
    setFlipped(false);
  };
  const goNext = () => {
    setCurrentIndex((prev) => (prev < count - 1 ? prev + 1 : prev));
    setFlipped(false);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        goPrevious();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (!card) return null;

  return (
    <div className="space-y-6">
      <div style={{ perspective: "1200px" }}>
        <button
          type="button"
          aria-label="Flip card"
          onClick={() => setFlipped((prev) => !prev)}
          className="relative block w-full cursor-pointer"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateX(180deg)" : "rotateX(0deg)",
            transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <span
            className="flex min-h-[380px] w-full flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-card p-10 shadow-sm hover:shadow-md transition-shadow"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              {frontLabel}
            </span>
            <span className="text-2xl md:text-3xl font-semibold leading-snug text-center">
              <MarkdownText text={card.front} />
            </span>
            <span className="text-xs text-faint">Click to reveal</span>
          </span>
          <span
            className="absolute inset-0 flex min-h-[380px] w-full flex-col items-center justify-center gap-5 rounded-3xl border border-accent/30 bg-accent-soft/40 p-10 shadow-sm"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateX(180deg)",
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-dim">
              {backLabel}
            </span>
            <span className="text-xl md:text-2xl leading-relaxed text-center">
              <MarkdownText text={card.back} />
            </span>
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={goPrevious}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" />
          Previous
        </Button>

        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {currentIndex + 1} / {count}
          </span>
          <ProgressBar
            value={((currentIndex + 1) / count) * 100}
            className="w-32"
            size="sm"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={goNext}
          disabled={currentIndex === count - 1}
        >
          Next
          <ChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentIndex(0);
              setFlipped(false);
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restart
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShuffledOrder(
                entries.map((_, i) => i).sort(() => Math.random() - 0.5),
              );
              setCurrentIndex(0);
              setFlipped(false);
            }}
          >
            <Shuffle className="mr-1.5 h-3.5 w-3.5" />
            Shuffle
          </Button>
        </div>
        <p className="text-xs text-faint">
          Use ← → to navigate · Space to flip
        </p>
      </div>
    </div>
  );
}
