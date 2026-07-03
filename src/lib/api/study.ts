import { isLiveApi } from "./config";
import {
  studySessionApi,
  mapSession,
  typeToApi,
  statusToApi,
  depthToApi,
} from "./study-session";
import { getSession, getWorkspace } from "@/lib/mock-data";
import type {
  ActivityStatus,
  ExamBoard,
  SessionActivity,
  SessionDepth,
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

export async function addSessionComment(
  sessionId: string,
  content: string,
): Promise<void> {
  if (!isLiveApi) return;
  await studySessionApi.addComment(sessionId, content);
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
