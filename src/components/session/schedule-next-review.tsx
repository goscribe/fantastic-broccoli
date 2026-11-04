"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Check, Download, ArrowRight } from "lucide-react";
import { TrackedButton } from "@/components/ui/tracked-button";
import { screenProps, track, useTrackOnce } from "@/lib/analytics";
import {
  addReminderChannel,
  defaultReminderTime,
  downloadIcs,
  formatReminderWhen,
  googleCalendarUrl,
  newReminderId,
  reviewSetFromActivities,
  saveReminder,
  toDateTimeLocalValue,
  updateReminder,
  useReviewReminders,
  type ReminderChannel,
  type ReviewReminder,
} from "@/lib/review-reminders";
import { syncReminderToServer } from "@/lib/api/reminders";
import type { SessionActivity } from "@/types";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/retention";

/**
 * Session-end "schedule next": the debrief's primary CTA books tomorrow's
 * review instead of ending on a bare Done.
 */
export function ScheduleNextReview({
  workspaceId,
  workspaceTitle,
  sessionId,
  activities,
  quickStart,
  isFirstSession,
}: {
  workspaceId: string;
  workspaceTitle: string;
  sessionId: string;
  activities: SessionActivity[];
  quickStart: boolean;
  isFirstSession: boolean;
}) {
  const { t, locale } = useI18n();
  const reminders = useReviewReminders();
  const scheduled = reminders.find(
    (r) => r.sessionId === sessionId && !r.openedAt,
  );
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [defaultValue] = useState(() =>
    toDateTimeLocalValue(defaultReminderTime()),
  );
  const [timeValue, setTimeValue] = useState(defaultValue);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const set = useMemo(() => reviewSetFromActivities(activities), [activities]);
  const baseProps = {
    session_id: sessionId,
    workspace_id: workspaceId,
    due_count: set.dueCount,
    est_minutes: set.estMinutes,
    is_first_session: isFirstSession,
    quick_start: quickStart,
  };

  useTrackOnce(
    "reminder_offer_shown",
    { ...baseProps, default_hours: 24 },
    !scheduled,
  );

  const chosen = new Date(timeValue);
  const validTime =
    !Number.isNaN(chosen.getTime()) && chosen.getTime() > now + 60_000;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const choseTomorrow = chosen.toDateString() === tomorrow.toDateString();

  const optIn = (reminder: ReviewReminder, channel: ReminderChannel) => {
    if (channel !== "in_app") addReminderChannel(reminder.id, channel);
    track("reminder_opt_in", {
      ...baseProps,
      reminder_id: reminder.id,
      channel,
    });
  };

  const schedule = () => {
    if (!validTime) return;
    const scheduledAt = chosen.toISOString();
    const rescheduled = !!scheduled;
    const reminder: ReviewReminder = scheduled
      ? { ...scheduled, scheduledAt }
      : {
          id: newReminderId(),
          workspaceId,
          workspaceTitle,
          sessionId,
          scheduledAt,
          createdAt: new Date().toISOString(),
          dueCount: set.dueCount,
          estMinutes: set.estMinutes,
          channels: ["in_app"],
        };
    if (scheduled) updateReminder(scheduled.id, { scheduledAt });
    else saveReminder(reminder);
    syncReminderToServer(reminder).catch(() => {});
    track("next_session_scheduled", {
      ...baseProps,
      reminder_id: reminder.id,
      scheduled_at: scheduledAt,
      hours_from_now:
        Math.round(((chosen.getTime() - new Date().getTime()) / 3_600_000) * 10) / 10,
      time_edited: timeValue !== defaultValue,
      rescheduled,
    });
    if (!rescheduled) optIn(reminder, "in_app");
    setEditing(false);
  };

  if (dismissed && !scheduled) return null;

  const body =
    set.dueCount === 0
      ? t("retention.scheduleBodyShort")
      : t(
          set.dueCount === 1
            ? "retention.scheduleBodyOne"
            : "retention.scheduleBodyMany",
        ).replace("{count}", String(set.dueCount));

  return (
    <div
      {...screenProps("schedule_next_review")}
      className="mt-8 rounded-xl border border-accent/25 bg-accent-soft p-4"
    >
      {scheduled && !editing ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Check className="h-4 w-4 text-accent" />
            {t("retention.scheduledTitle").replace(
              "{when}",
              formatReminderWhen(scheduled.scheduledAt, locale, t),
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-6">
            {t("retention.scheduledBody")}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <TrackedButton
              ctaId="debrief_add_google_calendar"
              ctaPosition="secondary"
              size="sm"
              variant="outline"
              onClick={() => {
                window.open(
                  googleCalendarUrl(scheduled, window.location.origin),
                  "_blank",
                  "noopener",
                );
                optIn(scheduled, "google_calendar");
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              {t("retention.addGoogle")}
            </TrackedButton>
            <TrackedButton
              ctaId="debrief_download_ics"
              ctaPosition="secondary"
              size="sm"
              variant="outline"
              onClick={() => {
                downloadIcs(scheduled, window.location.origin);
                optIn(scheduled, "ics");
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("retention.downloadIcs")}
            </TrackedButton>
            <TrackedButton
              ctaId="debrief_change_review_time"
              ctaPosition="tertiary"
              size="sm"
              variant="ghost"
              onClick={() => {
                setTimeValue(toDateTimeLocalValue(new Date(scheduled.scheduledAt)));
                setEditing(true);
              }}
            >
              {t("retention.changeTime")}
            </TrackedButton>
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-accent" />
            {t(quickStart ? "retention.quick5Title" : "retention.scheduleTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground leading-6">
            {body.replace("{minutes}", String(set.estMinutes))}
          </p>
          <label className="mt-3 block max-w-xs">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {t("retention.reviewTime")}
            </span>
            <input
              type="datetime-local"
              value={timeValue}
              min={toDateTimeLocalValue(new Date(now))}
              onChange={(e) => setTimeValue(e.target.value)}
              className="mt-1 block h-9 w-full rounded-xl border border-border bg-card px-3 text-sm focus:outline-none focus:border-accent/50"
            />
          </label>
          {!validTime && (
            <p className="mt-1.5 text-xs text-rose">
              {t("retention.pickFutureTime")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <TrackedButton
              ctaId={editing ? "debrief_save_review_time" : "debrief_schedule_review"}
              ctaPosition="primary"
              size="sm"
              disabled={!validTime}
              onClick={schedule}
            >
              {editing
                ? t("retention.save")
                : t(choseTomorrow ? "retention.scheduleTomorrow" : "retention.schedule")}
              {!editing && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
            </TrackedButton>
            <TrackedButton
              ctaId={editing ? "debrief_cancel_review_time" : "debrief_schedule_not_now"}
              ctaPosition="tertiary"
              size="sm"
              variant="ghost"
              onClick={() => (editing ? setEditing(false) : setDismissed(true))}
            >
              {t(editing ? "retention.cancel" : "retention.notNow")}
            </TrackedButton>
          </div>
        </>
      )}
    </div>
  );
}
