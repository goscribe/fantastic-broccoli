"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, RotateCcw } from "lucide-react";
import type { DueReviewCard } from "@/lib/api/study-session";
import { ctaProps, useTrackOnce } from "@/lib/analytics";
import {
  dueReminder,
  estimateReviewMinutes,
  formatReminderWhen,
  reviewDeepLink,
  upcomingReminder,
  useReviewReminders,
} from "@/lib/review-reminders";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/retention";

/**
 * Home "Your review is ready" strip: shown when a scheduled review reminder
 * is due or any SRS cards are due. Otherwise a quiet line for the next
 * scheduled review, if there is one.
 */
export function ReviewReadyStrip({
  dueReview,
}: {
  dueReview?: { total: number; cards: DueReviewCard[] };
}) {
  const { t, locale } = useI18n();
  const reminders = useReviewReminders();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const ready = dueReminder(reminders, now);
  const upcoming = upcomingReminder(reminders, now);
  const workspaceDue = ready
    ? (dueReview?.cards ?? []).filter((c) => c.workspaceId === ready.workspaceId)
        .length
    : 0;
  const count = ready ? workspaceDue || ready.dueCount : (dueReview?.total ?? 0);
  const show = !!ready || count > 0;
  const minutes = estimateReviewMinutes(count);

  useTrackOnce(
    "review_ready_shown",
    {
      reminder_id: ready?.id,
      workspace_id: ready?.workspaceId,
      due_count: count,
      from_reminder: !!ready,
    },
    show,
  );

  if (!show) {
    if (!upcoming) return null;
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up">
        <CalendarClock className="h-3.5 w-3.5 text-accent" />
        {t("retention.nextReview").replace(
          "{when}",
          formatReminderWhen(upcoming.scheduledAt, locale, t),
        )}
        {" · "}
        {upcoming.workspaceTitle}
      </p>
    );
  }

  const detail =
    count === 0
      ? t("retention.aboutMinutes")
      : t(count === 1 ? "retention.cardAbout" : "retention.cardsAbout").replace(
          "{count}",
          String(count),
        );

  return (
    <Link
      href={
        ready ? reviewDeepLink(ready, "home_strip") : "/flashcards/review?src=home_strip"
      }
      {...ctaProps("home_review_start", "primary", "Start")}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 transition-colors animate-fade-up hover:border-accent/60 sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-accent">
          <RotateCcw className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("retention.reviewReady")}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {ready ? `${ready.workspaceTitle} · ` : ""}
            {detail.replace("{minutes}", String(minutes))}
          </p>
        </div>
      </div>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground">
        {t("retention.start")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
