/**
 * How a finished session went, for the end-of-session screen: which mood the
 * result puts it in, and the row of per-question dots under the score.
 * Pure, so it is unit-tested and shared with the public note pages' practice.
 */

/** perfect: every answer right. strong: 80%+. okay: half or more. rough: under half. done: nothing was marked. */
export type ResultBand = "perfect" | "strong" | "okay" | "rough" | "done";

export function resultBand(accuracy: number | null | undefined): ResultBand {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(accuracy)) return "done";
  if (accuracy >= 0.995) return "perfect";
  if (accuracy >= 0.8) return "strong";
  if (accuracy >= 0.5) return "okay";
  return "rough";
}

/** Confetti is for results worth a party; everything else gets a quieter welcome. */
export const bandCelebrates = (band: ResultBand) => band === "perfect" || band === "strong";

interface TrailActivity {
  id: string;
  type: string;
  content: unknown;
  draft?: Record<string, unknown>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/**
 * Each marked answer of the session in the order it was asked, true = right.
 * Read from what the activities already keep to resume a session (their
 * drafts): quiz picks, gap-fill marks and flashcard self-marks. Activities
 * with no per-item record (worksheets, own-words rewrites) add nothing.
 */
export function questionTrail(
  activities: TrailActivity[],
  draftOf: (id: string, serverDraft?: Record<string, unknown>) => Record<string, unknown> | undefined = (_id, d) => d,
): boolean[] {
  const trail: boolean[] = [];
  for (const a of activities) {
    const draft = draftOf(a.id, a.draft);
    const content = isRecord(a.content) ? a.content : {};
    if (a.type === "mcq") {
      const questions = Array.isArray(content.questions) ? content.questions : [];
      const picks = isRecord(draft) && Array.isArray(draft.answersByQ) ? draft.answersByQ : [];
      questions.forEach((q, i) => {
        const pick = picks[i] ?? (isRecord(q) ? q.userAnswer : undefined);
        if (typeof pick === "number" && isRecord(q)) trail.push(pick === q.correctIndex);
      });
    } else if (a.type === "cloze") {
      const results = isRecord(draft) && Array.isArray(draft.results) ? draft.results : [];
      for (const r of results) if (isRecord(r) && typeof r.correct === "boolean") trail.push(r.correct);
    } else if (a.type === "flashcard_review") {
      const results = isRecord(draft) && Array.isArray(draft.results) ? draft.results : [];
      for (const r of results) if (typeof r === "boolean") trail.push(r);
    }
  }
  return trail;
}

export interface ResultDots {
  /** One entry per dot, true = right. */
  dots: boolean[];
  /** True when the dots are in the order the questions were asked; false when they are a tally (rights first). */
  ordered: boolean;
}

/**
 * The dots to draw for `answered` questions of which `correct` were right.
 * The real order is used when the trail accounts for exactly those answers;
 * otherwise the dots are a plain tally, so they never disagree with the score.
 * Above `max` answers there are no dots (the caller shows the count alone).
 */
export function resultDots(answered: number, correct: number, trail: boolean[] = [], max = 40): ResultDots | null {
  if (!Number.isFinite(answered) || answered <= 0 || answered > max) return null;
  const right = Math.max(0, Math.min(answered, Math.round(correct)));
  if (trail.length === answered && trail.filter(Boolean).length === right) return { dots: trail, ordered: true };
  return { dots: Array.from({ length: answered }, (_, i) => i < right), ordered: false };
}

/** How many right answers in a row end at `upTo` (exclusive), given each item's mark (null = not answered). */
export function runOfRight(marks: (boolean | null | undefined)[], upTo = marks.length): number {
  let n = 0;
  for (let i = Math.min(upTo, marks.length) - 1; i >= 0 && marks[i] === true; i--) n++;
  return n;
}
