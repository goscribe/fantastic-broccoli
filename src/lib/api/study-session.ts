import superjson from "superjson";
import { apiUrl } from "./config";
import { normalizeActivityContent } from "./activity-content";
import type {
  ActivityStatus,
  ActivityType,
  ExamBoard,
  SessionActivity,
  SessionDepth,
  StudySession,
} from "@/types";

/**
 * Typed client for the server's `studySession` tRPC router (goscribe/server#5).
 *
 * The router is newer than the published @goscribe/server package, so its
 * types can't be inferred yet — the contracts below mirror the router's zod
 * schemas and Prisma models 1:1. Once a server version including the router
 * is published, replace this with the inferred client in trpc-client.ts.
 */

// ---------- wire types (server enums are SCREAMING_SNAKE) ----------

export type ApiSessionDepth = "LIGHT" | "MODERATE" | "DEEP";
export type ApiSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
export type ApiActivityStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";
export type ApiActivityType =
  | "MCQ"
  | "COMPREHENSION_CHECK"
  | "FLASHCARD_REVIEW"
  | "READING"
  | "WORKSHEET"
  | "INTERACTIVE"
  | "VOCAB_RECALL"
  | "CLOZE"
  | "EXPLAIN_ALOUD";

export interface ApiPartMarking {
  marking: {
    points: Array<{
      point: number;
      requirements: string;
      achievedPoints: number;
      feedback: string;
    }>;
    totalPoints: number;
  };
  achievedPoints: number;
  totalPoints: number;
  correct: boolean;
}

export interface ApiSessionActivity {
  id: string;
  sessionId: string;
  type: ApiActivityType;
  title: string;
  description: string | null;
  content: Record<string, unknown>;
  order: number;
  status: ApiActivityStatus;
  estimatedMinutes: number;
  timeSpentSeconds: number | null;
  meta?: { draft?: Record<string, unknown> } | null;
  highlights?: ApiReadingHighlight[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiReadingHighlight {
  id: string;
  activityId: string;
  text: string;
  color: string;
  note: string | null;
  paragraph: number;
  startChar: number;
  endChar: number;
  createdAt: Date;
}

export interface ApiSessionComment {
  id: string;
  sessionId: string;
  content: string;
  createdAt: Date;
}

export interface ApiStudySession {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  description: string | null;
  depth: ApiSessionDepth;
  durationMinutes: number;
  status: ApiSessionStatus;
  progress: number;
  generating?: boolean;
  examBoard: ExamBoard | null;
  syllabus: string | null;
  topics: string | null;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  activities: ApiSessionActivity[];
  comments: ApiSessionComment[];
}

export interface CreateStudySessionInput {
  workspaceId: string;
  title: string;
  description?: string;
  depth?: ApiSessionDepth;
  durationMinutes?: number;
  examBoard?: ExamBoard;
  syllabus?: string;
  topics?: string;
  subject?: string;
  endDate?: Date;
}

export interface AddActivityInput {
  type: ApiActivityType;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  order: number;
  estimatedMinutes: number;
}

// ---------- transport (tRPC HTTP protocol + superjson) ----------

interface TrpcEnvelope {
  result?: { data: { json: unknown; meta?: unknown } };
  // Error payload may be superjson-wrapped ({ json: { message } }) or plain.
  error?: { message?: string; json?: { message?: string } };
}

export async function rpc<T>(
  path: string,
  kind: "query" | "mutation",
  input: unknown,
): Promise<T> {
  const serialized = superjson.serialize(input);
  const base = `${apiUrl}/trpc/${path}`;
  const res =
    kind === "query"
      ? await fetch(`${base}?input=${encodeURIComponent(JSON.stringify(serialized))}`, {
          credentials: "include",
        })
      : await fetch(base, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(serialized),
        });

  const body = (await res.json()) as TrpcEnvelope;
  if (!res.ok || body.error || !body.result) {
    throw new Error(
      body.error?.json?.message ??
        body.error?.message ??
        `${path} failed (${res.status})`,
    );
  }
  return superjson.deserialize(
    body.result.data as Parameters<typeof superjson.deserialize>[0],
  ) as T;
}

export interface ApiWarmupQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string | null;
  unseen: boolean;
}

// ---------- procedures ----------

