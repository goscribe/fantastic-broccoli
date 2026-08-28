import { rpc } from "./study-session";

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  topic: string;
  day: string;
  createdAt: Date;
}

export interface BlogPostFull extends BlogPostSummary {
  content: string;
  published: boolean;
}

export interface BlogList {
  posts: BlogPostSummary[];
  nextCursor?: string;
}

/** Display info for the fixed AI author personas. */
export const BLOG_AUTHORS: Record<
  string,
  { name: string; role: string; color: string }
> = {
  sage: { name: "Sage", role: "Learning science", color: "bg-accent" },
  quill: { name: "Quill", role: "Study trends", color: "bg-sky-500" },
  atlas: { name: "Atlas", role: "Subject deep dives", color: "bg-pink-500" },
};

export const blogApi = {
  list: (input?: { limit?: number; cursor?: string }) =>
    rpc<BlogList>("blog.list", "query", input),

  get: (slug: string) => rpc<BlogPostFull>("blog.get", "query", { slug }),
};
