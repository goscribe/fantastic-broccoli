/**
 * Graph mode: y = f(x) drawn by the app's own note-figure plot (NoteGraph),
 * which takes Desmos-style LaTeX. This turns the calculator's syntax tree
 * into that LaTeX and picks a y-window from the curve itself.
 *
 * The plot's evaluator works in radians, so graphs do too, whatever the
 * calculator's Deg/Rad switch says (the panel says so). Things the plot
 * cannot draw (factorials, nCr, %) come back as an error rather than a wrong
 * curve.
 */
import { niceStep, parseExpression } from "../latex-eval";
import { CalcError, parse, type CalcValue, type Node } from "./engine";

export interface GraphWindow {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export type GraphOutcome =
  | { ok: true; latex: string; window: GraphWindow }
  | { ok: false; message: string };

export const GRAPH_ERRORS = {
  empty: "Type a function of x, like x² − 4",
  unsupported: "Graphs can't use !, %, nCr or nPr",
  range: "The x range needs a smaller number on the left",
  invalid: "That doesn't read as a function of x",
  nothing: "Nothing to draw in this x range",
} as const;

const FUNCTION_LATEX: Record<string, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  asin: "\\arcsin",
  acos: "\\arccos",
  atan: "\\arctan",
  ln: "\\ln",
  exp: "\\exp",
};

class Unsupported extends Error {}

function number(v: number): string {
  // Plain decimals only: the plot's reader takes "1e-7" as 1·e − 7.
  if (!Number.isFinite(v)) throw new Unsupported();
  const text = Math.abs(v) < 1e-6 || Math.abs(v) >= 1e15 ? v.toFixed(20) : String(v);
  return v < 0 ? `(${text})` : text;
}

function latex(node: Node, ans: CalcValue | null | undefined): string {
  const go = (n: Node) => latex(n, ans);
  switch (node.k) {
    case "num":
      return number(Number(node.text));
    case "const":
      return node.name === "pi" ? "\\pi " : "e";
    case "x":
      return "x";
    case "ans":
      if (!ans) throw new CalcError("noAnswer");
      return number(ans.value);
    case "neg":
      return `(-(${go(node.a)}))`;
    case "post":
      throw new Unsupported();
    case "bin":
      if (node.op === "C" || node.op === "P") throw new Unsupported();
      if (node.op === "/") return `\\frac{${go(node.a)}}{${go(node.b)}}`;
      if (node.op === "^") return `(${go(node.a)})^{${go(node.b)}}`;
      return `(${go(node.a)})${node.op}(${go(node.b)})`;
    case "call": {
      const a = go(node.args[0]);
      if (node.fn === "sqrt") return `\\sqrt{${a}}`;
      if (node.fn === "cbrt") return `(${a})^{\\frac{1}{3}}`;
      if (node.fn === "root") return `(${a})^{\\frac{1}{${go(node.args[1])}}}`;
      if (node.fn === "abs") return `\\left|${a}\\right|`;
      if (node.fn === "log") return node.args.length === 2 ? `\\frac{\\ln(${a})}{\\ln(${go(node.args[1])})}` : `\\log(${a})`;
      const name = FUNCTION_LATEX[node.fn];
      if (!name) throw new Unsupported();
      return `${name}(${a})`;
    }
  }
}

/** A y-window that shows the curve: the middle of its values, padded, on tidy numbers. */
export function fitWindow(f: (x: number) => number, left: number, right: number): GraphWindow | null {
  const ys: number[] = [];
  for (let i = 0; i <= 240; i++) {
    const y = f(left + ((right - left) * i) / 240);
    if (Number.isFinite(y)) ys.push(y);
  }
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  // Drop the extremes so one asymptote (1/x, tan x) does not flatten the rest.
  const cut = ys.length >= 40 ? Math.floor(ys.length * 0.06) : 0;
  let lo = ys[cut];
  let hi = ys[ys.length - 1 - cut];
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  // Keep the x-axis in view when the curve is near it.
  lo = Math.min(lo - pad, lo > 0 && lo < (hi - lo) * 2 ? 0 : lo - pad);
  hi = Math.max(hi + pad, hi < 0 && -hi < (hi - lo) * 2 ? 0 : hi + pad);
  const step = niceStep(hi - lo, 5);
  const clean = (v: number) => Number(v.toPrecision(12));
  return { left, right, bottom: clean(Math.floor(lo / step) * step), top: clean(Math.ceil(hi / step) * step) };
}

/** The plot for a typed f(x) over an x range. */
export function graphOf(expr: string, left: number, right: number, ans?: CalcValue | null): GraphOutcome {
  const typed = expr.trim().replace(/^y\s*=\s*/i, "");
  if (!typed) return { ok: false, message: GRAPH_ERRORS.empty };
  if (!(Number.isFinite(left) && Number.isFinite(right) && left < right)) return { ok: false, message: GRAPH_ERRORS.range };
  let body: string;
  try {
    body = latex(parse(typed), ans);
  } catch (err) {
    if (err instanceof Unsupported) return { ok: false, message: GRAPH_ERRORS.unsupported };
    return { ok: false, message: err instanceof CalcError ? err.message : GRAPH_ERRORS.invalid };
  }
  const text = `y=${body}`;
  const parsed = parseExpression(text);
  if (!parsed || parsed.kind !== "curve") return { ok: false, message: GRAPH_ERRORS.invalid };
  const window = fitWindow(parsed.f, left, right);
  if (!window) return { ok: false, message: GRAPH_ERRORS.nothing };
  return { ok: true, latex: text, window };
}
