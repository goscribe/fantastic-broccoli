/**
 * URLs of the public topic-note pages. One URL per page:
 *
 *   /notes                                   boards and courses
 *   /notes/<courseId>                        a course's units and topics
 *   /notes/<courseId>/unit-<unitId>-<name>   one unit's topics
 *   /notes/<courseId>/<topicId>-<name>       a topic: the note + practice questions
 *
 * Course and topic ids are the catalog's (server src/lib/courses), so the
 * signed-in reader's old links (/notes/ib-biology/a1-1) still resolve: a
 * bare or stale slug redirects to the canonical one. Pure, so it is tested.
 */

export interface SlugTopic {
  id: string;
  name: string;
}
export interface SlugUnit {
  id: string;
  name: string;
  topics: SlugTopic[];
}

/** "Enzymes and metabolism" → "enzymes-and-metabolism" (ASCII, max ~60 chars, whole words). */
export function slugify(text: string, max = 60): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const i = cut.lastIndexOf("-");
  return (i > 20 ? cut.slice(0, i) : s.slice(0, max)).replace(/-+$/, "");
}

const UNIT_PREFIX = "unit-";

export const notesIndexPath = () => "/notes";
export const coursePath = (courseId: string) => `/notes/${encodeURIComponent(courseId)}`;
export const topicSlug = (t: SlugTopic) => {
  const name = slugify(t.name);
  return name ? `${t.id}-${name}` : t.id;
};
export const unitSlug = (u: Pick<SlugUnit, "id" | "name">) => {
  const name = slugify(u.name);
  return `${UNIT_PREFIX}${u.id}${name ? `-${name}` : ""}`;
};
export const topicPath = (courseId: string, t: SlugTopic) => `${coursePath(courseId)}/${topicSlug(t)}`;
export const unitPath = (courseId: string, u: Pick<SlugUnit, "id" | "name">) => `${coursePath(courseId)}/${unitSlug(u)}`;

export type SlugMatch<U extends SlugUnit> =
  | { kind: "topic"; unit: U; topic: U["topics"][number]; canonical: boolean; slug: string }
  | { kind: "unit"; unit: U; canonical: boolean; slug: string }
  | null;

/**
 * Resolves the second path segment of /notes/<course>/<segment> against the
 * course outline. Accepts the canonical slug, the bare catalog id ("a1-1") or
 * an id followed by any old name; `canonical` says whether to redirect.
 * The longest matching id wins, so "a1-10-…" never resolves to "a1-1".
 */
export function resolveSegment<U extends SlugUnit>(units: U[], segment: string): SlugMatch<U> {
  const seg = decodeURIComponent(segment).toLowerCase();
  if (seg.startsWith(UNIT_PREFIX)) {
    const rest = seg.slice(UNIT_PREFIX.length);
    const unit = [...units]
      .sort((a, b) => b.id.length - a.id.length)
      .find((u) => rest === u.id.toLowerCase() || rest.startsWith(`${u.id.toLowerCase()}-`));
    if (unit) return { kind: "unit", unit, canonical: seg === unitSlug(unit), slug: unitSlug(unit) };
  }
  let best: { unit: U; topic: U["topics"][number] } | null = null;
  for (const unit of units)
    for (const topic of unit.topics) {
      const id = topic.id.toLowerCase();
      if ((seg === id || seg.startsWith(`${id}-`)) && (!best || id.length > best.topic.id.length)) best = { unit, topic };
    }
  if (!best) return null;
  const slug = topicSlug(best.topic);
  return { kind: "topic", ...best, canonical: seg === slug, slug };
}

/** Previous / next topic in course order (across units), for "next topic" links. */
export function neighbours<T extends SlugTopic>(units: { topics: T[] }[], topicId: string): { prev: T | null; next: T | null } {
  const all = units.flatMap((u) => u.topics);
  const i = all.findIndex((t) => t.id === topicId);
  if (i < 0) return { prev: null, next: null };
  return { prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
}
