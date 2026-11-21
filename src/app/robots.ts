import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { generateSitemaps as notesSitemaps } from "./notes/sitemap";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Public note pages (/notes) are crawlable and have their own sitemap files.
  const notes = await notesSitemaps();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/workspace/",
        "/folder/",
        "/settings",
        "/shared/",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/restore-account",
        "/accept-invite",
        "/review",
      ],
    },
    sitemap: [`${siteUrl}/sitemap.xml`, ...notes.map((s) => `${siteUrl}/notes/sitemap/${s.id}.xml`)],
  };
}
