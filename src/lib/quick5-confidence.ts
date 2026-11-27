/**
 * Pure helpers for the confidence question of a Quick 5 (asked on the start
 * step, or on its wait screen when it started without one) and for a Quick
 * 5's end screen: which mix a rating picks, the skip memory it shares with
 * the start step, and how the learner did on the warm-up versus the
 * exam-level questions.
 */
import { CONFIDENCE_MAX, clampConfidence } from "./start-check";

export type Quick5Path = "gentle" | "mixed" | "hard";
export type Quick5Difficulty = "easy" | "medium" | "hard";

/** The server's bands (0-4, 5-7, 8-10): low 2 easy + 3 medium and no hard one, middle 1 + 2 + 2, high 1 medium + 4 hard. */
export function quick5Path(confidence: number): Quick5Path {
  const c = clampConfidence(confidence);
  return c <= 4 ? "gentle" : c <= 7 ? "mixed" : "hard";
}

/** "Skip" quiets the question for the subject (it is asked once per subject, in its first session). */
export function confidenceSkipKey(session: { workspaceId: string }): string {
  return `subject:${session.workspaceId}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface DifficultyResult {
  /** Medium and hard: the questions harder than the warm-up (shown as "harder questions", never "exam-level"). */
  examLevel: { right: number; total: number };
  hard: { right: number; total: number };
}

/**
 * Right / total by difficulty over the session's answered MCQ questions
 * (their drafts' picks, as the answer trail reads them). Null when no
 * question carries a difficulty (anything but a new Quick 5).
 */
export function difficultyResults(
  activities: { id: string; type: string; content: unknown; draft?: Record<string, unknown> }[],
  draftOf: (id: string, serverDraft?: Record<string, unknown>) => Record<string, unknown> | undefined = (_id, d) => d,
): DifficultyResult | null {
  const out: DifficultyResult = { examLevel: { right: 0, total: 0 }, hard: { right: 0, total: 0 } };
  let tagged = false;
  for (const a of activities) {
    if (a.type !== "mcq" || !isRecord(a.content)) continue;
    const questions = Array.isArray(a.content.questions) ? a.content.questions : [];
    const draft = draftOf(a.id, a.draft);
    const picks = isRecord(draft) && Array.isArray(draft.answersByQ) ? draft.answersByQ : [];
    questions.forEach((q, i) => {
      if (!isRecord(q)) return;
      const d = q.difficulty;
      if (d !== "easy" && d !== "medium" && d !== "hard") return;
      tagged = true;
      const pick = picks[i] ?? q.userAnswer;
      if (typeof pick !== "number" || d === "easy") return;
      const right = pick === q.correctIndex ? 1 : 0;
      out.examLevel.total++;
      out.examLevel.right += right;
      if (d === "hard") {
        out.hard.total++;
        out.hard.right += right;
      }
    });
  }
  return tagged ? out : null;
}

/**
 * "You said 7/10 → You got 3/5": the result is shown as the real count (right / answered), the same
 * numbers as the headline's "3 of 5 right", never rescaled to a second "/10" that reads like a count.
 * The verdict still compares the two on one scale.
 */
export function quick5SaidGot(confidence: number | null | undefined, correct: number, answered: number) {
  if (typeof confidence !== "number" || !(answered > 0)) return null;
  const said = clampConfidence(confidence);
  const diff = clampConfidence((correct / answered) * CONFIDENCE_MAX) - said;
  return { said, got: correct, of: answered, verdict: diff >= 2 ? ("better" as const) : diff <= -2 ? ("tougher" as const) : ("asExpected" as const) };
}
