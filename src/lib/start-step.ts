import { applyStudyLength, type StudyLengthInput } from "./study-length";
import { confidenceBand, parseCourseTopics, sessionPath } from "./start-check";
import { quick5Path } from "./quick5-confidence";
import type { SessionDepth } from "../types";

/**
 * The start step: the one short screen before a session is made. It asks
 * only what will change the session about to be written, and says what each
 * answer changes:
 *
 * - what kind of session: practice questions, or "Just study the topic"
 *   (readings with their pictures, no questions);
 * - how long, on a learner's first two sessions;
 * - how confident they are, once per subject (the server says when);
 * - which paper they are preparing for, once per course, and only when the
 *   session will have written questions in a paper's style.
 *
 * Nothing due: there is no screen, and the session starts at once. Skip (or
 * closing it): the session starts as it would have without the screen.
 * Pure (no React, no network), so the rules are tested.
 */

/** "Just study the topic": the server's session mode (goscribe/server src/lib/session-mode.ts). */
export const STUDY_MODE = "study";
export type StartMode = "practice" | typeof STUDY_MODE;

/** A study session is never shorter than this (the server's STUDY_MIN_MINUTES). */
export const STUDY_MIN_MINUTES = 10;

export interface StartOptions {
  askConfidence: boolean;
  askTopicIds: string[];
  papers: { id: string; name: string; blurb: string }[];
  paperId: string | null;
  /** The learner has answered the paper question for this course before. Older servers omit it. */
  paperChosen?: boolean;
}

export interface StartStepAsks {
  /** "How long?": the learner's first two sessions. */
  length: boolean;
  /** "How confident are you?": the server has no fresh rating. */
  confidence: boolean;
  /** "Which paper?": several papers, none chosen yet. Shown only for a full practice session. */
  paper: boolean;
}

/**
 * What the step has to ask. `skipped`: the learner tapped Skip on this
 * lately, so the confidence and paper questions stay quiet (the length is
 * not part of that memory: it is only ever asked twice).
 */
export function startStepAsks(input: { lengthDue: boolean; options: StartOptions | null; skipped: boolean; quickStart: boolean }): StartStepAsks {
  const o = input.skipped ? null : input.options;
  const confidence = !!o?.askConfidence;
  // An older server does not say whether a paper was chosen: it is then asked only alongside the confidence.
  const paperOpen = !!o && o.papers.length > 1 && (o.paperChosen === false || (o.paperChosen === undefined && confidence));
  return { length: input.lengthDue, confidence, paper: paperOpen };
}

/**
 * Whether the screen is shown at all. A paper alone does not open it for a
 * Quick 5: five multiple-choice questions are not written in a paper's style.
 */
export function startStepShown(asks: StartStepAsks, quickStart: boolean): boolean {
  return asks.length || asks.confidence || (asks.paper && !quickStart);
}

/** What the session will be, from what is chosen on the screen so far. */
export type StartKind = "study" | "quick5" | "session";

export function startKind(input: { mode: StartMode; quickStart: boolean; minutes?: number | null }): StartKind {
  if (input.mode === STUDY_MODE) return "study";
  if (!input.quickStart) return "session";
  // A Quick 5 asked for more than ten minutes becomes a full session of that length (applyStudyLength).
  const sized = typeof input.minutes === "number" ? applyStudyLength({ depth: "light", durationMinutes: 5, quickStart: true }, input.minutes) : null;
  return sized && !sized.quickStart ? "session" : "quick5";
}

/** The paper question is shown only where the answer is used: a full practice session. */
export const paperAsked = (asks: StartStepAsks, kind: StartKind) => asks.paper && kind === "session";

/**
 * The i18n key of the line under the confidence slider: what this rating
 * changes in the session about to be written. Each one is true of what the
 * server and planner do with it:
 * - study: where the readings start (basics first, a brief recap, or the harder ideas);
 * - Quick 5: which five of the written questions are shown;
 * - full session: notes first, a recap, or straight to slightly harder questions.
 */
