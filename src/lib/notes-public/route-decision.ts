import { coursePath, resolveSegment, type SlugUnit } from "./slug";

/** Files Next serves under /notes/... that are not note pages. */
const RESERVED = /^(sitemap|opengraph-image|twitter-image|icon|apple-icon)(\b|[.-])/;

/** Sitemaps, OG images and other generated files under /notes. */
export const isReservedNotesPath = (courseId: string, segment: string | undefined) =>
  RESERVED.test(courseId) || (segment !== undefined && (RESERVED.test(segment) || segment === ""));

export type RouteDecision = { action: "next" } | { action: "redirect"; path: string } | { action: "not_found" };

/**
 * What the proxy does with /notes/<courseId>[/<segment>]:
 * - outline `undefined` (not looked up, or the API failed): let the page handle it;
 * - unknown course (outline null) or unknown segment: 404;
 * - non-canonical segment: 308 to the canonical one;
 * - otherwise render. Pure, so it is tested.
 */
export function notesRouteDecision(
  courseId: string | undefined,
  segment: string | undefined,
  outline: { id: string; units: SlugUnit[] } | null | undefined,
): RouteDecision {
  if (!courseId || isReservedNotesPath(courseId, segment)) return { action: "next" };
  if (outline === undefined) return { action: "next" };
  if (outline === null) return { action: "not_found" };
  if (segment === undefined) return { action: "next" };
  const m = resolveSegment(outline.units, segment);
  if (!m) return { action: "not_found" };
  if (!m.canonical) return { action: "redirect", path: `${coursePath(outline.id)}/${m.slug}` };
  return { action: "next" };
}
