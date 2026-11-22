/**
 * Typed client for the coursework grader (goscribe/server `coursework.*`).
 * The router is newer than the published @goscribe/server types, so calls
 * go out as plain tRPC HTTP requests (superjson), like home.ts. Against a
 * server without the grader, `graderAvailable()` resolves false and the
 * entry stays hidden.
 *
 * Contract: shapes below mirror services/coursework/coursework.service.ts
 * and lib/coursework/result-schema.ts on the server.
 */
import superjson from "superjson";
import { apiUrl } from "./config";
import { isMissingProcedure } from "@/lib/home-action";

/* ---------------------------------- Types ---------------------------------- */

export type GraderTier = "free" | "starter" | "pro" | "ultra" | "other";
export type GraderLimitReason = "locked" | "daily_limit" | "abuse_cap";
export type ReviewMode = "marked" | "feedback";
export type ReviewStatus = "queued" | "grading" | "completed" | "failed";
export type ComponentKind = "extended_essay" | "tok_essay" | "tok_exhibition" | "internal_assessment" | "nea" | "coursework";
export type DocumentKind = "coursework" | "note";
export type ImportStatus = null | "uploading" | "extracting" | "failed";

export interface GraderStatus {
  tier: GraderTier;
  allowed: boolean;
  reason: GraderLimitReason | null;
  /** Reviews a day as shown; null = unlimited. */
  limit: number | null;
  usedToday: number;
  remainingToday: number | null;
  resetsAt: Date;
  timezone: string;
  /** Ultra's price is configured: the Ultra upsell may be shown. */
  ultraAvailable: boolean;
  ultraPlanId: string | null;
}

export interface GraderRubric {
  id: string;
  key: string;
  board: string;
  qualification: string;
  subject: string;
  component: string;
  componentKind: ComponentKind;
  level: string | null;
  sessionLabel: string;
  totalMarks: number;
  wordLimit: number | null;
  status: "draft" | "reviewed";
  sourceNote: string;
  criteria: Array<{ letter: string; name: string; maxMarks: number }>;
  /** Matches one of the student's own subjects: prefill the picker with it. */
  suggested: boolean;
}

export type GuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: Array<{ text: string; sub: string[] }> }
  | { type: "callout"; kind: "mistake" | "tip"; text: string };

export interface GraderGuide {
  rubricId: string;
  board: string;
  qualification: string;
  subject: string;
  component: string;
  componentKind: ComponentKind;
  level: string | null;
  sessionLabel: string;
  totalMarks: number;
  wordLimit: number | null;
  status: "draft" | "reviewed";
  sourceNote: string;
  /** Same section/block shape as topic notes (light markdown inline). */
  guide: { objectiveLine: string; sections: Array<{ id: string; heading: string; blocks: GuideBlock[] }> } | null;
}

export interface GraderDocumentSummary {
  id: string;
  title: string;
  kind: DocumentKind;
  workspaceId: string | null;
  rubricId: string | null;
  wordCount: number;
  importStatus: ImportStatus;
  updatedAt: Date;
  reviewCount: number;
  lastReview: null | { id: string; status: ReviewStatus; mode: ReviewMode; draftNumber: number; createdAt: Date; marksLow: number | null; marksHigh: number | null };
}

