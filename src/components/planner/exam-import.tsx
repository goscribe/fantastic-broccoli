"use client";

import "@/lib/i18n/exam-planner";
import "@/lib/i18n/exam-import";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { apiUrl } from "@/lib/api/config";
import { deleteExam } from "@/lib/api/exam-planner";
import {
  attachCalendarExam,
  dismissCalendarEvent,
  fetchCalendarEvents,
  importExamFile,
  importIcsFile,
  syncCalendarExams,
  type CalendarEventRow,
  type ExamImportStatus,
  type ExamSuggestion,
  type ImportedExam,
  type ImportResult,
  type ImportSource,
} from "@/lib/api/exam-import";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { CalendarParseError, looksLikeIcs } from "@/lib/calendar/ics";
import { filterEvents, importHeadline, whenLabel } from "@/lib/exam-import-view";
import { dayLabel, fill } from "@/lib/exam-planner-view";
import { track } from "@/lib/funnel";
import { useI18n } from "@/lib/i18n";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Folder, Workspace } from "@/types";
import { PLAN_KEY } from "@/components/planner/plan-task";

/** How the sheet opens: the choice of source, the summary of an import that already ran, or the event picker. */
export type ImportOpen = { view: "entry" } | { view: "summary"; result: ImportResult } | { view: "attach" };
type View = "entry" | "busy" | "summary" | "attach";

export const IMPORT_STATUS_KEY = [...PLAN_KEY, "import-status"];

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  return [...root, ...folders.flatMap((f) => flatten(f.folders ?? [], f.workspaces))];
}

/** The subject's name on its own colour (the cover family's hue). */
export function SubjectChip({ subject }: { subject: Pick<Workspace, "id" | "title" | "subjectFamily"> }) {
  const family = resolveSubjectFamily(subject.subjectFamily, subject.title);
  return (
    <span
      className="inline-flex h-6 max-w-[160px] shrink-0 items-center rounded-full px-2.5 text-caption font-bold text-white"
      style={{ ...familyVars(family, subject.title), background: "var(--tile-a)" } as CSSProperties}
    >
      <span className="truncate">{subject.title}</span>
    </span>
  );
}

function SubjectSelect({ subjects, value, onChange, label, placeholder }: { subjects: Workspace[]; value: string; onChange: (id: string) => void; label: string; placeholder: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-10 min-w-0 flex-1 text-small font-semibold", !value && "text-muted-foreground")}>
      <option value="">{placeholder}</option>
      {subjects.map((w) => (
        <option key={w.id} value={w.id}>
          {w.title}
        </option>
      ))}
    </select>
  );
}

/**
 * Import exams from Google Calendar, an .ics file or any timetable file.
 * Clear tests are added by the server straight away; this sheet shows what
 * was added (each with Remove), what might be a test (added only when the
 * student says so), and a picker to attach any other calendar event.
 */
