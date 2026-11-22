/**
 * The editor's `/` menu: what can be inserted, and how the typed word finds
 * it. Pure, so it is tested without an editor.
 */
export type SlashId =
  | "heading"
  | "subheading"
  | "bullets"
  | "numbers"
  | "quote"
  | "equation"
  | "equation-block"
  | "table"
  | "image"
  | "divider"
  | "footnote"
  | "reference"
  | "diagram";

export interface SlashCommand {
  id: SlashId;
  label: string;
  hint: string;
  /** Words that find it, beyond its label ("/maths", "/hr"). */
  keys: string[];
  /** Offered only when the host can do it. */
  needs?: "image" | "diagram";
}

export interface SlashContext {
  image: boolean;
  diagram: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "heading", label: "Heading", hint: "A section title", keys: ["h1", "title", "section"] },
  { id: "subheading", label: "Subheading", hint: "A smaller title", keys: ["h2", "heading"] },
  { id: "bullets", label: "Bulleted list", hint: "Points in any order", keys: ["list", "bullet", "ul"] },
  { id: "numbers", label: "Numbered list", hint: "Steps in order", keys: ["list", "ordered", "ol", "steps"] },
  { id: "quote", label: "Quote", hint: "A quotation set apart", keys: ["blockquote", "citation"] },
  { id: "equation", label: "Equation", hint: "Maths in the line", keys: ["math", "maths", "formula", "latex", "inline"] },
  { id: "equation-block", label: "Equation block", hint: "Maths on its own line", keys: ["equation", "math", "maths", "formula", "latex", "display"] },
  { id: "table", label: "Table", hint: "Rows and columns", keys: ["grid", "data"] },
  { id: "image", label: "Image", hint: "A picture from your device", keys: ["picture", "photo", "figure", "upload"], needs: "image" },
  { id: "divider", label: "Divider", hint: "A line between sections", keys: ["hr", "rule", "line", "separator"] },
  { id: "footnote", label: "Footnote", hint: "A numbered note at the end", keys: ["citation", "cite", "note", "reference"] },
  { id: "reference", label: "Reference entry", hint: "A new line in your bibliography", keys: ["citation", "cite", "bibliography", "source", "works cited"] },
  { id: "diagram", label: "Diagram", hint: "Describe it, Scribe draws it", keys: ["graph", "chart", "figure", "draw"], needs: "diagram" },
];

/**
 * The "/word" being typed at the end of `before` (the block's text up to the
 * caret): after a space or at the start of the line, letters only. Null when
 * the caret is not in one ("and/or", "1/2", a URL).
 */
export function slashQuery(before: string): { query: string; length: number } | null {
  const m = /(?:^|\s)\/([a-z]{0,20})$/i.exec(before);
  if (!m) return null;
  return { query: m[1].toLowerCase(), length: m[1].length + 1 };
}

/** Commands for a typed word, best first: the label starting with it, then a word of the label, then a keyword. */
export function filterCommands(all: SlashCommand[], query: string, context: SlashContext): SlashCommand[] {
  const q = query.trim().toLowerCase();
  const offered = all.filter((c) => !c.needs || context[c.needs]);
  if (!q) return offered;
  const rank = (c: SlashCommand) => {
    const label = c.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.split(" ").some((w) => w.startsWith(q))) return 1;
    if (c.keys.some((k) => k.startsWith(q))) return 2;
    return -1;
  };
  return offered
    .map((c, i) => ({ c, r: rank(c), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}
