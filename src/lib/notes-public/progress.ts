/**
 * Anonymous practice progress on the public note pages, kept in localStorage
 * (no account, nothing sent to the server): which option was chosen for each
 * question per topic, and whether the signup prompt was dismissed. Pure
 * reducers plus a tiny guarded storage wrapper, so it is tested.
 */

export const PROGRESS_KEY = "scribe.notesPractice.v1";
/** Answers on a page before the soft signup prompt appears. */
export const PROMPT_AFTER = 5;
/** A dismissed prompt stays away this long. */
export const PROMPT_SNOOZE_MS = 7 * 24 * 3600 * 1000;

export interface TopicProgress {
  /** question id → chosen option index */
  answers: Record<string, number>;
  /** question id → answered correctly */
  correct: Record<string, boolean>;
  updatedAt: number;
}

export interface PracticeProgress {
  v: 1;
  topics: Record<string, TopicProgress>;
  promptDismissedAt: number | null;
}

export const emptyProgress = (): PracticeProgress => ({ v: 1, topics: {}, promptDismissedAt: null });
export const topicKey = (courseId: string, topicId: string) => `${courseId}/${topicId}`;

/** Parses stored JSON defensively; anything odd starts afresh. */
export function parseProgress(raw: string | null | undefined): PracticeProgress {
  if (!raw) return emptyProgress();
  try {
    const p = JSON.parse(raw) as Partial<PracticeProgress>;
    if (p?.v !== 1 || !p.topics || typeof p.topics !== "object") return emptyProgress();
    const topics: Record<string, TopicProgress> = {};
    for (const [k, t] of Object.entries(p.topics)) {
      if (!t || typeof t !== "object") continue;
      const answers: Record<string, number> = {};
      const correct: Record<string, boolean> = {};
      for (const [q, i] of Object.entries((t as TopicProgress).answers ?? {})) if (Number.isInteger(i) && i >= 0 && i < 8) answers[q] = i;
      for (const [q, c] of Object.entries((t as TopicProgress).correct ?? {})) if (q in answers) correct[q] = c === true;
      topics[k] = { answers, correct, updatedAt: Number((t as TopicProgress).updatedAt) || 0 };
    }
    return { v: 1, topics, promptDismissedAt: typeof p.promptDismissedAt === "number" ? p.promptDismissedAt : null };
  } catch {
    return emptyProgress();
  }
}

/** Records an answer (first answer wins: re-tapping does not change the score). */
export function recordAnswer(p: PracticeProgress, key: string, questionId: string, choice: number, isCorrect: boolean, now: number): PracticeProgress {
  const t = p.topics[key] ?? { answers: {}, correct: {}, updatedAt: 0 };
  if (questionId in t.answers) return p;
  return {
    ...p,
    topics: {
      ...p.topics,
      [key]: { answers: { ...t.answers, [questionId]: choice }, correct: { ...t.correct, [questionId]: isCorrect }, updatedAt: now },
    },
  };
}

export function resetTopic(p: PracticeProgress, key: string): PracticeProgress {
  const topics = { ...p.topics };
  delete topics[key];
  return { ...p, topics };
}

/** Score for one topic, counting only questions still on the page. */
export function topicScore(p: PracticeProgress, key: string, questionIds: string[]): { answered: number; correct: number; total: number } {
  const t = p.topics[key];
  let answered = 0;
  let correct = 0;
  for (const id of questionIds)
    if (t && id in t.answers) {
      answered++;
      if (t.correct[id]) correct++;
    }
  return { answered, correct, total: questionIds.length };
}

export const totalAnswered = (p: PracticeProgress) => Object.values(p.topics).reduce((a, t) => a + Object.keys(t.answers).length, 0);

/** Soft prompt: after PROMPT_AFTER answers on this page, unless dismissed recently or signed in. */
export function shouldPrompt(p: PracticeProgress, answeredHere: number, now: number, signedIn: boolean): boolean {
  if (signedIn || answeredHere < PROMPT_AFTER) return false;
  return !p.promptDismissedAt || now - p.promptDismissedAt > PROMPT_SNOOZE_MS;
}

/** localStorage, guarded: private mode / quota errors simply mean no persistence. */
export const progressStore = {
  read(): PracticeProgress {
    try {
      return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
    } catch {
      return emptyProgress();
    }
  },
  write(p: PracticeProgress): void {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch {
      // ignore
    }
  },
};
