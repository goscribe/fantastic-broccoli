import type { CheckedClaim, LintIssue, NoteLabel, TopicNoteContent } from "@/lib/api/notes";

/** Learner-facing label key: only reviewed/published notes say "reviewed". */
export const noteLabelKey = (label: NoteLabel) => (label === "reviewed" ? "notes.labelReviewed" : "notes.labelDraft");

/** Reader URL for a topic note. */
export const noteHref = (courseId: string, topicId: string) =>
  `/notes/${encodeURIComponent(courseId)}/${encodeURIComponent(topicId)}`;

/**
 * Block-level key for a location label from the fact-check or lint
 * ("s2.b3.1" → "s2.b3", "s2.heading" → "s2.heading", "q3.mp1" → "q3",
 * "f1.caption" → "f1", "term4.definition" → "terms").
 */
export function blockKey(where: string): string {
  const w = where.replace(/^\[|\]$/g, "").trim();
  const sec = /^(s\d+)\.(heading|b\d+)/.exec(w);
  if (sec) return `${sec[1]}.${sec[2]}`;
  const other = /^(q\d+|f\d+)/.exec(w);
  if (other) return other[1];
  if (/^term/.test(w)) return "terms";
  return w.split(".")[0] || "note";
}

export interface BlockFlags {
  flagged: number;
  fixed: number;
  lint: number;
}

/** Flag counts per block so the review view can mark the places to check. */
export function flagsByBlock(claims: CheckedClaim[], lint: LintIssue[]): Map<string, BlockFlags> {
  const out = new Map<string, BlockFlags>();
  const get = (k: string) => {
    const v = out.get(k) ?? { flagged: 0, fixed: 0, lint: 0 };
    out.set(k, v);
    return v;
  };
  for (const c of claims) {
    if (c.verdict === "ok") continue;
    const v = get(blockKey(c.where));
    if (c.applied) v.fixed++;
    else v.flagged++;
  }
  for (const l of lint) if (l.severity === "error") get(blockKey(l.where)).lint++;
  return out;
}

/** Figure numbers in reading order ("Figure 1", "Figure 2"). */
export function figureNumbers(note: TopicNoteContent): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of note.sections)
    for (const b of s.blocks) if (b.type === "figure" && !out.has(b.figureId)) out.set(b.figureId, out.size + 1);
  return out;
}

/** Total marks of the recall questions. */
export const recallMarks = (note: TopicNoteContent) => note.recall.reduce((a, q) => a + q.marks, 0);

/** Claims to show first in review: unresolved flags, then auto-fixes, then the rest. */
export function sortClaims(claims: CheckedClaim[]): CheckedClaim[] {
  const rank = (c: CheckedClaim) => (c.verdict === "ok" ? 2 : c.applied ? 1 : 0);
  return [...claims].sort((a, b) => rank(a) - rank(b));
}

/** Immutable edit of a note: clone, mutate, return. */
export function editNote(note: TopicNoteContent, mutate: (draft: TopicNoteContent) => void): TopicNoteContent {
  const draft = structuredClone(note);
  mutate(draft);
  return draft;
}

/** Plain numbers wrapped as maths ("$120$") read better as text in prose. */
export const tidyMath = (text: string) => text.replace(/\$(-?\d[\d,]*(?:\.\d+)?)\$/g, "$1");
