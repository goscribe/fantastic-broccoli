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
  importFile as startImport,
  type GraderDocument,
  type GraderDocumentSummary,
  type GraderGuide,
  type GraderReview,
  type GraderReviewSummary,
  type GraderRubric,
  type GraderStatus as Status,
  type MarkedCriterion,
  type FeedbackCriterion,
} from "./grader";
import { rpc } from "./study-session";

export type {
  CitationsResult,
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

/**
 * `chat` is not in the server's status yet: when the server adds
 * `coursework.ask` it should send `chat: true` here, and the Chat tab appears.
 */
export type GraderStatus = Status & { chat?: boolean };
export type GraderPlanTier = Status["tier"];
/** The allowance part of the status (server limits.ts ReviewAllowance). */
export type ReviewAllowance = Pick<Status, "tier" | "allowed" | "limit" | "usedToday" | "remainingToday" | "reason" | "resetsAt">;
export type RubricSummary = GraderRubric;
export type RubricCriterion = GraderRubric["criteria"][number];
/** A rubric without its criteria: what a review carries. */
export type RubricInfo = GraderReview["rubric"];
export type GuideResponse = GraderGuide;
export type CourseworkGuide = NonNullable<GraderGuide["guide"]>;
export type DocumentSummary = GraderDocumentSummary;
export type CourseworkDocument = GraderDocument;
export type ReviewRow = GraderReviewSummary;
export type ResultCriterion = MarkedCriterion | FeedbackCriterion;
export type MarkedOverall = import("./grader").MarkedResult["overall"];

/** Where a running review is, if the worker ever reports it (today it does not: the wait is indeterminate). */
export type ReviewStage = "reading" | "citations" | "criteria" | "checking";
export type Review = GraderReview & { stage?: ReviewStage | null };

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

/** A criterion with its band descriptors, as the rubric is stored (server CourseworkCriterion). */
export interface RubricDetailCriterion {
  letter: string;
  name: string;
  maxMarks: number;
  /** Low to high. */
  bands: Array<{ minMarks: number; maxMarks: number; descriptor: string }>;
  /** What examiners look for (paraphrased). */
  lookFor: string[];
}

export interface RubricDetail {
  rubricId: string;
  criteria: RubricDetailCriterion[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Two procedures the server does NOT have yet (the UI is built against mocks
 * of them and degrades without them):
 * - `coursework.rubric({ rubricId })` → RubricDetail. `rubrics` only sends
 *   letter / name / maxMarks; the Rubric tab wants each criterion's bands
 *   and lookFor from CourseworkCriterion. Without it the tab lists the
 *   criteria and their marks.
 * - `coursework.ask({ documentId, reviewId?, message, history })` → `{ answer }`:
 *   the copilot with this document's text and this review as its context,
 *   under the hints-only guard (explain and advise; never write or rewrite the
 *   student's text). `copilot.ask` cannot be used as it is: its context needs a
 *   workspaceId, and a coursework document may belong to no subject.
 */
export const courseworkApi = {
  ...graderApi,
  status: () => graderApi.status() as Promise<GraderStatus>,
  review: (reviewId: string) => graderApi.review(reviewId) as Promise<Review>,
  rubricDetail: (rubricId: string) => rpc<RubricDetail>("coursework.rubric", "query", { rubricId }),
  ask: (input: { documentId: string; reviewId?: string; message: string; history: ChatTurn[] }) => rpc<{ answer: string }>("coursework.ask", "mutation", input),
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
export async function importFile(file: File, opts: { documentId?: string; rubricId?: string } = {}, signal?: AbortSignal): Promise<string> {
  const fail = (kind: ImportFailure, message?: string) => Object.assign(new Error(message ?? kind), { kind });
  if (file.size > MAX_UPLOAD_BYTES) throw fail("too_large");
  if (!/\.(pdf|docx?|txt)$/i.test(file.name)) throw fail("unsupported");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw fail("offline");
  let id: string;
  try {
    id = (await startImport(file, opts)).documentId;
  } catch (err) {
    if (isCourseworkLimit(err)) throw err;
    throw fail("failed");
  }
  // Extraction is a worker job: a few seconds for a PDF or a Word file.
  for (let i = 0; i < 90; i++) {
    if (signal?.aborted) throw fail("failed");
    await new Promise((r) => setTimeout(r, i < 5 ? 1000 : 2000));
    const doc = await graderApi.document(id);
    if (doc.importStatus === null) return id;
    if (doc.importStatus === "failed") throw fail("unreadable", doc.importError ?? undefined);
  }
  throw fail("failed");
}
