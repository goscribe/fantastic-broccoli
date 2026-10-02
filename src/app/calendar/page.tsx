"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, RefreshCw, Trash2 } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import type { Folder, Workspace } from "@/types";
import { TrackedButton } from "@/components/ui/tracked-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarImport } from "@/components/calendar/calendar-import";
import { CalendarTimeline, type TimelineSession } from "@/components/calendar/calendar-timeline";
import { StudyPlanPanel } from "@/components/calendar/study-plan-panel";
import { AcceptedPlan } from "@/components/calendar/accepted-plan";
import { fill, formatSessionWhen } from "@/components/calendar/calendar-ui";
import { errorMessage, track } from "@/lib/analytics";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";
import {
  CalendarParseError,
  parseIcs,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/calendar/ics";
import { readCalendarFiles } from "@/lib/calendar/read-files";
import { sampleCalendarIcs } from "@/lib/calendar/sample";
import {
  DEFAULT_PLAN_PREFS,
  applyPlanEdits,
  buildStudyPlan,
  matchWorkspace,
  type PlanPrefs,
} from "@/lib/calendar/planner";
import {
  clearImportedCalendar,
  saveImportedCalendar,
  useImportedCalendar,
  type AcceptedSession,
  type CalendarImportMethod,
} from "@/lib/calendar/store";
import {
  downloadTextFile,
  sessionGoogleCalendarUrl,
  studyPlanIcs,
} from "@/lib/calendar/export";

const HORIZON_DAYS = 56;
const ERROR_KEYS = new Set(["not_ics", "empty", "too_large", "unzip_unsupported"]);

function flattenWorkspaces(folders: Folder[], root: Workspace[]): { id: string; title: string }[] {
  const all: Workspace[] = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all.map((w) => ({ id: w.id, title: w.title }));
}

function kindCounts(events: CalendarEvent[], kindOf: (e: CalendarEvent) => CalendarEventKind) {
  // Exams/deadlines count each occurrence; classes count each weekly series.
  const counts = { exam: 0, deadline: 0, class: 0, other: 0 };
  const series = { class: new Set<string>(), other: new Set<string>() };
  for (const e of events) {
    const k = kindOf(e);
    if (k === "exam" || k === "deadline") counts[k]++;
    else series[k].add(e.seriesId);
  }
  counts.class = series.class.size;
  counts.other = series.other.size;
  return counts;
}

class NoUpcomingEvents extends Error {
  constructor(public total: number) {
    super("no_upcoming");
  }
}

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const { user } = useAuthUser();
  const userId = user?.id;
  const { calendar, update } = useImportedCalendar(userId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const [editingAccepted, setEditingAccepted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["calendar-workspaces"],
    queryFn: async () => {
      const tree = await fetchWorkspaceTree();
      return flattenWorkspaces(tree.folders, tree.rootWorkspaces);
    },
    staleTime: 60_000,
  });

  const kindOf = useCallback(
    (e: CalendarEvent) => calendar?.kindOverrides[e.seriesId] ?? e.inferredKind,
    [calendar?.kindOverrides],
  );

  const plan = useMemo(
    () =>
      calendar
        ? buildStudyPlan({
            events: calendar.events,
            kindOf,
            excluded: new Set(calendar.excludedTargets),
            prefs: calendar.prefs,
            now,
          })
        : { targets: [], sessions: [] },
    [calendar, kindOf, now],
  );

  const proposed = useMemo(
    () => (calendar ? applyPlanEdits(plan.sessions, calendar.edits) : []),
    [plan.sessions, calendar],
  );

  const workspaceFor = useCallback(
    (targetId: string, subject: string) =>
      calendar?.workspaceByTarget[targetId] ?? matchWorkspace(subject, workspaces)?.id ?? "",
    [calendar?.workspaceByTarget, workspaces],
  );

  const showProposal = !!calendar && (calendar.accepted.length === 0 || editingAccepted);

  const timelineSessions: TimelineSession[] = useMemo(() => {
    if (!calendar) return [];
    return showProposal
      ? proposed.map((session) => ({ session, state: "suggested" as const }))
      : calendar.accepted.map((session) => ({ session, state: "planned" as const }));
  }, [calendar, proposed, showProposal]);

  const runImport = async (
    method: CalendarImportMethod,
    read: () => Promise<string[]>,
    meta: { fileCount: number; sizeKb?: number },
  ) => {
    if (!userId) return;
    const startedAt = performance.now();
    const replacing = !!calendar;
    setBusy(true);
    setError(null);
    track("calendar_import_started", {
      method,
      file_count: meta.fileCount,
      file_size_kb: meta.sizeKb,
      replacing,
    });
    try {
      const texts = await read();
      const parsed = parseIcs(texts, { horizonDays: HORIZON_DAYS });
      if (parsed.events.length === 0) throw new NoUpcomingEvents(parsed.totalInFile);
      const counts = kindCounts(parsed.events, (e) => e.inferredKind);
      track("calendar_events_parsed", {
        method,
        count: parsed.events.length,
        events_in_file: parsed.totalInFile,
        calendar_count: texts.length,
        exam_count: counts.exam,
        deadline_count: counts.deadline,
        class_series_count: counts.class,
        other_series_count: counts.other,
        recurring_count: parsed.events.filter((e) => e.recurring).length,
        all_day_count: parsed.events.filter((e) => e.allDay).length,
        horizon_days: HORIZON_DAYS,
      });
      saveImportedCalendar(userId, {
        version: 1,
        importedAt: new Date().toISOString(),
        method,
        fileCount: texts.length,
        calendarNames: parsed.calendarNames,
        horizonDays: HORIZON_DAYS,
        events: parsed.events,
        kindOverrides: {},
        excludedTargets: [],
        prefs: calendar?.prefs ?? DEFAULT_PLAN_PREFS,
        edits: { removed: [], starts: {} },
        workspaceByTarget: {},
        accepted: calendar?.accepted ?? [],
      });
      track("calendar_import_completed", {
        method,
        events_parsed: parsed.events.length,
        exam_count: counts.exam,
        deadline_count: counts.deadline,
        duration_ms: Math.round(performance.now() - startedAt),
        replacing,
      });
      toast.success(fill(t("cal.toast.imported"), { count: parsed.events.length }));
      setReimporting(false);
      setEditingAccepted(false);
    } catch (err) {
      const reason =
        err instanceof NoUpcomingEvents
          ? "no_upcoming"
          : err instanceof CalendarParseError
            ? ERROR_KEYS.has(err.message)
              ? err.message
              : err.reason
            : "generic";
      track("calendar_import_failed", {
        method,
        reason,
        error: err instanceof CalendarParseError || err instanceof NoUpcomingEvents ? undefined : errorMessage(err),
        duration_ms: Math.round(performance.now() - startedAt),
      });
      const key = ERROR_KEYS.has(reason) || reason === "no_upcoming" ? reason : "generic";
      setError(
        fill(t(`cal.err.${key}`), {
          total: err instanceof NoUpcomingEvents ? err.total : 0,
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const importFiles = (files: File[]) =>
    runImport("ics_file", () => readCalendarFiles(files), {
      fileCount: files.length,
      sizeKb: Math.round(files.reduce((s, f) => s + f.size, 0) / 1024),
    });

  const importSample = () =>
    runImport("sample", async () => [sampleCalendarIcs()], { fileCount: 1 });

  const changeKind = (event: CalendarEvent, kind: CalendarEventKind) => {
    track("calendar_event_kind_changed", {
      from: kindOf(event),
      to: kind,
      inferred: event.inferredKind,
      recurring: event.recurring,
    });
    update((c) => ({ ...c, kindOverrides: { ...c.kindOverrides, [event.seriesId]: kind } }));
  };

  const setPrefs = (prefs: PlanPrefs) =>
    update((c) => ({ ...c, prefs, edits: { removed: [], starts: {} } }));

  const accept = () => {
    if (!calendar) return;
    const acceptedAt = new Date().toISOString();
    const fresh: AcceptedSession[] = proposed.map((s) => ({
      ...s,
      workspaceId: workspaceFor(s.targetId, s.subject) || undefined,
      acceptedAt,
      edited: !!calendar.edits.starts[s.id],
    }));
    for (const s of fresh) {
      track("study_session_accepted", {
        session_id: s.id,
        target_kind: s.targetKind,
        focus: s.focus,
        minutes: s.minutes,
        days_before: s.daysBefore,
        edited: s.edited,
        has_workspace: !!s.workspaceId,
        accepted_count: fresh.length,
        plan_update: editingAccepted,
      });
    }
    update((c) => {
      const started = c.accepted.filter((a) => a.openedAt);
      const startedIds = new Set(started.map((a) => a.id));
      return { ...c, accepted: [...started, ...fresh.filter((f) => !startedIds.has(f.id))] };
    });
    toast.success(fill(t("cal.toast.accepted"), { count: fresh.length }));
    setEditingAccepted(false);
  };

  const exportText = (s: AcceptedSession) => ({
    summary: fill(t("cal.export.summary"), {
      focus: t(`cal.focus.${s.focus}`),
      target: s.targetTitle,
    }),
    description: fill(t("cal.export.description"), {
      minutes: s.minutes,
      target: s.targetTitle,
      hint: t(`cal.focusHint.${s.focus}`),
    }),
  });

  const removeCalendar = () => {
    if (!userId || !window.confirm(t("cal.header.removeConfirm"))) return;
    clearImportedCalendar(userId);
    setReimporting(false);
    setEditingAccepted(false);
    setError(null);
  };

  const counts = calendar ? kindCounts(calendar.events, kindOf) : null;
  const countLabel = (kind: "exam" | "deadline" | "class", n: number) =>
    n === 1 ? t(`cal.count.${kind}One`) : fill(t(`cal.count.${kind}`), { count: n });

  return (
    <main className="w-full flex-1 space-y-6 px-4 py-5 sm:px-8 sm:py-8">
      <header className="animate-fade-up">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <CalendarDays className="h-6 w-6 text-accent" />
          {t("cal.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("cal.subtitle")}</p>
      </header>

      {!userId ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : !calendar ? (
        <CalendarImport busy={busy} error={error} onFiles={importFiles} onSample={importSample} />
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3 animate-fade-up sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {calendar.method === "sample"
                  ? t("cal.header.sample")
                  : calendar.calendarNames.join(", ") || t("cal.import.title")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {fill(t("cal.header.imported"), {
                  when: formatSessionWhen(calendar.importedAt, locale),
                })}
              </p>
            </div>
            {counts && (
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  {countLabel("exam", counts.exam)}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {countLabel("deadline", counts.deadline)}
                </span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
                  {countLabel("class", counts.class)}
                </span>
              </div>
            )}
            <div className="ml-auto flex gap-1">
              <TrackedButton
                ctaId="calendar_reimport"
                ctaPosition="tertiary"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setReimporting((v) => !v);
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("cal.header.replace")}
              </TrackedButton>
              <TrackedButton
                ctaId="calendar_remove"
                ctaPosition="tertiary"
                size="sm"
                variant="ghost"
                onClick={removeCalendar}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("cal.header.remove")}
              </TrackedButton>
            </div>
          </section>

          {reimporting && (
            <CalendarImport
              compact
              busy={busy}
              error={error}
              onFiles={importFiles}
              onSample={importSample}
            />
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <CalendarTimeline
              events={calendar.events}
              kindOf={kindOf}
              sessions={timelineSessions}
              onChangeKind={changeKind}
              now={now}
            />
            {showProposal ? (
              <StudyPlanPanel
                plan={plan}
                sessions={proposed}
                prefs={calendar.prefs}
                events={calendar.events}
                workspaces={workspaces}
                workspaceFor={workspaceFor}
                hasEdits={calendar.edits.removed.length > 0 || Object.keys(calendar.edits.starts).length > 0}
                editingAccepted={editingAccepted}
                now={now}
                onPrefs={setPrefs}
                onToggleTarget={(targetId, include) =>
                  update((c) => ({
                    ...c,
                    excludedTargets: include
                      ? c.excludedTargets.filter((id) => id !== targetId)
                      : [...c.excludedTargets, targetId],
                  }))
                }
                onWorkspace={(targetId, workspaceId) =>
                  update((c) => ({
                    ...c,
                    workspaceByTarget: { ...c.workspaceByTarget, [targetId]: workspaceId },
                  }))
                }
                onMove={(sessionId, iso) =>
                  update((c) => ({
                    ...c,
                    edits: { ...c.edits, starts: { ...c.edits.starts, [sessionId]: iso } },
                  }))
                }
                onRemove={(sessionId) =>
                  update((c) => ({
                    ...c,
                    edits: { ...c.edits, removed: [...c.edits.removed, sessionId] },
                  }))
                }
                onResetEdits={() => update((c) => ({ ...c, edits: { removed: [], starts: {} } }))}
                onAccept={accept}
                onCancelEdit={() => setEditingAccepted(false)}
              />
            ) : (
              <AcceptedPlan
                sessions={calendar.accepted}
                workspaces={workspaces}
                now={now}
                onEdit={() => setEditingAccepted(true)}
                onDownloadIcs={() => {
                  const upcoming = calendar.accepted.filter(
                    (s) => Date.parse(s.end) > now.getTime(),
                  );
                  downloadTextFile(
                    "scribe-study-plan.ics",
                    studyPlanIcs(upcoming, exportText, window.location.origin),
                  );
                }}
                onGoogle={(s) =>
                  window.open(
                    sessionGoogleCalendarUrl(s, exportText(s), window.location.origin),
                    "_blank",
                    "noopener",
                  )
                }
                onWorkspace={(s, workspaceId) =>
                  update((c) => ({
                    ...c,
                    accepted: c.accepted.map((a) =>
                      a.id === s.id || a.targetId === s.targetId
                        ? { ...a, workspaceId: workspaceId || undefined }
                        : a,
                    ),
                  }))
                }
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
