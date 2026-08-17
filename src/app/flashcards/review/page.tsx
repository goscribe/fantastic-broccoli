"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { DeckLearnView } from "@/components/flashcards/deck-learn-view";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

/** Daily spaced review: every card past its SM-2 review date, across decks. */
export default function DueReviewPage() {
  // No refetch during the round: answering moves cards' nextReviewAt forward,
  // so a refetch would drop cards out from under the learn view.
  const { data, isLoading } = useQuery({
    queryKey: ["due-review"],
    queryFn: fetchDueReview,
    staleTime: Infinity,
  });

  const entries = useMemo(
    () =>
      (data?.cards ?? []).map((c) => ({
        front: c.front,
        back: c.back,
        flashcardId: c.flashcardId,
      })),
    [data],
  );
  const progress = useMemo(
    () =>
      (data?.cards ?? []).map((c) => ({
        flashcardId: c.flashcardId,
        progress: c.progress,
      })),
    [data],
  );

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link
            href="/flashcards"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Flashcards
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Daily review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? data.total > 0
                ? `${data.total} card${data.total === 1 ? "" : "s"} due for review`
                : "Cards you've studied come back here when they're due."
              : "Cards past their spaced-repetition review date."}
          </p>
        </div>

        {isLoading && <Skeleton className="h-[380px] w-full rounded-3xl" />}

        {data && data.cards.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-energy" />
            <p className="mt-3 text-sm font-medium">All caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No cards are due right now — come back tomorrow.
            </p>
          </div>
        )}

        {data && data.cards.length > 0 && (
          <DeckLearnView
            entries={entries}
            frontLabel="Front"
            backLabel="Back"
            progress={progress}
          />
        )}
      </div>
    </main>
  );
}
