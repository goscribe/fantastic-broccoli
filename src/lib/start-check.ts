import type { NoteFigure, TopicNoteContent } from "@/lib/api/notes";

/**
 * The start check: "How confident are you with X?" before a session on
 * something the learner has not rated, and what the answer changes. Pure
 * (no React, no network), so the rules can be tested: the slider's faces and
 * keys, which path a confidence takes, what the notes-first screen shows,
 * and how a first reading is put in visual-first order. The server holds the
 * same bands (goscribe/server src/lib/start-check.ts).
 */

export const CONFIDENCE_MAX = 10;
/** Where the slider starts: the middle, so neither end is suggested. */
export const CONFIDENCE_START = 5;
export const FOCUS_NOTE_MAX = 200;

export type ConfidenceFace = "worried" | "unsure" | "neutral" | "happy" | "delighted";
export const CONFIDENCE_FACES: ConfidenceFace[] = ["worried", "unsure", "neutral", "happy", "delighted"];

export const clampConfidence = (n: number) => Math.min(CONFIDENCE_MAX, Math.max(0, Math.round(Number.isFinite(n) ? n : CONFIDENCE_START)));

/**
 * The cat's pose along the scale: worried 0-2 (crouched small, tail wrapped), unsure 3-4 (sitting, paw to
 * chin), neutral 5-6 (a relaxed sit), happy 7-8 (perky, tail up), delighted 9-10 (mid-hop, arms up).
 */
export function confidenceFace(value: number): ConfidenceFace {
  const v = clampConfidence(value);
  return v <= 2 ? "worried" : v <= 4 ? "unsure" : v <= 6 ? "neutral" : v <= 8 ? "happy" : "delighted";
}

/**
 * The round orange cat in that pose (image-generated from the mascot's own art, public/design). All five
 * are 336×400 with the feet on one base line, 396px down, so they can be swapped in place.
 */
export const confidenceCat = (face: ConfidenceFace) => `/design/cat3-${face}.webp`;

/**
 * The slider's value after a key, or null for a key it does not handle (so
 * Tab and the rest behave as usual). Arrows step by one, Page keys by two,
 * Home and End jump to the ends, a digit jumps to that number.
 */
export function sliderKeyValue(value: number, key: string): number | null {
  const v = clampConfidence(value);
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clampConfidence(v + 1);
    case "ArrowLeft":
    case "ArrowDown":
      return clampConfidence(v - 1);
    case "PageUp":
      return clampConfidence(v + 2);
    case "PageDown":
      return clampConfidence(v - 2);
    case "Home":
      return 0;
    case "End":
      return CONFIDENCE_MAX;
    default:
      return /^[0-9]$/.test(key) ? Number(key) : null;
  }
}

/** The value under a finger or pointer at `clientX` on a track that starts at `left` and is `width` wide. */
export function valueFromPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return CONFIDENCE_START;
  return clampConfidence(((clientX - left) / width) * CONFIDENCE_MAX);
}

export type ConfidenceBand = "low" | "medium" | "high";

export function confidenceBand(confidence: number): ConfidenceBand {
  const c = clampConfidence(confidence);
  return c <= 4 ? "low" : c <= 7 ? "medium" : "high";
}

/**
 * What comes before the questions. Low: the notes, pictures first. Medium: a
 * short recap. High, or never asked: straight to the questions.
 */
export type SessionPath = "notes" | "recap" | "questions";

export function sessionPath(confidence: number | null | undefined): SessionPath {
  if (typeof confidence !== "number") return "questions";
  const band = confidenceBand(confidence);
  return band === "low" ? "notes" : band === "medium" ? "recap" : "questions";
}

/** What the notes-first / recap screen shows from one Scribe topic note. */
export interface NotePrimer {
  courseId: string;
  topicId: string;
  topicName: string;
  /** The shortest core explanation: the note's opening paragraph. */
  lead: string;
  figures: NoteFigure[];
  terms: { term: string; definition: string }[];
  /** Recap only: at most three points. */
  points: string[];
}

