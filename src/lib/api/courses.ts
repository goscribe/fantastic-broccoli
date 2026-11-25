import { rpc, type StartCheckAnswers, type StartCheckOptions } from "./study-session";
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
  /** When the board sits this course's exams (season only); not sent by an older server. */
  examWindows?: ExamWindow[];
}

/** A board's exam season, months only (goscribe/server lib/courses/types.ts). */
export interface ExamWindow {
  season: "may" | "may_june" | "november";
  startMonth: number;
  endMonth: number;
  label: string;
  /** Only some schools sit this session (IB November). */
  optional?: boolean;
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

/** What a start without a topic ("Start today's session") in a course subject will be on. */
export interface NextCourseSession {
  courseId: string;
  topics: Array<{ id: string; code: string; name: string }>;
  /** "1.2 Competitive markets", or "2 topics · <unit>". */
  title: string;
}

export const coursesApi = {
  list: () => rpc<CourseSummary[]>("course.list", "query", undefined),
  get: (courseId: string) => rpc<Course>("course.get", "query", { courseId }),
  mine: () => rpc<CourseSubject[]>("course.mine", "query", undefined),
  /**
   * Per-topic progress for a subject that follows a course; null when it
   * follows none. Ask only for a subject known (or not yet known not) to
   * follow one: see `courseLookup`. A server before the null answer replies
   * NOT_FOUND instead, which callers treat the same way.
   */
  progress: (workspaceId: string) => rpc<CourseProgress | null>("course.progress", "query", { workspaceId }),
  /**
   * The next topics in the syllabus a topic-less start in this subject plans
   * from; null when the subject follows no course. An older server has no
   * such query: callers treat a failure as null.
   */
  nextSession: (workspaceId: string, durationMinutes: number) =>
    rpc<NextCourseSession | null>("course.nextSession", "query", { workspaceId, durationMinutes }),
  enroll: (courseId: string, level?: CourseLevel) =>
    rpc<{ workspaceId: string }>("course.enroll", "mutation", { courseId, ...(level ? { level } : {}) }),
  /** Before a start on these topics: which still need a confidence, and the course's papers. */
  startCheck: (courseId: string, topicIds: string[]) => rpc<StartCheckOptions>("course.startCheck", "query", { courseId, topicIds }),
  startTopic: (input: { courseId: string; topicId: string; level?: CourseLevel; mode?: "quick5" | "session"; startCheck?: StartCheckAnswers }) =>
    rpc<{ workspaceId: string; sessionId: string }>("course.startTopic", "mutation", input),
  /** One session over several topics of a course, its questions mixed across them (one topic is a Quick 5). */
  startTopics: (input: { courseId: string; topicIds: string[]; level?: CourseLevel; durationMinutes?: number; startCheck?: StartCheckAnswers }) =>
    rpc<{ workspaceId: string; sessionId: string }>("course.startTopics", "mutation", input),
};
