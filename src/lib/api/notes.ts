import { rpc } from "./study-session";
import type { NoteAccess, PublicTopic } from "./public-notes";

/**
 * Client for the server's `topicNote` router (goscribe/server): Scribe's own
 * topic notes for catalog courses, and the reviewer queue. Contracts mirror
 * src/lib/notes/types.ts there. Note content is English (UK for IB/GCSE/A-level,
 * US for AP); only the UI chrome is translated.
 */

export type NoteBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: { text: string; sub: string[] }[] }
  | { type: "callout"; kind: "mistake" | "tip"; text: string }
  | { type: "example"; title: string; problem: string; steps: string[]; answer: string }
  | { type: "table"; caption: string; headers: string[]; rows: string[][] }
  | { type: "figure"; figureId: string }
  /** Extra depth, collapsed by default ("Go deeper"). */
  | { type: "deeper"; title: string; paragraphs: string[] };

export interface NoteSection {
  id: string;
  heading: string;
  blocks: NoteBlock[];
}

export interface NoteFigure {
  id: string;
  kind: "html" | "graph" | "widget";
  static: boolean;
  title: string;
  caption: string;
  alt: string;
  brief: string;
  widgetId?: string | null;
  html?: string | null;
  graph?: {
    xLabel: string;
    yLabel: string;
    bounds?: { left: number; right: number; bottom: number; top: number };
    expressions: { latex: string; label: string | null }[];
  } | null;
}

export interface RecallQuestion {
  id: string;
  commandTerm: string;
  question: string;
  marks: number;
  modelAnswer: string;
  markPoints: string[];
}

export interface TopicNoteContent {
  schemaVersion: number;
  courseId: string;
  topicId: string;
  topicCode: string;
  topicName: string;
  unitCode: string;
  unitName: string;
  hlOnly?: boolean;
  locale: "en-GB" | "en-US";
  objectiveLine: string;
  sections: NoteSection[];
  keyTerms: { term: string; definition: string; sectionId: string }[];
  figures: NoteFigure[];
  recall: RecallQuestion[];
}

export type NoteLabel = "reviewed" | "draft";
export type NoteStatus = "DRAFT" | "CHANGES_REQUESTED" | "REVIEWED" | "PUBLISHED";

export interface LearnerNote {
  courseId: string;
  topicId: string;
  version: number;
  label: NoteLabel;
  updatedAt: string;
  /** The whole note, or only its preview when `access.locked` (paid gate). */
  content: TopicNoteContent;
  /** Older servers omit it (treated as unlocked). */
  access?: NoteAccess;
}

export interface CheckedClaim {
  id: string;
  where: string;
  claim: string;
  verdict: "ok" | "wrong" | "doubtful";
  reason: string;
  fix: { find: string; replace: string } | null;
  applied: boolean;
}

export interface LintIssue {
  rule: string;
  where: string;
  message: string;
  severity: "error" | "warning";
}

export interface FactCheckReport {
  checkedAt: string;
  model: string;
  claims: CheckedClaim[];
  styleFixesApplied: number;
  stats: { claims: number; ok: number; autoFixed: number; flagged: number };
  needsReview: boolean;
  reviewReasons: string[];
  lint: LintIssue[];
  figureQa: { figureId: string; ok: boolean; issues: string[]; attempts: number }[];
}

