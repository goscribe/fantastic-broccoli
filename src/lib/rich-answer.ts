/**
 * Rich answers are edited in a real editor but saved as plain text in the
 * app's own format — Markdown with LaTeX between $…$ — so drafts, marking and
 * the mistakes log read them as before, and MarkdownText renders them.
 * These convert between that text and the editor's document (Tiptap JSON).
 *
 * Besides lines of text (bold, italics, maths) an answer can hold:
 * - tables, as GFM pipe tables: the first row is the header, a `|` inside a
 *   cell is written `\|` (in maths too), a line break in a cell is `<br>`;
 * - figures (a photo, an upload or a sketch), as `![caption](url)` on a line
 *   of its own.
 * Both are written with a blank line before and after them, as Markdown
 * needs; reading back, that blank line is the separator, not an empty line.
 */

export interface RichMark {
  type: "bold" | "italic";
}

export type RichInline =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "inlineMath"; attrs: { latex: string } }
  | { type: "hardBreak" };

export interface RichParagraph {
  type: "paragraph";
  content?: RichInline[];
}

export interface RichCell {
  type: "tableHeader" | "tableCell";
  content: RichParagraph[];
}

export interface RichTable {
  type: "table";
  content: Array<{ type: "tableRow"; content: RichCell[] }>;
}

export interface RichFigure {
  type: "answerFigure";
  attrs: { src: string; caption: string };
}

export type RichBlock = RichParagraph | RichTable | RichFigure;

export interface RichDoc {
  type: "doc";
  content: RichBlock[];
}

/** At most this many figures in one answer (the server marks no more). */
export const MAX_ANSWER_FIGURES = 4;

/** `$…$` maths, `**bold**`, `*italic*`, or an escaped dollar. */
const INLINE = /\\\$|\$([^$\n]+)\$|\*\*([^*\n]+)\*\*|\*([^*\s\n][^*\n]*)\*/g;

/** A table line, a header separator (same rules as MarkdownText), a figure on its own line. */
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/;
const FIGURE_LINE = /^\s*!\[([^\]\n]*)\]\(([^)\s]+)\)\s*$/;
const CELL_BREAK = /<br\s*\/?>/gi;

function parseLine(line: string): RichInline[] {
  const out: RichInline[] = [];
  const text = (t: string, marks?: RichMark[]) => {
    if (!t) return;
    const last = out[out.length - 1];
    // Plain runs join up, so an escaped $ doesn't split the text.
    if (!marks && last?.type === "text" && !last.marks) last.text += t;
    else out.push(marks ? { type: "text", text: t, marks } : { type: "text", text: t });
  };
  let at = 0;
  for (const m of line.matchAll(INLINE)) {
    text(line.slice(at, m.index));
    if (m[0] === "\\$") text("$");
    else if (m[1] !== undefined) out.push({ type: "inlineMath", attrs: { latex: m[1].trim() } });
    else if (m[2] !== undefined) text(m[2], [{ type: "bold" }]);
    else if (m[3] !== undefined) text(m[3], [{ type: "italic" }]);
    at = (m.index ?? 0) + m[0].length;
  }
  text(line.slice(at));
  return out;
}

const paragraph = (content: RichInline[]): RichParagraph => (content.length ? { type: "paragraph", content } : { type: "paragraph" });

/** One table line → its cells' text: split on `|` that are not escaped, `\|` read back as `|`. */
export function splitTableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "");
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  // The text after the closing pipe (normally nothing) is not a cell.
  if (cur.trim()) cells.push(cur.trim());
  return cells;
}

function parseCell(text: string, type: RichCell["type"]): RichCell {
  const inline: RichInline[] = [];
  text.split(CELL_BREAK).forEach((piece, i) => {
    if (i > 0) inline.push({ type: "hardBreak" });
    inline.push(...parseLine(piece.trim()));
  });
  return { type, content: [paragraph(inline)] };
}

function parseTable(lines: string[]): RichTable {
  const [header, , ...body] = lines;
  const head = splitTableCells(header);
  const cols = Math.max(1, head.length);
  const row = (cells: string[], type: RichCell["type"]) => ({
    type: "tableRow" as const,
    // Every row as wide as the header: short rows are padded, long ones cut (as GFM does).
    content: Array.from({ length: cols }, (_, c) => parseCell(cells[c] ?? "", type)),
  });
  return { type: "table", content: [row(head, "tableHeader"), ...body.map((l) => row(splitTableCells(l), "tableCell"))] };
}

