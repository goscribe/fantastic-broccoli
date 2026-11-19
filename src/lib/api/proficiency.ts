import type { ReadingFigure } from "@/types";
import { rpc } from "./study-session";

export type ProficiencyLevel = "unknown" | "beginner" | "developing" | "secure";

export interface TopicLevel {
  topic: string;
  label: string;
  rating: number;
  attempts: number;
  /** Chance of answering an average question on this topic correctly (0–1). */
  mastery: number;
  level: ProficiencyLevel;
}

export interface PrecheckItem {
  artifactId: string;
  index: number;
  question: string;
  options: string[];
  figures?: ReadingFigure[];
  difficulty: number;
}

export interface PrecheckTopic {
  topic: string;
  label: string;
  level: ProficiencyLevel;
  /** Easiest → hardest. */
  ladder: PrecheckItem[];
}

export interface BankAnswerResult {
  correct: boolean;
  correctIndex: number;
  explanation: string;
  topic: TopicLevel | null;
}

export const proficiencyApi = {
  list: (workspaceId: string) =>
    rpc<TopicLevel[]>("proficiency.list", "query", { workspaceId }),
  precheck: (workspaceId: string, focus?: string) =>
    rpc<PrecheckTopic[]>("proficiency.precheck", "query", {
      workspaceId,
      focus: focus?.slice(0, 2000) || undefined,
    }),
  /** Marks a question-bank MCQ server-side (pre-check or spaced review). */
  answerBankQuestion: (input: {
    workspaceId: string;
    artifactId: string;
    index: number;
    selectedIndex: number;
  }) => rpc<BankAnswerResult>("proficiency.answerPrecheck", "mutation", input),
  reviewPreference: (workspaceId: string) =>
    rpc<{ longTerm: boolean; dueItems: number }>(
      "proficiency.reviewPreference",
      "query",
      { workspaceId },
    ),
  setReviewPreference: (workspaceId: string, longTerm: boolean) =>
    rpc<{ longTerm: boolean }>("proficiency.setReviewPreference", "mutation", {
      workspaceId,
      longTerm,
    }),
};
