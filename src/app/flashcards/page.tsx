"use client";

import Link from "next/link";
import {
  useFlashcardDecks,
  type DeckWithWorkspace,
} from "@/lib/flashcard-decks";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { FlashcardsArt } from "@/components/graphics/bank-art";
import { Layers } from "lucide-react";

function DeckCard({ deck }: { deck: DeckWithWorkspace }) {
  const { item, workspace, cardCount } = deck;
  return (
    <Link
      href={`/flashcards/${item.id}?ws=${workspace.id}`}
      className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-150 hover:border-border-strong hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
        <FlashcardsArt className="h-8 w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight group-hover:text-accent transition-colors">
          {item.title}
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="shrink-0">
            {cardCount} card{cardCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span className="truncate">{workspace.title}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
