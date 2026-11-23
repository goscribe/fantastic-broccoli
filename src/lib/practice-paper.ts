/**
 * Practice papers in the app: the clock, and the picker's labels. Pure.
 * The papers themselves come from the server's catalog (studySession.paperOptions).
 */

/** Seconds left on the paper (negative once over time). */
export function paperTimeLeft(startedAt: number, minutes: number, now: number): number {
  return Math.round((startedAt + minutes * 60_000 - now) / 1000);
}

/** "1:05:09", "45:00", "0:59". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** "1 h 30 min", "45 min". */
export function formatPaperMinutes(minutes: number, labels: { min: string; h: string }): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} ${labels.min}`;
  return m ? `${h} ${labels.h} ${m} ${labels.min}` : `${h} ${labels.h}`;
}

export const PAPER_BOARDS = ["IB", "AP", "A_LEVEL", "GCSE", "SAT"] as const;
export type PaperBoard = (typeof PAPER_BOARDS)[number];

export function boardLabel(board: string): string {
  return board === "A_LEVEL" ? "A-Level" : board;
}
