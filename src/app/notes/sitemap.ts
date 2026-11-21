import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { getCourses, getSitemapRows } from "@/lib/notes-public/data";
import { notesSitemapEntries, SITEMAP_CHUNK } from "@/lib/notes-public/sitemap";

export const revalidate = 3600;

/**
 * Public note pages, split into files of SITEMAP_CHUNK URLs
 * (/notes/sitemap/0.xml, /notes/sitemap/1.xml, …; robots.ts lists them).
 * Only indexable pages are listed (see isTopicIndexable).
 */
export async function generateSitemaps() {
  try {
    const entries = notesSitemapEntries(await getCourses(), await getSitemapRows());
    return Array.from({ length: Math.max(1, Math.ceil(entries.length / SITEMAP_CHUNK)) }, (_, id) => ({ id }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id) || 0;
  try {
    const entries = notesSitemapEntries(await getCourses(), await getSitemapRows());
    return entries.slice(id * SITEMAP_CHUNK, (id + 1) * SITEMAP_CHUNK).map((e) => ({
      url: `${siteUrl}${e.path}`,
      ...(e.lastModified ? { lastModified: new Date(e.lastModified) } : {}),
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }));
  } catch {
    return [{ url: `${siteUrl}/notes`, changeFrequency: "weekly", priority: 0.8 }];
  }
}
