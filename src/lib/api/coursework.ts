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
  type GraderRubricVersions,
  type GraderStatus as Status,
  type MarkedCriterion,
  type FeedbackCriterion,
  type ReviewMode,
} from "./grader";
import { rpc } from "./study-session";
import { waitForRead, type ReadStatus } from "../coursework-read";

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
export type RubricVersions = GraderRubricVersions;
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
  /** A component's guide versions and the one this work's headings point to (a draft, or pasted text not saved yet). Reads only; sent as a mutation so pasted text travels in the body. */
  rubricVersions: (input: { rubricId: string; draftId?: string; text?: string }) => rpc<RubricVersions>("coursework.rubricVersions", "mutation", input),
  ask: (input: { documentId: string; draftId?: string; reviewId?: string; message: string; history: ChatTurn[] }) => rpc<ChatReply>("coursework.ask", "mutation", input),
};

/** Files up to 25 MB can be imported (server MAX_UPLOAD_BYTES). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_ACCEPT = ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export type ImportFailure = "unreadable" | "too_large" | "unsupported" | "offline" | "failed";

/** What `finishUpload` / `retryRead` answer. `status` and `draft` are absent on a server that always queues the read. */
export interface ReadState {
  documentId: string;
  draftId?: string;
  importStatus: null | "uploading" | "extracting" | "failed";
  status?: ReadStatus;
  error?: string | null;
  /** The draft as read, when it was read inside the request. */
  draft?: DraftDetail | null;
}

export interface ImportedFile {
  documentId: string;
  draftId: string | null;
  wordCount: number;
  /** The file as read, when the server sent it along (no need to fetch the draft). */
  detail: DraftDetail | null;
}

/** An import that failed: `kind` says how; `draftId` is there when the file is stored and can be read again. */
export type ImportError = Error & { kind: ImportFailure; documentId?: string; draftId?: string };

const importError = (kind: ImportFailure, message?: string, at?: { documentId?: string; draftId?: string | null }): ImportError =>
  Object.assign(new Error(message ?? kind), { kind, ...(at?.documentId ? { documentId: at.documentId } : {}), ...(at?.draftId ? { draftId: at.draftId } : {}) });

/**
 * Waits for a stored upload to be read: at once when the server already read
 * it (`first`), else by asking with the backoff in coursework-read.ts.
 */
export async function awaitRead(at: { documentId: string; draftId: string | null }, first: ReadState | null, opts: { signal?: AbortSignal; startedAt?: number } = {}): Promise<ImportedFile> {
  const { documentId, draftId } = at;
  if (first?.status === "ready" && first.draft) return { documentId, draftId: first.draft.id, wordCount: first.draft.wordCount, detail: first.draft };
  if (first?.status === "failed") throw importError("unreadable", first.error ?? undefined, at);
  const aborted = () => !!opts.signal?.aborted;
  if (draftId) {
    const res = await waitForRead(() => courseworkApi.draft(draftId), { aborted, startedAt: opts.startedAt });
    if (res.outcome === "ready") return { documentId, draftId, wordCount: res.value.wordCount, detail: res.value };
    if (res.outcome === "failed") throw importError("unreadable", res.value.error ?? undefined, at);
    throw importError(res.outcome === "timeout" ? "unreadable" : "failed", undefined, at);
  }
  // A v1 server: the document itself carries the import's state.
  const res = await waitForRead(async () => {
    const doc = await graderApi.document(documentId);
    return { status: (doc.importStatus === null ? "ready" : doc.importStatus) as ReadStatus, doc };
  }, { aborted, startedAt: opts.startedAt });
  if (res.outcome === "ready") return { documentId, draftId: null, wordCount: res.value.doc.wordCount, detail: null };
  if (res.outcome === "failed") throw importError("unreadable", res.value.doc.importError ?? undefined, at);
  throw importError(res.outcome === "timeout" ? "unreadable" : "failed", undefined, at);
}

/**
 * Uploads a file and waits for its text. Most files are read while the
 * upload is being confirmed, so this resolves with that one answer; scans
 * and photos are waited for. Resolves with the document and the draft as
 * read; rejects with an ImportError (`kind`, and for an unreadable file the
 * server's words). `onUploaded` fires when the file is stored and reading
 * starts, with the ids (so the wait can be picked up again after a reload).
 */
export async function importFile(
  file: File,
  opts: { documentId?: string; rubricId?: string; onUploaded?: (at: { documentId: string; draftId: string | null }) => void } = {},
  signal?: AbortSignal,
): Promise<ImportedFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw importError("too_large");
  if (!/\.(pdf|docx?|txt)$/i.test(file.name)) throw importError("unsupported");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw importError("offline");
  let documentId: string;
  let draftId: string | null = null;
  let first: ReadState | null;
  try {
    const contentType = file.type || "application/octet-stream";
    const up = (await graderApi.importUpload({ documentId: opts.documentId, rubricId: opts.rubricId, fileName: file.name, contentType, size: file.size })) as { documentId: string; uploadUrl: string; draftId?: string };
    documentId = up.documentId;
    draftId = up.draftId ?? null;
    const put = await fetch(up.uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: file, signal });
    if (!put.ok) throw new Error("upload");
    opts.onUploaded?.({ documentId, draftId });
    first = await rpc<ReadState>("coursework.finishUpload", "mutation", { documentId, ...(draftId ? { draftId } : {}) });
  } catch (err) {
    if (isCourseworkLimit(err)) throw err;
    throw importError("failed");
  }
  return awaitRead({ documentId, draftId }, first, { signal });
}

/** Reads a stored file again after it failed (the original is kept): same result as importFile. */
export async function readAgain(at: { documentId: string; draftId: string }, signal?: AbortSignal): Promise<ImportedFile> {
  let first: ReadState;
  try {
    first = await rpc<ReadState>("coursework.retryRead", "mutation", { draftId: at.draftId });
  } catch (err) {
    if (isCourseworkLimit(err)) throw err;
    throw importError("failed", undefined, at);
  }
  return awaitRead(at, first, { signal });
}
