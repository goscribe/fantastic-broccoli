import type { LockedKind, LockedSummary, NoteAccess } from "@/lib/api/public-notes";

/**
 * Copy and links for topics behind the notes paid gate (the server decides
 * what is locked and strips it: goscribe/server src/lib/notes/gate.ts). Pure,
 * so it is tested. Public pages are English-only.
 */

export const isLocked = (access: NoteAccess | undefined): access is LockedSummary => !!access && access.locked;

/** "HL", "second-year A-level", or "" (a whole course behind a plan). */
export function lockedAdjective(kind: LockedKind): string {
  return kind === "HL" ? "HL" : kind === "A_LEVEL" ? "second-year A-level" : "";
}

/** Badge on a locked topic: "HL · with a plan". */
export const lockedBadge = (kind: LockedKind) => (kind === "HL" ? "HL · with a plan" : kind === "A_LEVEL" ? "Year 2 · with a plan" : "With a plan");

/** "12 HL topics with a plan", "1 second-year A-level topic with a plan". */
export function lockedCountLabel(n: number, kind: LockedKind | undefined): string {
  const adj = kind ? lockedAdjective(kind) : "";
  return `${n} ${adj ? `${adj} ` : ""}${n === 1 ? "topic" : "topics"} with a plan`;
}

/** The paywall: the pricing page (visitors are sent through sign-in and come back to it). */
export function paywallHref(courseId: string, topicId: string): string {
  return `/pricing?from=notes_unlock&course=${encodeURIComponent(courseId)}&topic=${encodeURIComponent(topicId)}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "What's inside" lines for the unlock panel; only non-zero parts. */
export function insideItems(s: LockedSummary): string[] {
  const moreSections = s.sections - s.shownSections;
  const moreQuestions = s.questions - s.shownQuestions;
  return [
    moreSections > 0 ? `${plural(moreSections, "more section")} of the note` : null,
    s.workedExamples > 0 ? plural(s.workedExamples, "worked example") : null,
    s.figures > 0 ? plural(s.figures, "diagram") : null,
    s.keyTerms > 0 ? plural(s.keyTerms, "key-term card") : null,
    s.recall > 0 ? `${plural(s.recall, "exam-style recall question")} with mark schemes` : null,
    moreQuestions > 0 ? `${plural(moreQuestions, "more practice question")} with worked answers` : null,
  ].filter((x): x is string => !!x);
}

/** One plain sentence under the unlock heading. */
export function unlockLead(kind: LockedKind): string {
  const adj = lockedAdjective(kind);
  return adj
    ? `${adj === "HL" ? "HL" : "Second-year A-level"} topics are part of Scribe's plans and exam passes. The rest of the course stays free.`
    : "This course is part of Scribe's plans and exam passes.";
}
