import katex from "katex";
import { tokenizeInline } from "@/lib/notes-public/inline";
import { tidyMath } from "@/lib/notes";

/**
 * Server-only inline markdown + maths for the public note pages. KaTeX runs
 * here, at render time, so the browser gets finished HTML and no maths
 * JavaScript. Never import this from a client component (it would ship KaTeX);
 * pass the rendered nodes to client islands as props instead.
 */
export function RichText({ text }: { text: string }) {
  const tokens = tokenizeInline(tidyMath(text));
  return (
    <>
      {tokens.map((tok, i) => {
        switch (tok.t) {
          case "text":
            return <span key={i}>{tok.v}</span>;
          case "strong":
            return <strong key={i}>{tok.v}</strong>;
          case "em":
            return <em key={i}>{tok.v}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
                {tok.v}
              </code>
            );
          case "link":
            return (
              <a key={i} href={tok.href} rel="nofollow noopener" target="_blank" className="font-semibold text-accent underline-offset-2 hover:underline">
                {tok.v}
              </a>
            );
          case "math": {
            let html: string;
            try {
              html = katex.renderToString(tok.latex, { throwOnError: true, displayMode: tok.display, output: "htmlAndMathml" });
            } catch {
              return (
                <code key={i} className="font-mono text-[0.92em]">
                  {tok.latex}
                </code>
              );
            }
            return (
              <span
                key={i}
                className={tok.display ? "my-2 block max-w-full overflow-x-auto" : undefined}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
        }
      })}
    </>
  );
}
