/**
 * The calculator's line as textbook maths: what the student types ("3÷4+√(2)",
 * "sin⁻¹(0.5)", "5C2") becomes LaTeX for KaTeX to draw above the line, the
 * way a natural-display school calculator shows it: fractions stacked,
 * powers raised, roots over their radicand.
 *
 * It is drawn live, so it has to cope with a half-typed line: "3÷" shows a
 * box where the denominator will go, "sin(" an empty bracket. Brackets the
 * student typed only for grouping are dropped where the layout already shows
 * the grouping ("(3+4)÷2" is a fraction with 3+4 on top).
 *
 * Pure functions on the engine's own syntax tree, so the preview always reads
 * the line the way "=" will.
 */
import { parse, type Node } from "./engine";

/** Binding strength of what a piece of LaTeX is, so a parent knows when to bracket it. */
const ADD = 10;
const MUL = 20;
const NEG = 30;
const CHOOSE = 40;
const POW = 50;
const POST = 60;
const ATOM = 100;

interface Tex {
  tex: string;
  prec: number;
}

/** Stands in for the part of the line not typed yet; replaced by a box once rendered. */
const HOLE = "9081726354";
const BOX = "\\square";

const paren = (tex: string) => `\\left(${tex}\\right)`;

function wrap(node: Node, min: number): string {
  const r = render(node);
  return r.prec < min ? paren(r.tex) : r.tex;
}

function number(text: string): Tex {
  if (text === HOLE) return { tex: BOX, prec: ATOM };
  const m = /^([^E]*)E([+-]?)(\d+)$/.exec(text);
  if (m) {
    const exp = m[3] === HOLE ? BOX : `${m[2] === "-" ? "-" : ""}${m[3]}`;
    return { tex: `${m[1]}\\times 10^{${exp}}`, prec: MUL };
  }
  return { tex: text, prec: ATOM };
}

const TRIG: Record<string, string> = { sin: "\\sin", cos: "\\cos", tan: "\\tan", asin: "\\sin^{-1}", acos: "\\cos^{-1}", atan: "\\tan^{-1}", ln: "\\ln", log: "\\log", exp: "\\exp" };

/** "2π", "3x", "4sin(30)", "2√3": a number before a letter-like factor reads without a × sign. */
function joins(a: Node, b: Node): boolean {
  if (a.k !== "num" || a.text.includes("E") || a.text === HOLE) return false;
  if (b.k === "const" || b.k === "x" || b.k === "ans") return true;
  if (b.k === "bin" && (b.op === "+" || b.op === "-")) return true;
  return b.k === "call" && b.fn !== "abs";
}

/** Set for one render: in degree mode a plain number in sin, cos or tan gets its ° sign. */
let degrees = false;

