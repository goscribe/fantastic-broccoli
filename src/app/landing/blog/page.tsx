import type { Metadata } from "next";
import Link from "next/link";
import { GlowField } from "@/components/graphics/landing-art";
import { blogApi, BLOG_AUTHORS, type BlogList } from "@/lib/api/blog";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The Scribe Blog — Daily Study Tips, Trends & Topic Deep-Dives",
  description:
    "Daily study tips, learning-science techniques, and topic deep-dives — written from what students are actually studying on Scribe.",
  alternates: { canonical: "/landing/blog" },
};

function AuthorBadge({ author }: { author: string }) {
  const persona = BLOG_AUTHORS[author] ?? {
    name: author,
    role: "Scribe AI",
    color: "bg-accent",
  };
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${persona.color}`}
      >
        {persona.name[0]}
      </span>
      <span className="text-xs">
        <span className="block font-semibold">{persona.name}</span>
        <span className="block text-faint">{persona.role} · Scribe AI</span>
      </span>
    </span>
  );
}

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogIndexPage() {
  let data: BlogList | null = null;
  try {
    data = await blogApi.list({ limit: 30 });
  } catch {
    data = null;
  }

  return (
    <section className="relative overflow-hidden py-16 md:py-20">
      <GlowField />
      <div className="relative mx-auto max-w-4xl px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          The Scribe blog
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Daily study tips, trends, and topic deep-dives — written by our AI
          authors from what students are actually studying.
        </p>

        {!data || data.posts.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            No posts yet — check back tomorrow.
          </p>
        ) : (
          <div className="mt-12 space-y-4">
            {data.posts.map((post) => (
              <Link
                key={post.id}
                href={`/landing/blog/${post.slug}`}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50 sm:p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <AuthorBadge author={post.author} />
                  <span className="text-xs text-faint">
                    {formatDay(post.day)}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug">
                  {post.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
