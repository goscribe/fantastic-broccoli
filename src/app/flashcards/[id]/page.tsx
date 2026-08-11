"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { studySessionApi } from "@/lib/api/study-session";
import { deckEntries } from "@/components/bank/bank-content";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, Layers } from "lucide-react";

function FlashcardViewer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const deckId = params.id as string;
  const workspaceId = searchParams.get("ws") ?? "";

  const { data: items, isLoading } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
    enabled: !!workspaceId,
  });

  const item = items?.find((i) => i.id === deckId);
  const deck = useMemo(() => (item ? deckEntries(item) : null), [item]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cardCount = deck?.entries.length ?? 0;

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((prev) => !prev);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        setFlipped(false);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((prev) => (prev < cardCount - 1 ? prev + 1 : prev));
        setFlipped(false);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [cardCount]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!item || !deck) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-border bg-card px-6 py-12 text-center">
        <Layers className="mx-auto h-6 w-6 text-faint" />
        <p className="mt-3 text-sm font-medium">Deck not found</p>
        <Link
          href="/flashcards"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Flashcards
        </Link>
      </div>
    );
  }

  const current = deck.entries[currentIndex];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link
          href="/flashcards"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Flashcards
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{item.title}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {cardCount} card{cardCount === 1 ? "" : "s"}
          </span>
          {item.topic && (
            <>
              <span>·</span>
              <span>{item.topic}</span>
            </>
          )}
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Flip card"
        onClick={() => setFlipped((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setFlipped((prev) => !prev);
        }}
        className="rounded-2xl border border-border bg-card p-6 cursor-pointer transition-all duration-500 hover:shadow-lg"
        style={{
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transformStyle: "preserve-3d",
          transition: "transform 0.5s",
        }}
      >
        {current ? (
          <div className="flex min-h-[300px] items-center justify-center text-center">
            <div
              className="w-full"
              style={{
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transformStyle: "preserve-3d",
                transition: "transform 0.5s",
              }}
            >
              <p className="text-xs font-medium text-faint mb-3">
                {flipped ? deck.backLabel : deck.frontLabel}
              </p>
              <p className="text-2xl leading-relaxed">
                <MarkdownText
                  text={flipped ? current.back : current.front}
                />
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center text-center text-muted-foreground">
            No flashcards in this deck yet.
          </div>
        )}
      </div>

      {cardCount > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
              setFlipped(false);
            }}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            {currentIndex + 1} of {cardCount}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentIndex((prev) =>
                prev < cardCount - 1 ? prev + 1 : prev,
              );
              setFlipped(false);
            }}
            disabled={currentIndex === cardCount - 1}
          >
            Next
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-faint">
        Tap the card or press Space to flip · Use ← → to navigate
      </p>
    </div>
  );
}

export default function FlashcardDeckPage() {
  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <Suspense fallback={null}>
        <FlashcardViewer />
      </Suspense>
    </main>
  );
}
