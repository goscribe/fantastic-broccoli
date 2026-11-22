import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { isDeck, SAFE_ID, splitDeck, type FlashcardDeck, type FlashcardSet } from "./flashcard-deck";
import { richTextHtml } from "./rich-html";

const DIR = join(process.cwd(), "src/data/flashcards");

/** The generated deck for a topic (scripts/generate-flashcards.mjs), or null when there is none. */
export const loadDeck = cache(async (courseId: string, topicId: string): Promise<FlashcardDeck | null> => {
  if (!SAFE_ID.test(courseId) || !SAFE_ID.test(topicId)) return null;
  try {
    const deck: unknown = JSON.parse(await readFile(join(DIR, courseId, `${topicId}.json`), "utf8"));
    return isDeck(deck) && deck.courseId === courseId && deck.topicId === topicId && deck.cards.length > 0 ? deck : null;
  } catch {
    return null;
  }
});

/** The deck as the island receives it: every card for a signed-in learner, the free ones otherwise. */
export async function flashcardSet(courseId: string, topicId: string, signedIn: boolean): Promise<FlashcardSet | null> {
  const deck = await loadDeck(courseId, topicId);
  if (!deck) return null;
  const { open } = splitDeck(deck.cards, signedIn);
  return {
    total: deck.cards.length,
    cards: open.map((c) => ({
      id: c.id,
      kind: c.kind,
      front: richTextHtml(c.front),
      back: richTextHtml(c.back),
      ...(c.hint ? { hint: richTextHtml(c.hint) } : {}),
      ...(c.sectionId ? { sectionId: c.sectionId } : {}),
    })),
  };
}