export const studySessionApi = {
  list: (workspaceId: string) =>
    rpc<ApiStudySession[]>("studySession.list", "query", { workspaceId }),

  get: (id: string) => rpc<ApiStudySession>("studySession.get", "query", { id }),

  create: (input: CreateStudySessionInput) =>
    rpc<ApiStudySession>("studySession.create", "mutation", input),

  getWarmupQuiz: (workspaceId: string) =>
    rpc<ApiWarmupQuestion[]>("studySession.getWarmupQuiz", "query", {
      workspaceId,
    }),

  updateStatus: (id: string, status: ApiSessionStatus) =>
    rpc<ApiStudySession>("studySession.updateStatus", "mutation", { id, status }),

  remove: (id: string) =>
    rpc<ApiStudySession>("studySession.remove", "mutation", { id }),

  retryGeneration: (id: string) =>
    rpc<ApiStudySession>("studySession.retryGeneration", "mutation", { id }),

  addComment: (sessionId: string, content: string) =>
    rpc<ApiSessionComment>("studySession.addComment", "mutation", {
      sessionId,
      content,
    }),

  removeComment: (commentId: string) =>
    rpc<ApiSessionComment>("studySession.removeComment", "mutation", {
      commentId,
    }),

  updateActivityStatus: (
    activityId: string,
    status: ApiActivityStatus,
    timeSpentSeconds?: number,
  ) =>
    rpc<ApiSessionActivity>("studySession.updateActivityStatus", "mutation", {
      activityId,
      status,
      timeSpentSeconds,
    }),

  saveActivityDraft: (activityId: string, draft: Record<string, unknown>) =>
    rpc<ApiSessionActivity>("studySession.saveActivityDraft", "mutation", {
      activityId,
      draft,
    }),

  markWorksheetAnswer: (input: {
    activityId: string;
    stepIndex: number;
    partIndex: number;
    answer: string;
    answerImage?: string;
  }) =>
    rpc<ApiPartMarking>("studySession.markWorksheetAnswer", "mutation", input),

  markClozeAnswers: (input: {
    activityId: string;
    passageIndex: number;
    answers: string[];
  }) =>
    rpc<{ results: Array<{ correct: boolean; feedback: string }> }>(
      "studySession.markClozeAnswers",
      "mutation",
      input,
    ),

  submitComprehensionRewrite: (input: {
    activityId: string;
    rewrite: string;
  }) =>
    rpc<{
      evaluation: {
        attempt: number;
        score: number;
        feedback: string;
        passed: boolean;
      };
      content: Record<string, unknown>;
    }>("studySession.submitComprehensionRewrite", "mutation", input),

  addActivities: (sessionId: string, activities: AddActivityInput[]) =>
    rpc<{ count: number }>("studySession.addActivities", "mutation", {
      sessionId,
      activities,
    }),

  addHighlight: (input: {
    activityId: string;
    text: string;
    color: string;
    note?: string;
    paragraph?: number;
    startChar?: number;
    endChar?: number;
  }) => rpc<ApiReadingHighlight>("studySession.addHighlight", "mutation", input),

  updateHighlight: (input: {
    highlightId: string;
    note?: string | null;
    color?: string;
  }) =>
    rpc<ApiReadingHighlight>("studySession.updateHighlight", "mutation", input),

  removeHighlight: (highlightId: string) =>
    rpc<ApiReadingHighlight>("studySession.removeHighlight", "mutation", {
      highlightId,
    }),

  activityCalendar: (days: number) =>
    rpc<{ date: string; count: number }[]>(
      "studySession.activityCalendar",
      "query",
      { days },
    ),

  pullFromBank: (input: {
    workspaceId: string;
    count: number;
    topic?: string;
    kinds?: ApiArtifactKind[];
  }) => rpc<ApiArtifactBankItem[]>("studySession.pullFromBank", "mutation", input),

  listBank: (input: { workspaceId: string; kind?: ApiArtifactKind }) =>
    rpc<ApiArtifactBankItem[]>("studySession.listBank", "query", input),

  updateBankItem: (input: {
    workspaceId: string;
    id: string;
    title?: string;
    topic?: string | null;
    syllabusRef?: string | null;
    difficulty?: number;
    content?: Record<string, unknown>;
  }) => rpc<ApiArtifactBankItem>("studySession.updateBankItem", "mutation", input),

  deleteBankItem: (input: { workspaceId: string; id: string }) =>
    rpc<{ deleted: boolean }>("studySession.deleteBankItem", "mutation", input),

  generateBank: (input: {
    workspaceId: string;
    fileIds?: string[];
    visibility?: ApiArtifactVisibility;
  }) => rpc<{ started: boolean }>("studySession.generateBank", "mutation", input),

  setBankVisibility: (input: {
    workspaceId: string;
    ids: string[];
    visibility: ApiArtifactVisibility;
  }) =>
    rpc<{ updated: number }>("studySession.setBankVisibility", "mutation", input),
};