const firstSentence = (text: string) => {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
};

/** The note's figures in the order the note shows them. */
function figuresInOrder(note: TopicNoteContent): NoteFigure[] {
  const byId = new Map(note.figures.map((f) => [f.id, f]));
  const out: NoteFigure[] = [];
  for (const s of note.sections)
    for (const b of s.blocks) {
      if (b.type !== "figure") continue;
      const f = byId.get(b.figureId);
      if (f && !out.includes(f)) out.push(f);
    }
  return out.length ? out : note.figures;
}

/**
 * A topic note cut down to what a learner needs before questions.
 * "notes" (not confident): up to three figures with their captions, the
 * opening explanation and up to six key terms; no bullet lists.
 * "recap" (fairly confident): one or two figures and at most three points,
 * one from each of the first sections.
 */
export function notePrimer(note: TopicNoteContent, path: Exclude<SessionPath, "questions">): NotePrimer {
  const blocks = note.sections.flatMap((s) => s.blocks);
  const para = blocks.find((b) => b.type === "paragraph");
  const lead = para && para.type === "paragraph" ? para.text : note.objectiveLine;
  const figures = figuresInOrder(note).slice(0, path === "notes" ? 3 : 2);
  const points: string[] = [];
  if (path === "recap") {
    for (const s of note.sections) {
      if (points.length >= 3) break;
      const bullets = s.blocks.find((b) => b.type === "bullets");
      const p = s.blocks.find((b) => b.type === "paragraph");
      const point =
        bullets && bullets.type === "bullets" && bullets.items[0]
          ? bullets.items[0].text
          : p && p.type === "paragraph" && p.text !== lead
            ? firstSentence(p.text)
            : "";
      if (point && !points.includes(point)) points.push(point);
    }
  }
  return {
    courseId: note.courseId,
    topicId: note.topicId,
    topicName: note.topicName,
    lead: path === "notes" ? lead : firstSentence(lead),
    figures,
    terms: path === "notes" ? note.keyTerms.slice(0, 6).map((k) => ({ term: k.term, definition: k.definition })) : [],
    points,
  };
}

/** What the server has for a session on the learner's own material (studySession.getPrimer). */
export interface MaterialPrimer {
  status: "ready" | "preparing" | "none";
  reading: { artifactId: string; title: string; text: string; figures: unknown[] } | null;
  images: { id: string; type: "image"; url: string; caption: string }[];
}

