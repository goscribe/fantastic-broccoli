import type { NextRequest } from "next/server";
import { flashcardSet } from "@/lib/notes-public/flashcards-server";

/**
 * A topic's flashcards for the deck island (components/notes-public/flashcards.tsx):
 * the free cards by default, every card with `?all=1`. The island asks for all
 * of them only once the visitor is signed in (sessions live on the API host,
 * so this route cannot check one itself); the topic page's HTML carries only
 * the free cards. Decks change only on a deploy, so responses cache for a day.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string; topicId: string }> }) {
  const { courseId, topicId } = await params;
  const all = request.nextUrl.searchParams.get("all") === "1";
  const set = await flashcardSet(courseId, topicId, all);
  if (!set) return Response.json({ error: "No flashcards for this topic" }, { status: 404 });
  return Response.json(set, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
