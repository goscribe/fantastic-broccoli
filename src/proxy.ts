import { NextResponse, type NextRequest } from "next/server";
import { publicNotesApi, type PublicCourse } from "@/lib/api/public-notes";
import { isCourseCardPath, isReservedNotesPath, notesRouteDecision } from "@/lib/notes-public/route-decision";

/**
 * Real HTTP status codes for the public note pages. Pages stream (the root
 * loading.tsx), so a `notFound()` or `permanentRedirect()` inside them can
 * only send 200 + a noindex / meta-refresh. Here, before rendering, an
 * unknown course or topic gets a 404 and an old or bare slug
 * (/notes/ib-biology/a1-1) a 308 to its canonical URL. Course outlines are
 * cached in memory for 10 minutes; if the API is unreachable the request
 * passes through and the page handles it.
 */

export const config = { matcher: ["/notes/:course", "/notes/:course/:segment"] };

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; course: PublicCourse | null }>();

async function outline(courseId: string): Promise<PublicCourse | null | undefined> {
  const hit = cache.get(courseId);
  if (hit && Date.now() - hit.at < TTL) return hit.course;
  try {
    const course = await publicNotesApi.course(courseId);
    if (cache.size > 200) cache.clear();
    cache.set(courseId, { at: Date.now(), course });
    return course;
  } catch (e) {
    console.warn("notes proxy: outline lookup failed", courseId, e instanceof Error ? e.message : e);
    return undefined;
  }
}

const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | Scribe</title><style>body{font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#1f1b2e;background:#fff}main{max-width:420px;padding:24px;text-align:center}a{display:inline-block;margin-top:16px;padding:10px 18px;border-radius:12px;background:#6952E0;color:#fff;font-weight:700;text-decoration:none}</style></head><body><main><h1>We couldn't find that topic</h1><p>It may have moved. Browse every course's notes and practice questions instead.</p><a href="/notes">All courses</a></main></body></html>`;

export async function proxy(request: NextRequest) {
  const [, , courseId, segment] = request.nextUrl.pathname.split("/");
  const decision = notesRouteDecision(courseId, segment, await outlineFor(courseId, segment));
  if (decision.action === "next") return NextResponse.next();
  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.path;
    return NextResponse.redirect(url, 308);
  }
  return new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
}

/** Skips the lookup for paths that are not note pages (sitemaps, the index's OG images); a course's card needs it (404 when unknown). */
async function outlineFor(courseId: string | undefined, segment: string | undefined) {
  if (!courseId || (isReservedNotesPath(courseId, segment) && !isCourseCardPath(courseId, segment))) return undefined;
  return outline(decodeURIComponent(courseId));
}
