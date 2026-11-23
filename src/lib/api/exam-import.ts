import { rpc } from "./study-session";
import { parseIcs, type IcsEvent } from "@/lib/calendar/ics";

/**
 * Exam import (server `planner.*`): the connected Google Calendar, an .ics
 * file (parsed here, in the browser) or any uploaded timetable. The server
 * adds the exams it is sure of and returns the rest as suggestions.
 */

export type ImportSource = "google" | "ics" | "file";
export type ExamKind = "exam" | "test" | "coursework";

export interface ImportedExam {
  id: string;
  title: string;
  date: string;
  /** "HH:MM", or a timetable's session "am" | "pm"; null for all-day. */
  time: string | null;
  workspaceId: string;
  subject: string;
  kind: ExamKind;
}

export interface ExamSuggestion {
  source: ImportSource;
  eventId: string;
  title: string;
  date: string | null;
  time: string | null;
  start: string | null;
  end: string | null;
  workspaceId: string | null;
  kind: ExamKind;
  /** unsure: might be a test. no_subject: a test with no matching subject. check_date: the date needs a look. */
  reason: "unsure" | "no_subject" | "check_date";
}

export interface ImportResult {
  source: ImportSource;
  scanned: number;
  added: ImportedExam[];
  moved: { id: string; title: string; from: string; to: string }[];
  suggested: ExamSuggestion[];
  already: number;
}

export interface CalendarSyncResult extends ImportResult {
  connected: boolean;
  needsReconnect: boolean;
  /** The calendar was read in the last few hours: nothing was done. */
  skipped: boolean;
  unavailable: boolean;
}

export interface ExamImportStatus {
  connected: boolean;
  email: string | null;
  needsReconnect: boolean;
  lastSyncedAt: string | Date | null;
  imported: number;
  maxFileBytes: number;
}

export interface CalendarEventRow {
  eventId: string;
  title: string;
  date: string;
  time: string | null;
  /** Set when the event is already an exam in the planner. */
  examId: string | null;
  workspaceId: string | null;
  kind: ExamKind;
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};
const locale = () => (typeof navigator === "undefined" ? undefined : navigator.language);

/** Throws on a server without the import (older deploy): the planner then hides every import entry. */
export const fetchExamImportStatus = () => rpc<ExamImportStatus>("planner.examImportStatus", "query", undefined);
export const syncCalendarExams = (force: boolean) => rpc<CalendarSyncResult>("planner.syncCalendarExams", "mutation", { timezone: tz(), force });
export const fetchCalendarEvents = () =>
  rpc<{ connected: boolean; needsReconnect: boolean; unavailable: boolean; events: CalendarEventRow[] }>("planner.calendarEvents", "query", { timezone: tz() });
export const importIcsEvents = (events: IcsEvent[]) => rpc<ImportResult>("planner.importIcsExams", "mutation", { timezone: tz(), events });

export const attachCalendarExam = (input: {
  source: ImportSource;
  eventId: string;
  workspaceId: string;
  kind?: ExamKind;
  title?: string;
  date?: string;
  time?: string | null;
  start?: string | null;
  end?: string | null;
}) => rpc<{ id: string; title: string; date: string; workspaceId: string }>("planner.attachCalendarExam", "mutation", { ...input, timezone: tz() });
export const dismissCalendarEvent = (source: ImportSource, eventId: string) => rpc<{ ok: boolean }>("planner.dismissCalendarEvent", "mutation", { source, eventId });
export const ackExamMoved = (id: string) => rpc<{ ok: boolean }>("planner.ackExamMoved", "mutation", { id });

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
};

/** A timetable in any format: uploaded, read on the server (text, OCR for photos), and deleted there once read. */
export async function importExamFile(file: File): Promise<ImportResult> {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  const contentType = file.type || EXT_TYPES[ext] || "application/octet-stream";
  const up = await rpc<{ key: string; uploadUrl: string }>("planner.examFileUpload", "mutation", { fileName: file.name, contentType, size: file.size });
  const put = await fetch(up.uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file });
  if (!put.ok) throw new Error("The upload didn't finish. Check your connection and try again.");
  return rpc<ImportResult>("planner.importExamFile", "mutation", { key: up.key, fileName: file.name, contentType, timezone: tz(), locale: locale() });
}

/** An .ics is read in the browser: only each event's title, start/end and id are sent on. */
export async function importIcsFile(file: File): Promise<ImportResult> {
  const { events } = parseIcs(await file.text());
  return importIcsEvents(events);
}
