/**
 * Pure helpers for the first-run screen ("What are you studying?"), kept free
 * of framework imports so they can be tested.
 */
import type { ExamBoard } from "../types";

export interface TopicStart {
  /** Subject + session title, e.g. "IB Physics – atomic structure". */
  title: string;
  /** What the planner should cover. */
  topics: string;
  examBoard?: ExamBoard;
}

const BOARD_PATTERNS: [RegExp, ExamBoard][] = [
  [/\bIB(?:DP)?\b/i, "IB"],
  [/\bAP\b/, "AP"],
  [/\bA[\s-]?levels?\b/i, "A_LEVEL"],
  [/\bAS[\s-]level\b/i, "A_LEVEL"],
  [/\b(?:I?GCSE)\b/i, "GCSE"],
  [/\b(?:SAT|PSAT)\b/, "SAT"],
];

/** Collapses whitespace and caps the length the server accepts for a subject name. */
export function cleanTopic(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 100).trim();
}

/** Reads an exam board out of a typed topic ("AP Bio cell transport" → AP). */
export function topicStart(raw: string): TopicStart | null {
  const title = cleanTopic(raw);
  if (title.length < 2) return null;
  const examBoard = BOARD_PATTERNS.find(([re]) => re.test(title))?.[1];
  return { title, topics: title, ...(examBoard ? { examBoard } : {}) };
}

export const PASTE_MIN_CHARS = 40;
export const PASTE_MAX_CHARS = 100_000;

/** Subject name for pasted notes: their first non-empty line (markdown heading marks dropped). */
export function pastedSubjectTitle(text: string, fallback: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return fallback;
  const words = cleanTopic(line).split(" ");
  // A whole first paragraph is not a name: keep the first few words.
  const short = words.slice(0, 8).join(" ");
  return (short.length > 60 ? short.slice(0, 60).trim() : short) || fallback;
}

/** Subject name for an upload: the first file's name, plus a count for more. */
export function uploadSubjectTitle(names: string[], fallback: string): string {
  const base = names
    .map((n) => n.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim())
    .filter(Boolean);
  // Camera photos ("IMG 2041", "PXL 20261120 101010", "image") say nothing about the subject.
  const camera = /^(?:img|image|pxl|dsc|dcim|photo|scan|screenshot|whatsapp image)?[\s\d.]*$/i;
  const useful = base.filter((n) => !camera.test(n));
  if (useful.length === 0) return fallback;
  const first = useful[0].slice(0, 60);
  return base.length > 1 ? `${first.slice(0, 50)} +${base.length - 1}` : first;
}

/**
 * Whether home shows the first-run screen ("What are you studying?") instead
 * of the dashboard. A failed request is never read as "nothing there": only a
 * successful, empty answer makes someone a first-run candidate.
 *
 * `sessionCounts` has one entry per subject: its number of study sessions, or
 * null when that request failed.
 */
export function shouldShowFirstRun(input: {
  treeFailed: boolean;
  workspaceCount: number;
  skipped: boolean;
  sessionCounts: (number | null)[];
}): boolean {
  if (input.treeFailed) return false;
  if (input.workspaceCount === 0) return true;
  if (input.skipped) return false;
  // Established students (many subjects) are never first-run candidates.
  if (input.workspaceCount > FIRST_RUN_MAX_SUBJECTS) return false;
  if (input.sessionCounts.some((c) => c === null)) return false;
  return input.sessionCounts.every((c) => c === 0);
}

/** Above this many subjects the per-subject session check is skipped entirely. */
export const FIRST_RUN_MAX_SUBJECTS = 5;
