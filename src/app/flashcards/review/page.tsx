"use client";

import "@/lib/i18n/flashcards";
import Image from "next/image";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { DueReviewRound } from "@/components/flashcards/due-review-round";
import { Skeleton } from "@/components/ui/skeleton";
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

  const cards = useMemo(
    () => (data?.cards ?? []).map((c) => ({ front: c.front, back: c.back, flashcardId: c.flashcardId })),
    [data],
  );

  return (
    <PageShell max="max-w-3xl" className="space-y-6">
        <PageHeader
          back={{ href: "/flashcards", label: t("fc.backToFlashcards") }}
          title={t("fc.dailyReview")}
          className="mb-0"
          subtitle={<>
            {data
              ? data.total > 0
                ? t(data.total === 1 ? "fc.dueOne" : "fc.dueMany").replace(
                    "{count}",
                    String(data.total),
                  )
                : t("fc.reviewComeBack")
              : t("fc.reviewPastDue")}</>}
        />

        {isLoading && <Skeleton className="h-[260px] w-full rounded-[28px]" />}

        {data && data.cards.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Image
              src="/design/cat3-trophy.webp"
              alt=""
              width={413}
              height={400}
              className="cat-bob pointer-events-none mx-auto h-24 w-auto select-none"
            />
            <p className="mt-4 text-[18px] font-extrabold">{t("fc.allCaughtUp")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fc.noCardsDue")}
            </p>
          </div>
        )}

        {data && data.cards.length > 0 && <DueReviewRound cards={cards} />}
    </PageShell>
  );
}
