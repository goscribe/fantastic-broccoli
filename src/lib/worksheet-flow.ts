import type { PartMarking, WorksheetPart, WorksheetStep } from "@/types";

/**
 * Finishable worksheets: how much to write, the help a stuck student can
 * ask for (a hint, then the first step), the model answer after an attempt
 * or a skip, and which parts a "Check" marks. A question never needs every
 * part answered before marking: unanswered parts count as skipped.
 *
 * Production data behind it: written parts were finished 12% of the time
 * (MCQs 65%), with a median marked score of 25%.
 */

/** The answer-length line under a part: the generator's, else from its type and marks. */
export function answerGuideFor(part: WorksheetPart): { key: string } | { text: string } {
  if (part.answerGuide?.trim()) return { text: part.answerGuide.trim() };
  const marks = part.marks ?? 1;
  if (part.type === "numeric") return { key: marks > 1 ? "written.guideWorking" : "written.guideValue" };
  if (part.type === "essay") return { key: "written.guideParagraphs" };
  return { key: marks <= 1 ? "written.guideLine" : marks <= 3 ? "written.guideSentences" : "written.guideParagraph" };
}

/** What "Show the first step" shows: the generator's first step, else the first mark-scheme point of a multi-point scheme. */
export function firstStepFor(part: WorksheetPart): string | undefined {
  if (part.firstStep?.trim()) return part.firstStep.trim();
  const points = part.markScheme?.points ?? [];
  return points.length > 1 ? points[0].requirements : undefined;
}

/** The model answer shown after an attempt or a skip: the worked answer, else the expected answer. */
export function modelAnswerFor(part: WorksheetPart): string | undefined {
  return part.workedAnswer?.trim() || part.answer?.trim() || undefined;
}

/** Help levels: 0 none, 1 the hint, 2 the first step too. Hints cost nothing. */
export type HelpLevel = 0 | 1 | 2;

/** The next help a part can offer, or null when there is none left. */
export function nextHelp(part: WorksheetPart, level: HelpLevel): "hint" | "step" | null {
  if (level < 1 && part.hint?.trim()) return "hint";
  if (level < 2 && firstStepFor(part)) return "step";
  return null;
}

/** The earlier parts' answers sent with a part's marking (for error carried forward). */
export function earlierAnswers(
  step: WorksheetStep,
  partIndex: number,
  answerOf: (partIndex: number) => string,
): { partIndex: number; answer: string }[] {
  return step.parts
    .slice(0, partIndex)
    .map((_, i) => ({ partIndex: i, answer: answerOf(i).slice(0, 5000) }))
    .filter((e) => e.answer.trim());
}

/** Marking for a part the student skipped or left blank: no marks, no server call. */
export function skippedMarking(part: WorksheetPart): PartMarking {
  return { points: [], achievedPoints: 0, totalPoints: part.marks ?? 1, correct: false };
}

/**
 * Which parts "Check answers" still has to mark: the answered ones that are
 * not marked yet. Everything else is either marked already or ends as skipped.
 */
export function partsToMark(
  step: WorksheetStep,
  state: { answered: (i: number) => boolean; marked: (i: number) => boolean },
): number[] {
  return step.parts.map((_, i) => i).filter((i) => state.answered(i) && !state.marked(i));
}

/** The question's marks: earned on the parts marked, out of all its marks (skipped parts score 0, not counted as wrong). */
export function stepScore(step: WorksheetStep, markingOf: (i: number) => PartMarking | undefined) {
  const total = step.parts.reduce((s, p) => s + (p.marks ?? 1), 0);
  const earned = step.parts.reduce((s, _, i) => s + (markingOf(i)?.achievedPoints ?? 0), 0);
  return { earned, total };
}

/** The prompt without a trailing "[2]" / "[2 marks]" / "(2 points)" that repeats the marks shown beside it. */
export function promptWithoutMarks(prompt: string, marks: number): string {
  const re = new RegExp(`\\s*[\\[(]\\s*${marks}\\s*(?:marks?|points?)?\\s*[\\])]\\s*\\.?\\s*$`, "i");
  return prompt.replace(re, "").trimEnd() || prompt;
}
