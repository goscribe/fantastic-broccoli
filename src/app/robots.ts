import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
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
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
