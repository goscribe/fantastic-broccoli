/**
 * Maths as a student types it ("sqrt(x^2+1)/2", "3*10^8", "x >= 2 pi") turned
 * into LaTeX for the editor's equation block. Deliberately small: it covers
 * what is typed on a keyboard without knowing LaTeX, and leaves anything that
 * already is LaTeX (a backslash, or braces) alone.
 */

/** True when the text already reads as LaTeX. */
export function looksLikeLatex(input: string): boolean {
  return /\\[a-zA-Z]+|[{}]/.test(input);
}

const WORDS: [RegExp, string][] = [
  [/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|rho|sigma|tau|phi|omega)\b/g, "\\$1"],
  [/\b(Delta|Sigma|Omega|Theta|Lambda|Phi)\b/g, "\\$1"],
  [/\b(sin|cos|tan|ln|log|lim)\b/g, "\\$1"],
  [/\binfinity\b|\binf\b/g, "\\infty"],
];

const SYMBOLS: [RegExp, string][] = [
  [/<=>/g, " \\Leftrightarrow "],
  [/<->/g, " \\leftrightarrow "],
  [/->/g, " \\to "],
  [/=>/g, " \\Rightarrow "],
  [/>=/g, " \\ge "],
  [/<=/g, " \\le "],
  [/!=/g, " \\ne "],
  [/~=/g, " \\approx "],
  [/\+-|\+\/-/g, " \\pm "],
  [/\*/g, " \\times "],
  [/°/g, "^{\\circ}"],
];

/** The index of the bracket that closes the one at `open`, or -1. */
function closing(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** sqrt(...) → \sqrt{...}, nested ones included. */
function roots(s: string): string {
  let out = s;
  for (let guard = 0; guard < 20; guard++) {
    const at = out.search(/\bsqrt\(/);
    if (at < 0) break;
    const open = at + 4;
    const end = closing(out, open);
    if (end < 0) break;
    out = `${out.slice(0, at)}\\sqrt{${out.slice(open + 1, end)}}${out.slice(end + 1)}`;
  }
  return out;
}

/** x^12, x^(n+1), x_10 → braces around the whole exponent or subscript. */
function scripts(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ((ch !== "^" && ch !== "_") || s[i + 1] === "{") {
      out += ch;
      continue;
    }
    if (s[i + 1] === "(") {
      const end = closing(s, i + 1);
      if (end > 0) {
        out += `${ch}{${s.slice(i + 2, end)}}`;
        i = end;
        continue;
      }
    }
    const m = /^-?[A-Za-z0-9.]+/.exec(s.slice(i + 1));
    if (m && m[0].length > 1) {
      out += `${ch}{${m[0]}}`;
      i += m[0].length;
      continue;
    }
    out += ch;
  }
  return out;
}

/** One term of a typed fraction ("delta c" counts as one): a bracketed group (or a function of one: sin(x)), a \sqrt{…}, or a run of letters, digits and scripts. */
const TERM = String.raw`(?:[A-Za-z]*\([^()]*\)|\\sqrt\{[^{}]*\}|(?:[dD]elta\s+)?[A-Za-z0-9.\\]+(?:[\^_](?:\{[^{}]*\}|[A-Za-z0-9]))*)`;
const FRACTION = new RegExp(`(${TERM})\\s*/\\s*(${TERM})`);

const unwrap = (t: string) => (t.startsWith("(") && t.endsWith(")") ? t.slice(1, -1) : t);

/** a/b → \frac{a}{b}, left to right. */
function fractions(s: string): string {
  let out = s;
  for (let guard = 0; guard < 20; guard++) {
    const m = FRACTION.exec(out);
    if (!m) break;
    out = `${out.slice(0, m.index)}\\frac{${unwrap(m[1])}}{${unwrap(m[2])}}${out.slice(m.index + m[0].length)}`;
  }
  return out;
}

/** "sqrt(x^2+1)/2" → "\frac{\sqrt{x^{2}+1}}{2}". LaTeX in, the same LaTeX out. */
export function typedToLatex(input: string): string {
  const text = input.trim();
  if (!text || looksLikeLatex(text)) return text;
  let out = scripts(text);
  out = roots(out);
  out = fractions(out);
  for (const [re, to] of WORDS) out = out.replace(re, to);
  for (const [re, to] of SYMBOLS) out = out.replace(re, to);
  return out.replace(/\s+/g, " ").trim();
}
