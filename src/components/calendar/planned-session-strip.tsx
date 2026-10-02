"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, GraduationCap } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { ctaProps } from "@/lib/analytics";
import { nextPlannedSession, plannedSessionLink, useImportedCalendar } from "@/lib/calendar/store";
import { formatReminderWhen } from "@/lib/review-reminders";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";
import "@/lib/i18n/retention";
import { fill } from "./calendar-ui";

/**
 * Home: "Time to study" when an accepted calendar-planned session is due,
 * else a quiet line for the next one — or an invite to import a calendar.
 */
export function PlannedSessionStrip() {
  const { t, locale } = useI18n();
  const { user } = useAuthUser();
  const { calendar } = useImportedCalendar(user?.id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const next = calendar ? nextPlannedSession(calendar.accepted, now) : undefined;

  if (!user) return null;

  if (!calendar) {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground animate-fade-up">
        <CalendarDays className="h-3.5 w-3.5 text-accent" />
        {t("cal.strip.cta")}
        <Link
          href="/calendar"
          {...ctaProps("home_calendar_import", "tertiary")}
          className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline"
        >
          {t("cal.strip.ctaLink")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
    );
  }

  if (!next) return null;
  const { session, isNow } = next;
  const what = fill(t("cal.strip.forTarget"), {
    focus: t(`cal.focus.${session.focus}`),
    target: session.targetTitle,
  });

  if (!isNow) {
    return (
      <Link
        href="/calendar"
        {...ctaProps("home_next_planned_session", "tertiary")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-up hover:text-foreground"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">
          {fill(t("cal.strip.next"), { when: formatReminderWhen(session.start, locale, t) })}
          {" · "}
          {what}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={plannedSessionLink(session, "home_strip")}
      {...ctaProps("home_planned_session_start", "primary", "Start")}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 transition-colors animate-fade-up hover:border-accent/60 sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-accent">
          <GraduationCap className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("cal.strip.now")}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {what} · {fill(t("cal.session.minutes"), { minutes: session.minutes })}
          </p>
        </div>
      </div>
      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground">
        {t("cal.strip.start")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
