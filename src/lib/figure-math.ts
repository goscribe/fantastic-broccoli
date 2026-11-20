/**
 * Maths inside generated figure HTML (tables, labelled diagrams) rendered
 * before the figure reaches its sandboxed iframe, so it never depends on the
 * in-frame KaTeX script loading in time (R07's complexity table showed raw
 * `O(n\log n)`; R09's energy levels showed `E_3=-1.0\times10^{-19}`).
 *
 * Handled, outside <script>/<style>/<textarea>/<code>/<pre>:
 *  - elements with a maths class (`math`, `math-display`, `latex`, `tex`)
 *    whose content is plain text;
 *  - `$$…$$`, `\[…\]`, `\(…\)` and `$…$` spans in text (`$5 … $10` is
 *    currency, not maths);
 *  - bare LaTeX in text (`O(n\log n)`, `C_{11}`, `\Delta E`), detected by
 *    common commands, not just a few.
 * Inside <svg>, where HTML cannot go, LaTeX in labels becomes Unicode
 * (`\Delta E_A` → `ΔE_A`, `10^{-19}` → `10⁻¹⁹`). An <svg> with a fixed
 * width/height but no viewBox gets one so it can scale to a phone's width.
 *
 * Pure string processing: `render` turns TeX into HTML (KaTeX in the app),
 * returning null when the TeX is invalid (the text is then left as it was).
 */

export type RenderTex = (tex: string, display: boolean) => string | null;

const MATH_CLASS = /(?:^|\s)(?:math|math-display|math-inline|latex|tex)(?:\s|$)/;
const RAW_TAGS = new Set(["script", "style", "textarea", "code", "pre", "kbd", "samp"]);
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** LaTeX commands common in generated figures; any of them marks text as maths. */
const COMMANDS = [
  "frac", "dfrac", "tfrac", "sqrt", "log", "ln", "lg", "exp", "sin", "cos", "tan", "sec", "csc", "cot",
  "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "lim", "sum", "prod", "int", "oint", "infty",
  "times", "cdot", "div", "pm", "mp", "le", "leq", "ge", "geq", "ne", "neq", "approx", "equiv", "sim",
  "propto", "to", "rightarrow", "leftarrow", "Rightarrow", "Leftarrow", "leftrightarrow", "Leftrightarrow",
  "rightleftharpoons", "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta",
  "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "rho", "sigma", "tau", "upsilon", "phi",
  "varphi", "chi", "psi", "omega", "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi",
  "Omega", "partial", "nabla", "degree", "circ", "mathrm", "mathbf", "mathit", "mathcal", "text", "textrm",
  "operatorname", "vec", "hat", "bar", "overline", "underline", "dot", "ddot", "left", "right", "ldots",
  "cdots", "dots", "in", "notin", "subset", "subseteq", "cup", "cap", "forall", "exists", "angle", "perp",
  "parallel", "binom", "max", "min", "det", "mod", "bmod", "gcd", "Box", "checkmark", "quad", "qquad",
];
const COMMAND_RE = new RegExp(String.raw`\\(?:${COMMANDS.join("|")})(?![A-Za-z])`);
/** Anything that is clearly TeX: a known command, a braced sub/superscript, or `\word{`. */
const ANCHOR = new RegExp(String.raw`${COMMAND_RE.source}|[_^]\{|\\[A-Za-z]+\{`);
/** A run of TeX around an anchor (same shape the in-frame script used, any command). */
const FRAG =
  /[A-Za-z0-9()[\]+\-=/|]*(?:[\^_]\{[^{}]*\}|\\[a-zA-Z]+\{[^{}]*\}|\\[a-zA-Z]+)(?:[\s,]*(?:\\[a-zA-Z]+|[\^_]\{[^{}]*\}|[\^_][A-Za-z0-9]|\{[^{}]*\}|[0-9()[\]+\-=*/.|]+|[A-Za-z](?![A-Za-z])))*/g;
