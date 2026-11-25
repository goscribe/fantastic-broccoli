"use client";

/**
 * Browser side of the start check. `askTopicsStartCheck` / `askSubjectStartCheck`
 * are awaited right before a session is made: they ask the server whether
 * this learner still has to rate the topics (or the subject), open
 * <StartCheckHost/>'s sheet if so, and return the answers for the start
 * call. They never cancel a start: no question to ask, an old server, being
 * offline, or "Skip" all return undefined and the session starts as before.
 */
import { useSyncExternalStore } from "react";
import { rpc, type PaperChoice, type StartCheckAnswers, type StartCheckOptions } from "@/lib/api/study-session";
import { materialName, skippedRecently } from "@/lib/start-check";

const SKIP_KEY = "scribe.start-check.skipped";

export interface StartCheckRequest {
  id: number;
  /** What the confidence is about ("Water"); empty = "this". */
  what: string;
  /** More than one topic: their names, listed small under the title. */
  topicNames: string[];
  papers: PaperChoice[];
  paperId: string | null;
  resolve: (answer: { confidence: number; paperId?: string | null; focusNote?: string } | null) => void;
}

let pending: StartCheckRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function useStartCheckRequest(): StartCheckRequest | null {
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
export function answerStartCheck(answer: Parameters<StartCheckRequest["resolve"]>[0]): void {
  const p = pending;
  if (!p) return;
  pending = null;
  notify();
  p.resolve(answer);
}

function readSkips(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(SKIP_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** "Skip" was tapped on this check lately (a Quick 5's wait-screen question shares the memory). */
export function startCheckSkipped(key: string): boolean {
  if (typeof window === "undefined") return false;
  return skippedRecently(readSkips()[key], Date.now());
}

export function rememberSkip(key: string): void {
  try {
    const now = Date.now();
    const kept = Object.fromEntries(Object.entries(readSkips()).filter(([, at]) => skippedRecently(at, now)));
    window.localStorage.setItem(SKIP_KEY, JSON.stringify({ ...kept, [key]: now }));
  } catch {
    // Storage blocked: asked again next time.
  }
}

async function ask(input: {
  skipKey: string;
  options: () => Promise<StartCheckOptions>;
  what: string;
  topicNames?: (askTopicIds: string[]) => string[];
}): Promise<StartCheckAnswers | undefined> {
  if (typeof window === "undefined") return undefined;
  if (skippedRecently(readSkips()[input.skipKey], Date.now())) return undefined;
  let options: StartCheckOptions;
  try {
    options = await input.options();
  } catch {
    // An older server, or offline: start without the question.
    return undefined;
  }
  if (!options?.askConfidence) return undefined;
  // One question at a time: a second start while it is open skips the first.
  if (pending) pending.resolve(null);
  const names = input.topicNames?.(options.askTopicIds) ?? [];
  const answer = await new Promise<Parameters<StartCheckRequest["resolve"]>[0]>((resolve) => {
    pending = {
      id: nextId++,
      what: names.length === 1 ? names[0] : input.what,
      topicNames: names.length > 1 ? names : [],
      papers: options.papers ?? [],
      paperId: options.paperId ?? null,
      resolve,
    };
    notify();
  });
  if (!answer) {
    rememberSkip(input.skipKey);
    return undefined;
  }
  return {
    confidence: answer.confidence,
    ...(options.askTopicIds.length ? { confidenceTopicIds: options.askTopicIds } : {}),
    ...(answer.paperId !== undefined ? { paperId: answer.paperId } : {}),
    ...(answer.focusNote ? { focusNote: answer.focusNote } : {}),
  };
}

/** Before `course.startTopic(s)`: asks about the picked topics the learner has not rated. */
export function askTopicsStartCheck(input: { courseId: string; topics: { id: string; name: string }[] }): Promise<StartCheckAnswers | undefined> {
  const ids = input.topics.map((t) => t.id);
  return ask({
    skipKey: `topic:${input.courseId}:${[...ids].sort().join(",")}`,
    options: () => rpc<StartCheckOptions>("course.startCheck", "query", { courseId: input.courseId, topicIds: ids }),
    what: input.topics.length === 1 ? input.topics[0].name : "",
    topicNames: (asked) => input.topics.filter((t) => asked.includes(t.id)).map((t) => t.name),
  });
}

/** Before `studySession.create`: asked the first time a learner studies a subject's own material. */
export function askSubjectStartCheck(input: { workspaceId: string; title: string }): Promise<StartCheckAnswers | undefined> {
  return ask({
    skipKey: `subject:${input.workspaceId}`,
    options: () => rpc<StartCheckOptions>("studySession.startCheck", "query", { workspaceId: input.workspaceId }),
    what: materialName(input.title),
  });
}
