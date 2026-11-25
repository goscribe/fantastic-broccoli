/**
 * Syllabus match of a student's own material (goscribe/server
 * services/workspace/syllabus-match.service.ts): what the confirm step says
 * and which courses the board-first picker lists. Pure, so it is tested
 * without React.
 */
import type { CourseSummary } from "./api/courses";

export type MatchBand = "high" | "medium" | "low";
/** 'confirm' one tap; 'choose' from 2–3 options; 'pick' the board-first picker. */
export type MatchPromptKind = "confirm" | "choose" | "pick";
export type MatchStatus = "suggested" | "none" | "confirmed" | "changed" | "dismissed";

export interface MatchTopic {
  id: string;
  code: string;
  name: string;
  unitCode: string;
  unitName: string;
  confidence: number;
}

export interface SyllabusMatch {
  status: MatchStatus | null;
  prompt: MatchPromptKind | null;
  band: MatchBand | null;
  confidence: number | null;
  suggestion: {
    courseId: string;
    courseTitle: string;
    /** "AQA GCSE Biology", "IB Chemistry HL". */
    label: string;
    boardName: string;
    qualification: string;
    level: string | null;
    levels: string[] | null;
    topics: MatchTopic[];
  } | null;
  options: Array<{ courseId: string; label: string; boardName: string; level: string | null; confidence: number }>;
  boardGuess: { board: string; qualification: string } | null;
}

/** Awarding bodies in the catalog, as students know them; the picker starts here. */
export const MATCH_BOARDS = [
  { key: "IB", label: "IB" },
  { key: "AP", label: "AP" },
  { key: "AQA", label: "AQA" },
  { key: "Edexcel", label: "Edexcel" },
  { key: "OCR", label: "OCR" },
] as const;
export type MatchBoardKey = (typeof MATCH_BOARDS)[number]["key"];

/** Awarding body of a catalog course from its id prefix (the server's matchBoardOfCourse). */
export function boardOfCourseId(courseId: string): MatchBoardKey | null {
  const prefix = courseId.split("-")[0];
  return ({ ib: "IB", ap: "AP", aqa: "AQA", edexcel: "Edexcel", ocr: "OCR" } as Record<string, MatchBoardKey>)[prefix] ?? null;
}

/** A board's courses for the picker, GCSE before A-level within UK boards, then by title. */
export function coursesForBoard(courses: CourseSummary[], board: MatchBoardKey): CourseSummary[] {
  const rank = (c: CourseSummary) => (c.board === "GCSE" ? 0 : c.board === "A_LEVEL" ? 1 : 2);
  return courses.filter((c) => boardOfCourseId(c.id) === board).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}

/** Boards to offer first: the suggestion's, else the board guess, else the usual order. */
export function boardOrder(match: Pick<SyllabusMatch, "suggestion" | "boardGuess" | "options"> | null): MatchBoardKey[] {
  const first = [match?.suggestion?.courseId, ...(match?.options ?? []).map((o) => o.courseId)].map((id) => (id ? boardOfCourseId(id) : null));
  const guess = MATCH_BOARDS.find((b) => b.key === match?.boardGuess?.board)?.key ?? null;
  const out: MatchBoardKey[] = [];
  for (const b of [...first, guess, ...MATCH_BOARDS.map((x) => x.key)]) if (b && !out.includes(b)) out.push(b);
  return out;
}

/** The unit the best topic is in: "4.1 Cell biology". */
export function matchedUnit(s: SyllabusMatch["suggestion"]): string | null {
  const t = s?.topics[0];
  return t ? `${t.unitCode} ${t.unitName.replace(/[?.!]+$/, "")}`.trim() : null;
}

/** "Looks like AQA GCSE Biology · 4.1 Cell biology. Right?" */
export function matchHeadline(s: NonNullable<SyllabusMatch["suggestion"]>): string {
  const unit = matchedUnit(s);
  return `Looks like ${s.label}${unit ? ` · ${unit}` : ""}. Right?`;
}

/** What the "pick" step says when no catalog course fits but a board was read. */
export function boardGuessLine(g: SyllabusMatch["boardGuess"]): string | null {
  if (!g) return null;
  const qual = g.qualification === "A_LEVEL" ? "A-level" : g.qualification === "unknown" || g.qualification === "other" ? "" : g.qualification;
  const known = MATCH_BOARDS.some((b) => b.key === g.board) || ["Cambridge", "WJEC"].includes(g.board);
  if (!known) return null;
  return `It looks like ${g.board}${qual ? ` ${qual}` : ""}, which isn't in our courses yet.`;
}

/** Whether the step should be on screen: a prompt to answer, not answered in this tab. */
export function shouldShowMatch(match: SyllabusMatch | null | undefined, answeredHere: boolean): boolean {
  return !!match?.prompt && !answeredHere;
}

/** "Not now" hides the step for this subject in this tab only (it is asked again next visit). */
export const MATCH_SNOOZE_KEY = (workspaceId: string) => `scribe.syllabusMatch.snoozed.${workspaceId}`;
