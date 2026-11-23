/**
 * Word equations in the document view. The server converts each equation of
 * a Word file to LaTeX and keeps it in the file's HTML as the editor's maths
 * nodes (`data-type="inline-math"` / `"block-math"` with `data-latex`, in
 * document order; goscribe/server src/lib/coursework/omml.ts). The original
 * file's own drawing of an equation (docx-preview's MathML) loses accents,
 * stacks every token on its own line and flattens scripts, so the view
 * draws the server's LaTeX with KaTeX in its place.
 */

export interface DocMath {
  latex: string;
  /** A display equation on its own line. */
  block: boolean;
}

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/**
 * The equations of the body of a Word file's HTML, in order. Footnotes and
 * endnotes (mammoth puts them in a list at the end) are left out: the view
 * draws them elsewhere on the page.
 */
export function bodyMath(html: string | null | undefined): DocMath[] {
  if (!html) return [];
  const end = html.search(/<li id="(?:foot|end)note-/);
  const body = end >= 0 ? html.slice(0, end) : html;
  const out: DocMath[] = [];
  for (const m of body.matchAll(/<(?:span|div)\s+data-type="(inline|block)-math"\s+data-latex="([^"]*)"/g)) {
    const latex = decode(m[2]);
    out.push({ latex, block: m[1] === "block" || latex.startsWith("\\displaystyle") });
  }
  return out;
}

/** A header or footer that is only a page number ("3", "Page 3", "3 of 12", "- 3 -"): Word's PAGE field, drawn as its saved value on every page. */
export const LONE_PAGE_NUMBER = /^[\s\-–—]*(?:page\s*)?\d{1,3}(?:\s*(?:of|\/)\s*\d{1,3})?[\s\-–—]*$/i;

/** The class of an equation drawn by the view; `data-latex` on it holds the LaTeX. */
export const MATH_CLASS = "cw-docx-math";
