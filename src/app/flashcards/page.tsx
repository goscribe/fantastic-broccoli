"use client";

import "@/lib/i18n/flashcards";
import { MathText } from "@/components/ui/markdown-text";
import Link from "next/link";
import Image from "next/image";
import {
  useFlashcardDecks,
  type DeckWithWorkspace,
} from "@/lib/flashcard-decks";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { BankDocThumb } from "@/components/bank/bank-content";
import { RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";

function DeckCard({ deck }: { deck: DeckWithWorkspace }) {
  const { t } = useI18n();
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
            {cardCount} {t(cardCount === 1 ? "fc.card" : "fc.cards")}
          </span>
          <span>·</span>
          <span className="truncate">{workspace.title}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dim">
            {t(item.kind === "VOCAB_DECK" ? "fc.kindVocab" : "fc.kindFlashcards")}
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
  const { t } = useI18n();
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
          <h1 className="text-xl font-bold tracking-tight">{t("fc.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fc.subtitle")}
          </p>
        </div>
        {dueReview && dueReview.total > 0 && (
          <Link
            href="/flashcards/review"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t(
              dueReview.total === 1 ? "fc.reviewDueOne" : "fc.reviewDueMany",
            ).replace("{count}", String(dueReview.total))}
          </Link>
        )}
      </div>

      {isLoading && <CardGridSkeleton count={6} />}

      {!isLoading && (decks ?? []).length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <Image
            src="/illustrations/cards.png"
            alt=""
            width={200}
            height={150}
            className="pointer-events-none mx-auto h-24 w-auto select-none"
          />
          <p className="mt-4 text-sm font-medium">{t("fc.noDecksTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("fc.noDecksBody")}
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
