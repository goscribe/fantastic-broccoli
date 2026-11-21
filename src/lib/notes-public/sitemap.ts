import { coursePath, notesIndexPath, topicPath, unitPath } from "./slug";
import { indexDraftsFromEnv, isTopicIndexable } from "./seo";

/** URLs per sitemap file (Google allows 50,000; small files regenerate faster). */
export const SITEMAP_CHUNK = 5000;

export interface SitemapEntry {
  path: string;
  lastModified: string | null;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}

interface Row {
  courseId: string;
  unitId: string;
  unitName: string;
  topicId: string;
  topicName: string;
  note: "reviewed" | "draft" | null;
  questionCount: number;
  updatedAt: string | null;
}

const latest = (dates: (string | null)[]) => dates.filter((d): d is string => !!d).sort().at(-1) ?? null;

/**
 * Sitemap entries for the public note pages: the index, then per course the
 * course page, its unit pages and its topic pages — only indexable topics,
 * and course / unit pages only when they lead to at least one. Pure, tested.
 */
export function notesSitemapEntries(
  courses: { id: string }[],
  rows: Row[],
  indexDrafts = indexDraftsFromEnv(),
): SitemapEntry[] {
  const ok = rows.filter((r) => isTopicIndexable({ note: r.note, questionCount: r.questionCount, indexDrafts }));
  const out: SitemapEntry[] = [{ path: notesIndexPath(), lastModified: latest(ok.map((r) => r.updatedAt)), changeFrequency: "weekly", priority: 0.8 }];
  for (const c of courses) {
    const mine = ok.filter((r) => r.courseId === c.id);
    if (!mine.length) continue;
    out.push({ path: coursePath(c.id), lastModified: latest(mine.map((r) => r.updatedAt)), changeFrequency: "weekly", priority: 0.7 });
    const units = [...new Map(mine.map((r) => [r.unitId, r])).values()];
    for (const u of units)
      out.push({
        path: unitPath(c.id, { id: u.unitId, name: u.unitName }),
        lastModified: latest(mine.filter((r) => r.unitId === u.unitId).map((r) => r.updatedAt)),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    for (const r of mine)
      out.push({ path: topicPath(c.id, { id: r.topicId, name: r.topicName }), lastModified: r.updatedAt, changeFrequency: "monthly", priority: 0.6 });
  }
  return out;
}
