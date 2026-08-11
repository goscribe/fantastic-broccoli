"use client";

import Link from "next/link";
import {
  useFlashcardDecks,
  type DeckWithWorkspace,
} from "@/lib/flashcard-decks";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";

function DeckCard({ deck }: { deck: DeckWithWorkspace }) {
  const { item, workspace, cardCount } = deck;
  return (
    <Link
      href={`/flashcards/${item.id}?ws=${workspace.id}`}
      className="block rounded-2xl border border-border bg-card p-5 cursor-pointer transition-all duration-300 hover:bg-muted/50"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold leading-tight tracking-tight">
          {item.title}
        </h3>
        <Layers className="h-5 w-5 shrink-0 text-faint" />
      </div>
      <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
        <span>
          {cardCount} card{cardCount === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span className="truncate">{workspace.title}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1 pt-2 min-h-[30px]">
        {item.topic ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {item.topic}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">No topic</span>
        )}
        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-xs text-accent-dim">
          {item.kind === "VOCAB_DECK" ? "Vocab" : "Flashcards"}
        </span>
      </div>
    </Link>
  );
}

export default function FlashcardsPage() {
  const { data: decks, isLoading } = useFlashcardDecks();

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Flashcards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All flashcard and vocab decks from your workspaces, in one place.
        </p>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(decks ?? []).map((deck) => (
          <DeckCard key={deck.item.id} deck={deck} />
        ))}
      </div>
    </main>
  );
}
