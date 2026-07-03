import { isLiveApi } from "./config";
import {
  studySessionApi,
  mapSession,
  typeToApi,
  statusToApi,
  depthToApi,
  type ApiArtifactKind,
} from "./study-session";
import {
  getSession,
  getWorkspace,
  planExtensionActivities,
} from "@/lib/mock-data";
import type {
  ActivityContent,
  ActivityStatus,
  ActivityType,
  ExamBoard,
  SessionActivity,
  SessionDepth,
  SessionNote,
  StudySession,
} from "@/types";

/**
 * Data layer for study sessions. Talks to goscribe/server when
 * NEXT_PUBLIC_API_URL is configured; otherwise serves the demo mock data so
 * the prototype runs standalone.
 */

export async function fetchStudySessions(
  workspaceId: string,
): Promise<StudySession[]> {
  if (!isLiveApi) return getWorkspace(workspaceId)?.sessions ?? [];
  const rows = await studySessionApi.list(workspaceId);
  return rows.map(mapSession);
}

export async function fetchStudySession(
  id: string,
): Promise<StudySession | undefined> {
  if (!isLiveApi) return getSession(id);
  return mapSession(await studySessionApi.get(id));
}

export interface CreateSessionInput {
  workspaceId: string;
  title: string;
  description?: string;
  depth: SessionDepth;
  durationMinutes: number;
  examBoard?: ExamBoard;
  syllabus?: string;
  topics?: string;
}

export async function createStudySession(
  input: CreateSessionInput,
): Promise<StudySession | undefined> {
  if (!isLiveApi) {
    // Demo mode: sessions aren't persisted; land on the sample session.
    return getWorkspace(input.workspaceId)?.sessions[0];
  }
  const row = await studySessionApi.create({
    ...input,
    depth: depthToApi[input.depth],
  });
  return mapSession(row);
}

export async function setActivityStatus(
  activityId: string,
  status: ActivityStatus,
  timeSpentSeconds?: number,
): Promise<void> {
  if (!isLiveApi) return;
  await studySessionApi.updateActivityStatus(
    activityId,
    statusToApi[status],
    timeSpentSeconds,
  );
}

export async function addSessionNote(
  sessionId: string,
  content: string,
): Promise<SessionNote> {
  if (!isLiveApi) {
    // Demo mode: notes live in component state only.
    return {
      id: `note-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
    };
  }
  const row = await studySessionApi.addComment(sessionId, content);
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function removeSessionNote(noteId: string): Promise<void> {
  if (!isLiveApi) return;
  await studySessionApi.removeComment(noteId);
}

const activityTypeFromKind: Record<ApiArtifactKind, ActivityType> = {
  WORKSHEET: "worksheet",
  MCQ_POOL: "mcq",
  FLASHCARD_DECK: "flashcard_review",
  VOCAB_DECK: "vocab_recall",
  CLOZE_PASSAGE: "cloze",
  READING_CHUNK: "reading",
  FIGURE: "reading",
};

/**
 * Precomputed activities offered when the learner nears the end of a plan.
 * Live mode pulls a balanced mix from the workspace's artifact bank
 * (studySession.pullFromBank); demo mode serves the sample extension set.
 */
export async function fetchExtensionActivities(
  workspaceId: string,
  sessionId: string,
  startOrder: number,
): Promise<SessionActivity[]> {
  if (!isLiveApi) {
    return planExtensionActivities.filter((a) => a.sessionId === sessionId);
  }
  const items = await studySessionApi.pullFromBank({
    workspaceId,
    count: 3,
    kinds: ["WORKSHEET", "MCQ_POOL", "CLOZE_PASSAGE"],
  });
  return items.map((item, i) => ({
    id: `bank-${item.id}`,
    sessionId,
    type: activityTypeFromKind[item.kind],
    title: item.title,
    description: item.topic ?? undefined,
    content: item.content as unknown as ActivityContent,
    order: startOrder + i,
    status: "pending" as const,
    estimatedMinutes: 8,
  }));
}

/** Appends precomputed activities (e.g. from the worksheet bank) to a plan. */
export async function appendActivities(
  sessionId: string,
  activities: SessionActivity[],
): Promise<void> {
  if (!isLiveApi) return;
  await studySessionApi.addActivities(
    sessionId,
    activities.map((a) => ({
      type: typeToApi[a.type],
      title: a.title,
      description: a.description,
      content: a.content as unknown as Record<string, unknown>,
      order: a.order,
      estimatedMinutes: a.estimatedMinutes,
    })),
  );
}
