"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Clock, Pencil, Undo2, X } from "lucide-react";
import { TrackedButton } from "@/components/ui/tracked-button";
import { cn } from "@/lib/utils";
import { screenProps, track, useTrackOnce } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";
import type { CalendarEvent } from "@/lib/calendar/ics";
import {
  conflictFor,
  type PlanPrefs,
  type PlannedSession,
  type StudyPlan,
  type StudyWindow,
} from "@/lib/calendar/planner";
import { toDateTimeLocalValue } from "@/lib/review-reminders";
import {
  KindBadge,
  daysBeforeLabel,
  fill,
  formatSessionWhen,
  formatShortDate,
  formatTime,
  relativeDays,
} from "./calendar-ui";

const WINDOWS: StudyWindow[] = ["after_school", "daytime", "evening"];
const LENGTHS: PlanPrefs["sessionMinutes"][] = [30, 45, 60];
const PER_DAY: PlanPrefs["maxPerDay"][] = [1, 2, 3];

function Segmented<V extends string | number>({
  value,
  options,
  label,
  onChange,
}: {
  value: V;
  options: { value: V; label: string; hint?: string }[];
  label: string;
  onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-left text-xs",
            value === o.value
              ? "border-accent bg-accent-soft font-semibold text-accent"
              : "border-border text-muted-foreground hover:border-accent/40",
          )}
        >
          {o.label}
          {o.hint && (
            <span className="block text-[10px] font-normal text-muted-foreground">{o.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function SessionRow({
  session,
  events,
  onMove,
  onRemove,
}: {
  session: PlannedSession;
  events: CalendarEvent[];
  onMove: (iso: string) => void;
  onRemove: () => void;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const conflict = conflictFor(session, events);
  const valid = value !== "" && !Number.isNaN(new Date(value).getTime());

  return (
    <li className="rounded-xl border border-border px-3 py-2">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs focus:border-accent/50 focus:outline-none"
          />
          <TrackedButton
            ctaId="calendar_session_time_save"
            size="sm"
            disabled={!valid}
            onClick={() => {
              onMove(new Date(value).toISOString());
              setEditing(false);
            }}
          >
            {t("cal.session.save")}
          </TrackedButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("cal.session.cancel")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              {formatSessionWhen(session.start, locale)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {t(`cal.focus.${session.focus}`)} ·{" "}
              {fill(t("cal.session.minutes"), { minutes: session.minutes })} ·{" "}
              {daysBeforeLabel(session.daysBefore, t)}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("cal.session.changeTime")}
            title={t("cal.session.changeTime")}
            data-cta-id="calendar_session_change_time"
            onClick={() => {
              setValue(toDateTimeLocalValue(new Date(session.start)));
              setEditing(true);
            }}
            className="rounded-md p-1.5 text-faint hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={t("cal.session.remove")}
            title={t("cal.session.remove")}
            data-cta-id="calendar_session_remove"
            onClick={onRemove}
            className="rounded-md p-1.5 text-faint hover:bg-muted hover:text-rose"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {conflict && !editing && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          {fill(t("cal.session.conflict"), { title: conflict.title })} ·{" "}
          {formatTime(conflict.start, locale)}
        </p>
      )}
    </li>
  );
}

export function StudyPlanPanel({
  plan,
  sessions,
  prefs,
  events,
  workspaces,
  workspaceFor,
  hasEdits,
  editingAccepted,
  now,
  onPrefs,
  onToggleTarget,
  onWorkspace,
  onMove,
  onRemove,
  onResetEdits,
  onAccept,
  onCancelEdit,
}: {
  plan: StudyPlan;
  /** Suggested sessions after the learner's edits. */
  sessions: PlannedSession[];
  prefs: PlanPrefs;
  events: CalendarEvent[];
  workspaces: { id: string; title: string }[];
  workspaceFor: (targetId: string, subject: string) => string;
  hasEdits: boolean;
  editingAccepted: boolean;
  now: Date;
  onPrefs: (prefs: PlanPrefs) => void;
  onToggleTarget: (targetId: string, include: boolean) => void;
  onWorkspace: (targetId: string, workspaceId: string) => void;
  onMove: (sessionId: string, iso: string) => void;
  onRemove: (sessionId: string) => void;
  onResetEdits: () => void;
  onAccept: () => void;
  onCancelEdit: () => void;
}) {
  const { t, locale } = useI18n();
  const byTarget = new Map<string, PlannedSession[]>();
  for (const s of sessions) {
    const list = byTarget.get(s.targetId);
    if (list) list.push(s);
    else byTarget.set(s.targetId, [s]);
  }
  const planned = plan.targets.filter((tg) => !tg.excluded);

  useTrackOnce("study_plan_shown", {
    session_count: sessions.length,
    target_count: planned.length,
    exam_count: planned.filter((tg) => tg.kind === "exam").length,
    deadline_count: planned.filter((tg) => tg.kind === "deadline").length,
    partial_count: planned.filter((tg) => !tg.tooSoon && tg.sessions.length < tg.wanted).length,
    too_soon_count: planned.filter((tg) => tg.tooSoon).length,
    study_window: prefs.window,
    session_minutes: prefs.sessionMinutes,
    max_per_day: prefs.maxPerDay,
    weekends: prefs.weekends,
    editing_accepted: editingAccepted,
  });

  // One study_session_planned per suggestion, the first time it's shown.
  const reported = useRef(new Set<string>());
  useEffect(() => {
    for (const s of plan.sessions) {
      if (reported.current.has(s.id)) continue;
      reported.current.add(s.id);
      track("study_session_planned", {
        session_id: s.id,
        target_kind: s.targetKind,
        focus: s.focus,
        minutes: s.minutes,
        days_before: s.daysBefore,
        study_window: prefs.window,
      });
    }
  }, [plan.sessions, prefs.window]);

  const acceptLabel = editingAccepted
    ? fill(t("cal.plan.update"), { count: sessions.length })
    : sessions.length === 1
      ? t("cal.plan.acceptOne")
      : fill(t("cal.plan.accept"), { count: sessions.length });

  return (
    <section {...screenProps("study_plan")} className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold">{t("cal.plan.title")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("cal.plan.subtitle")}</p>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
            {t("cal.prefs.when")}
          </p>
          <Segmented
            label={t("cal.prefs.when")}
            value={prefs.window}
            options={WINDOWS.map((w) => ({
              value: w,
              label: t(`cal.prefs.${w}`),
              hint: t(`cal.prefs.${w}Hint`),
            }))}
            onChange={(studyWindow) => onPrefs({ ...prefs, window: studyWindow })}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
              {t("cal.prefs.length")}
            </p>
            <Segmented
              label={t("cal.prefs.length")}
              value={prefs.sessionMinutes}
              options={LENGTHS.map((m) => ({
                value: m,
                label: fill(t("cal.session.minutes"), { minutes: m }),
              }))}
              onChange={(sessionMinutes) => onPrefs({ ...prefs, sessionMinutes })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
              {t("cal.prefs.perDay")}
            </p>
            <Segmented
              label={t("cal.prefs.perDay")}
              value={prefs.maxPerDay}
              options={PER_DAY.map((n) => ({ value: n, label: String(n) }))}
              onChange={(maxPerDay) => onPrefs({ ...prefs, maxPerDay })}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-1.5 text-xs font-medium">
            <input
              type="checkbox"
              checked={prefs.weekends}
              onChange={(e) => onPrefs({ ...prefs, weekends: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t("cal.prefs.weekends")}
          </label>
        </div>
      </div>

      {plan.targets.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm leading-6 text-muted-foreground">
          {t("cal.plan.empty")}
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {plan.targets.map((target) => {
            const list = byTarget.get(target.event.id) ?? [];
            const subject = target.sessions[0]?.subject ?? target.event.title;
            const ws = workspaceFor(target.event.id, subject);
            return (
              <li key={target.event.id} className="px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindBadge kind={target.kind} t={t} />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {formatShortDate(target.event.start, locale)}
                        {!target.event.allDay && ` · ${formatTime(target.event.start, locale)}`}
                        {" · "}
                        {relativeDays(target.event.start, t, now)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 truncate text-sm font-semibold",
                        target.excluded && "text-muted-foreground line-through",
                      )}
                    >
                      {target.event.title}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!target.excluded}
                      onChange={(e) => onToggleTarget(target.event.id, e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--accent)]"
                    />
                    {t("cal.target.include")}
                  </label>
                </div>

                {target.excluded ? (
                  <p className="mt-2 text-xs text-muted-foreground">{t("cal.target.skipped")}</p>
                ) : target.tooSoon ? (
                  <p className="mt-2 text-xs text-muted-foreground">{t("cal.target.tooSoon")}</p>
                ) : (
                  <>
                    <label className="mt-2.5 flex items-center gap-2 text-xs">
                      <span className="shrink-0 font-medium text-muted-foreground">
                        {t("cal.target.studyIn")}
                      </span>
                      <select
                        value={ws}
                        onChange={(e) => onWorkspace(target.event.id, e.target.value)}
                        className={cn(
                          "h-8 min-w-0 flex-1 rounded-lg border bg-card px-2 text-xs focus:border-accent/50 focus:outline-none sm:max-w-64",
                          ws ? "border-border" : "border-amber-300 dark:border-amber-500/50",
                        )}
                      >
                        <option value="">{t("cal.target.noWorkspace")}</option>
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {list.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {list.map((s) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            events={events}
                            onMove={(iso) => onMove(s.id, iso)}
                            onRemove={() => onRemove(s.id)}
                          />
                        ))}
                      </ul>
                    )}
                    {target.sessions.length < target.wanted && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
                        <Clock className="mt-px h-3 w-3 shrink-0" />
                        {fill(t("cal.target.partial"), {
                          got: target.sessions.length,
                          wanted: target.wanted,
                        })}
                      </p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-b-2xl border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5">
        <TrackedButton
          ctaId={editingAccepted ? "calendar_plan_update" : "calendar_plan_accept"}
          ctaPosition="primary"
          disabled={sessions.length === 0}
          onClick={onAccept}
          className="gap-1.5"
        >
          {acceptLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </TrackedButton>
        <span className="text-[11px] text-muted-foreground">{t("cal.plan.acceptHint")}</span>
        <div className="ml-auto flex gap-1">
          {hasEdits && (
            <TrackedButton
              ctaId="calendar_plan_reset_edits"
              ctaPosition="tertiary"
              size="sm"
              variant="ghost"
              onClick={onResetEdits}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              {t("cal.plan.reset")}
            </TrackedButton>
          )}
          {editingAccepted && (
            <TrackedButton
              ctaId="calendar_plan_cancel_edit"
              ctaPosition="tertiary"
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
            >
              {t("cal.plan.cancelEdit")}
            </TrackedButton>
          )}
        </div>
      </div>
    </section>
  );
}
