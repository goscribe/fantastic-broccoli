import { apiUrl } from "./config";
import type { TopicNoteContent } from "./notes";

/**
 * Client for the server's public `publicNotes` router (goscribe/server
 * src/routers/publicNotes.ts): no login, used by the server-rendered note
 * pages (with ISR caching) and, for `track`, by the browser. Contracts mirror
 * src/services/notes/public-notes.service.ts there.
 */

export type NoteLabel = "reviewed" | "draft";
export type CatalogBoard = "IB" | "AP" | "GCSE" | "A_LEVEL";

export interface PublicCourseSummary {
  id: string;
  title: string;
  board: CatalogBoard;
  boardName: string;
  subject: string;
  qualification: string;
  levels?: string[];
  topicCount: number;
  noteCount: number;
  questionCount: number;
  /** Topics behind the paid gate (0 while it is off) and how they are described. */
  lockedCount?: number;
  lockedKind?: LockedKind;
}

/** How a locked topic is gated: IB HL-only, second-year A-level, or the whole course. */
export type LockedKind = "HL" | "A_LEVEL" | "PLAN";

/** What a locked page leaves out (server src/lib/notes/gate.ts LockedSummary). */
export interface LockedSummary {
  locked: true;
  kind: LockedKind;
  sections: number;
  shownSections: number;
  questions: number;
  shownQuestions: number;
  workedExamples: number;
  keyTerms: number;
  figures: number;
  recall: number;
}

export type NoteAccess = { locked: false } | LockedSummary;

export interface PublicTopicRow {
  id: string;
  code: string;
  name: string;
  hlOnly?: boolean;
  higherTierOnly?: boolean;
  bcOnly?: boolean;
  /** Needs a plan or exam pass (only while the server's NOTES_PAID_GATE is on). */
  locked?: boolean;
  note: NoteLabel | null;
  questionCount: number;
}

export interface PublicUnit {
  id: string;
  code: string;
  name: string;
  topics: PublicTopicRow[];
}

export interface PublicCourse {
  id: string;
  title: string;
  board: CatalogBoard;
  boardName: string;
  subject: string;
  qualification: string;
  levels?: string[];
  unitLabel: string;
  sourceNote: string;
  units: PublicUnit[];
}

export interface PublicQuestion {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  commandTerm: string | null;
  marks: number;
}

export interface PublicTopic {
  course: PublicCourse;
  unitId: string;
  topic: PublicTopicRow & { objectives: string[] };
  note: { label: NoteLabel; version: number; updatedAt: string; content: TopicNoteContent } | null;
  questions: PublicQuestion[];
  updatedAt: string | null;
  /**
   * `locked: false`, or what the preview leaves out: then `note` holds only the
   * first section (the rest are headings with no blocks) and `questions` the
   * preview questions. Older servers omit it (treated as unlocked).
   */
  access?: NoteAccess;
}

export interface SitemapRow {
  courseId: string;
  unitId: string;
  unitName: string;
  topicId: string;
  topicName: string;
  note: NoteLabel | null;
  questionCount: number;
  updatedAt: string | null;
}

/** Seconds a rendered note page (and its data) may be served before a background refresh. */
export const NOTES_REVALIDATE = 3600;

type Envelope = { result?: { data?: { json?: unknown } | unknown }; error?: { json?: { message?: string } } };

/** superjson envelope → value (Dates arrive as ISO strings; pages treat them as strings). */
function unwrap<T>(body: Envelope): T {
  const data = body.result?.data as { json?: unknown } | undefined;
  return (data && typeof data === "object" && "json" in data ? data.json : data) as T;
}

async function query<T>(path: string, input?: unknown): Promise<T> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(`${apiUrl}/trpc/publicNotes.${path}${qs}`, {
    next: { revalidate: NOTES_REVALIDATE, tags: ["public-notes"] },
  });
  const body = (await res.json().catch(() => ({}))) as Envelope;
  if (!res.ok || body.error) throw new Error(body.error?.json?.message ?? `publicNotes.${path} failed (${res.status})`);
  return unwrap<T>(body);
}

export const publicNotesApi = {
  courses: () => query<PublicCourseSummary[]>("courses"),
  course: (courseId: string) => query<PublicCourse | null>("course", { courseId }),
  topic: (courseId: string, topicId: string) => query<PublicTopic | null>("topic", { courseId, topicId }),
  sitemap: () => query<SitemapRow[]>("sitemap"),
};

export type PublicNoteEvent =
  | "notes.viewed"
  | "notes.practice_answered"
  | "notes.signup_prompt_shown"
  | "notes.signup_clicked"
  | "notes.quick5_clicked"
  | "notes.locked_viewed"
  | "notes.unlock_clicked";

export interface PublicEventProps {
  correct?: boolean;
  answered?: number;
  totalAnswered?: number;
  difficulty?: "easy" | "medium" | "hard";
  placement?: "prompt" | "header" | "practice_end" | "note_cta" | "inline" | "unlock_panel" | "locked_questions";
  lockedKind?: LockedKind;
  signedIn?: boolean;
  viewportWidth?: number;
  fromSearch?: boolean;
}

/** Anonymous funnel event from the browser; fire-and-forget, never throws, no personal data. */
export function trackNoteEvent(event: PublicNoteEvent, courseId: string, topicId: string, props?: PublicEventProps): void {
  if (typeof window === "undefined" || !apiUrl) return;
  try {
    void fetch(`${apiUrl}/trpc/publicNotes.track`, {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: { event, courseId, topicId, ...(props ? { props } : {}) } }),
    }).catch(() => undefined);
  } catch {
    // Analytics must never break the page.
  }
}
