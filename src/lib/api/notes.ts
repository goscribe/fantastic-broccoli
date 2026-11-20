import { rpc } from "./study-session";

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
  | { type: "figure"; figureId: string };

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
  content: TopicNoteContent;
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
  listForCourse: (courseId: string) =>
    rpc<{ topicId: string; label: NoteLabel }[]>("topicNote.listForCourse", "query", { courseId }),
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
