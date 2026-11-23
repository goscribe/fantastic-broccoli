import type { MarkedPoint, PartMarking, WorksheetContent, WorksheetPart } from "@/types";

/**
 * Long-answer questions (LAQs): one exam-style extended response per activity
 * ("Explain … [6]"), stored as a one-question worksheet with
 * `format: "long_answer"`. Pure helpers for LongAnswerActivity.
 */

export function isLongAnswer(content: WorksheetContent | undefined): boolean {
  return content?.format === "long_answer" && !!content.steps[0]?.parts[0];
}

/** "[6]", "(6 marks)", "[6 marks]", "(6 points)" at the end of a prompt. */
const MARKS_SUFFIX = /\s*[[(]\s*\d+\s*(?:marks?|points?)?\s*[\])]\s*\.?\s*$/i;

/**
 * The prompt split for display: the command term it opens with (bolded),
 * the rest, and no trailing marks (the marks are shown as "[6]" beside it).
 */
export function promptParts(part: Pick<WorksheetPart, "prompt" | "commandTerm">): { term: string; rest: string } {
  const prompt = part.prompt.replace(MARKS_SUFFIX, "").trim();
  const term = (part.commandTerm ?? "").trim();
  if (term && prompt.toLowerCase().startsWith(term.toLowerCase())) {
    return { term: prompt.slice(0, term.length), rest: prompt.slice(term.length) };
  }
  return { term: "", rest: prompt };
}

/** About how many words a full-mark answer runs to (30 a mark). */
export function aimWords(marks: number): number {
  return Math.max(60, Math.round((marks * 30) / 10) * 10);
}

export interface Segment {
  text: string;
  /** Index of the marking point whose quote this is; null for plain text. */
  point: number | null;
}

/**
 * The answer cut into plain text and the spans the marker quoted for points
 * that earned marks (first occurrence, case-insensitive, no overlaps), so the
 * marked answer can show where each mark came from.
 */
export function answerSegments(answer: string, points: MarkedPoint[]): Segment[] {
  const lower = answer.toLowerCase();
  const spans: Array<{ start: number; end: number; point: number }> = [];
  points.forEach((p, i) => {
    const q = (p.quote ?? "").trim();
    if (!q || p.achievedPoints <= 0) return;
    const start = lower.indexOf(q.toLowerCase());
    if (start < 0) return;
    const end = start + q.length;
    if (spans.some((s) => start < s.end && end > s.start)) return;
    spans.push({ start, end, point: i });
  });
  spans.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) out.push({ text: answer.slice(at, s.start), point: null });
    out.push({ text: answer.slice(s.start, s.end), point: s.point });
    at = s.end;
  }
  if (at < answer.length) out.push({ text: answer.slice(at), point: null });
  return out;
}

/** Marking points that earned full marks, some marks, or none. */
export function groupPoints(marking: PartMarking): { hit: MarkedPoint[]; missed: MarkedPoint[] } {
  const hit = marking.points.filter((p) => p.achievedPoints >= p.point);
  const missed = marking.points.filter((p) => p.achievedPoints < p.point);
  return { hit, missed };
}

/** Under half marks is a mistake to come back to (same rule as the server). */
export const LAQ_MISTAKE_BELOW = 0.5;
export function needsReview(marking: PartMarking): boolean {
  return marking.totalPoints > 0 && marking.achievedPoints / marking.totalPoints < LAQ_MISTAKE_BELOW;
}
