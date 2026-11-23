/**
 * The coursework grader's API as the screens use it: the typed client from
 * `./grader` (goscribe/server `coursework.*`; see its contract there) under
 * the names the coursework components were written with, plus two things the
 * screens need on top: an import that waits for the file's text, and the
 * checks for "limit reached" and "this server has no grader".
 */
import {
  GraderError,
  GraderMissing,
  graderApi,
  type GraderDocument,
  type GraderDocumentSummary,
  type GraderGuide,
  type GraderReview,
  type GraderReviewSummary,
  type GraderRubric,
  type GraderStatus as Status,
  type MarkedCriterion,
  type FeedbackCriterion,
  type ReviewMode,
} from "./grader";
import { rpc } from "./study-session";

export type {
  CitationsResult,
  WordCountRules,
  ComponentKind,
  Evidence as ResultEvidence,
  FeedbackCriterion,
  FeedbackResult,
  GradeResult,
  ImportStatus,
  MarkedCriterion,
  MarkedResult,
  ReviewMode,
  ReviewStatus,
} from "./grader";

/** `chat` (contract v2): true when `coursework.ask` is deployed and the plan has chat. Absent on a v1 server: no Chat tab. */
export type GraderStatus = Status & { chat?: boolean; chatLimit?: number | null; chatUsedToday?: number; chatRemainingToday?: number };
export type GraderPlanTier = Status["tier"];
/** The allowance part of the status (server limits.ts ReviewAllowance). */
export type ReviewAllowance = Pick<Status, "tier" | "allowed" | "limit" | "usedToday" | "remainingToday" | "reason" | "resetsAt">;
export type RubricSummary = GraderRubric;
export type RubricCriterion = GraderRubric["criteria"][number];
/** A rubric without its criteria: what a review carries. */
export type RubricInfo = GraderReview["rubric"];
export type GuideResponse = GraderGuide;
export type CourseworkGuide = NonNullable<GraderGuide["guide"]>;
/* ---------- Drafts (contract v2): a document holds file drafts and text drafts ---------- */

/** "file" = the uploaded original, read-only, gradable from its extracted text. "text" = an editable document. */
export type DraftKind = "file" | "text";
export type FileFormat = "pdf" | "docx" | "doc" | "pptx" | "image" | "txt" | "other";

export interface DraftSummary {
  id: string;
  documentId: string;
  kind: DraftKind;
  /** 1, 2, … per document; both kinds share the sequence. */
  number: number;
  title: string;
  wordCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  // file only
  fileName?: string;
  mimeType?: string;
  format?: FileFormat;
  size?: number;
  status?: "uploading" | "extracting" | "ready" | "failed";
  error?: string | null;
  pageCount?: number | null;
  // text only
  version?: number;
  createdFromDraftId?: string | null;
  reviewCount: number;
}

export type TextDraft = DraftSummary & {
  kind: "text";
  content: unknown | null;
  /** Set (with `content` null) only for a text draft made from a Word file the editor has not saved yet. */
  contentHtml: string | null;
  text: string;
  version: number;
};
export type FileDraft = DraftSummary & {
  kind: "file";
  /** The text found in the file. */
  text: string;
  /** Character ranges of each PDF page inside `text` (and the ranges its layout shows to be table rows); null when not a PDF or the text came from OCR. */
  pages: Array<{ page: number; start: number; end: number; tables?: Array<[number, number]> }> | null;
  /** A Word file's HTML as the server converted it: structure for the word count, and the fallback preview. */
  contentHtml?: string | null;
};
export type DraftDetail = TextDraft | FileDraft;

export type DocumentSummary = GraderDocumentSummary;
/** `drafts` (newest first) and `currentDraftId` (the current text draft; null when the document only has files) are absent on a v1 server. */
export type CourseworkDocument = GraderDocument & { drafts?: DraftSummary[]; currentDraftId?: string | null };
export type ReviewRow = GraderReviewSummary & { draftId?: string | null; draftKind?: DraftKind | null };
export type ResultCriterion = MarkedCriterion | FeedbackCriterion;
export type MarkedOverall = import("./grader").MarkedResult["overall"];

/** Where a running review is, if the worker ever reports it (today it does not: the wait is indeterminate). */
export type ReviewStage = "reading" | "citations" | "criteria" | "checking";
export type Review = GraderReview & { stage?: ReviewStage | null; /** The draft that was reviewed, and whether it was the file as uploaded or text in the editor. */ draftId?: string | null; draftKind?: DraftKind | null };



/** Ultra costs this much more than Pro a month (server ULTRA_PRICE_ABOVE_PRO_USD). */
export const ULTRA_PRICE_ABOVE_PRO_USD = 20;

/** The server's refusal when the plan has no reviews left (COURSEWORK_LIMIT_PREFIX). */
export const COURSEWORK_LIMIT_PREFIX = "Coursework review limit";

export function isCourseworkLimit(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith(COURSEWORK_LIMIT_PREFIX);
}

/** The server has no coursework router (an older deploy): the feature stays hidden. */
export function isMissingEndpoint(err: unknown): boolean {
  if (err instanceof GraderMissing) return true;
  return err instanceof GraderError && (err.status === 404 || /no procedure found|No "(query|mutation)"-procedure/i.test(err.message));
}

