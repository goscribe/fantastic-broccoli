import type { NoteBlock, TopicNoteContent } from "@/lib/api/notes";

/**
 * Reading helpers for the public note pages: an honest reading time from the
 * note's own words, and anonymous reading progress (which sections of which
 * topic were read) kept in localStorage next to the practice progress. Pure
 * reducers plus a guarded storage wrapper, so it is tested.
 */

const WORDS_PER_MINUTE = 190;
const words = (s: string) => (s.match(/\S+/g) ?? []).length;

function blockWords(b: NoteBlock): number {
  switch (b.type) {
    case "paragraph":
    case "callout":
      return words(b.text);
    case "bullets":
      return b.items.reduce((a, it) => a + words(it.text) + it.sub.reduce((x, s) => x + words(s), 0), 0);
    case "example":
      return words(b.title) + words(b.problem) + b.steps.reduce((a, s) => a + words(s), 0) + words(b.answer);
    case "table":
      return b.rows.reduce((a, r) => a + r.reduce((x, c) => x + words(c), 0), 0);
    case "figure":
      return 25; // a figure takes about as long as a short paragraph
    case "deeper":
      return 0; // optional, collapsed
  }
}

/** Minutes to read the note's sections and key terms (never less than 1). */
export function readingMinutes(note: Pick<TopicNoteContent, "sections" | "keyTerms">): number {
  const n =
    note.sections.reduce((a, s) => a + words(s.heading) + s.blocks.reduce((x, b) => x + blockWords(b), 0), 0) +
    note.keyTerms.reduce((a, k) => a + words(k.definition), 0);
  return Math.max(1, Math.round(n / WORDS_PER_MINUTE));
}

export const READING_KEY = "scribe.notesRead.v1";

export interface TopicReading {
  /** Section ids read to the end. */
  read: string[];
  /** Sections on the page when it was last read. */
  total: number;
  updatedAt: number;
}
export interface ReadingProgress {
  v: 1;
  topics: Record<string, TopicReading>;
}

export const emptyReading = (): ReadingProgress => ({ v: 1, topics: {} });

/** Parses stored JSON defensively; anything odd starts afresh. */
export function parseReading(raw: string | null | undefined): ReadingProgress {
  if (!raw) return emptyReading();
  try {
    const p = JSON.parse(raw) as Partial<ReadingProgress>;
    if (p?.v !== 1 || !p.topics || typeof p.topics !== "object") return emptyReading();
    const topics: Record<string, TopicReading> = {};
    for (const [k, t] of Object.entries(p.topics)) {
      if (!t || typeof t !== "object" || !Array.isArray(t.read)) continue;
      const read = [...new Set(t.read.filter((x): x is string => typeof x === "string"))].slice(0, 60);
      topics[k] = { read, total: Math.max(Number(t.total) || 0, read.length), updatedAt: Number(t.updatedAt) || 0 };
    }
    return { v: 1, topics };
  } catch {
    return emptyReading();
  }
}

/** Marks a section read (idempotent: returns the same object when nothing changes). */
export function markRead(p: ReadingProgress, key: string, sectionId: string, total: number, now: number): ReadingProgress {
  const t = p.topics[key];
  if (t && t.read.includes(sectionId) && t.total === total) return p;
  const read = t ? (t.read.includes(sectionId) ? t.read : [...t.read, sectionId]) : [sectionId];
  return { ...p, topics: { ...p.topics, [key]: { read, total, updatedAt: now } } };
}

export type TopicState = "new" | "started" | "done";

/** Where a visitor is with a topic: read to the end (or every question answered) is done. */
export function topicState(reading: TopicReading | undefined, answered: number, questionCount: number): TopicState {
  const readAll = !!reading && reading.total > 0 && reading.read.length >= reading.total;
  const practisedAll = questionCount > 0 && answered >= questionCount;
  if (readAll || practisedAll) return "done";
  return (reading && reading.read.length > 0) || answered > 0 ? "started" : "new";
}

/** localStorage, guarded: private mode / quota errors simply mean no persistence. */
export const readingStore = {
  read(): ReadingProgress {
    try {
      return parseReading(window.localStorage.getItem(READING_KEY));
    } catch {
      return emptyReading();
    }
  },
  write(p: ReadingProgress): void {
    try {
      window.localStorage.setItem(READING_KEY, JSON.stringify(p));
    } catch {
      // ignore
    }
  },
};
