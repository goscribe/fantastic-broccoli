/**
 * "My notes": pure helpers for a student's own notes and for highlights in
 * any note (no React, no DOM), so they are tested on their own.
 */
import type { DiagramFigure, DiagramSpec, HighlightAnchor, HighlightColor } from "@/lib/api/my-notes";

/** A student's own note opens in the editor, inside its subject. */
export const ownNoteHref = (workspaceId: string, noteId: string) => `/workspace/${encodeURIComponent(workspaceId)}/note/${encodeURIComponent(noteId)}`;

export const DEFAULT_NOTE_TITLE = "Untitled note";

/* ---------- The subject a new note goes in ---------- */

const LAST_SUBJECT_KEY = "scribe.myNotes.lastSubject";

export function lastNoteSubject(): string | null {
  try {
    return localStorage.getItem(LAST_SUBJECT_KEY);
  } catch {
    return null;
  }
}

export function rememberNoteSubject(workspaceId: string): void {
  try {
    localStorage.setItem(LAST_SUBJECT_KEY, workspaceId);
  } catch {
    /* private mode */
  }
}

/** The subject "New note" offers first: the one last written in, else the most recently used. */
export function defaultNoteSubject<T extends { id: string }>(subjects: T[], last: string | null): T | null {
  return subjects.find((s) => s.id === last) ?? subjects[0] ?? null;
}

/* ---------- Highlight colours ---------- */

/**
 * The four highlighters: the app's own highlighter yellow (--hl) and three
 * from the subject palette. `var` is the CSS custom property that carries the
 * colour (my-notes.css), so a mark is never a hard-coded hex in markup.
 */
export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; var: string }[] = [
  { id: "yellow", label: "Yellow", var: "--hl-yellow" },
  { id: "green", label: "Green", var: "--hl-green" },
  { id: "pink", label: "Pink", var: "--hl-pink" },
  { id: "blue", label: "Blue", var: "--hl-blue" },
];

export const isHighlightColor = (c: unknown): c is HighlightColor => HIGHLIGHT_COLORS.some((x) => x.id === c);

const LAST_COLOR_KEY = "scribe.myNotes.highlightColor";

export function lastHighlightColor(): HighlightColor {
  try {
    const c = localStorage.getItem(LAST_COLOR_KEY);
    return isHighlightColor(c) ? c : "yellow";
  } catch {
    return "yellow";
  }
}

export function rememberHighlightColor(color: HighlightColor): void {
  try {
    localStorage.setItem(LAST_COLOR_KEY, color);
  } catch {
    /* private mode */
  }
}

/* ---------- Highlight anchors (Scribe notes) ---------- */

export const ANCHOR_CONTEXT = 40;
export const MAX_QUOTE = 1200;

/** The anchor for `text.slice(start, end)` inside a section: the words, a little either side, and where they were. */
export function makeAnchor(sectionId: string, text: string, start: number, end: number): HighlightAnchor | null {
  // Whitespace at the ends of a selection (a dragged-over line break) is not part of the highlight.
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  if (end - start < 1) return null;
  end = Math.min(end, start + MAX_QUOTE);
  return {
    sectionId,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - ANCHOR_CONTEXT), start),
    suffix: text.slice(end, end + ANCHOR_CONTEXT),
    startOffset: start,
  };
}

/**
 * Where the highlighter toolbar goes for a selection (or a tapped highlight)
 * whose box on screen is `rect`, or null when it should not be shown: the
 * selection has no box (nothing is selected, or what was selected is not
 * drawn), or it is off the screen, where a toolbar pinned to the screen's edge
 * would float over unrelated parts of the note. Above the words with a mouse;
 * under them on touch, clear of the system's own selection menu.
 */
export function highlightBarPlace(
  rect: { top: number; bottom: number; left: number; width: number; height: number },
  viewport: { width: number; height: number },
  touch: boolean,
): { x: number; y: number; below: boolean } | null {
  if (rect.width <= 0 && rect.height <= 0) return null;
  if (rect.bottom <= 0 || rect.top >= viewport.height) return null;
  const below = touch || rect.top < 130;
  return {
    x: Math.max(110, Math.min(rect.left + rect.width / 2, viewport.width - 110)),
    y: below ? Math.min(rect.bottom + (touch ? 48 : 10), viewport.height - 130) : rect.top - 10,
    below,
  };
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

/**
 * Where an anchor's words are in a section's text now: at its stored offset
 * when nothing moved, otherwise the occurrence of the words whose
 * surroundings match best (nearest to the old place on a tie). Null when the
 * words are no longer there: the highlight is left out, not guessed.
 */
export function locateAnchor(text: string, anchor: Pick<HighlightAnchor, "quote" | "prefix" | "suffix" | "startOffset">): { start: number; end: number; moved: boolean } | null {
  const { quote } = anchor;
  if (!quote) return null;
  if (text.startsWith(quote, anchor.startOffset)) return { start: anchor.startOffset, end: anchor.startOffset + quote.length, moved: false };
  let best: { at: number; score: number } | null = null;
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    const score = commonSuffix(text.slice(Math.max(0, at - ANCHOR_CONTEXT), at), anchor.prefix) + commonPrefix(text.slice(at + quote.length, at + quote.length + ANCHOR_CONTEXT), anchor.suffix);
    if (!best || score > best.score || (score === best.score && Math.abs(at - anchor.startOffset) < Math.abs(best.at - anchor.startOffset))) best = { at, score };
  }
  return best ? { start: best.at, end: best.at + quote.length, moved: true } : null;
}