export function confidenceEffectKey(confidence: number, kind: StartKind): string {
  if (kind === "study") return `startStep.study.${confidenceBand(confidence)}`;
  if (kind === "quick5") return `quick5Conf.next.${quick5Path(confidence)}`;
  return `startCheck.next.${sessionPath(confidence)}`;
}

export interface StartStepAnswer {
  mode: StartMode;
  /** Set when "How long?" was asked. */
  minutes?: number;
  /** Set when "How confident?" was asked. */
  confidence?: number;
  /** Set when the paper question was on screen: an id, or null for "Mix". */
  paperId?: string | null;
}

export interface StartAnswers {
  confidence?: number;
  confidenceTopicIds?: string[];
  paperId?: string | null;
}

/** What the start call sends: the server's `startCheck` answers, or undefined when none were given. */
export function startCheckAnswers(answer: StartStepAnswer, options: StartOptions | null): StartAnswers | undefined {
  const out: StartAnswers = {
    ...(typeof answer.confidence === "number" ? { confidence: answer.confidence } : {}),
    ...(typeof answer.confidence === "number" && options?.askTopicIds.length ? { confidenceTopicIds: options.askTopicIds } : {}),
    ...(answer.paperId !== undefined ? { paperId: answer.paperId } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

export interface StartInput extends StudyLengthInput {
  mode?: typeof STUDY_MODE;
  startCheck?: StartAnswers;
}

/**
 * The create input with the screen's answers applied. Study: never a Quick 5,
 * at least ten minutes, and "light" only if they asked for a short one.
 * No answer (Skip, or no screen): the input, untouched.
 */
export function applyStartAnswer<T extends StartInput>(input: T, answer: StartStepAnswer | null, options: StartOptions | null): T {
  if (!answer) return input;
  let out: T = typeof answer.minutes === "number" ? applyStudyLength(input, answer.minutes) : { ...input };
  if (answer.mode === STUDY_MODE) {
    const durationMinutes = Math.max(out.durationMinutes, STUDY_MIN_MINUTES);
    const depth: SessionDepth = input.quickStart && typeof answer.minutes !== "number" ? "moderate" : out.depth;
    out = { ...out, mode: STUDY_MODE, quickStart: false, durationMinutes, depth };
  }
  const startCheck = startCheckAnswers(answer, options);
  return startCheck ? { ...out, startCheck } : out;
}

/** What a study session's "Ready for practice questions?" starts. */
export type PracticeStart =
  | { kind: "topic"; courseId: string; topicId: string }
  | { kind: "topics"; courseId: string; topicIds: string[] }
  | {
      kind: "create";
      input: { workspaceId: string; title: string; description?: string; depth: SessionDepth; durationMinutes: number; examBoard?: string; syllabus?: string; topics?: string; subject?: string; quickStart: false };
    };

/**
 * A practice session on the same topics as the study session just finished:
 * the same catalog topic(s) when it was started from a course, else the same
 * title, topics and length in the same subject. Always a full session with
 * questions (never another reading-only one, never just five questions).
 */
export function practiceStart(session: {
  workspaceId: string;
  title: string;
  description?: string;
  depth: SessionDepth;
  durationMinutes: number;
  courseTopic?: string;
  examBoard?: string;
  syllabus?: string;
  topics?: string;
  subject?: string;
}): PracticeStart {
  const course = parseCourseTopics(session.courseTopic);
  if (course && course.topicIds.length === 1) return { kind: "topic", courseId: course.courseId, topicId: course.topicIds[0] };
  if (course) return { kind: "topics", courseId: course.courseId, topicIds: course.topicIds };
  return {
    kind: "create",
    input: {
      workspaceId: session.workspaceId,
      title: session.title,
      ...(session.description ? { description: session.description } : {}),
      depth: session.depth,
      durationMinutes: session.durationMinutes,
      ...(session.examBoard ? { examBoard: session.examBoard } : {}),
      ...(session.syllabus ? { syllabus: session.syllabus } : {}),
      // Without topics a course subject would move on to its next topics; the title keeps it on this one.
      topics: session.topics || session.title,
      ...(session.subject ? { subject: session.subject } : {}),
      quickStart: false,
    },
  };
}
