/**
 * Tokenizer for the light markdown in notes and practice questions (**bold**,
 * *italic*, `code`, [links](https://…), $…$ / $$…$$ / \(…\) LaTeX and bare
 * fragments like `x^{2}`), matching src/components/ui/markdown-text.tsx so a
 * public page reads exactly like the signed-in reader. Pure and framework-free:
 * the public pages render the tokens on the server (KaTeX runs there, so no
 * maths JavaScript reaches the browser).
 */

export type InlineToken =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; v: string; href: string }
  | { t: "math"; latex: string; display: boolean };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
const BARE_MATH_SRC =
  "[A-Za-z0-9()\\[\\]+\\-=/]*(?:[\\^_]\\{[^{}]*\\}|\\\\[a-zA-Z]+\\{[^{}]*\\})(?:[A-Za-z0-9^_+\\-=/()\\[\\]]|\\{[^{}]*\\}|\\\\[a-zA-Z]+)*";
const MATH_RE = new RegExp(
  `(\\$\\$[\\s\\S]+?\\$\\$|\\\\\\[[\\s\\S]+?\\\\\\]|(?<!\\\\)\\$(?:\\\\\\$|[^$\\n])+?(?<!\\\\)\\$(?!\\d)|\\\\\\([\\s\\S]+?\\\\\\)|${BARE_MATH_SRC})`,
  "g",
);
const TEXT_GROUP = /\\(?:text|textbf|textit|mathrm|mathbf|operatorname|mbox)\s*\{[^{}]*\}/g;
const LATEX_COMMAND = /\\[A-Za-z]+/g;
const PROSE_RUN = /[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){2}/;
const looksLikeProse = (inner: string) => PROSE_RUN.test(inner.replace(TEXT_GROUP, " ").replace(LATEX_COMMAND, " "));
const unescapeChars = (text: string) => text.replace(/\\([%$&#_{}])/g, "$1");

function mathToken(token: string): { latex: string; display: boolean } {
  if (token.startsWith("$$") || token.startsWith("\\[")) return { latex: token.slice(2, -2), display: true };
  if (token.startsWith("$")) return { latex: token.slice(1, -1), display: false };
  if (token.startsWith("\\(")) return { latex: token.slice(2, -2), display: false };
  return { latex: token, display: false };
}

function formatting(raw: string): InlineToken[] {
  const text = unescapeChars(raw);
  const out: InlineToken[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ t: "text", v: text.slice(last, idx) });
    const tok = m[0];
    if (tok.startsWith("**")) out.push({ t: "strong", v: tok.slice(2, -2) });
    else if (tok.startsWith("`")) out.push({ t: "code", v: tok.slice(1, -1) });
    else if (tok.startsWith("[") && m[2] && m[3]) out.push({ t: "link", v: m[2], href: m[3] });
    else out.push({ t: "em", v: tok.slice(1, -1) });
    last = idx + tok.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

export function tokenizeInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  const re = new RegExp(MATH_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    if (!token) {
      re.lastIndex++;
      continue;
    }
    if (token.startsWith("$") && !token.startsWith("$$") && looksLikeProse(token.slice(1, -1))) {
      re.lastIndex = m.index + 1;
      continue;
    }
    if (m.index > last) out.push(...formatting(text.slice(last, m.index)));
    out.push({ t: "math", ...mathToken(token) });
    last = m.index + token.length;
  }
  if (last < text.length) out.push(...formatting(text.slice(last)));
  return out;
}

/** Whether any of the strings contains maths (decides if the page needs KaTeX's stylesheet). */
export const hasMath = (texts: Iterable<string>) => {
  for (const s of texts) if (tokenizeInline(s).some((x) => x.t === "math")) return true;
  return false;
};
