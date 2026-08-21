"use client";

import "@/lib/i18n/flashcards";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { DeckLearnView } from "@/components/flashcards/deck-learn-view";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Daily spaced review: every card past its SM-2 review date, across decks. */
export default function DueReviewPage() {
  const { t } = useI18n();
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
            {t("fc.backToFlashcards")}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {t("fc.dailyReview")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? data.total > 0
                ? t(data.total === 1 ? "fc.dueOne" : "fc.dueMany").replace(
                    "{count}",
                    String(data.total),
                  )
                : t("fc.reviewComeBack")
              : t("fc.reviewPastDue")}
          </p>
        </div>

        {isLoading && <Skeleton className="h-[380px] w-full rounded-3xl" />}

        {data && data.cards.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <Image
              src="/illustrations/props/trophy.png"
              alt=""
              width={132}
              height={160}
              className="pointer-events-none mx-auto h-20 w-auto select-none"
            />
            <p className="mt-3 text-sm font-medium">{t("fc.allCaughtUp")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fc.noCardsDue")}
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
