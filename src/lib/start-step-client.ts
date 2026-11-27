"use client";

/**
 * Browser side of the start step (src/lib/start-step.ts): `prepareStart` is
 * awaited right before a session is made. It finds out what is due (the
 * length on a learner's first two sessions; the confidence and the paper
 * from the server), opens <StartStepHost/>'s one sheet when anything is, and
 * returns the create input with the answers applied, so generation starts
 * with them. Nothing due: it returns at once, without a screen.
 *
 * It never cancels a start (some callers have already uploaded files or made
 * the subject): Skip, closing the sheet, an old server or being offline all
 * return the input as it was.
 */
import { useSyncExternalStore } from "react";
import { rpc } from "@/lib/api/study-session";
import { materialName } from "@/lib/start-check";
import { ratedRecently, rememberRated, rememberSkip, startCheckSkipped } from "@/lib/start-check-client";
import { initialStudyMinutes, rememberStudyMinutes, studyLengthDue } from "@/lib/study-length-client";
import { applyStartAnswer, startStepAsks, startStepShown, type StartAnswers, type StartInput, type StartOptions, type StartStepAnswer, type StartStepAsks } from "@/lib/start-step";
import { track } from "@/lib/funnel";

export interface StartStepRequest {
  id: number;
  /** What the confidence is about ("Water"); empty = "this". */
  what: string;
  /** More than one topic: their names, listed small under the question. */
  topicNames: string[];
  asks: StartStepAsks;
  /** The start is a Quick 5 unless they choose otherwise. */
  quickStart: boolean;
  initialMinutes: number;
  papers: StartOptions["papers"];
  paperId: string | null;
  resolve: (answer: StartStepAnswer | null) => void;
}

let pending: StartStepRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useStartStepRequest(): StartStepRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
    () => null,
  );
}

/** Called by the sheet: the answers, or null for Skip / closed. */
export function answerStartStep(answer: StartStepAnswer | null): void {
  const p = pending;
  if (!p) return;
  pending = null;
  notify();
  if (!answer) track("start_check.skipped");
  else if (typeof answer.minutes === "number") rememberStudyMinutes(answer.minutes);
  p.resolve(answer);
}

/** The server's answer is reused for a few minutes, so back-to-back starts do not each wait on it. */
const OPTIONS_TTL_MS = 5 * 60_000;
const optionsCache = new Map<string, { at: number; value: Promise<StartOptions | null> }>();

function loadOptions(key: string, load: () => Promise<StartOptions>): Promise<StartOptions | null> {
  const hit = optionsCache.get(key);
  if (hit && Date.now() - hit.at < OPTIONS_TTL_MS) return hit.value;
  // An older server, or offline: start without the questions.
  const value = load().catch(() => null);
  optionsCache.set(key, { at: Date.now(), value });
  return value;
}

async function ask(input: {
  skipKey: string;
  cacheKey: string;
  options: () => Promise<StartOptions>;
  what: string;
  topicNames?: (askTopicIds: string[]) => string[];
  quickStart: boolean;
  durationMinutes: number;
  /** False where the length is not this start's to ask (one catalog topic is always its usual size). */
  askLength: boolean;
  /** Already rated from this browser (see ratedRecently): the confidence is not asked again. */
  rated?: () => boolean;
}): Promise<{ answer: StartStepAnswer | null; options: StartOptions | null; skipped: boolean }> {
  const none = { answer: null, options: null, skipped: false };
  if (typeof window === "undefined") return none;
  const [lengthDue, loaded] = await Promise.all([input.askLength ? studyLengthDue() : false, loadOptions(input.cacheKey, input.options)]);
  const options = loaded && input.rated?.() ? { ...loaded, askConfidence: false, askTopicIds: [] } : loaded;
  const asks = startStepAsks({ lengthDue, options, skipped: startCheckSkipped(input.skipKey), quickStart: input.quickStart });
  if (!startStepShown(asks, input.quickStart)) return { ...none, options };
  // One screen at a time: a second start while it is open settles the first as skipped.
  if (pending) pending.resolve(null);
  const names = (asks.confidence && options ? input.topicNames?.(options.askTopicIds) : null) ?? [];
  const answer = await new Promise<StartStepAnswer | null>((resolve) => {
    pending = {
      id: nextId++,
      what: names.length === 1 ? names[0] : input.what,
      topicNames: names.length > 1 ? names : [],
      asks,
      quickStart: input.quickStart,
      initialMinutes: initialStudyMinutes(input.durationMinutes),
      papers: options?.papers ?? [],
      paperId: options?.paperId ?? null,
      resolve,
    };
    notify();
  });
  // What the server said is out of date either way: answered, or to be asked again after the quiet week.
  optionsCache.delete(input.cacheKey);
  const skipped = !answer && (asks.confidence || asks.paper);
  if (skipped) rememberSkip(input.skipKey);
  return { answer, options, skipped };
}

/**
 * Before `studySession.create` in a subject. Returns the input with the
 * answers applied (length, "Just study the topic", confidence, paper).
 */
export async function prepareStart<T extends StartInput & { workspaceId: string; title: string }>(input: T): Promise<T> {
  const { answer, options } = await ask({
    skipKey: `subject:${input.workspaceId}`,
    cacheKey: `subject:${input.workspaceId}`,
    options: () => rpc<StartOptions>("studySession.startCheck", "query", { workspaceId: input.workspaceId }),
    what: materialName(input.title),
    quickStart: !!input.quickStart,
    durationMinutes: input.durationMinutes,
    askLength: true,
  });
  return applyStartAnswer(input, answer, options);
}

export interface TopicStart {
  mode?: "study";
  startCheck?: StartAnswers;
  /** Their own answer to "how long?" (several topics only). */
  durationMinutes?: number;
  /**
   * Call with the subject the start returned: a Skip here also quiets the
   * same question on that subject's wait screen.
   */
  started: (workspaceId: string) => void;
}

/**
 * Before `course.startTopic(s)`. The confidence is asked once per course from
 * here (the server remembers each answer for the topics and the subject).
 */
export async function prepareTopicStart(input: {
  courseId: string;
  topics: { id: string; name: string }[];
  quickStart: boolean;
  durationMinutes: number;
  askLength: boolean;
}): Promise<TopicStart> {
  const ids = input.topics.map((t) => t.id);
  const skipKey = `course:${input.courseId}`;
  const base = { depth: "moderate" as const, durationMinutes: input.durationMinutes, quickStart: input.quickStart };
  const { answer, options, skipped } = await ask({
    skipKey,
    cacheKey: `course:${input.courseId}:${[...ids].sort().join(",")}`,
    options: () => rpc<StartOptions>("course.startCheck", "query", { courseId: input.courseId, topicIds: ids }),
    what: input.topics.length === 1 ? input.topics[0].name : "",
    topicNames: (asked) => input.topics.filter((t) => asked.includes(t.id)).map((t) => t.name),
    quickStart: input.quickStart,
    durationMinutes: input.durationMinutes,
    askLength: input.askLength,
    rated: () => ratedRecently(skipKey),
  });
  const out = applyStartAnswer<StartInput>(base, answer, options);
  // Rated from here: not asked again on this course's other topics (the server keeps the rating for the subject).
  if (typeof answer?.confidence === "number") rememberRated(skipKey);
  return {
    ...(out.mode ? { mode: out.mode } : {}),
    ...(out.startCheck ? { startCheck: out.startCheck } : {}),
    ...(typeof answer?.minutes === "number" ? { durationMinutes: out.durationMinutes } : {}),
    started: (workspaceId) => {
      if (skipped) rememberSkip(`subject:${workspaceId}`);
    },
  };
}
