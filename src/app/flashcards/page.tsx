"use client";

import "@/lib/i18n/flashcards";
import { MathText } from "@/components/ui/markdown-text";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, pageShellClass } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useFlashcardDecks,
  type DeckWithWorkspace,
} from "@/lib/flashcard-decks";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";

function DeckRow({ deck }: { deck: DeckWithWorkspace }) {
  const { t } = useI18n();
  const { item, workspace, cardCount } = deck;
  return (
    <Link
      href={`/flashcards/${item.id}?ws=${workspace.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent/40"
    >
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft/60">
        <Image src="/design/props/cards.png" alt="" width={44} height={44} unoptimized className="h-10 w-auto" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight">
          <MathText text={item.title} />
        </h3>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="shrink-0">
            {cardCount} {t(cardCount === 1 ? "fc.card" : "fc.cards")}
          </span>
          <span>·</span>
          <span className="truncate">{workspace.title}</span>
          {item.topic && (
            <>
              <span>·</span>
              <span className="truncate">{item.topic}</span>
            </>
          )}
        </p>
      </div>
      <span className="hidden rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dim sm:inline">
        {t(item.kind === "VOCAB_DECK" ? "fc.kindVocab" : "fc.kindFlashcards")}
      </span>
      <span className="h-8 shrink-0 rounded-lg border border-border px-3 text-[12.5px] font-semibold leading-8 text-foreground group-hover:border-accent group-hover:text-accent">
        {t("fc.study")}
      </span>
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
    <main className={pageShellClass}>
      <PageHeader title={t("fc.title")} subtitle={t("fc.subtitle")} actions={dueReview && dueReview.total > 0 && (
          <Link
            href="/flashcards/review"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t(
              dueReview.total === 1 ? "fc.reviewDueOne" : "fc.reviewDueMany",
            ).replace("{count}", String(dueReview.total))}
          </Link>
        )} />

      {isLoading && <CardGridSkeleton count={6} />}

      {!isLoading && (decks ?? []).length === 0 && (
        <EmptyState cat="book" title={t("fc.noDecksTitle")} body={t("fc.noDecksBody")} />
      )}

      <div className="flex flex-col gap-2.5">
        {(decks ?? []).map((deck) => (
          <DeckRow key={deck.item.id} deck={deck} />
        ))}
      </div>
    </main>
  );
}
