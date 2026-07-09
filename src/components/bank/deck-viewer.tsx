"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/ui/markdown-text";

export interface DeckEntry {
  front: string;
  back: string;
}

/**
 * Flip-card deck viewer: one card at a time with a 3D front/back flip,
 * prev/next/shuffle navigation and keyboard shortcuts (arrows + space).
 */
export function DeckViewer({
  entries,
  frontLabel = "Question",
  backLabel = "Answer",
}: {
  entries: DeckEntry[];
  frontLabel?: string;
  backLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (entries.length === 0) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        setIndex((prev) => Math.max(0, prev - 1));
        setFlipped(false);
      } else if (e.key === "ArrowRight") {
        setIndex((prev) => Math.min(entries.length - 1, prev + 1));
        setFlipped(false);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [entries.length]);

  if (entries.length === 0) return null;

  const card = entries[Math.min(index, entries.length - 1)];

  const shuffle = () => {
    setIndex(Math.floor(Math.random() * entries.length));
    setFlipped(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] font-medium text-muted-foreground tabular-nums">
        Card {index + 1} of {entries.length}
      </p>

      <div
        className="w-full cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((prev) => !prev)}
      >
        <div
          className={`relative transition-transform duration-500 ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="rounded-2xl border border-border bg-card"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="p-10 flex flex-col justify-center items-center min-h-[220px]">
              <div className="text-center w-full space-y-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {frontLabel}
                </span>
                <p className="text-lg font-semibold leading-relaxed">
                  <MarkdownText text={card.front} />
                </p>
                <p className="text-xs text-muted-foreground">
                  Click or press Space to flip
                </p>
              </div>
            </div>
          </div>

          <div
            className="absolute inset-0 rounded-2xl border border-border bg-card [transform:rotateY(180deg)]"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="p-10 flex flex-col justify-center items-center min-h-[220px] h-full overflow-y-auto">
              <div className="text-center w-full space-y-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {backLabel}
                </span>
                <p className="text-lg font-semibold leading-relaxed">
                  <MarkdownText text={card.back} />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIndex((prev) => Math.max(0, prev - 1));
              setFlipped(false);
            }}
            disabled={index === 0}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0"
            onClick={shuffle}
            title="Random card"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIndex((prev) => Math.min(entries.length - 1, prev + 1));
              setFlipped(false);
            }}
            disabled={index === entries.length - 1}
            className="h-8"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px]">
            ←
          </kbd>
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] ml-0.5">
            →
          </kbd>
          <span className="mx-1.5">navigate</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px]">
            Space
          </kbd>
          <span className="ml-1.5">flip</span>
        </p>
      </div>
    </div>
  );
}