export interface GraderDocument {
  id: string;
  title: string;
  kind: DocumentKind;
  workspaceId: string | null;
  rubricId: string | null;
  /** tiptap JSON. */
  content: unknown;
  /** Server plain text (equations as LaTeX, images as "[figure]"). */
  text: string;
  wordCount: number;
  version: number;
  importStatus: ImportStatus;
  importError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evidence {
  /** The student's exact words. */
  quote: string;
  comment: string;
  /** Offsets into the review's snapshotText (end exclusive). */
  start: number;
  end: number;
}

interface CriterionBase {
  letter: string;
  name: string;
  maxMarks: number;
  evidence: Evidence[];
  droppedQuotes: number;
  evidenceVerified: boolean;
}

export interface MarkedCriterion extends CriterionBase {
  bandLow: number;
  bandHigh: number;
  justification: string;
  toMoveUp: string;
}

export interface FeedbackCriterion extends CriterionBase {
  assessment: string;
  toImprove: string;
}

interface ResultBase {
  schemaVersion: 1;
  disclaimer: string;
  topFixes: Array<{ title: string; detail: string; criterion: string }>;
  words: { counted: number; limit: number | null; overLimit: boolean; graded: number; bibliographyFound: boolean };
  flags: { quotesDropped: number; rewritesRemoved: number; bandsAdjusted: number; marksRemoved: number; notes: string[] };
}

export interface MarkedResult extends ResultBase {
  mode: "marked";
  criteria: MarkedCriterion[];
  overall: { marksLow: number; marksHigh: number; totalMarks: number; gradeLow: string | null; gradeHigh: string | null; summary: string };
}

export interface FeedbackResult extends ResultBase {
  mode: "feedback";
  criteria: FeedbackCriterion[];
  overall: { summary: string };
}

export type GradeResult = MarkedResult | FeedbackResult;

export type EntryPart = "author" | "title" | "date" | "publisher_or_site" | "url_or_doi" | "access_date" | "page_numbers" | "edition_or_volume";

export interface CitationsResult {
  style: "MLA" | "APA" | "Chicago" | "Harvard" | "IEEE" | "Other" | "None" | "Unknown";
  consistent: boolean;
  inconsistencies: string[];
  citedNotListed: Array<{ text: string; fix: string }>;
  listedNotCited: Array<{ text: string; fix: string }>;
  uncitedClaims: Array<{ sentence: string; kind: "quotation" | "statistic" | "date" | "claim"; fix: string }>;
  entries: Array<{
    index: number;
    raw: string;
    missing: EntryPart[];
    correctedFormat: string | null;
    lookup: null | { kind: "doi" | "url"; status: "found" | "not_found" | "unverified"; detail: string };
  }>;
  counts: { inText: number; entries: number; issues: number };
  modelChecked: boolean;
  note: string;
}

export interface GraderReview {
  id: string;
  documentId: string | null;
  draftNumber: number;
  mode: ReviewMode;
  status: ReviewStatus;
  label: string | null;
  error: string | null;
  wordCount: number | null;
  createdAt: Date;
  completedAt: Date | null;
  rubric: Pick<GraderRubric, "id" | "board" | "qualification" | "subject" | "component" | "componentKind" | "level" | "sessionLabel" | "totalMarks" | "wordLimit" | "status" | "sourceNote">;
  /** The exact text reviewed; evidence offsets point into it. */
  snapshotText: string | null;
  result: GradeResult | null;
  citations: CitationsResult | null;
}

export interface GraderReviewSummary {
  id: string;
  documentId: string | null;
  draftNumber: number;
  mode: ReviewMode;
  status: ReviewStatus;
  label: string | null;
  wordCount: number | null;
  createdAt: Date;
  rubric: { id: string; component: string; componentKind: ComponentKind; subject: string; totalMarks: number };
  marksLow: number | null;
  marksHigh: number | null;
}

export interface RequestReviewInput {
  documentId?: string;
  paste?: { text: string; title?: string; workspaceId?: string };
  rubricId?: string;
  mode?: ReviewMode;
  label?: string;
  timezone?: string;
}

/* --------------------------------- Transport -------------------------------- */

/** A tRPC error from the grader, with its code (FORBIDDEN, CONFLICT, …). */
export class GraderError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The server has no `coursework.*` router (an older deploy). */
export class GraderMissing extends Error {}

type Body = {
  result?: { data: Parameters<typeof superjson.deserialize>[0] };
  error?: { message?: string; data?: { code?: string }; json?: { message?: string; data?: { code?: string } } };
} | null;

async function call<T>(kind: "query" | "mutation", path: string, input?: unknown): Promise<T> {
  const url = `${apiUrl}/trpc/coursework.${path}`;
  const payload = JSON.stringify(superjson.serialize(input ?? null));
  const res =
    kind === "query"
      ? await fetch(input === undefined ? url : `${url}?input=${encodeURIComponent(payload)}`, { credentials: "include" })
      : await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: payload });
  const body = (await res.json().catch(() => null)) as Body;
  if (path === "status" && isMissingProcedure(res.status, body)) throw new GraderMissing("coursework is not deployed");
  if (!res.ok || !body?.result) {
    const message = body?.error?.json?.message ?? body?.error?.message ?? `coursework.${path} failed (${res.status})`;
    throw new GraderError(message, body?.error?.json?.data?.code ?? body?.error?.data?.code, res.status);
  }
  return superjson.deserialize(body.result.data) as T;
}

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/* ---------------------------------- Calls ---------------------------------- */

