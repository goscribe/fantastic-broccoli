/**
 * Rich answers stay plain text in the app's own format — Markdown with LaTeX
 * between $…$ — so drafts, marking and the mistakes log read them as before,
 * and MarkdownText renders them. These helpers insert formatting at the caret.
 */

export type SnippetId = "bold" | "italic" | "math" | "frac" | "pow" | "sub" | "sqrt" | "pi" | "times" | "div" | "le" | "ge";

interface Snippet {
  /** `{sel}` is the selected text; `|` is where the caret lands. */
  template: string;
  /** LaTeX: wrapped in $…$ unless the caret is already inside maths. */
  math: boolean;
}

export const SNIPPETS: Record<SnippetId, Snippet> = {
  bold: { template: "**{sel}|**", math: false },
  italic: { template: "*{sel}|*", math: false },
  math: { template: "${sel}|$", math: false },
  frac: { template: "\\frac{{sel}|}{}", math: true },
  pow: { template: "{sel}^{|}", math: true },
  sub: { template: "{sel}_{|}", math: true },
  sqrt: { template: "\\sqrt{{sel}|}", math: true },
  pi: { template: "{sel}\\pi |", math: true },
  times: { template: "{sel} \\times |", math: true },
  div: { template: "{sel} \\div |", math: true },
  le: { template: "{sel} \\le |", math: true },
  ge: { template: "{sel} \\ge |", math: true },
};

/** Whether `pos` sits between an opening and a closing `$` (escaped \$ doesn't count). */
export function insideMath(value: string, pos: number): boolean {
  let open = false;
  for (let i = 0; i < pos && i < value.length; i++) {
    if (value[i] === "\\") {
      i++;
      continue;
    }
    if (value[i] === "$") open = !open;
  }
  return open;
}

/** Insert a snippet over the selection [start, end); returns the new text and caret. */
export function applySnippet(value: string, start: number, end: number, id: SnippetId): { value: string; caret: number } {
  const { template, math } = SNIPPETS[id];
  const sel = value.slice(start, end);
  let body = template.replace("{sel}", sel);
  if (math && !insideMath(value, start)) body = `$${body}$`;
  const at = body.indexOf("|");
  body = body.replace("|", "");
  return { value: value.slice(0, start) + body + value.slice(end), caret: start + at };
}

/** Whether the text has anything a preview would show differently (maths, bold, italics). */
export function hasRichContent(value: string): boolean {
  return /\$[^$]+\$|\\\(|\\\[|\*\*[^*]+\*\*|(^|\s)\*[^*\s][^*]*\*/.test(value);
}
