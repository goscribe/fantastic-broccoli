/**
 * Pure helpers for the first-run offer of Scribe's notes (kept free of
 * framework imports so they can be tested).
 */

/** Most notes the first-run offer attaches (a unit's worth; the rest are one tap away on the subject page). */
export const OFFER_MAX_NOTES = 12;

interface OfferTopic {
  note: "reviewed" | "draft" | null;
  locked?: boolean;
  hlOnly?: boolean;
}

/**
 * The default the offer makes: the first unit (at the student's level) that
 * has notes they can read, and its topics that have one. Null when the course
 * has no notes yet, so the picker carries on exactly as before.
 */
export function defaultNotesSelection<U extends { topics: OfferTopic[] }>(units: U[], level?: "SL" | "HL" | null): { unit: U; topics: U["topics"][number][] } | null {
  for (const unit of units) {
    const topics = unit.topics.filter((t) => t.note && !t.locked && !(level === "SL" && t.hlOnly)).slice(0, OFFER_MAX_NOTES);
    if (topics.length > 0) return { unit, topics };
  }
  return null;
}