export const graderApi = {
  status: () => call<GraderStatus>("query", "status", { timezone: browserTimezone() }),
  rubrics: () => call<GraderRubric[]>("query", "rubrics"),
  guide: (rubricId: string) => call<GraderGuide>("query", "guide", { rubricId }),

  documents: (input: { workspaceId?: string; kind?: DocumentKind } = {}) => call<GraderDocumentSummary[]>("query", "documents", input),
  document: (documentId: string) => call<GraderDocument>("query", "document", { documentId }),
  createDocument: (input: { title?: string; rubricId?: string; workspaceId?: string; kind?: DocumentKind; text?: string; content?: unknown }) =>
    call<{ documentId: string; version: number; wordCount: number }>("mutation", "createDocument", input),
  /** Autosave: send the version you loaded; a GraderError with code CONFLICT means reload. */
  saveDocument: (input: { documentId: string; baseVersion: number; title?: string; rubricId?: string | null; workspaceId?: string | null; content?: unknown }) =>
    call<{ version: number; wordCount: number; updatedAt: Date }>("mutation", "saveDocument", input),
  deleteDocument: (documentId: string) => call<{ deleted: true }>("mutation", "deleteDocument", { documentId }),

  importUpload: (input: { documentId?: string; workspaceId?: string; rubricId?: string; fileName: string; contentType: string; size: number }) =>
    call<{ documentId: string; uploadUrl: string }>("mutation", "importUpload", input),
  finishUpload: (documentId: string) => call<{ documentId: string; importStatus: ImportStatus }>("mutation", "finishUpload", { documentId }),

  requestReview: (input: RequestReviewInput) =>
    call<{ reviewId: string; documentId: string; status: "queued"; draftNumber: number; remainingToday: number | null }>("mutation", "requestReview", {
      mode: "marked",
      timezone: browserTimezone(),
      ...input,
    }),
  review: (reviewId: string) => call<GraderReview>("query", "review", { reviewId }),
  reviews: (input: { documentId?: string; rubricId?: string } = {}) => call<GraderReviewSummary[]>("query", "reviews", input),
  deleteReview: (reviewId: string) => call<{ deleted: true }>("mutation", "deleteReview", { reviewId }),
};

/**
 * Uploads a file for import into a document (new, or `documentId`): signed
 * upload, then extraction starts on the server. Poll `graderApi.document`
 * until `importStatus` is null (done) or "failed".
 */
export async function importFile(file: File, opts: { documentId?: string; workspaceId?: string; rubricId?: string } = {}): Promise<{ documentId: string }> {
  const { documentId, uploadUrl } = await graderApi.importUpload({
    ...opts,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new GraderError("The upload did not finish. Try again.", undefined, put.status);
  await graderApi.finishUpload(documentId);
  return { documentId };
}

/** False on a server without the grader (hide the Coursework entry); the status otherwise. */
export async function graderAvailable(): Promise<GraderStatus | false> {
  try {
    return await graderApi.status();
  } catch (err) {
    if (err instanceof GraderMissing) return false;
    throw err;
  }
}

/** React Query keys. */
export const GRADER_KEYS = {
  status: ["grader", "status"] as const,
  rubrics: ["grader", "rubrics"] as const,
  guide: (rubricId: string) => ["grader", "guide", rubricId] as const,
  documents: ["grader", "documents"] as const,
  document: (id: string) => ["grader", "document", id] as const,
  review: (id: string) => ["grader", "review", id] as const,
  reviews: (filter: { documentId?: string; rubricId?: string } = {}) => ["grader", "reviews", filter] as const,
};
