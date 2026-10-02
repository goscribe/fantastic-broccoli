"use client";

import "@/lib/i18n/flashcards";
import "@/lib/i18n/retention";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDueReview } from "@/lib/api/study-session";
import { DeckLearnView } from "@/components/flashcards/deck-learn-view";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackedButton } from "@/components/ui/tracked-button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ctaProps, track } from "@/lib/analytics";
import { markReminderOpened } from "@/lib/review-reminders";

/**
 * Daily spaced review: every card past its SM-2 review date, across decks.
 * Reminder deep links (`?workspace=…&reminder=…&src=…`) narrow it to that
 * workspace's due cards and open straight on the first one.
 */
export default function DueReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-6 py-6 md:px-10">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <Skeleton className="h-[380px] w-full rounded-3xl" />
          </div>
        </main>
      }
    >
      <DueReview />
    </Suspense>
  );
}

function DueReview() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const reminderId = searchParams.get("reminder");
  const src = searchParams.get("src");
  // No refetch during the round: answering moves cards' nextReviewAt forward,
  // so a refetch would drop cards out from under the learn view.
  const { data, isLoading } = useQuery({
    queryKey: ["due-review"],
    queryFn: fetchDueReview,
    staleTime: Infinity,
  });

  // Prefer the reminder's workspace; fall back to everything due.
  const { workspaceCards, cards } = useMemo(() => {
    const all = data?.cards ?? [];
    const scoped = workspaceId
      ? all.filter((c) => c.workspaceId === workspaceId)
      : all;
    return { workspaceCards: scoped, cards: scoped.length > 0 ? scoped : all };
  }, [data, workspaceId]);

  const reminderTracked = useRef(false);
  useEffect(() => {
    if (!reminderId || !data || reminderTracked.current) return;
    reminderTracked.current = true;
    const reminder = markReminderOpened(reminderId);
    track("reminder_opened", {
      reminder_id: reminderId,
      workspace_id: workspaceId ?? undefined,
      src: src ?? undefined,
      known_reminder: !!reminder,
      minutes_late: reminder
        ? Math.round((Date.now() - Date.parse(reminder.scheduledAt)) / 60_000)
        : undefined,
      due_count: cards.length,
      workspace_due_count: workspaceCards.length,
    });
  }, [reminderId, workspaceId, src, data, cards.length, workspaceCards.length]);

  const entries = useMemo(
    () =>
      cards.map((c) => ({
        front: c.front,
        back: c.back,
        flashcardId: c.flashcardId,
      })),
    [cards],
  );
  const progress = useMemo(
    () =>
      cards.map((c) => ({
        flashcardId: c.flashcardId,
        progress: c.progress,
      })),
    [cards],
  );

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link
            href="/flashcards"
            {...ctaProps("review_back_to_flashcards", "tertiary")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("fc.backToFlashcards")}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            {reminderId ? t("retention.reviewReady") : t("fc.dailyReview")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? cards.length > 0
                ? t(cards.length === 1 ? "fc.dueOne" : "fc.dueMany").replace(
                    "{count}",
                    String(cards.length),
                  )
                : t("fc.reviewComeBack")
              : t("fc.reviewPastDue")}
          </p>
        </div>

        {isLoading && <Skeleton className="h-[380px] w-full rounded-3xl" />}

        {data && cards.length === 0 && (
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
            {workspaceId && (
              <Link href={`/workspace/${workspaceId}/study`}>
                <TrackedButton
                  ctaId="review_empty_start_session"
                  ctaPosition="primary"
                  size="sm"
                  className="mt-4"
                >
                  {t("retention.startQuickSession")}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </TrackedButton>
              </Link>
            )}
          </div>
        )}

        {data && cards.length > 0 && (
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
