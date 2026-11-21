import type { ReadingFigure } from "@/types";
import { rpc } from "./study-session";

/**
 * Client for the server's `mistakes` router: every wrong answer is saved
 * automatically (Quick 5s, session MCQs, cloze, flashcards, worksheet parts,
 * pre-check) and moves NEVER_CORRECTED → CORRECTED / STILL_INCORRECT on later
 * attempts. "Practice my mistakes" builds a short session from the open ones.
 */

export type MistakeState = "NEVER_CORRECTED" | "CORRECTED" | "STILL_INCORRECT";
export type MistakeFilter = "open" | "all" | MistakeState;
export type MistakeKind = "mcq" | "card" | "cloze" | "part";

export interface MistakeSummary {
  counts: Record<MistakeState, number>;
  /** Never corrected + still incorrect. */
  open: number;
  total: number;
  /** Minutes one practice round of the open ones takes. */
  practiceMinutes: number;
  subjects: Array<{ workspaceId: string; title: string; open: number; total: number }>;
}

export interface Mistake {
  id: string;
  kind: MistakeKind;
  state: MistakeState;
  /** Topic or activity it was tested under. */
  label: string;
  prompt: string;
  yourAnswer: string | null;
  rightAnswer: string | null;
  explanation: string | null;
  detail: {
    figures?: ReadingFigure[];
    textWithBlanks?: string;
    answers?: string[];
    yours?: string[];
    wrong?: number[];
    achieved?: number;
    total?: number;
  };
  wrongCount: number;
  lastWrongAt: Date;
  correctedAt: Date | null;
  workspaceId: string;
  workspaceTitle: string;
}

export interface StartPracticeResult {
  sessionId: string | null;
  workspaceId: string | null;
  count: number;
}

export const OPEN_STATES: MistakeState[] = ["NEVER_CORRECTED", "STILL_INCORRECT"];

export const mistakesApi = {
  summary: (workspaceId?: string) =>
    rpc<MistakeSummary>("mistakes.summary", "query", { workspaceId }),
  list: (input: { workspaceId?: string; filter?: MistakeFilter; cursor?: string; limit?: number }) =>
    rpc<{ items: Mistake[]; nextCursor: string | null }>("mistakes.list", "query", input),
  startPractice: (input: { workspaceId?: string; sessionId?: string }) =>
    rpc<StartPracticeResult>("mistakes.startPractice", "mutation", input),
  /** Marks a session MCQ answer server-side so a wrong one lands in the log. */
  answerMcq: (input: { activityId: string; questionIndex: number; selectedIndex: number }) =>
    rpc<{ correct: boolean; correctIndex: number; explanation: string }>("studySession.answerMcq", "mutation", input),
};

export { practiceHref, localizePracticeSession } from "@/lib/mistakes";
