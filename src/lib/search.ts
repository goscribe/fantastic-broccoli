/**
 * The search palette's rows (purpose audit, finding 18): pages and subjects
 * matched in the browser, then the server's free local index (`search.query`)
 * grouped by type with a one-line preview each, and the AI search as the
 * last row. Pure, so the grouping and the links can be tested.
 */

export type SearchResultType = "session" | "material" | "mistake" | "topic" | "note";

export interface SearchLink {
  href: string;
  kind: SearchResultType;
  workspaceId?: string;
  sessionId?: string;
  fileId?: string;
  mistakeId?: string;
  courseId?: string;
  topicId?: string;
}

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  preview: string;
  workspaceId: string | null;
  workspaceTitle: string | null;
  link: SearchLink;
}

export interface SearchResponse {
  query: string;
  total: number;
  hasLocalResults: boolean;
  groups: Array<{ type: SearchResultType; results: SearchResult[] }>;
}

/** Shortest query the server searches (it returns no groups below this). */
export const SEARCH_MIN_CHARS = 2;

/** Order the groups appear in, whatever order the server sends. */
export const GROUP_ORDER: SearchResultType[] = ["session", "mistake", "topic", "note", "material"];

/** A page or subject matched in the browser. */
export interface LocalItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  kind: "page" | "subject" | "folder";
}

export type PaletteRow =
  | { row: "heading"; key: string; group: "pages" | "subjects" | SearchResultType }
  | { row: "local"; key: string; item: LocalItem }
  | { row: "result"; key: string; result: SearchResult; href: string }
  | { row: "ai"; key: string };

/** Only in-app paths: a server link is followed only if it is a path on this site. */
export function safeHref(href: string | undefined | null): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return null;
  return href;
}

/** Local items whose label contains the query (all of them, capped, for an empty query). */
export function matchLocal(items: LocalItem[], query: string, max = 6): LocalItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, max);
  return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, max);
}

/**
 * Every row of the palette, in order: local matches (subjects, then pages),
 * each server group under a heading, then the AI row once the query is long
 * enough. Headings are not selectable; `selectable` lists the rest.
 */
export function paletteRows(input: { query: string; local: LocalItem[]; server?: SearchResponse | null }): PaletteRow[] {
  const q = input.query.trim();
  const rows: PaletteRow[] = [];
  const subjects = input.local.filter((i) => i.kind !== "page");
  const pages = input.local.filter((i) => i.kind === "page");
  if (subjects.length) {
    rows.push({ row: "heading", key: "h-subjects", group: "subjects" });
    for (const item of subjects) rows.push({ row: "local", key: item.id, item });
  }
  if (pages.length) {
    rows.push({ row: "heading", key: "h-pages", group: "pages" });
    for (const item of pages) rows.push({ row: "local", key: item.id, item });
  }
  const groups = [...(input.server?.groups ?? [])].sort((a, b) => GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type));
  for (const g of groups) {
    const results = g.results.flatMap((r) => {
      const href = safeHref(r.link?.href);
      return href ? [{ result: r, href }] : [];
    });
    if (!results.length) continue;
    rows.push({ row: "heading", key: `h-${g.type}`, group: g.type });
    for (const { result, href } of results) rows.push({ row: "result", key: `${g.type}-${result.id}`, result, href });
  }
  if (q.length >= SEARCH_MIN_CHARS) rows.push({ row: "ai", key: "ai" });
  return rows;
}

export const selectable = (rows: PaletteRow[]) => rows.filter((r) => r.row !== "heading");

/** One line under a result: the preview, and the subject when it adds something. */
export function resultSubline(r: SearchResult): string {
  const preview = r.preview?.trim() ?? "";
  const subject = r.workspaceTitle?.trim() ?? "";
  if (!subject || preview === subject) return preview || subject;
  return preview ? `${subject} · ${preview}` : subject;
}
