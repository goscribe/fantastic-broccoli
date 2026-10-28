import type { WorksheetPart } from "@/types";

/**
 * Local (no-LLM) worksheet answer check. Expected answers are authored as
 * LaTeX ("$8.4\\times10^{7}\\,\\mathrm{CFU\\,mL^{-1}}$", "$27$"), so a plain
 * string compare never matched a numeric part; compare the numbers instead.
 */

const LATEX_WRAPPERS = /\\\(|\\\)|\\\[|\\\]|\$\$|\$/g;

function stripLatex(raw: string): string {
  let s = raw.replace(LATEX_WRAPPERS, " ");
  // \mathrm{...}, \text{...}, \textbf{...} → keep their contents.
  s = s.replace(/\\(?:mathrm|text|textbf|textit|mathbf|operatorname)\s*\{([^{}]*)\}/g, " $1 ");
  // 1\frac{3}{8} → "1 3/8" (mixed number), \frac{a}{b} → (a)/(b)
  s = s.replace(/(\d)\s*\\[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, "$1 $2/$3");
  s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\times|\\cdot|×|·/g, "*");
  s = s.replace(/(\d)\s*[xX]\s*(?=10\s*\^)/g, "$1*");
  s = s.replace(/\\(?:,|;|:|!|quad|qquad|left|right)/g, " ");
  s = s.replace(/\\[a-zA-Z]+/g, " ");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\^\s*\(?([-+]?\d+)\)?/g, "^$1");
  s = s.replace(/[−–]/g, "-");
  s = s.replace(/,(?=\d{3}\b)/g, "");
  return s.replace(/\s+/g, " ").trim();
}

const NUMBER = /[-+]?(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+(?:[eE][-+]?\d+)?)/;

interface ParsedNumber {
  value: number;
  /** Significant figures the author wrote (Infinity for exact fractions). */
  sig: number;
}

function sigFigs(token: string): number {
  const mantissa = token.replace(/[eE][-+]?\d+$/, "").replace(/[-+.]/g, "");
  const digits = mantissa.replace(/^0+/, "");
  return digits.length || 1;
}

/**
 * Parses a scalar from "8.4 * 10^7", "8.4x10^7", "8.4e7", "1 3/8", "5/4",
 * "(260)/(4)", "1.2%". When the text is a worked line ("k = ln 8 / 6 = 0.346 h^-1")
 * the final result after the last "=" is used.
 */
function parseNumericDetailed(raw: string): ParsedNumber | null {
  let s = stripLatex(raw);
  if (s.includes("=")) s = s.slice(s.lastIndexOf("=") + 1);
  s = s
    .replace(/\(([^()]*)\)\s*\/\s*\(([^()]*)\)/g, "$1/$2")
    .replace(/\s*\*\s*10\s*\^\s*([-+]?\d+)/g, "e$1")
    .replace(/\b10\s*\^\s*([-+]?\d+)/g, "1e$1");
  const m = NUMBER.exec(s);
  if (!m) return null;
  const token = m[0].trim();
  const mixed = /^([-+]?)(\d+)\s+(\d+)\/(\d+)$/.exec(token);
  if (mixed) {
    const sign = mixed[1] === "-" ? -1 : 1;
    const d = Number(mixed[4]);
    return d ? { value: sign * (Number(mixed[2]) + Number(mixed[3]) / d), sig: Infinity } : null;
  }
  const frac = /^([-+]?\d+)\/(\d+)$/.exec(token);
  if (frac) {
    const d = Number(frac[2]);
    return d ? { value: Number(frac[1]) / d, sig: Infinity } : null;
  }
  const v = Number(token);
  return Number.isFinite(v) ? { value: v, sig: sigFigs(token) } : null;
}

export function parseNumeric(raw: string): number | null {
  return parseNumericDetailed(raw)?.value ?? null;
}

function roundSig(v: number, sig: number): number {
  if (v === 0 || !Number.isFinite(sig)) return v;
  const digits = sig - Math.ceil(Math.log10(Math.abs(v)));
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * Numbers agree within 1% (rounding differences such as 0.346 vs 0.347), or
 * are equal once both are rounded to the coarser precision either side wrote
 * (1.18 vs 1.2). 8.4 vs 8.5 stays wrong.
 */
export function numbersMatch(a: ParsedNumber, b: ParsedNumber, relTol = 0.01): boolean {
  if (a.value === b.value) return true;
  const scale = Math.max(Math.abs(a.value), Math.abs(b.value));
  if (Math.abs(a.value - b.value) <= Math.max(scale * relTol, 1e-9)) return true;
  const sig = Math.max(2, Math.min(a.sig, b.sig));
  return Number.isFinite(sig) && roundSig(a.value, sig) === roundSig(b.value, sig);
}

const TRUE_WORDS = new Set(["true", "t", "yes", "y", "correct", "vrai", "sant", "wahr"]);
const FALSE_WORDS = new Set(["false", "f", "no", "n", "incorrect", "faux", "falskt", "falsch"]);

function asBoolean(raw: string): boolean | null {
  const w = stripLatex(raw).toLowerCase().replace(/[^a-z]/g, "");
  if (TRUE_WORDS.has(w)) return true;
  if (FALSE_WORDS.has(w)) return false;
  return null;
}

export function isPartCorrect(part: WorksheetPart, value: string): boolean {
  const given = value.trim();
  if (!part.answer) return given.length > 0;
  if (part.type === "true_false") {
    const want = asBoolean(part.answer);
    const got = asBoolean(given);
    return want !== null && got !== null && want === got;
  }
  if (part.type === "numeric") {
    const want = parseNumericDetailed(part.answer);
    const got = parseNumericDetailed(given);
    if (want && got) return numbersMatch(want, got);
    return stripLatex(given).toLowerCase() === stripLatex(part.answer).toLowerCase();
  }
  const expected = stripLatex(part.answer).toLowerCase();
  return stripLatex(given).toLowerCase().includes(expected);
}