const materialHasVisual = (m: MaterialPrimer) =>
  m.images.length > 0 || (!!m.reading && (m.reading.figures.length > 0 || /\[\[(figure|widget):/.test(m.reading.text)));

/** Which screen, if any, comes before the questions, from what exists for the session. */
export type PrimerPlan =
  | { kind: "none" }
  | { kind: "note"; path: "notes" | "recap" }
  | { kind: "material"; path: "notes" | "recap" }
  /** Not confident, own material, and its note is being written: wait for it on the screen. */
  | { kind: "preparing" };

/**
 * Scribe's topic note leads when it has a figure. Without one, the learner's
 * own material does (its reading and images; for a recap only when it has
 * something to look at). A note with words but no figure is still better
 * than nothing for a learner who is not confident. Otherwise there is no
 * screen: the session's own reading does the teaching.
 */
export function primerPlan(input: { path: SessionPath; notes: readonly NotePrimer[]; material: MaterialPrimer | null }): PrimerPlan {
  const { path, notes, material } = input;
  if (path === "questions") return { kind: "none" };
  if (notes.some((n) => n.figures.length > 0)) return { kind: "note", path };
  if (material?.status === "ready" && (path === "notes" || materialHasVisual(material))) return { kind: "material", path };
  if (path === "notes" && notes.some((n) => n.lead.trim())) return { kind: "note", path };
  if (path === "notes" && material?.status === "preparing") return { kind: "preparing" };
  return { kind: "none" };
}

/** At most three points for a recap of a reading: its own key points, else its first bullets. */
export function readingPoints(text: string, keyPoints?: readonly string[]): string[] {
  const own = (keyPoints ?? []).map((p) => p.trim()).filter(Boolean);
  if (own.length) return own.slice(0, 3);
  return text
    .split("\n")
    .map((l) => l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+)$/)?.[1]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * A reading's blocks in the order a first screen should show them. A reading
 * that opens on a bullet list becomes: its headings, the first figure or
 * widget, the first paragraph (the short explanation), then the rest as
 * written. Only the order changes: every block keeps its index, so saved
 * highlights still land on their paragraph. `needsLead`: it opens on bullets
 * and has no visual of its own, so the caller should bring one.
 */
export function readingOrder(kinds: readonly string[]): { order: number[]; needsLead: boolean; bulletLed: boolean } {
  const all = kinds.map((_, i) => i);
  const first = kinds.findIndex((k) => k !== "heading");
  const bulletLed = first >= 0 && kinds[first] === "list";
  if (!bulletLed) return { order: all, needsLead: false, bulletLed };
  const visual = kinds.findIndex((k) => k === "figure" || k === "widget");
  const para = kinds.findIndex((k) => k === "paragraph");
  const moved = [visual, para].filter((i) => i > first);
  const order = [...all.slice(0, first), ...moved, ...all.slice(first).filter((i) => !moved.includes(i))];
  return { order, needsLead: visual < 0, bulletLed };
}

export type ConfidenceVerdict = "better" | "asExpected" | "tougher";

/**
 * "You said 3/10, you got 7/10": the learner's rating beside their result on
 * the same scale. Null when nothing was asked or nothing was marked.
 */
export function confidenceResult(
  confidence: number | null | undefined,
  correct: number,
  answered: number,
): { said: number; got: number; verdict: ConfidenceVerdict } | null {
  if (typeof confidence !== "number" || !(answered > 0)) return null;
  const said = clampConfidence(confidence);
  const got = clampConfidence((correct / answered) * CONFIDENCE_MAX);
  const diff = got - said;
  return { said, got, verdict: diff >= 2 ? "better" : diff <= -2 ? "tougher" : "asExpected" };
}

/** "<courseId>:<topicId>,<topicId>" on a session started from catalog topics. */
export function parseCourseTopics(ref: string | null | undefined): { courseId: string; topicIds: string[] } | null {
  if (!ref) return null;
  const i = ref.indexOf(":");
  if (i <= 0) return null;
  const topicIds = ref.slice(i + 1).split(",").filter(Boolean);
  return topicIds.length ? { courseId: ref.slice(0, i), topicIds } : null;
}

/** One line, capped: what the "Anything to focus on?" box sends. */
export const tidyFocusNote = (note: string) => note.replace(/\s+/g, " ").trim().slice(0, FOCUS_NOTE_MAX);

/** How long a skipped check stays quiet for the same thing. */
export const SKIP_QUIET_MS = 7 * 86_400_000;

export function skippedRecently(skippedAt: number | null | undefined, now: number): boolean {
  return typeof skippedAt === "number" && skippedAt > 0 && now - skippedAt < SKIP_QUIET_MS;
}

/** Session titles that say nothing about the content ("Quick 5", "Review: …"). */
const GENERIC_TITLE = /^(quick 5|review\b|study session|session\b)/i;

/**
 * What an own-material session is about, for "How confident are you with X?":
 * its title without a file extension or a trailing "notes" ("Cell membranes
 * notes" asks about Cell membranes). '' when the title names nothing, and the
 * question becomes "…with this?".
 */
export function materialName(title: string): string {
  const t = title.trim();
  if (!t || GENERIC_TITLE.test(t)) return "";
  const name = t
    .replace(/\.(pdf|docx?|pptx?|txt|md|png|jpe?g)$/i, "")
    .replace(/[\s:,·-]*\b(my\s+)?(study\s+|revision\s+|class\s+|lecture\s+)?notes?$/i, "")
    .replace(/^(my|your)\s+/i, "")
    .trim();
  return name;
}
