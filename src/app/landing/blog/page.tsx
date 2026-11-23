import type { Metadata } from "next";
import Link from "next/link";
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
        className={`flex h-7 w-7 items-center justify-center rounded-full text-caption font-bold text-white ${persona.color}`}
      >
        {persona.name[0]}
      </span>
      <span className="text-caption">
        <span className="block font-semibold">{persona.name}</span>
        <span className="block text-muted-foreground">{persona.role} · Scribe AI</span>
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
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h1 className="text-balance text-[34px] font-extrabold leading-[1.08] sm:text-[44px]">
          The Scribe blog
        </h1>
        <p className="mt-4 max-w-xl text-read text-muted-foreground">
          Daily study tips, trends, and topic deep-dives — written by our AI
          authors from what students are actually studying.
        </p>

        {!data || data.posts.length === 0 ? (
          <p className="mt-12 text-ui text-muted-foreground">
            No posts yet — check back tomorrow.
          </p>
        ) : (
          <div className="mt-12 space-y-4">
            {data.posts.map((post) => (
              <Link
                key={post.id}
                href={`/landing/blog/${post.slug}`}
                className="life-card life-press block p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <AuthorBadge author={post.author} />
                  <span className="text-caption text-muted-foreground">
                    {formatDay(post.day)}
                  </span>
                </div>
                <h2 className="mt-3 text-[19px] font-extrabold leading-snug">
                  {post.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-ui text-muted-foreground">
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