export interface QueueRow {
  id: string;
  topicId: string;
  topicCode: string;
  topicName: string;
  status: NoteStatus;
  risk: number;
  version: number;
  stats: FactCheckReport["stats"];
  needsReview: boolean;
  reasons: string[];
  lintErrors: number;
  assignedToMe: boolean;
  assigned: boolean;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface ReviewNote {
  id: string;
  courseId: string;
  courseTitle: string;
  topicId: string;
  status: NoteStatus;
  version: number;
  risk: number;
  content: TopicNoteContent;
  factCheck: FactCheckReport;
  lint: LintIssue[];
  commandTerms: string[];
  figureThumbs: Record<string, Record<string, string>>;
  assignedToMe: boolean;
  assigned: boolean;
  reviewedAt: string | null;
  reviews: {
    id: string;
    action: string;
    version: number;
    comment: string | null;
    changes: { where: string; before: string; after: string }[] | null;
    mine: boolean;
    createdAt: string;
  }[];
}

export interface ReviewCourse {
  courseId: string;
  title: string;
  topicCount: number;
  counts: Record<NoteStatus, number>;
}

export interface NoteReviewer {
  id: string;
  email: string;
  name: string | null;
  userId: string | null;
  courseIds: string[];
  ratePerNoteCents: number | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface PayoutRow {
  userId: string;
  email: string | null;
  name: string | null;
  staff: boolean;
  notesApproved: number;
  changesRequested: number;
  notesEdited: number;
  ratePerNoteCents: number | null;
  amountCents: number | null;
}

export const notesApi = {
  get: (courseId: string, topicId: string) =>
    rpc<LearnerNote | null>("topicNote.get", "query", { courseId, topicId }),
  /** The public page's data for the signed-in user; whole when they may read a locked topic. */
  page: (courseId: string, topicId: string) => rpc<PublicTopic | null>("topicNote.page", "query", { courseId, topicId }),
  listForCourse: (courseId: string) =>
    rpc<{ topicId: string; label: NoteLabel }[]>("topicNote.listForCourse", "query", { courseId }),
};

/* ---- Notes attached to a subject as material (server: AttachedNotesService) ---- */

/** `current`: in step with the note. `locked`: needs a plan the learner no longer has (not used as material). `withdrawn`: the note is being revised or was removed; the subject keeps its last text. */
export type AttachedNoteState = "current" | "locked" | "withdrawn";

export interface AttachedNote {
  /** The material (file) id in the subject. */
  fileId: string;
  name: string;
  courseId: string;
  courseTitle: string;
  topicId: string;
  topicCode: string;
  topicName: string;
  version: number;
  label: NoteLabel;
  state: AttachedNoteState;
  addedAt: string;
}

export type AttachSkipReason = "unknown_topic" | "no_note" | "locked" | "already_attached" | "limit";

export interface AttachResult {
  attached: { fileId: string; topicId: string; name: string }[];
  skipped: { topicId: string; reason: AttachSkipReason }[];
  count: number;
  max: number;
}

export interface AttachOptionTopic {
  id: string;
  code: string;
  name: string;
  hlOnly?: boolean;
  higherTierOnly?: boolean;
  bcOnly?: boolean;
  note: NoteLabel | null;
  locked: boolean;
  attached: boolean;
}

export interface AttachOptions {
  course: { id: string; title: string; board: string; boardName: string; subject: string; unitLabel: string };
  count: number;
  max: number;
  units: { id: string; code: string; name: string; topics: AttachOptionTopic[] }[];
}

export interface NoteSubjects {
  attachable: boolean;
  reason: "no_note" | "locked" | null;
  attachedWorkspaceIds: string[];
  courseWorkspaceId: string | null;
}

/**
 * Newer than some deployed servers: every caller treats a failure as "this
 * server has no attached notes" and hides the feature rather than erroring.
 */
export const attachedNotesApi = {
  list: (workspaceId: string) => rpc<AttachedNote[]>("topicNote.attached", "query", { workspaceId }),
  options: (workspaceId: string, courseId: string) => rpc<AttachOptions>("topicNote.attachOptions", "query", { workspaceId, courseId }),
  attach: (workspaceId: string, courseId: string, topicIds: string[]) =>
    rpc<AttachResult>("topicNote.attach", "mutation", { workspaceId, courseId, topicIds }),
  detach: (workspaceId: string, fileIds: string[]) => rpc<{ removed: number }>("topicNote.detach", "mutation", { workspaceId, fileIds }),
  subjectsFor: (courseId: string, topicId: string) => rpc<NoteSubjects>("topicNote.subjectsFor", "query", { courseId, topicId }),
  /** A signed-in practice answer: the server marks it and feeds the Mistakes list. */
  practiceAnswer: (input: { courseId: string; topicId: string; questionId: string; choice: number }) =>
    rpc<{ correct: boolean; logged: boolean; workspaceId: string | null }>("topicNote.practiceAnswer", "mutation", input),
};

export const reviewApi = {
  me: () => rpc<{ admin: boolean; courseIds: string[] | null } | null>("topicNote.review.me", "query", undefined),
  courses: () => rpc<ReviewCourse[]>("topicNote.review.courses", "query", undefined),
  queue: (courseId: string, status?: NoteStatus) =>
    rpc<QueueRow[]>("topicNote.review.queue", "query", { courseId, ...(status ? { status } : {}) }),
  note: (noteId: string) => rpc<ReviewNote>("topicNote.review.note", "query", { noteId }),
  claim: (noteId: string) => rpc<{ ok: boolean }>("topicNote.review.claim", "mutation", { noteId }),
  release: (noteId: string) => rpc<{ ok: boolean }>("topicNote.review.release", "mutation", { noteId }),
  save: (input: { noteId: string; version: number; content: TopicNoteContent; comment?: string }) =>
    rpc<{ version: number; changes: number }>("topicNote.review.save", "mutation", input),
  approve: (input: { noteId: string; version: number; comment?: string; overrideLint?: boolean }) =>
    rpc<{ ok: boolean }>("topicNote.review.approve", "mutation", input),
  requestChanges: (input: { noteId: string; version: number; comment: string }) =>
    rpc<{ ok: boolean }>("topicNote.review.requestChanges", "mutation", input),
  setPublished: (noteId: string, published: boolean) =>
    rpc<{ ok: boolean }>("topicNote.review.setPublished", "mutation", { noteId, published }),
  exportCourse: (courseId: string, format: "bundle" | "csv") =>
    rpc<{ filename: string; text: string }>("topicNote.review.export", "query", { courseId, format }),
  importBundle: (text: string) =>
    rpc<{ notes: number; results: { courseId: string; topicId: string; result: string }[] }>(
      "topicNote.review.import",
      "mutation",
      { text },
    ),
  reviewers: () => rpc<NoteReviewer[]>("topicNote.review.reviewers", "query", undefined),
  invite: (input: { email: string; name?: string; courseIds: string[]; ratePerNoteCents?: number }) =>
    rpc<{ id: string; sent: boolean }>("topicNote.review.invite", "mutation", input),
  revoke: (id: string) => rpc<{ ok: boolean }>("topicNote.review.revoke", "mutation", { id }),
  payouts: (from: string, to: string) => rpc<PayoutRow[]>("topicNote.review.payouts", "query", { from, to }),
};
