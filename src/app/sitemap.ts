import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { blogApi } from "@/lib/api/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const { posts } = await blogApi.list({ limit: 50 });
    blogEntries = posts.map((post) => ({
      url: `${siteUrl}/landing/blog/${post.slug}`,
      lastModified: new Date(post.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    blogEntries = [];
  }

  return [
    {
      url: `${siteUrl}/landing/blog`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...blogEntries,
    {
      url: `${siteUrl}/landing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/landing/features`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/landing/how-it-works`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/landing/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/landing/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/landing/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
