import { rpc } from "./study-session";
import type { ExamBoard } from "@/types";

/**
 * Client for the server's `course` router (goscribe/server, "Pick your
 * course"): Scribe's own course outlines and the start path into them. Newer
 * than the published @goscribe/server types, so the contracts mirror the
 * router (src/lib/courses/types.ts there).
 */

export type CatalogBoard = Extract<ExamBoard, "IB" | "AP" | "GCSE" | "A_LEVEL">;
export type ProficiencyLevel = "unknown" | "beginner" | "developing" | "secure";

export interface CourseSummary {
  id: string;
  title: string;
  board: CatalogBoard;
  boardName: string;
  subject: string;
  qualification: string;
  levels?: string[];
  unitCount: number;
  topicCount: number;
}

export interface CatalogTopic {
  id: string;
  code: string;
  name: string;
  objectives: string[];
  hlOnly?: boolean;
  higherTierOnly?: boolean;
  bcOnly?: boolean;
  /** IB HL-only or second-year A-level content. */
  advanced?: boolean;
  /** Notes and Quick 5 need a plan or exam pass (only while the server's NOTES_PAID_GATE is on). */
  locked?: boolean;
}

export interface CatalogUnit {
  id: string;
  code: string;
  name: string;
  topics: CatalogTopic[];
}

export interface Course extends Omit<CourseSummary, "unitCount" | "topicCount"> {
  specRef: string;
  unitLabel: string;
  version: number;
  sourceNote: string;
  /** Where codes are partly Scribe's own or less certain (English, like course names). */
  numberingNote?: string;
  units: CatalogUnit[];
}

export interface TopicProgress {
  topicId: string;
  done: boolean;
  attempts: number;
  mastery: number | null;
  level: ProficiencyLevel;
}

export interface ProgressSummary {
  topicsTotal: number;
  topicsDone: number;
  topicsPractised: number;
  mastery: number | null;
}

export interface CourseProgress extends ProgressSummary {
  courseId: string;
  level: string | null;
  /** The subject's stored cover family; not sent by an older server. */
  subjectFamily?: string | null;
  topics: TopicProgress[];
}

export interface CourseSubject {
  workspaceId: string;
  title: string;
  courseId: string;
  courseTitle: string;
  level: string | null;
  /** The subject's stored cover family; not sent by an older server. */
  subjectFamily?: string | null;
  progress: ProgressSummary;
}

export type CourseLevel = "SL" | "HL";

export const coursesApi = {
  list: () => rpc<CourseSummary[]>("course.list", "query", undefined),
  get: (courseId: string) => rpc<Course>("course.get", "query", { courseId }),
  mine: () => rpc<CourseSubject[]>("course.mine", "query", undefined),
  progress: (workspaceId: string) => rpc<CourseProgress>("course.progress", "query", { workspaceId }),
  enroll: (courseId: string, level?: CourseLevel) =>
    rpc<{ workspaceId: string }>("course.enroll", "mutation", { courseId, ...(level ? { level } : {}) }),
  startTopic: (input: { courseId: string; topicId: string; level?: CourseLevel; mode?: "quick5" | "session" }) =>
    rpc<{ workspaceId: string; sessionId: string }>("course.startTopic", "mutation", input),
};