/** A save refused because the document changed somewhere else (reload to keep editing). */
export function isConflict(err: unknown): boolean {
  return err instanceof GraderError && (err.code === "CONFLICT" || err.status === 409);
}

/** A criterion with its band descriptors, as the rubric is stored (contract v2 `coursework.rubric`). */
export interface RubricDetailCriterion {
  letter: string;
  name: string;
  maxMarks: number;
  /** Low to high. */
  bands: Array<{ minMarks: number; maxMarks: number; descriptor: string }>;
  /** What examiners look for (paraphrased). */
  lookFor: string[];
  /** Common reasons marks are lost. */
  pitfalls?: string[];
}

export interface RubricDetail {
  id: string;
  guidance?: string | null;
  criteria: RubricDetailCriterion[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  /** It declined to write for the student (not counted against the daily cap). */
  refused: boolean;
  remainingToday: number;
}

/** The server's refusal when today's chat messages are used up, or chat is not in the plan. */
export const COURSEWORK_CHAT_LIMIT_PREFIX = "Coursework chat limit";

/**
 * The typed v1 client (`./grader`) plus the v2 procedures (drafts, files,
 * the full rubric, chat), which are newer than that client and go through
 * `rpc` with the contract's shapes written above.
 */
export const courseworkApi = {
  ...graderApi,
  status: () => graderApi.status() as Promise<GraderStatus>,
  document: (documentId: string) => graderApi.document(documentId) as Promise<CourseworkDocument>,
  review: (reviewId: string) => graderApi.review(reviewId) as Promise<Review>,
  reviews: (input: { documentId?: string; rubricId?: string } = {}) => graderApi.reviews(input) as Promise<ReviewRow[]>,
  requestReview: (input: { documentId: string; draftId?: string; rubricId?: string; mode: ReviewMode; declaredWords?: number }) => graderApi.requestReview(input as Parameters<typeof graderApi.requestReview>[0]),
  draft: (draftId: string) => rpc<DraftDetail>("coursework.draft", "query", { draftId }),
  /** A short-lived (10 min) signed URL of the original file: for the PDF viewer and "Download the original". */
  fileUrl: (draftId: string) => rpc<{ url: string; expiresAt: Date | string }>("coursework.fileUrl", "query", { draftId }),
  saveDraft: (input: { draftId: string; baseVersion: number; content: unknown; title?: string }) => rpc<{ version: number; wordCount: number; updatedAt: Date | string }>("coursework.saveDraft", "mutation", input),
  /** An editable version made from a file draft (or a copy of a text draft). The source draft is never changed. */
  createTextDraft: (input: { documentId: string; fromDraftId?: string }) => rpc<{ draftId: string; number: number }>("coursework.createTextDraft", "mutation", input),
  rubricDetail: (rubricId: string) => rpc<RubricDetail>("coursework.rubric", "query", { rubricId }),
  ask: (input: { documentId: string; draftId?: string; reviewId?: string; message: string; history: ChatTurn[] }) => rpc<ChatReply>("coursework.ask", "mutation", input),
};

/** Files up to 25 MB can be imported (server MAX_UPLOAD_BYTES). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export type ImportFailure = "unreadable" | "too_large" | "unsupported" | "offline" | "failed";

/**
 * Uploads a file and waits for its text to land in the document. Resolves
 * with the document id; rejects with an ImportFailure (`kind`) and, for an
 * unreadable file, the server's words.
 */
export async function importFile(file: File, opts: { documentId?: string; rubricId?: string } = {}, signal?: AbortSignal): Promise<{ documentId: string; draftId: string | null; wordCount: number }> {
  const fail = (kind: ImportFailure, message?: string) => Object.assign(new Error(message ?? kind), { kind });
  if (file.size > MAX_UPLOAD_BYTES) throw fail("too_large");
  if (!/\.(pdf|docx?|txt)$/i.test(file.name)) throw fail("unsupported");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw fail("offline");
  let documentId: string;
  let draftId: string | null = null;
  try {
    const contentType = file.type || "application/octet-stream";
    const up = (await graderApi.importUpload({ ...opts, fileName: file.name, contentType, size: file.size })) as { documentId: string; uploadUrl: string; draftId?: string };
    documentId = up.documentId;
    draftId = up.draftId ?? null;
    const put = await fetch(up.uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file, signal });
    if (!put.ok) throw new Error("upload");
    await rpc("coursework.finishUpload", "mutation", { documentId, ...(draftId ? { draftId } : {}) });
  } catch (err) {
    if (isCourseworkLimit(err)) throw err;
    throw fail("failed");
  }
  // Extraction is a worker job: a few seconds for a PDF or a Word file.
  for (let i = 0; i < 90; i++) {
    if (signal?.aborted) throw fail("failed");
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2000));
    if (draftId) {
      const draft = await courseworkApi.draft(draftId);
      if (draft.status === "ready") return { documentId, draftId, wordCount: draft.wordCount };
      if (draft.status === "failed") throw fail("unreadable", draft.error ?? undefined);
    } else {
      // A v1 server: the document itself carries the import's state.
      const doc = await graderApi.document(documentId);
      if (doc.importStatus === null) return { documentId, draftId: null, wordCount: doc.wordCount };
      if (doc.importStatus === "failed") throw fail("unreadable", doc.importError ?? undefined);
    }
  }
  throw fail("failed");
}
