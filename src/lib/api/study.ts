import {
  studySessionApi,
  mapSession,
  typeToApi,
  statusToApi,
  depthToApi,
  type ApiArtifactKind,
} from "./study-session";
import { normalizeActivityContent } from "./activity-content";
import type {
  ActivityStatus,
  ActivityType,
  ExamBoard,
  PartMarking,
  SessionActivity,
  SessionDepth,
  SessionHighlight,
  SessionNote,
  StudySession,
} from "@/types";

/** Data layer for study sessions (goscribe/server studySession router). */

export async function fetchStudySessions(
  workspaceId: string,
): Promise<StudySession[]> {
  const rows = await studySessionApi.list(workspaceId);
  return rows.map(mapSession);
}

export async function fetchStudySession(
  id: string,
): Promise<StudySession | undefined> {
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
  const row = await studySessionApi.create({
    ...input,
    depth: depthToApi[input.depth],
  });
  return mapSession(row);
}

export async function markWorksheetAnswer(input: {
  activityId: string;
  stepIndex: number;
  partIndex: number;
  answer: string;
}): Promise<PartMarking> {
  const result = await studySessionApi.markWorksheetAnswer(input);
  return {
    points: result.marking.points,
    achievedPoints: result.achievedPoints,
    totalPoints: result.totalPoints,
    correct: result.correct,
  };
}

export async function setActivityStatus(
  activityId: string,
  status: ActivityStatus,
  timeSpentSeconds?: number,
): Promise<void> {
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
  const row = await studySessionApi.addComment(sessionId, content);
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function removeSessionNote(noteId: string): Promise<void> {
  await studySessionApi.removeComment(noteId);
}

export async function addReadingHighlight(input: {
  activityId: string;
  text: string;
  color: string;
  note?: string;
  paragraph?: number;
  startChar?: number;
  endChar?: number;
}): Promise<SessionHighlight> {
  const row = await studySessionApi.addHighlight(input);
  return {
    id: row.id,
    activityId: row.activityId,
    text: row.text,
    color: row.color,
    note: row.note ?? undefined,
    paragraph: row.paragraph,
    startChar: row.startChar,
    endChar: row.endChar,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function updateReadingHighlight(
  highlightId: string,
  input: { note?: string | null; color?: string },
): Promise<void> {
  await studySessionApi.updateHighlight({ highlightId, ...input });
}

export async function removeReadingHighlight(
  highlightId: string,
): Promise<void> {
  await studySessionApi.removeHighlight(highlightId);
}

export interface PlanGenerationEvent {
  sessionId: string;
  error?: string;
}

/**
 * Subscribe to background plan-generation events for a workspace. The server
 * generates session plans on its job queue and emits `study_plan_complete` /
 * `study_plan_error` on the workspace's Pusher channel when done. Returns an
 * unsubscribe function. No-op without Pusher config (callers should also poll
 * while a session is generating).
 */
export function subscribePlanGeneration(
  workspaceId: string,
  onEvent: (event: PlanGenerationEvent) => void,
): () => void {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return () => {};

  let cleanup: (() => void) | undefined;
  let cancelled = false;

  import("pusher-js").then(({ default: Pusher }) => {
    if (cancelled) return;
    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe(`workspace_${workspaceId}`);
    channel.bind("study_plan_complete", onEvent);
    channel.bind("study_plan_error", onEvent);
    cleanup = () => {
      channel.unbind("study_plan_complete", onEvent);
      channel.unbind("study_plan_error", onEvent);
      pusher.unsubscribe(`workspace_${workspaceId}`);
      pusher.disconnect();
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export interface DailyActivityPoint {
  date: string;
  count: number;
}

export async function fetchActivityCalendar(
  days = 180,
): Promise<DailyActivityPoint[]> {
  return studySessionApi.activityCalendar(days);
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
 * Precomputed activities offered when the learner nears the end of a plan —
 * a balanced mix pulled from the workspace's artifact bank.
 */
export async function fetchExtensionActivities(
  workspaceId: string,
  sessionId: string,
  startOrder: number,
): Promise<SessionActivity[]> {
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
    content: normalizeActivityContent(
      activityTypeFromKind[item.kind],
      item.content,
    ),
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