export type ApiArtifactVisibility = "workspace" | "private" | "public";

export interface ApiArtifactFinderResult {
  id: string;
  workspaceId: string;
  workspaceTitle: string;
  title: string;
  type: string;
  kind: ApiArtifactKind | null;
  topic: string | null;
  snippet: string;
  reason: string;
  source: "mine" | "community";
}

/** RAG + LLM search across the user's artifacts. Costs 1 token per search. */
export function findArtifacts(query: string) {
  return rpc<ApiArtifactFinderResult[]>("workspace.findArtifacts", "mutation", {
    query,
  });
}

export interface ApiMarketplaceArtifact {
  id: string;
  workspaceId: string;
  workspaceTitle: string;
  title: string;
  type: string;
  kind: ApiArtifactKind | null;
  topic: string | null;
  content: Record<string, unknown> | null;
  visibility: ApiArtifactVisibility;
  createdAt: string;
  source: "mine" | "community";
}

/** Recent artifacts for the marketplace browse grid (own + public). Free. */
export function marketplaceArtifacts(limit?: number) {
  return rpc<ApiMarketplaceArtifact[]>("workspace.marketplaceArtifacts", "query", {
    limit,
  });
}

export interface ApiExportArtifact {
  id: string;
  workspaceId: string;
  workspaceTitle: string;
  title: string;
  type: string;
  kind: ApiArtifactKind | null;
  topic: string | null;
  content: Record<string, unknown> | null;
}

/** Full content for selected artifacts (multi-select export). */
export function getArtifactsForExport(ids: string[]) {
  return rpc<ApiExportArtifact[]>("workspace.getArtifactsForExport", "query", {
    ids,
  });
}

export interface ExportDoc {
  title: string;
  themeId: string;
  sections: { heading: string; body: string }[];
}

/** AI edit/restyle of the export editor document. Costs 4 tokens. */
export function assistExport(input: {
  instruction: string;
  doc: ExportDoc;
  themeIds: string[];
}) {
  return rpc<ExportDoc & { note: string }>(
    "workspace.assistExport",
    "mutation",
    input,
  );
}

/**
 * Best-effort draft save during page unload — `keepalive` lets the request
 * outlive the document. Browsers cap keepalive bodies at ~64KB, so oversized
 * drafts (e.g. with drawings) are skipped; the debounced save covers those.
 */
