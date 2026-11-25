/**
 * Where the calculator shows, and when it must not be used.
 *
 * Subjects with numbers in them get a "Calculator" button in the toolbar;
 * the rest keep it one step away behind "Tools". On a non-calculator paper
 * (IB Maths Paper 1, a GCSE non-calculator paper, an AP no-calculator
 * section) it is off, with a line saying why: practising with a calculator
 * the exam will not allow teaches the wrong paper.
 */
import { paperAllowsCalculator } from "../exam-papers";
import type { SubjectFamily } from "../subject-family";

/** Families where a calculator is an everyday tool (biology for its statistics). */
export const CALCULATOR_FAMILIES: readonly SubjectFamily[] = ["maths", "physics", "chemistry", "economics", "computing", "biology"];

export type CalculatorPlacement = "toolbar" | "tools";

export function calculatorPlacement(family: SubjectFamily | null | undefined): CalculatorPlacement {
  return family && CALCULATOR_FAMILIES.includes(family) ? "toolbar" : "tools";
}

/** "Non-calculator", "no calculator", "without a calculator", "calculators are not permitted"… */
const NON_CALCULATOR_TEXT =
  /\bnon[-\s]?calc(?:ulator)?\b|\bno[-\s]calc(?:ulator)?s?\b|\bwithout (?:a |the )?calculator\b|\bcalculators? (?:is|are|may|must) not\b|\bnot (?:permitted|allowed)(?: access)? (?:to )?(?:use )?(?:a|any) calculator\b|\bcalculators? (?:not|are not) (?:allowed|permitted)\b/i;

export function saysNonCalculator(text: string | null | undefined): boolean {
  return !!text && NON_CALCULATOR_TEXT.test(text);
}

export interface CalculatorContext {
  /** The practice paper's cover, when the work is a paper. */
  paper?: { name?: string; calculator?: boolean | null; instructions?: string[] } | null;
  /** The sections the questions on screen are in ("Section I, Part A: no calculator"). */
  sections?: (string | null | undefined)[];
  /** The paper chosen on the start check (`StudySession.paperFocus`). */
  paperFocus?: string | null;
}

/**
 * True when the calculator must be off. In order: every section on screen
 * says no calculator; the paper's own flag; the paper's name or instructions;
 * then the paper the session was set to practise.
 */
export function isNonCalculator(context: CalculatorContext): boolean {
  const sections = (context.sections ?? []).filter((s): s is string => !!s);
  if (sections.length > 0 && sections.every(saysNonCalculator)) return true;
  const paper = context.paper;
  if (paper) {
    if (paper.calculator === false) return true;
    // A paper's instructions can take the calculator away even when its format allows one.
    if (saysNonCalculator(paper.name) || (paper.instructions ?? []).some(saysNonCalculator)) return true;
    if (paper.calculator === true) return false;
  }
  return paperAllowsCalculator(context.paperFocus) === false;
}

/** The parts of a session's activities this reads (structural, so tests need no full session). */
interface ActivityLike {
  content: { type: string; paper?: CalculatorContext["paper"]; steps?: { section?: string }[] };
}

/**
 * What the calculator rule needs from a study session: the paper the
 * activity on screen belongs to (a practice paper is one session, so any
 * activity's cover counts), the section of the question on screen, and the
 * paper the session was set to practise on the start check.
 */
export function sessionCalculatorContext(input: {
  activities: ActivityLike[];
  active?: ActivityLike | null;
  /** The step of the active worksheet that is on screen. */
  itemIndex?: number;
  paperFocus?: string | null;
}): CalculatorContext {
  const paperOf = (a: ActivityLike | null | undefined) => (a?.content.type === "worksheet" ? (a.content.paper ?? null) : null);
  const paper = paperOf(input.active) ?? input.activities.map(paperOf).find((p) => p) ?? null;
  const steps = input.active?.content.type === "worksheet" ? (input.active.content.steps ?? []) : [];
  const step = steps[Math.min(Math.max(input.itemIndex ?? 0, 0), Math.max(steps.length - 1, 0))];
  return { paper, sections: step?.section ? [step.section] : [], paperFocus: input.paperFocus ?? null };
}
