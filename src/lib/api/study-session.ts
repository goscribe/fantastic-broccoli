import superjson from "superjson";
import { apiUrl } from "./config";
import type {
  ActivityContent,
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
export type ApiSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED";
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
  createdAt: Date;
  updatedAt: Date;
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
  error?: { message?: string };
}

async function rpc<T>(
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
    throw new Error(body.error?.message ?? `${path} failed (${res.status})`);
  }
  return superjson.deserialize(
    body.result.data as Parameters<typeof superjson.deserialize>[0],
  ) as T;
}

// ---------- procedures ----------

export const studySessionApi = {
  list: (workspaceId: string) =>
    rpc<ApiStudySession[]>("studySession.list", "query", { workspaceId }),

  get: (id: string) => rpc<ApiStudySession>("studySession.get", "query", { id }),

  create: (input: CreateStudySessionInput) =>
    rpc<ApiStudySession>("studySession.create", "mutation", input),

  updateStatus: (id: string, status: ApiSessionStatus) =>
    rpc<ApiStudySession>("studySession.updateStatus", "mutation", { id, status }),

  remove: (id: string) =>
    rpc<ApiStudySession>("studySession.remove", "mutation", { id }),

  addComment: (sessionId: string, content: string) =>
    rpc<ApiSessionComment>("studySession.addComment", "mutation", {
      sessionId,
      content,
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

  addActivities: (sessionId: string, activities: AddActivityInput[]) =>
    rpc<{ count: number }>("studySession.addActivities", "mutation", {
      sessionId,
      activities,
    }),
};

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
    content: a.content as unknown as ActivityContent,
    order: a.order,
    status: statusFromApi[a.status],
    estimatedMinutes: a.estimatedMinutes,
    timeSpentSeconds: a.timeSpentSeconds ?? undefined,
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
    comments: (s.comments ?? []).map((c) => c.content),
    activities: (s.activities ?? []).map(mapActivity),
    progress: s.progress,
    status: s.status.toLowerCase() as StudySession["status"],
    startDate: s.startDate.toISOString(),
    endDate: s.endDate?.toISOString(),
    examBoard: s.examBoard ?? undefined,
    syllabus: s.syllabus ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