/** Three ordinary words in a row: prose, not a formula. */
const PROSE = /[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,}/;
const DELIMITED =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$])\$((?:\\\$|[^$\n])+?)(?<!\\)\$(?!\d)/g;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
export function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e]);
}

/** True when the text holds TeX the reader would otherwise see raw. */
export function looksLikeBareLatex(text: string): boolean {
  return ANCHOR.test(text);
}

/** Words left once the TeX is taken out: then only the TeX pieces are rendered, not the whole text. */
const WORDS = /[A-Za-z]{3,}\s+[A-Za-z]{3,}|[A-Za-z]{2,}(?:\s+[A-Za-z]{2,}){2}/;
function proseOutsideMath(text: string): boolean {
  return WORDS.test(text.replace(FRAG, " "));
}

/** Renders delimited spans and bare TeX in one run of decoded text; null when there is nothing to do. */
export function renderTextMath(text: string, render: RenderTex): string | null {
  let out = "";
  let last = 0;
  let any = false;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const plain = (s: string) => {
    const bare = renderBare(s, render);
    if (bare !== null) any = true;
    return bare ?? escape(s);
  };
  for (const m of text.matchAll(DELIMITED)) {
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    // `$` pairs around prose are currency or stray dollars, not maths.
    if (m[4] !== undefined && PROSE.test(tex.replace(/\\[A-Za-z]+(\{[^{}]*\})?/g, " "))) continue;
    const html = render(tex.trim(), display);
    if (html === null) continue;
    out += plain(text.slice(last, m.index)) + html;
    last = m.index! + m[0].length;
    any = true;
  }
  out += plain(text.slice(last));
  return any ? out : null;
}

function renderBare(text: string, render: RenderTex): string | null {
  if (!ANCHOR.test(text)) return null;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!proseOutsideMath(text)) {
    const lead = text.match(/^\s*/)![0];
    const trail = text.match(/\s*$/)![0];
    const html = render(text.trim(), false);
    return html === null ? null : `${lead}${html}${trail}`;
  }
  let out = "";
  let last = 0;
  let any = false;
  for (const m of text.matchAll(FRAG)) {
    if (!m[0] || !ANCHOR.test(m[0])) continue;
    const tex = m[0].replace(/\s+$/, "");
    const html = render(tex, false);
    if (html === null) continue;
    out += escape(text.slice(last, m.index)) + html;
    last = m.index! + tex.length;
    any = true;
  }
  return any ? out + escape(text.slice(last)) : null;
}

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ",
  psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ",
  Psi: "Ψ", Omega: "Ω", times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥",
  ne: "≠", neq: "≠", approx: "≈", equiv: "≡", sim: "∼", propto: "∝", to: "→", rightarrow: "→", leftarrow: "←",
  Rightarrow: "⇒", leftrightarrow: "↔", rightleftharpoons: "⇌", infty: "∞", partial: "∂", nabla: "∇",
  degree: "°", circ: "°", angle: "∠", perp: "⊥", parallel: "∥", in: "∈", sqrt: "√", ldots: "…", cdots: "⋯",
  dots: "…", sum: "Σ", int: "∫",
};
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", n: "ⁿ", i: "ⁱ", "(": "⁽", ")": "⁾" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋", "+": "₊", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", n: "ₙ", i: "ᵢ", r: "ᵣ", m: "ₘ", k: "ₖ" };
const script = (s: string, map: Record<string, string>, mark: string) =>
  [...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join("") : `${mark}${s.length > 1 ? `(${s})` : s}`;

/** TeX in an SVG label as readable Unicode (SVG text cannot hold KaTeX's HTML). */
export function latexToUnicode(text: string): string {
  if (!/[\\^_$]/.test(text)) return text;
  return text
    .replace(/\$\$?|\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\(?:mathrm|text|textrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
    .replace(/([A-Za-z0-9)]?)\\(log|ln|sin|cos|tan|exp|lim|max|min)(?![A-Za-z])/g, (_, pre: string, f: string) => `${pre}${pre ? " " : ""}${f}`)
    .replace(/\\([A-Za-z]+)(?![A-Za-z]) ?/g, (whole, name: string) => GREEK[name] ?? whole)
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9+-])/g, (_, a?: string, b?: string) => script(a ?? b ?? "", SUP, "^"))
    .replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_, a?: string, b?: string) => script(a ?? b ?? "", SUB, "_"))
    .replace(/[{}]/g, "");
}

