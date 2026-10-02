"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, CheckCircle2, Download, Pencil } from "lucide-react";
import { TrackedButton } from "@/components/ui/tracked-button";
import { ctaProps, screenProps } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";
import { startOfLocalDay } from "@/lib/calendar/ics";
import { plannedSessionLink, type AcceptedSession } from "@/lib/calendar/store";
import { fill, formatDayLabel, formatTime } from "./calendar-ui";

export function AcceptedPlan({
  sessions,
  workspaces,
  now,
  scrollIntoView = false,
  onEdit,
  onDownloadIcs,
  onGoogle,
  onWorkspace,
}: {
  sessions: AcceptedSession[];
  workspaces: { id: string; title: string }[];
  now: Date;
  /** Bring the confirmation into view (right after accepting). */
  scrollIntoView?: boolean;
  onEdit: () => void;
  onDownloadIcs: () => void;
  onGoogle: (session: AcceptedSession) => void;
  onWorkspace: (session: AcceptedSession, workspaceId: string) => void;
}) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (scrollIntoView) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [scrollIntoView]);
  const nowMs = now.getTime();
  const upcoming = sessions
    .filter((s) => Date.parse(s.end) + 60 * 60_000 > nowMs)
    .sort((a, b) => a.start.localeCompare(b.start));
  const groups = new Map<number, AcceptedSession[]>();
  for (const s of upcoming) {
    const key = startOfLocalDay(new Date(s.start)).getTime();
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  const wsTitle = (id?: string) => workspaces.find((w) => w.id === id)?.title;

  return (
    <section
      ref={ref}
      {...screenProps("study_plan_accepted")}
      className="scroll-mt-4 rounded-2xl border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {t("cal.accepted.title")}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("cal.accepted.body")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <TrackedButton
            ctaId="calendar_plan_download_ics"
            ctaPosition="secondary"
            size="sm"
            variant="outline"
            onClick={onDownloadIcs}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("cal.accepted.ics")}
          </TrackedButton>
          <TrackedButton
            ctaId="calendar_plan_edit"
            ctaPosition="tertiary"
            size="sm"
            variant="ghost"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t("cal.accepted.edit")}
          </TrackedButton>
        </div>
      </div>
      <ol className="divide-y divide-border">
        {[...groups.entries()].map(([dayMs, list]) => (
          <li key={dayMs} className="px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold text-faint">
              {formatDayLabel(new Date(dayMs), locale, t, now)}
            </p>
            <ul className="mt-2 space-y-2">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="w-16 shrink-0 text-xs tabular-nums text-accent">
                    {formatTime(s.start, locale)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {t(`cal.focus.${s.focus}`)} ·{" "}
                      <span className="font-medium">{s.targetTitle}</span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {fill(t("cal.session.minutes"), { minutes: s.minutes })}
                      {wsTitle(s.workspaceId) ? ` · ${wsTitle(s.workspaceId)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("cal.accepted.google")}
                      title={t("cal.accepted.google")}
                      {...ctaProps("calendar_session_add_google", "tertiary", "Add to Google Calendar")}
                      onClick={() => onGoogle(s)}
                      className="rounded-md p-1.5 text-faint hover:bg-muted hover:text-foreground"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </button>
                    {s.openedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-muted-foreground">
                        <Check className="h-3.5 w-3.5" />
                        {t("cal.accepted.started")}
                      </span>
                    ) : s.workspaceId ? (
                      <Link
                        href={plannedSessionLink(s, "calendar_plan")}
                        {...ctaProps("calendar_session_start", "primary", "Start")}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-foreground hover:bg-accent-dim"
                      >
                        {t("cal.accepted.start")}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <select
                        aria-label={t("cal.accepted.pickWorkspace")}
                        value=""
                        onChange={(e) => onWorkspace(s, e.target.value)}
                        className="h-8 max-w-44 rounded-lg border border-amber-300 bg-card px-2 text-xs dark:border-amber-500/50"
                      >
                        <option value="">{t("cal.accepted.pickWorkspace")}</option>
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
