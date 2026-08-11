"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { studySessionApi } from "@/lib/api/study-session";
import { createStudySession } from "@/lib/api/study";
import { Button } from "@/components/ui/button";
import { deckEntries } from "@/components/bank/bank-content";
import { DeckCardsView } from "@/components/flashcards/deck-cards-view";
import { DeckLearnView } from "@/components/flashcards/deck-learn-view";
import { DeckTestView } from "@/components/flashcards/deck-test-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";

type DeckMode = "cards" | "learn" | "test";

const MODES: { id: DeckMode; label: string; icon: typeof Layers }[] = [
  { id: "cards", label: "Cards", icon: Layers },
  { id: "learn", label: "Learn", icon: GraduationCap },
  { id: "test", label: "Test", icon: ClipboardCheck },
];

function FlashcardDeck() {
  const params = useParams();
  const router = useRouter();
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

  const [mode, setMode] = useState<DeckMode>("cards");

  const startSession = useMutation({
    mutationFn: () =>
      createStudySession({
        workspaceId,
        title: item!.title,
        depth: "moderate",
        durationMinutes: 30,
        topics: item!.topic ?? item!.title,
      }),
    onSuccess: (session) => {
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[380px] w-full rounded-3xl" />
      </div>
    );
  }

  if (!item || !deck || deck.entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <Layers className="mx-auto h-6 w-6 text-faint" />
        <p className="mt-3 text-sm font-medium">
          {item ? "This deck has no cards yet" : "Deck not found"}
        </p>
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

  const cardCount = deck.entries.length;

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
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  mode === id
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            </div>
            <Button
              size="sm"
              onClick={() => startSession.mutate()}
              disabled={startSession.isPending}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {startSession.isPending ? "Starting…" : "Study"}
            </Button>
          </div>
        </div>
        {startSession.isError && (
          <p className="mt-2 text-sm text-rose">
            {startSession.error instanceof Error
              ? startSession.error.message
              : "Could not start a study session."}
          </p>
        )}
      </div>

      {mode === "cards" && (
        <DeckCardsView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
        />
      )}
      {mode === "learn" && (
        <DeckLearnView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
        />
      )}
      {mode === "test" && (
        <DeckTestView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
        />
      )}
    </div>
  );
}

export default function FlashcardDeckPage() {
  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <Suspense fallback={null}>
        <FlashcardDeck />
      </Suspense>
    </main>
  );
}