export function saveActivityDraftKeepalive(
  activityId: string,
  draft: Record<string, unknown>,
) {
  const body = JSON.stringify(superjson.serialize({ activityId, draft }));
  if (body.length > 60_000) return;
  fetch(`${apiUrl}/trpc/studySession.saveActivityDraft`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// ---------- artifact progress (session activities backed by pools) ----------

/** Records an SRS study attempt against a pooled `Flashcard` row. */
export const recordFlashcardAttempt = (input: {
  flashcardId: string;
  isCorrect: boolean;
  timeSpentMs?: number;
  studySessionId?: string;
}) => rpc<unknown>("flashcards.recordStudyAttempt", "mutation", input);

export interface DeckCardProgress {
  flashcardId: string;
  progress: {
    timesStudied: number;
    masteryLevel: number;
    nextReviewAt: string | Date | null;
  } | null;
}

export interface DueReviewCard {
  flashcardId: string;
  front: string;
  back: string;
  deckId: string;
  deckTitle: string;
  workspaceId: string | null;
  progress: {
    timesStudied: number;
    masteryLevel: number;
    nextReviewAt: string | Date | null;
  };
}

/** Cards due for spaced review across all the user's workspaces. */
export const fetchDueReview = () =>
  rpc<{ total: number; cards: DueReviewCard[] }>(
    "flashcards.getDueReview",
    "query",
    {},
  );

/** Per-card SRS progress for a flashcard deck artifact. */
export const fetchDeckProgress = (artifactId: string) =>
  rpc<DeckCardProgress[]>("flashcards.getSetProgress", "query", {
    artifactId,
  });

/** AI-grades a typed answer against a pooled `Flashcard` row. */
export const gradeFlashcardTypedAnswer = (input: {
  flashcardId: string;
  userAnswer: string;
}) =>
  rpc<{ isCorrect: boolean; reason: string }>(
    "flashcards.gradeTypedAnswer",
    "mutation",
    input,
  );

/** Records a batch of SRS study attempts (one full study round). */
export const recordFlashcardStudySession = (input: {
  attempts: { flashcardId: string; isCorrect: boolean; timeSpentMs?: number }[];
}) => rpc<unknown>("flashcards.recordStudySession", "mutation", input);

export interface MasteryMatrixRow {
  topic: string;
  /** 0-100, or null when the topic has never been studied. */
  proficiency: number | null;
  /** Graded items (flashcards + worksheet questions) under this topic. */
  cardsTotal: number;
  cardsStudied: number;
  attempts: number;
}

/** Per-topic proficiency matrix for a workspace, weakest first. */
export const fetchMasteryMatrix = (workspaceId: string) =>
  rpc<MasteryMatrixRow[]>("flashcards.getMasteryMatrix", "query", {
    workspaceId,
  });

/** Records answer/correctness progress against a pooled `WorksheetQuestion`. */
export const recordWorksheetQuestionProgress = (input: {
  problemId: string;
  completed: boolean;
  answer?: string;
  correct?: boolean;
}) => rpc<unknown>("worksheets.updateProblemStatus", "mutation", input);

// ---------- artifact bank (precomputed content pulled into plans) ----------

export type ApiArtifactKind =
  | "WORKSHEET"
  | "MCQ_POOL"
  | "FLASHCARD_DECK"
  | "VOCAB_DECK"
  | "CLOZE_PASSAGE"
  | "READING_CHUNK"
  | "FIGURE";

export interface ApiArtifactBankItem {
  id: string;
  workspaceId: string;
  fileId: string | null;
  kind: ApiArtifactKind;
  title: string;
  topic: string | null;
  syllabusRef: string | null;
  difficulty: number;
  content: Record<string, unknown>;
  usedCount: number;
  visibility?: ApiArtifactVisibility;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- mappers (wire enums <-> frontend camel/lower types) ----------

const typeFromApi: Record<ApiActivityType, ActivityType> = {
  MCQ: "mcq",
  COMPREHENSION_CHECK: "comprehension_check",
  FLASHCARD_REVIEW: "flashcard_review",
  READING: "reading",
  WORKSHEET: "worksheet",
  INTERACTIVE: "interactive",
  VOCAB_RECALL: "vocab_recall",
  CLOZE: "cloze",
  EXPLAIN_ALOUD: "explain_aloud",
};

export const typeToApi = Object.fromEntries(
  Object.entries(typeFromApi).map(([k, v]) => [v, k]),
) as Record<ActivityType, ApiActivityType>;

const statusFromApi: Record<ApiActivityStatus, ActivityStatus> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  SKIPPED: "skipped",
};

export const statusToApi = Object.fromEntries(
  Object.entries(statusFromApi).map(([k, v]) => [v, k]),
) as Record<ActivityStatus, ApiActivityStatus>;

const depthFromApi: Record<ApiSessionDepth, SessionDepth> = {
  LIGHT: "light",
  MODERATE: "moderate",
  DEEP: "deep",
};

export const depthToApi = Object.fromEntries(
  Object.entries(depthFromApi).map(([k, v]) => [v, k]),
) as Record<SessionDepth, ApiSessionDepth>;

export function mapActivity(a: ApiSessionActivity): SessionActivity {
  return {
    id: a.id,
    sessionId: a.sessionId,
    type: typeFromApi[a.type],
    title: a.title,
    description: a.description ?? undefined,
    content: normalizeActivityContent(typeFromApi[a.type], a.content),
    order: a.order,
    status: statusFromApi[a.status],
    estimatedMinutes: a.estimatedMinutes,
    timeSpentSeconds: a.timeSpentSeconds ?? undefined,
    draft: a.meta?.draft,
    highlights: (a.highlights ?? []).map((h) => ({
      id: h.id,
      activityId: h.activityId,
      text: h.text,
      color: h.color,
      note: h.note ?? undefined,
      paragraph: h.paragraph,
      startChar: h.startChar,
      endChar: h.endChar,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export function mapSession(s: ApiStudySession): StudySession {
  return {
    id: s.id,
    workspaceId: s.workspaceId,
    title: s.title,
    description: s.description ?? undefined,
    depth: depthFromApi[s.depth],
    durationMinutes: s.durationMinutes,
    comments: (s.comments ?? []).map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    })),
    activities: (s.activities ?? []).map(mapActivity),
    progress: s.progress,
    generating: s.generating ?? false,
    status: s.status.toLowerCase() as StudySession["status"],
    startDate: s.startDate.toISOString(),
    endDate: s.endDate?.toISOString(),
    examBoard: s.examBoard ?? undefined,
    syllabus: s.syllabus ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