export function ExamImportSheet({
  open,
  status,
  onClose,
  onAddByHand,
}: {
  open: ImportOpen;
  status: ExamImportStatus;
  onClose: () => void;
  onAddByHand: () => void;
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(open.view === "summary" ? "summary" : open.view);
  const [busy, setBusy] = useState<"google" | "file">("google");
  const [result, setResult] = useState<ImportResult | null>(open.view === "summary" ? open.result : null);
  const [added, setAdded] = useState<ImportedExam[]>(open.view === "summary" ? open.result.added : []);
  const [suggested, setSuggested] = useState<ExamSuggestion[]>(open.view === "summary" ? open.result.suggested : []);
  const [error, setError] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(status.needsReconnect);
  const [working, setWorking] = useState<string | null>(null);

  const subjectsQ = useQuery({
    queryKey: ["workspace-tree-flat"],
    queryFn: async () => {
      const tr = await fetchWorkspaceTree();
      return flatten(tr.folders, tr.rootWorkspaces);
    },
  });
  const subjects = useMemo(() => subjectsQ.data ?? [], [subjectsQ.data]);
  const subjectOf = (id: string | null | undefined) => subjects.find((w) => w.id === id);

  const refresh = () => qc.invalidateQueries({ queryKey: PLAN_KEY });
  const show = (r: ImportResult) => {
    setResult(r);
    setAdded(r.added);
    setSuggested(r.suggested);
    setView("summary");
    if (r.added.length) track("planner.calendar_import_added", { count: r.added.length, source: r.source });
    void refresh();
  };

  const runGoogle = async () => {
    setError(null);
    setBusy("google");
    setView("busy");
    track("planner.calendar_import_opened", { source: "google" });
    try {
      const r = await syncCalendarExams(true);
      if (r.needsReconnect || !r.connected) {
        setNeedsReconnect(true);
        setView("entry");
        void qc.invalidateQueries({ queryKey: IMPORT_STATUS_KEY });
        return;
      }
      if (r.unavailable) {
        setError(t("ei.google.unavailable"));
        setView("entry");
        return;
      }
      show(r);
    } catch (err) {
      setError(toastError(err, t("ei.err.import")));
      setView("entry");
    }
  };

  const runFile = async (file: File) => {
    setError(null);
    if (file.size > status.maxFileBytes) {
      setError(t("ei.file.tooBig"));
      return;
    }
    const head = await file
      .slice(0, 64)
      .text()
      .catch(() => "");
    const ics = looksLikeIcs(file, head);
    setBusy("file");
    setView("busy");
    track("planner.calendar_import_opened", { source: ics ? "ics" : "file" });
    try {
      show(ics ? await importIcsFile(file) : await importExamFile(file));
    } catch (err) {
      // An unreadable file adds nothing: back to the choice, with the reason.
      setError(err instanceof CalendarParseError ? t("ei.file.notCalendar") : err instanceof Error && err.message ? err.message : t("ei.err.import"));
      setView("entry");
    }
  };

  const remove = async (exam: ImportedExam) => {
    setWorking(exam.id);
    try {
      await deleteExam(exam.id);
      setAdded((list) => list.filter((x) => x.id !== exam.id));
      track("planner.calendar_exam_removed", { source: result?.source });
      toast.success(t("ei.removed"));
      void refresh();
    } catch (err) {
      toastError(err, t("ei.err.remove"));
    } finally {
      setWorking(null);
    }
  };

  const addSuggestion = async (s: ExamSuggestion, workspaceId: string, date: string) => {
    setWorking(s.eventId);
    try {
      const exam = await attachCalendarExam({ source: s.source, eventId: s.eventId, workspaceId, kind: s.kind, title: s.title, date, time: s.time, start: s.start, end: s.end });
      setSuggested((list) => list.filter((x) => x.eventId !== s.eventId));
      setAdded((list) => [...list, { id: exam.id, title: exam.title, date: exam.date, time: s.time, workspaceId: exam.workspaceId, subject: subjectOf(exam.workspaceId)?.title ?? "", kind: s.kind }]);
      track("planner.calendar_event_attached", { source: s.source });
      void refresh();
    } catch (err) {
      toastError(err, t("ei.err.add"));
    } finally {
      setWorking(null);
    }
  };

  const notATest = async (s: ExamSuggestion) => {
    setSuggested((list) => list.filter((x) => x.eventId !== s.eventId));
    await dismissCalendarEvent(s.source, s.eventId).catch(() => {});
  };

  const toReconnect = useCallback(() => {
    setNeedsReconnect(true);
    setView("entry");
  }, []);

  const source: ImportSource = result?.source ?? "google";
  const headline = result ? importHeadline({ source, added, suggested }, t) : null;
  const heading = view === "attach" ? t("ei.attach.title") : view === "summary" && headline ? headline.title : t("ei.title");
  const connectUrl = `${apiUrl}/calendar/google/connect`;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/30 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col bg-card sm:max-h-[min(760px,calc(100vh-48px))] sm:max-w-[560px] sm:rounded-3xl sm:shadow-xl"
      >
        <div className="flex items-center justify-end px-5 pt-4 sm:px-6 sm:pt-5">
          <button type="button" aria-label={t("ei.close")} onClick={onClose} className="grid size-9 place-items-center rounded-lg text-faint hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          <h2 className="text-[21px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{heading}</h2>

          {view === "entry" && (
            <div className="mt-1.5 flex flex-col">
              <p className="text-ui text-muted-foreground">{t("ei.sub")}</p>
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-muted px-3.5 py-3 text-small font-semibold text-foreground">
                  {error}
                </p>
              )}

              <section className="mt-5 border-t border-border pt-4">
                <h3 className="text-ui font-bold">{t("ei.google.heading")}</h3>
                {needsReconnect ? (
                  <>
                    <p className="mt-1 text-small text-muted-foreground">{t("ei.google.reconnectNote")}</p>
                    <a href={connectUrl} className={buttonClass({ className: "mt-3 w-full sm:w-auto" })}>
                      {t("ei.google.reconnect")}
                    </a>
                  </>
                ) : status.connected ? (
                  <>
                    <p className="mt-1 text-small text-muted-foreground">{status.email ? fill(t("ei.google.connected"), { email: status.email }) : t("ei.google.connectedNoEmail")}</p>
                    <Button type="button" onClick={() => void runGoogle()} className="mt-3 w-full sm:w-auto">
                      {t("ei.google.import")}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-small text-muted-foreground">{t("ei.google.notConnected")}</p>
                    <a href={connectUrl} className={buttonClass({ className: "mt-3 w-full sm:w-auto" })}>
                      {t("ei.google.connect")}
                    </a>
                  </>
                )}
              </section>

              <section className="mt-5 border-t border-border pt-4">
                <h3 className="text-ui font-bold">{t("ei.file.heading")}</h3>
                <p className="mt-1 text-small text-muted-foreground">{t("ei.file.body")}</p>
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  aria-label={t("ei.file.upload")}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void runFile(file);
                  }}
                />
                <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} className="mt-3 w-full sm:w-auto">
                  {t("ei.file.upload")}
                </Button>
              </section>

              <p className="mt-6 text-caption text-faint">{t("ei.privacy")}</p>
            </div>
          )}

          {view === "busy" && (
            <div className="flex flex-col items-center px-4 py-14 text-center" role="status">
              <Loader2 className="size-7 animate-spin text-faint" />
              <p className="mt-4 text-ui font-semibold">{t(busy === "google" ? "ei.busy.google" : "ei.busy.file")}</p>
              {busy === "file" && <p className="mt-1 text-small text-muted-foreground">{t("ei.busy.fileSlow")}</p>}
            </div>
          )}

          {view === "summary" && result && headline && (
            <div className="mt-1.5 flex flex-col">
              {headline.body && <p className="text-ui text-muted-foreground">{headline.body}</p>}

              {result.moved.map((m) => (
                <p key={m.id} className="mt-3 rounded-xl bg-muted px-3.5 py-2.5 text-small font-semibold">
                  {fill(t("ei.moved"), { title: m.title, day: dayLabel(m.to, locale, { weekday: "short", day: "numeric", month: "short" }) })}
                </p>
              ))}

              {added.length > 0 && (
                <ul className="mt-4 border-t border-border">
                  {added.map((exam) => {
                    const subject = subjectOf(exam.workspaceId) ?? { id: exam.workspaceId, title: exam.subject };
                    return (
                      <li key={exam.id} className="flex items-center gap-3 border-b border-border py-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-ui font-semibold [overflow-wrap:anywhere]">{exam.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted-foreground">
                            <SubjectChip subject={subject} />
                            <span>{whenLabel(exam.date, exam.time, locale, t)}</span>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" disabled={working === exam.id} onClick={() => void remove(exam)} className="shrink-0">
                          {t("ei.remove")}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {result.already > 0 && <p className="mt-3 text-small text-muted-foreground">{result.already === 1 ? t("ei.alreadyOne") : fill(t("ei.already"), { n: result.already })}</p>}

              {suggested.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-ui font-bold">
                    {source === "file" ? t("ei.check.heading") : suggested.length === 1 ? t("ei.maybe.headingOne") : fill(t("ei.maybe.heading"), { n: suggested.length })}
                  </h3>
                  <p className="mt-0.5 text-small text-muted-foreground">{t(source === "file" ? "ei.check.sub" : "ei.maybe.sub")}</p>
                  <ul className="mt-3 border-t border-border">
                    {suggested.map((s) => (
                      <SuggestionRow key={s.eventId} s={s} subjects={subjects} busy={working === s.eventId} onAdd={addSuggestion} onDismiss={notATest} />
                    ))}
                  </ul>
                </section>
              )}

              {added.length === 0 && suggested.length === 0 && (
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {status.connected && !needsReconnect && (
                    <Button type="button" variant="secondary" onClick={() => setView("attach")}>
                      {t("ei.attach.open")}
                    </Button>
                  )}
                  <Button type="button" variant="secondary" onClick={() => setView("entry")}>
                    {t("ei.file.upload")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onAddByHand}>
                    {t("ei.addByHand")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {view === "attach" && (
            <AttachPicker
              subjects={subjects}
              onNeedsReconnect={toReconnect}
              onAttached={() => {
                track("planner.calendar_event_attached", { source: "google" });
                void refresh();
              }}
            />
          )}
        </div>

        {(view === "summary" || view === "attach") && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 sm:px-6">
            {view === "attach" ? (
              <Button type="button" variant="ghost" onClick={() => setView(result ? "summary" : "entry")}>
                {t("ei.back")}
              </Button>
            ) : status.connected && !needsReconnect && (added.length > 0 || suggested.length > 0) ? (
              <Button type="button" variant="ghost" onClick={() => setView("attach")}>
                {t("ei.attach.open")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={onClose} className="min-w-[120px]">
              {t("ei.done")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** One event that might be a test: its subject (and, for a timetable row, its date) can be set before it is added. */
function SuggestionRow({
  s,
  subjects,
  busy,
  onAdd,
  onDismiss,
}: {
  s: ExamSuggestion;
  subjects: Workspace[];
  busy: boolean;
  onAdd: (s: ExamSuggestion, workspaceId: string, date: string) => Promise<void>;
  onDismiss: (s: ExamSuggestion) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [workspaceId, setWorkspaceId] = useState(s.workspaceId ?? (subjects.length === 1 ? subjects[0].id : ""));
  const [date, setDate] = useState(s.date ?? "");
  // A calendar event's date is the calendar's; a timetable row's can be corrected here.
  const editableDate = s.source !== "google";
  const chosen = subjects.find((w) => w.id === workspaceId);
  return (
    <li className="border-b border-border py-3">
      <div className="text-ui font-semibold [overflow-wrap:anywhere]">{s.title}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted-foreground">
        {chosen && <SubjectChip subject={chosen} />}
        {!editableDate && <span>{whenLabel(s.date, s.time, locale, t)}</span>}
        {editableDate && s.time && <span>{whenLabel(null, s.time, locale, t)}</span>}
        <span>{t(`ei.reason.${s.reason}`)}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <SubjectSelect subjects={subjects} value={workspaceId} onChange={setWorkspaceId} label={t("ei.subject.label")} placeholder={t("ei.subject.choose")} />
        {editableDate && (
          <input type="date" aria-label={t("ei.date.label")} value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "h-10 w-[150px] shrink-0 text-small font-semibold")} />
        )}
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" variant="secondary" size="sm" disabled={busy || !workspaceId || !date} onClick={() => void onAdd(s, workspaceId, date)} className="h-10 flex-1 sm:flex-none">
            {busy ? t("ei.adding") : t("ei.add")}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onDismiss(s)} className="h-10 flex-1 sm:flex-none">
            {t("ei.notTest")}
          </Button>
        </div>
      </div>
    </li>
  );
}

/** "Attach from calendar": every other upcoming event, searchable; one becomes an exam once a subject is chosen. */
function AttachPicker({ subjects, onAttached, onNeedsReconnect }: { subjects: Workspace[]; onAttached: () => void; onNeedsReconnect: () => void }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const key = [...PLAN_KEY, "calendar-events"];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: fetchCalendarEvents, retry: false, staleTime: 60_000 });
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const events = useMemo(() => filterEvents(data?.events ?? [], query), [data, query]);

  const reconnect = data?.needsReconnect ?? false;
  useEffect(() => {
    if (reconnect) onNeedsReconnect();
  }, [reconnect, onNeedsReconnect]);

  const pick = (e: CalendarEventRow) => {
    setOpenId(openId === e.eventId ? null : e.eventId);
    setWorkspaceId(e.workspaceId ?? (subjects.length === 1 ? subjects[0].id : ""));
  };
  const attach = async (e: CalendarEventRow) => {
    setSaving(true);
    try {
      const exam = await attachCalendarExam({ source: "google", eventId: e.eventId, workspaceId, kind: e.kind });
      qc.setQueryData<typeof data>(key, (old) => (old ? { ...old, events: old.events.map((x) => (x.eventId === e.eventId ? { ...x, examId: exam.id, workspaceId } : x)) } : old));
      setOpenId(null);
      toast.success(t("ei.addedOne"));
      onAttached();
    } catch (err) {
      toastError(err, t("ei.err.add"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-col">
      <p className="text-ui text-muted-foreground">{t("ei.attach.sub")}</p>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("ei.attach.search")} aria-label={t("ei.attach.search")} className={cn(inputClass, "mt-4 h-11")} />
      {isLoading ? (
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError || data?.unavailable ? (
        <p className="mt-4 text-small text-muted-foreground">{t("ei.google.unavailable")}</p>
      ) : !events.length ? (
        <p className="mt-4 text-small text-muted-foreground">{t(data?.events.length ? "ei.attach.empty" : "ei.attach.none")}</p>
      ) : (
        <ul className="mt-3 border-t border-border">
          {events.map((e) => {
            const subject = subjects.find((w) => w.id === e.workspaceId);
            const isOpen = openId === e.eventId;
            return (
              <li key={e.eventId} className="border-b border-border">
                <button type="button" disabled={!!e.examId} aria-expanded={isOpen} onClick={() => pick(e)} className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default">
                  <span className="min-w-0 flex-1">
                    <span className="block text-ui font-semibold [overflow-wrap:anywhere]">{e.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted-foreground">
                      {e.examId && subject && <SubjectChip subject={subject} />}
                      <span>{whenLabel(e.date, e.time, locale, t)}</span>
                    </span>
                  </span>
                  {e.examId && <span className="shrink-0 text-caption font-semibold text-faint">{t("ei.attach.inPlanner")}</span>}
                </button>
                {isOpen && !e.examId && (
                  <div className="flex flex-wrap items-center gap-2 pb-3">
                    <SubjectSelect subjects={subjects} value={workspaceId} onChange={setWorkspaceId} label={t("ei.subject.label")} placeholder={t("ei.subject.choose")} />
                    <Button type="button" variant="secondary" size="sm" disabled={saving || !workspaceId} onClick={() => void attach(e)} className="h-10 w-full sm:w-auto">
                      {saving ? t("ei.adding") : t("ei.attach.add")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
