"use client";

import { MathText } from "@/components/ui/markdown-text";
import Link from "next/link";
import {
  useFlashcardDecks,
  type DeckWithWorkspace,
} from "@/lib/flashcard-decks";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { BankDocThumb } from "@/components/bank/bank-content";
import { Layers, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";

function DeckCard({ deck }: { deck: DeckWithWorkspace }) {
  const { item, workspace, cardCount } = deck;
  return (
    <Link
      href={`/flashcards/${item.id}?ws=${workspace.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-150 hover:border-border-strong hover:-translate-y-0.5 active:translate-y-0"
    >
      <BankDocThumb
        kind={item.kind}
        content={item.content}
        className="aspect-square w-full rounded-none border-0 border-b border-border"
      />
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold leading-tight tracking-tight group-hover:text-accent transition-colors">
          <MathText text={item.title} />
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">
            {cardCount} card{cardCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span className="truncate">{workspace.title}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dim">
            {item.kind === "VOCAB_DECK" ? "Vocab" : "Flashcards"}
          </span>
          {item.topic && (
            <span className="max-w-[160px] truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {item.topic}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function FlashcardsPage() {
  const { data: decks, isLoading } = useFlashcardDecks();
  const { data: dueReview } = useQuery({
    queryKey: ["due-review-count"],
    queryFn: fetchDueReview,
    staleTime: 60_000,
  });

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Flashcards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All flashcard and vocab decks from your workspaces, in one place.
          </p>
        </div>
        {dueReview && dueReview.total > 0 && (
          <Link
            href="/flashcards/review"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Review {dueReview.total} due card{dueReview.total === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      {isLoading && <CardGridSkeleton count={6} />}

      {!isLoading && (decks ?? []).length === 0 && (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
          <Layers className="mx-auto h-6 w-6 text-faint" />
          <p className="mt-3 text-sm font-medium">No flashcard decks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and analyse materials in a workspace — Scribe precomputes
            flashcard decks from them.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(decks ?? []).map((deck) => (
          <DeckCard key={deck.item.id} deck={deck} />
        ))}
      </div>
    </main>
  );
}
