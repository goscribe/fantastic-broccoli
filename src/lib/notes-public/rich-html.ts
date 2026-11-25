import katex from "katex";
import { tokenizeInline } from "@/lib/notes-public/inline";
import { tidyMath } from "@/lib/notes";

/**
 * RichText (components/notes-public/rich-text.tsx) as an HTML string, for
 * content a client island receives as data (flashcards fetched after sign-in)
 * instead of as server-rendered nodes. Same tokens, same KaTeX options, so a
 * card reads like the note. Server-only: it imports KaTeX.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function richTextHtml(text: string): string {
  return tokenizeInline(tidyMath(text))
    .map((tok) => {
      switch (tok.t) {
        case "text":
          return esc(tok.v);
        case "strong":
          return `<strong>${esc(tok.v)}</strong>`;
        case "em":
          return `<em>${esc(tok.v)}</em>`;
        case "code":
          return `<code class="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">${esc(tok.v)}</code>`;
        case "link":
          return `<a href="${esc(tok.href)}" rel="nofollow noopener" target="_blank" class="font-semibold text-accent underline-offset-2 hover:underline">${esc(tok.v)}</a>`;
        case "math":
          try {
            const html = katex.renderToString(tok.latex, { throwOnError: true, displayMode: tok.display, output: "htmlAndMathml" });
            return tok.display ? `<span class="nl-math-block my-2 block max-w-full overflow-x-auto">${html}</span>` : html;
          } catch {
            return `<code class="font-mono text-[0.92em]">${esc(tok.latex)}</code>`;
          }
      }
    })
    .join("");
}