/** Saved answer text → editor document: a paragraph per line; tables and figures as their own blocks. */
export function answerToDoc(value: string): RichDoc {
  const lines = value.split("\n");
  const content: RichBlock[] = [];
  /** Whether the last block is the empty paragraph a blank line made (and may be a block's separator). */
  let lastBlank = false;
  const pushBlock = (block: RichTable | RichFigure, end: number) => {
    // The blank line written before a table or figure is its separator, not an empty line.
    if (lastBlank && content.length > 1) content.pop();
    content.push(block);
    lastBlank = false;
    // …and so is the one after it, when something follows.
    return end < lines.length - 1 && !lines[end].trim() ? end + 1 : end;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
      let end = i + 2;
      while (end < lines.length && TABLE_ROW.test(lines[end])) end++;
      i = pushBlock(parseTable(lines.slice(i, end)), end);
      continue;
    }
    const figure = FIGURE_LINE.exec(line);
    if (figure) {
      i = pushBlock({ type: "answerFigure", attrs: { caption: figure[1].trim(), src: figure[2] } }, i + 1);
      continue;
    }
    const inline = parseLine(line);
    content.push(paragraph(inline));
    lastBlank = !inline.length;
    i++;
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string }>;
  content?: DocNode[];
}

function inlineToText(node: DocNode): string {
  if (node.type === "inlineMath") return `$${String(node.attrs?.latex ?? "").trim()}$`;
  if (node.type === "hardBreak") return "\n";
  if (node.type !== "text") return (node.content ?? []).map(inlineToText).join("");
  const raw = (node.text ?? "").replace(/\$/g, "\\$");
  const marks = new Set((node.marks ?? []).map((m) => m.type));
  // Keep the spaces outside the markers, or `** bold**` stops being bold.
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw) ?? ["", "", raw, ""];
  if (!core) return raw;
  let body = core;
  if (marks.has("italic")) body = `*${body}*`;
  if (marks.has("bold")) body = `**${body}**`;
  return lead + body + trail;
}

/** One cell's text on a table line: pipes escaped, line breaks as `<br>`. */
function cellToText(cell: DocNode): string {
  const text = (cell.content ?? [])
    .map((p) => (p.content ?? []).map(inlineToText).join(""))
    .join("\n")
    .trim()
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
  // A trailing backslash would escape the cell's closing pipe.
  return text.endsWith("\\") && !text.endsWith("\\|") ? `${text} ` : text;
}

function tableToText(table: DocNode): string {
  const rows = (table.content ?? []).filter((r) => r.type === "tableRow").map((r) => (r.content ?? []).map(cellToText));
  if (!rows.length) return "";
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: cols }, (_, c) => cells[c] || " ").join(" | ")} |`;
  // GFM tables always have a header row: the first row is it.
  return [line(rows[0]), `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

/** A caption as Markdown alt text: one line, no square brackets. */
export function cleanCaption(caption: string): string {
  return caption.replace(/[[\]\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
}

function figureToText(node: DocNode): string {
  const src = String(node.attrs?.src ?? "").replace(/[\s)]/g, encodeURIComponent);
  return src ? `![${cleanCaption(String(node.attrs?.caption ?? ""))}](${src})` : "";
}

/** Editor document → saved answer text. */
export function docToAnswer(doc: DocNode): string {
  const blocks = (doc.content ?? []).map((block) => {
    if (block.type === "table") return { text: tableToText(block), own: true };
    if (block.type === "answerFigure") return { text: figureToText(block), own: true };
    return { text: (block.content ?? []).map(inlineToText).join(""), own: false };
  });
  let out = "";
  blocks.forEach((b, i) => {
    if (i > 0) out += b.own || blocks[i - 1].own ? "\n\n" : "\n";
    out += b.text;
  });
  return out.replace(/\s+$/, "");
}

/** The figures an answer holds (`![caption](url)` lines), in order. */
export function answerFigures(value: string): Array<{ src: string; caption: string }> {
  return value
    .split("\n")
    .map((l) => FIGURE_LINE.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ caption: m[1].trim(), src: m[2] }));
}

/** Whether the answer holds a table or a figure (blocks a plain text view cannot show). */
export function hasAnswerBlocks(value: string): boolean {
  const lines = value.split("\n");
  return lines.some((l, i) => FIGURE_LINE.test(l) || (TABLE_ROW.test(l) && TABLE_SEPARATOR.test(lines[i + 1] ?? "")));
}

/** Whether the text has anything a plain box would show differently (maths, bold, italics, tables, figures). */
export function hasRichContent(value: string): boolean {
  return /\$[^$]+\$|\\\(|\\\[|\*\*[^*]+\*\*|(^|\s)\*[^*\s][^*]*\*/.test(value) || hasAnswerBlocks(value);
}
