/**
 * Flashcard decks for the public topic pages: the file format, the rules a
 * generated deck must pass, and the free / sign-in split. Pure and free of
 * imports, so the generator (scripts/generate-flashcards.mjs, run by Node with
 * type stripping) and the app share one definition. Decks live in
 * src/data/flashcards/<courseId>/<topicId>.json.
 */

export type FlashcardKind = "term" | "concept" | "formula" | "process" | "mistake" | "example";

export const FLASHCARD_KINDS: readonly FlashcardKind[] = ["term", "concept", "formula", "process", "mistake", "example"];

export interface Flashcard {
  /** Stable within the deck (a short hash of the front), so saved progress survives a regeneration that keeps the card. */
  id: string;
  kind: FlashcardKind;
  /** The prompt: inline markdown and $maths$, like the note. */
  front: string;
  /** The answer, same format. */
  back: string;
  /** A nudge shown on request before flipping. */
  hint?: string;
  /** The note section this card comes from (its "Read this part" link). */
  sectionId?: string;
}

export interface FlashcardDeck {
  schemaVersion: 1;
  courseId: string;
  topicId: string;
  topicCode: string;
  topicName: string;
  /** The note version the deck was written from: a newer note makes it stale. */
  noteVersion: number;
  model: string;
  generatedAt: string;
  cards: Flashcard[];
}

/** A card ready for the deck island: its text already rendered to HTML (maths included). */
export interface RenderedFlashcard {
  id: string;
  kind: FlashcardKind;
  front: string;
  back: string;
  hint?: string;
  sectionId?: string;
}

/** What the deck island is given: the cards it may show, and the deck's full size. */
export interface FlashcardSet {
  total: number;
  cards: RenderedFlashcard[];
}

/** Cards anyone can study; the rest need an account. */
export const FREE_FLASHCARDS = 3;

export const DECK_LIMITS = {
  minCards: 8,
  maxCards: 16,
  frontMax: 160,
  backMax: 360,
  hintMax: 90,
} as const;

/** Splits a deck into what a visitor sees and how many wait behind sign-in. */
export function splitDeck<T>(cards: T[], signedIn: boolean): { open: T[]; lockedCount: number } {
  if (signedIn) return { open: cards, lockedCount: 0 };
  return { open: cards.slice(0, FREE_FLASHCARDS), lockedCount: Math.max(0, cards.length - FREE_FLASHCARDS) };
}

/** Short, stable id from a card's front (FNV-1a, base36). */
export function cardId(front: string): string {
  let h = 0x811c9dc5;
  const s = front.trim().toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** `$` signs that are not escaped (`\$`) must pair up, or KaTeX renders raw text. */
function balancedMath(s: string): boolean {
  const n = (s.match(/(?<!\\)\$/g) ?? []).length;
  return n % 2 === 0;
}

export interface RawCard {
  kind?: unknown;
  front?: unknown;
  back?: unknown;
  hint?: unknown;
  sectionId?: unknown;
}

/**
 * Checks generated cards against the deck rules. Returns readable problems
 * (fed back to the model so it can fix them) and the cleaned cards.
 */
export function checkCards(raw: RawCard[], sectionIds: string[]): { problems: string[]; cards: Flashcard[] } {
  const problems: string[] = [];
  const cards: Flashcard[] = [];
  if (!Array.isArray(raw)) return { problems: ["`cards` must be an array"], cards };
  if (raw.length < DECK_LIMITS.minCards || raw.length > DECK_LIMITS.maxCards) {
    problems.push(`Write between ${DECK_LIMITS.minCards} and ${DECK_LIMITS.maxCards} cards (got ${raw.length}).`);
  }
  const seen = new Set<string>();
  const ids = new Set<string>();
  raw.forEach((c, i) => {
    const at = `Card ${i + 1}`;
    const front = typeof c.front === "string" ? c.front.trim() : "";
    const back = typeof c.back === "string" ? c.back.trim() : "";
    const hint = typeof c.hint === "string" && c.hint.trim() ? c.hint.trim() : undefined;
    const kind = FLASHCARD_KINDS.includes(c.kind as FlashcardKind) ? (c.kind as FlashcardKind) : null;
    const sectionId = typeof c.sectionId === "string" && sectionIds.includes(c.sectionId) ? c.sectionId : undefined;
    if (!front) problems.push(`${at}: empty front.`);
    if (!back) problems.push(`${at}: empty back.`);
    if (!kind) problems.push(`${at}: kind must be one of ${FLASHCARD_KINDS.join(", ")}.`);
    if (front.length > DECK_LIMITS.frontMax) problems.push(`${at}: front is ${front.length} characters; keep it under ${DECK_LIMITS.frontMax}.`);
    if (back.length > DECK_LIMITS.backMax) problems.push(`${at}: back is ${back.length} characters; keep it under ${DECK_LIMITS.backMax}.`);
    if (hint && hint.length > DECK_LIMITS.hintMax) problems.push(`${at}: hint is too long; keep it under ${DECK_LIMITS.hintMax}.`);
    if ([front, back, hint ?? ""].some((t) => /[\u0000-\u0008\u000b-\u001f]/.test(t))) problems.push(`${at}: contains a control character (write LaTeX backslashes doubled in JSON, e.g. "\\\\frac").`);
    if (![front, back, hint ?? ""].every(balancedMath)) problems.push(`${at}: unbalanced $ signs (wrap every bit of maths in a pair of $).`);
    if (front && back && norm(back) === norm(front)) problems.push(`${at}: back repeats the front.`);
    if (hint && back && norm(back).length > 3 && norm(hint).includes(norm(back))) problems.push(`${at}: the hint gives the answer away.`);
    const key = norm(front);
    if (key && seen.has(key)) problems.push(`${at}: duplicate of an earlier card.`);
    seen.add(key);
    if (front && back && kind) {
      let id = cardId(front);
      while (ids.has(id)) id = cardId(`${id}${front}`);
      ids.add(id);
      cards.push({ id, kind, front, back, ...(hint ? { hint } : {}), ...(sectionId ? { sectionId } : {}) });
    }
  });
  return { problems, cards };
}

/** Loose shape check for a deck read from disk (the app skips a bad file rather than failing the page). */
export function isDeck(x: unknown): x is FlashcardDeck {
  const d = x as FlashcardDeck | null;
  return (
    !!d &&
    d.schemaVersion === 1 &&
    typeof d.courseId === "string" &&
    typeof d.topicId === "string" &&
    Array.isArray(d.cards) &&
    d.cards.every((c) => c && typeof c.id === "string" && typeof c.front === "string" && typeof c.back === "string")
  );
}

/** Course and topic ids are slugs; anything else never reaches the file system. */
export const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
