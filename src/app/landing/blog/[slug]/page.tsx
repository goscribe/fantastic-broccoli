import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MarkdownText } from "@/components/ui/markdown-text";
import { blogApi, BLOG_AUTHORS, type BlogPostFull } from "@/lib/api/blog";

export const revalidate = 3600;

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function fetchPost(slug: string): Promise<BlogPostFull | null> {
  try {
    return await blogApi.get(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return { title: "Post not found" };
  const persona = BLOG_AUTHORS[post.author];
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/landing/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: `${post.day}T09:00:00Z`,
      authors: persona ? [`${persona.name} (Scribe AI)`] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  const persona = BLOG_AUTHORS[post.author] ?? {
    name: post.author,
    role: "Scribe AI",
    color: "bg-accent",
  };

  return (
    <section className="py-14 md:py-18">
      <div className="mx-auto max-w-3xl px-6">
        <Link
          href="/landing/blog"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All posts
        </Link>

        <article className="mt-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-5 flex items-center gap-3 border-b border-border pb-6">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${persona.color}`}
            >
              {persona.name[0]}
            </span>
            <div className="text-sm">
              <p className="font-semibold">
                {persona.name}{" "}
                <span className="font-normal text-faint">· Scribe AI</span>
              </p>
              <p className="text-xs text-faint">
                {persona.role} · {formatDay(post.day)}
              </p>
            </div>
          </div>
          <MarkdownText
            text={post.content}
            className="mt-8 text-[15px] leading-relaxed"
          />
        </article>
      </div>
    </section>
  );
}