/** `<svg width="700" height="440">` without a viewBox cannot scale; give it one. */
function svgWithViewBox(tag: string): string {
  if (/\sviewBox\s*=/i.test(tag)) return tag;
  const w = tag.match(/\swidth\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/i)?.[1];
  const h = tag.match(/\sheight\s*=\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/i)?.[1];
  if (!w || !h) return tag;
  return tag.replace(/^<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
}

const TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** Pre-renders maths in a figure's HTML (see file header). Returns the HTML unchanged when there is none. */
export function prerenderFigureMath(html: string, render: RenderTex): string {
  if (!html) return html;
  let out = "";
  let last = 0;
  const raw: string[] = [];
  let svgDepth = 0;
  // Open maths-class element: its tag name, nesting of that tag, and where its content starts in `out`.
  let mathEl: { tag: string; depth: number; start: number; display: boolean; plain: boolean } | null = null;

  const emitText = (text: string) => {
    if (!text) return;
    if (raw.length > 0 || mathEl) {
      out += text;
      return;
    }
    if (svgDepth > 0) {
      out += /[\\^_$]/.test(text) ? latexToUnicode(text) : text;
      return;
    }
    if (!/[\\$^_]/.test(text)) {
      out += text;
      return;
    }
    const rendered = renderTextMath(decodeEntities(text), render);
    out += rendered ?? text;
  };

  for (const m of html.matchAll(TAG)) {
    emitText(html.slice(last, m.index));
    last = m.index! + m[0].length;
    const [whole, closing, rawName, attrs = ""] = m;
    if (!rawName) {
      out += whole;
      continue;
    }
    const name = rawName.toLowerCase();
    const selfClosing = /\/\s*$/.test(attrs) || VOID_TAGS.has(name);
    if (closing) {
      if (raw.length && raw[raw.length - 1] === name) raw.pop();
      if (name === "svg" && svgDepth > 0) svgDepth--;
      if (mathEl && name === mathEl.tag) {
        if (mathEl.depth === 0) {
          const inner = out.slice(mathEl.start);
          const tex = decodeEntities(inner).trim().replace(/^\$\$?|\$\$?$|^\\\(|\\\)$|^\\\[|\\\]$/g, "").trim();
          const rendered = mathEl.plain && tex && !/<\w/.test(inner) ? render(tex, mathEl.display) : null;
          if (rendered !== null) out = out.slice(0, mathEl.start) + rendered;
          mathEl = null;
        } else mathEl.depth--;
      }
      out += whole;
      continue;
    }
    if (mathEl) {
      if (name === mathEl.tag && !selfClosing) mathEl.depth++;
      else if (!selfClosing) mathEl.plain = false; // nested markup: leave it to the in-frame script
      out += whole;
      continue;
    }
    if (name === "svg") {
      svgDepth++;
      out += svgWithViewBox(whole);
      continue;
    }
    out += whole;
    if (selfClosing) continue;
    if (RAW_TAGS.has(name)) {
      raw.push(name);
      continue;
    }
    if (raw.length === 0 && svgDepth === 0) {
      const cls = attrs.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const classes = cls ? (cls[1] ?? cls[2] ?? cls[3] ?? "") : "";
      if (MATH_CLASS.test(classes)) {
        mathEl = { tag: name, depth: 0, start: out.length, display: /(?:^|\s)math-display(?:\s|$)/.test(classes), plain: true };
      }
    }
  }
  emitText(html.slice(last));
  return out;
}
