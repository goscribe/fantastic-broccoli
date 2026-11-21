/**
 * With a long enough note, the first easy questions sit between sections as
 * "quick checks" (after the 2nd and 4th sections); the rest are the practice
 * section. Every question appears once on the page.
 */
export function splitInline<Q extends { id: string; difficulty: string }>(sectionCount: number, questions: Q[]): { inline: Map<number, Q>; rest: Q[] } {
  const slots = sectionCount >= 5 ? [1, 3] : sectionCount >= 3 ? [1] : [];
  if (questions.length < 8) return { inline: new Map(), rest: questions };
  const inline = new Map<number, Q>();
  const used = new Set<string>();
  for (const slot of slots) {
    const q = questions.find((x) => !used.has(x.id) && x.difficulty !== "hard");
    if (!q) break;
    used.add(q.id);
    inline.set(slot, q);
  }
  return { inline, rest: questions.filter((q) => !used.has(q.id)) };
}
