/**
 * Page-view reporting: turns the current URL into a route pattern
 * (`/workspace/[id]/study`) so the server never receives raw ids, query
 * strings or fragments. Kept free of framework imports so it can be tested.
 */

export type RouteParams = Record<string, string | string[] | undefined>;

/**
 * Replaces each dynamic segment of `pathname` with its param name, using the
 * params Next.js reports for the current route.
 */
export function routePattern(pathname: string, params: RouteParams): string {
  const segments = pathname.split(/[?#]/, 1)[0].split("/").filter(Boolean);
  const taken = new Set<number>();
  for (const [name, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      const i = segments.findIndex(
        (s, idx) => !taken.has(idx) && (s === v || s === encodeURIComponent(v) || safeDecode(s) === v),
      );
      if (i >= 0) {
        segments[i] = `[${name}]`;
        taken.add(i);
      }
    }
  }
  return `/${segments.join("/")}`;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export interface PageView {
  path: string;
  /** The subject a `/workspace/[id]/…` page belongs to. */
  workspaceId?: string;
}

/** What to report for the current page. */
export function pageViewFor(pathname: string, params: RouteParams): PageView {
  const path = routePattern(pathname, params);
  const id = params.id;
  return path.startsWith("/workspace/[id]") && typeof id === "string"
    ? { path, workspaceId: id }
    : { path };
}

/** Identity of a page view; two navigations with the same key are the same page. */
export function pageViewKey(view: PageView): string {
  return `${view.path}|${view.workspaceId ?? ""}`;
}