/**
 * Finds an anchor in a note: its own section first, then every other section
 * (a paragraph moved by a correction). `sections` are in reading order.
 */
export function locateInNote(sections: { id: string; text: string }[], anchor: HighlightAnchor): { sectionId: string; start: number; end: number; moved: boolean } | null {
  const own = sections.find((s) => s.id === anchor.sectionId);
  const hit = own ? locateAnchor(own.text, anchor) : null;
  if (own && hit) return { sectionId: own.id, ...hit };
  for (const s of sections) {
    if (s === own) continue;
    const found = locateAnchor(s.text, anchor);
    if (found) return { sectionId: s.id, start: found.start, end: found.end, moved: true };
  }
  return null;
}

/** Reading order: by section as the note lists them, then by place in the section. */
export function sortByPlace<T extends { sectionId: string; start: number }>(items: T[], sectionOrder: string[]): T[] {
  const rank = new Map(sectionOrder.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.sectionId) ?? 1e6) - (rank.get(b.sectionId) ?? 1e6) || a.start - b.start);
}

/** A highlight in the list: its words on one line, cut in the middle of nothing. */
export function quotePreview(quote: string, max = 140): string {
  const t = quote.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/* ---------- Highlights in a student's own note (editor marks) ---------- */

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
}

export interface DocHighlight {
  /** Position in reading order (0, 1, …): how the editor finds it again. */
  index: number;
  text: string;
  color: HighlightColor;
}

/** The highlighted passages of an editor document, in reading order; a run of one colour inside one block is one highlight. */
export function docHighlights(doc: unknown): DocHighlight[] {
  const out: DocHighlight[] = [];
  const walk = (node: DocNode) => {
    let open: { text: string; color: HighlightColor } | null = null;
    const close = () => {
      if (open && open.text.trim()) out.push({ index: out.length, text: open.text, color: open.color });
      open = null;
    };
    for (const child of node.content ?? []) {
      const mark = child.type === "text" ? child.marks?.find((m) => m.type === "highlight") : undefined;
      if (mark && child.text) {
        const color = isHighlightColor(mark.attrs?.color) ? mark.attrs.color : "yellow";
        if (open && open.color === color) open.text += child.text;
        else {
          close();
          open = { text: child.text, color };
        }
      } else {
        close();
        if (child.content) walk(child);
      }
    }
    close();
  };
  if (doc && typeof doc === "object") walk(doc as DocNode);
  return out;
}

/* ---------- Figures (/diagram) ---------- */

/** A stored figure block read back from a document (anything could be in there). */
export function isDiagramFigure(v: unknown): v is DiagramFigure {
  const f = v as Partial<DiagramFigure> | null;
  if (!f || typeof f !== "object" || typeof f.title !== "string") return false;
  if (f.kind === "graph") return !!f.graph && Array.isArray(f.graph.expressions) && !!f.graph.bounds;
  if (f.kind === "diagram") return !!f.diagram && Array.isArray(f.diagram.nodes) && Array.isArray(f.diagram.edges);
  if (f.kind === "sketch") {
    const k = f.sketch;
    return !!k && !!k.bounds && ["curves", "points", "marks", "arrows", "regions", "texts"].every((part) => Array.isArray(k[part as keyof typeof k]));
  }
  return false;
}

/** How deep each node of a tree sits (root = 0), and the nodes of each level in order. Nodes no arrow reaches go on the first level. */
export function treeLevels(d: DiagramSpec): string[][] {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of d.edges) {
    children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
    hasParent.add(e.to);
  }
  const levels: string[][] = [];
  const seen = new Set<string>();
  let row = d.nodes.map((n) => n.id).filter((id) => !hasParent.has(id));
  if (row.length === 0 && d.nodes[0]) row = [d.nodes[0].id];
  while (row.length) {
    row = row.filter((id) => !seen.has(id));
    if (!row.length) break;
    row.forEach((id) => seen.add(id));
    levels.push(row);
    row = row.flatMap((id) => children.get(id) ?? []);
  }
  const rest = d.nodes.map((n) => n.id).filter((id) => !seen.has(id));
  if (rest.length) levels.push(rest);
  return levels;
}

/** Breaks a label into lines of at most `max` characters, at spaces (a long word stays whole). */
export function wrapLabel(text: string, max: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/.$/, "")}…`;
    return kept;
  }
  return lines;
}
