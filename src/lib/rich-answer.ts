/**
 * Rich answers are edited in a real editor but saved as plain text in the
 * app's own format — Markdown with LaTeX between $…$ — so drafts, marking and
 * the mistakes log read them as before, and MarkdownText renders them.
 * These convert between that text and the editor's document (Tiptap JSON).
 */

export interface RichMark {
  type: "bold" | "italic";
}

export type RichInline =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "inlineMath"; attrs: { latex: string } }
  | { type: "hardBreak" };

export interface RichDoc {
  type: "doc";
  content: Array<{ type: "paragraph"; content?: RichInline[] }>;
}

/** `$…$` maths, `**bold**`, `*italic*`, or an escaped dollar. */
const INLINE = /\\\$|\$([^$\n]+)\$|\*\*([^*\n]+)\*\*|\*([^*\s\n][^*\n]*)\*/g;

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

/** Saved answer text → editor document: one paragraph per line. */
export function answerToDoc(value: string): RichDoc {
  return {
    type: "doc",
    content: value.split("\n").map((line) => {
      const content = parseLine(line);
      return content.length ? { type: "paragraph", content } : { type: "paragraph" };
    }),
  };
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

/** Editor document → saved answer text. */
export function docToAnswer(doc: DocNode): string {
  return (doc.content ?? [])
    .map((block) => (block.content ?? []).map(inlineToText).join(""))
    .join("\n")
    .replace(/\s+$/, "");
}

/** Whether the text has anything a plain box would show differently (maths, bold, italics). */
export function hasRichContent(value: string): boolean {
  return /\$[^$]+\$|\\\(|\\\[|\*\*[^*]+\*\*|(^|\s)\*[^*\s][^*]*\*/.test(value);
}