function render(node: Node): Tex {
  switch (node.k) {
    case "num":
      return number(node.text);
    case "const":
      return { tex: node.name === "pi" ? "\\pi" : "e", prec: ATOM };
    case "ans":
      return { tex: "\\mathrm{Ans}", prec: ATOM };
    case "x":
      return { tex: "x", prec: ATOM };
    case "neg":
      return { tex: `-${wrap(node.a, NEG)}`, prec: NEG };
    case "post": {
      // 3! and 25% bind tightly; anything but a plain atom gets brackets so the sign is not misread.
      const a = render(node.a);
      const base = a.prec >= ATOM && node.a.k !== "bin" ? a.tex : paren(a.tex);
      return { tex: `${base}${node.op === "!" ? "!" : "\\%"}`, prec: POST };
    }
    case "bin": {
      const { op, a, b } = node;
      if (op === "/") return { tex: `\\frac{${render(a).tex}}{${render(b).tex}}`, prec: ATOM };
      if (op === "^") {
        // A fraction, a function or a negative under a power needs its own brackets: (½)², (sin 30)², (−2)².
        const base = render(a);
        const bare = base.prec >= ATOM && !(a.k === "bin" && a.op === "/") && a.k !== "call";
        const exp = render(b).tex;
        return { tex: `${bare ? base.tex : paren(base.tex)}^{${exp}}`, prec: POW };
      }
      if (op === "C" || op === "P") return { tex: `{}^{${wrap(a, ATOM)}}\\mathrm{${op}}_{${wrap(b, ATOM)}}`, prec: CHOOSE };
      if (op === "*") {
        const left = wrap(a, MUL);
        const right = b.k === "neg" ? paren(render(b).tex) : wrap(b, MUL + 1);
        return { tex: joins(a, b) ? `${left}${right}` : `${left}\\times ${right}`, prec: MUL };
      }
      // + and −: a negative on the right is bracketed (3 + (−2)); a sum on the right of − is too.
      const left = wrap(a, ADD);
      const right = b.k === "neg" ? paren(render(b).tex) : wrap(b, op === "-" ? ADD + 1 : ADD);
      return { tex: `${left}${op}${right}`, prec: ADD };
    }
    case "call": {
      const [a, b] = node.args;
      const inner = a ? render(a).tex : BOX;
      switch (node.fn) {
        case "sqrt":
          return { tex: `\\sqrt{${inner}}`, prec: ATOM };
        case "cbrt":
          return { tex: `\\sqrt[3]{${inner}}`, prec: ATOM };
        case "root":
          return { tex: `\\sqrt[${b ? render(b).tex : BOX}]{${inner}}`, prec: ATOM };
        case "abs":
          return { tex: `\\left|${inner}\\right|`, prec: ATOM };
        case "nCr":
        case "nPr":
          return { tex: `{}^{${wrap(a, ATOM)}}\\mathrm{${node.fn[1]}}_{${b ? wrap(b, ATOM) : BOX}}`, prec: CHOOSE };
        case "log":
          if (b) return { tex: `\\log_{${render(b).tex}}${paren(inner)}`, prec: ATOM };
      }
      const deg = degrees && a?.k === "num" && a.text !== HOLE && ["sin", "cos", "tan"].includes(node.fn);
      return { tex: `${TRIG[node.fn] ?? `\\operatorname{${node.fn}}`}${paren(deg ? `${inner}^{\\circ}` : inner)}`, prec: ATOM };
    }
  }
}

function tryLatex(line: string, angle: "deg" | "rad"): string | null {
  degrees = angle === "deg";
  try {
    return render(parse(line)).tex.split(HOLE).join(BOX);
  } catch {
    return null;
  }
}

/**
 * LaTeX for the line as typed so far, or null when it does not read as maths
 * yet (a half-typed word like "co"): the plain line is shown then.
 */
export function lineLatex(line: string, angle: "deg" | "rad" = "rad"): string | null {
  if (!line.trim()) return null;
  const whole = tryLatex(line, angle);
  if (whole !== null) return whole;
  // Half-typed: fill the gap at the end with a box ("3÷" → 3 ÷ □), or a bracketed one ("sin" → sin(□)).
  for (const fill of [HOLE, `(${HOLE}`, `${HOLE})`]) {
    const tex = tryLatex(line + fill, angle);
    if (tex !== null) return tex;
  }
  return null;
}

/**
 * A formatted result (format.ts: "7/4", "-1.2×10^-5", "0.5") as LaTeX, so a
 * fraction is stacked and a power of ten is raised.
 */
export function resultLatex(text: string): string {
  const neg = text.startsWith("-");
  const body = neg ? text.slice(1) : text;
  const frac = /^(\d+)\/(\d+)$/.exec(body);
  const sci = /^([\d.]+)×10\^(-?\d+)$/.exec(body);
  const tex = frac ? `\\frac{${frac[1]}}{${frac[2]}}` : sci ? `${sci[1]}\\times 10^{${sci[2]}}` : body;
  return neg ? `-${tex}` : tex;
}
