/**
 * The calculator's own parser and evaluator: a small Pratt parser over a
 * fixed grammar, never `eval` and no library, so it costs a few KB and can
 * only ever compute numbers.
 *
 * Grammar (loosest to tightest): + −, × ÷ and implicit multiplication ("2π",
 * "3(4+1)"), unary minus, powers (right to left, so −2² = −4), then the
 * postfix ! and % and the infix nCr / nPr ("5C2"). Functions take brackets:
 * sin cos tan and their inverses (in the chosen angle unit), ln, log (base
 * 10, or log(x, base)), √, ∛, root(x, n), abs, exp, nCr(n, r), nPr(n, r).
 * Numbers may carry an exponent with a capital E ("6.02E23"); a lone
 * lowercase e is Euler's number. `Ans` is the last result, `x` the graph
 * variable. Brackets left open at the end are closed for the student.
 *
 * Results that come from whole numbers and fractions alone are also kept as
 * an exact fraction (BigInt), so 0.1 + 0.2 is 0.3 and 1 ÷ 3 can be shown
 * as 1/3.
 */

export type AngleMode = "deg" | "rad";

export interface Fraction {
  n: bigint;
  d: bigint;
}

export interface CalcValue {
  value: number;
  /** Set when the result is exactly this fraction (lowest terms, d > 0). */
  exact?: Fraction;
}

export type CalcErrorCode =
  | "empty"
  | "incomplete"
  | "syntax"
  | "bracket"
  | "unknown"
  | "needsBrackets"
  | "args"
  | "divideByZero"
  | "sqrtNegative"
  | "logDomain"
  | "inverseTrigDomain"
  | "tanUndefined"
  | "factorial"
  | "combination"
  | "noAnswer"
  | "noVariable"
  | "undefined"
  | "tooLarge";

/** What the student reads. Short, and says what to change. */
export const ERROR_TEXT: Record<CalcErrorCode, string> = {
  empty: "Type a calculation first",
  incomplete: "Something is missing at the end",
  syntax: "That doesn't read as a calculation",
  bracket: "There is a closing bracket without an opening one",
  unknown: "Unknown name",
  needsBrackets: "Put brackets after the function, like sin(30)",
  args: "Wrong number of values in the brackets",
  divideByZero: "Can't divide by zero",
  sqrtNegative: "Can't take the square root of a negative number",
  logDomain: "Logs need a number above zero",
  inverseTrigDomain: "sin⁻¹ and cos⁻¹ need a value from −1 to 1",
  tanUndefined: "tan is undefined at this angle",
  factorial: "Factorial needs a whole number from 0 to 170",
  combination: "nCr and nPr need whole numbers with 0 ≤ r ≤ n",
  noAnswer: "There is no previous answer yet",
  noVariable: "x is only for graphs",
  undefined: "That has no real value",
  tooLarge: "The result is too large",
};

export class CalcError extends Error {
  code: CalcErrorCode;
  constructor(code: CalcErrorCode, detail?: string) {
    super(detail ? `${ERROR_TEXT[code]}: ${detail}` : ERROR_TEXT[code]);
    this.code = code;
    this.name = "CalcError";
  }
}

// ── Exact fractions ────────────────────────────────────────────────────────

/** Past this many digits a fraction stops being useful to read, and the arithmetic is only a float anyway. */
const MAX_EXACT_DIGITS = 40;

function gcd(a: bigint, b: bigint): bigint {
  if (a < BigInt(0)) a = -a;
  if (b < BigInt(0)) b = -b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function frac(n: bigint, d: bigint): Fraction | undefined {
  if (d === BigInt(0)) return undefined;
  if (d < BigInt(0)) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || BigInt(1);
  n /= g;
  d /= g;
  if (n.toString().length > MAX_EXACT_DIGITS || d.toString().length > MAX_EXACT_DIGITS) return undefined;
  return { n, d };
}

function fromExact(q: Fraction | undefined, fallback: number): CalcValue {
  if (!q) return { value: fallback };
  const value = Number(q.n) / Number(q.d);
  return Number.isFinite(value) ? { value, exact: q } : { value: fallback };
}

const isInt = (q: Fraction | undefined): q is Fraction => !!q && q.d === BigInt(1);

/** The exact square root of a perfect square, else null. */
function bigSqrt(n: bigint): bigint | null {
  if (n < BigInt(0)) return null;
  if (n < BigInt(2)) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x -= BigInt(1);
  while ((x + BigInt(1)) * (x + BigInt(1)) <= n) x += BigInt(1);
  return x * x === n ? x : null;
}

// ── Tokens ────────────────────────────────────────────────────────────────

type Token =
  | { t: "num"; text: string }
  | { t: "id"; name: string }
  | { t: "op"; op: string };

const SUPERSCRIPT_MINUS_ONE = /⁻¹/g;

/** One spelling per symbol, so the parser sees ASCII operators. */
function normalise(src: string): string {
  return src
    .replace(/sin⁻¹/g, "asin")
    .replace(/cos⁻¹/g, "acos")
    .replace(/tan⁻¹/g, "atan")
    .replace(SUPERSCRIPT_MINUS_ONE, "^(-1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅]/g, "*")
    .replace(/[÷∕]/g, "/")
    .replace(/π/g, " pi ")
    .replace(/√/g, " sqrt ")
    .replace(/∛/g, " cbrt ");
}

/** Every name the line can hold, longest first. One-letter names are case-sensitive (e, x, and the C / P of nCr / nPr). */
const WORDS = ["arcsin", "arccos", "arctan", "asin", "acos", "atan", "sqrt", "cbrt", "root", "sin", "cos", "tan", "log", "exp", "abs", "ans", "ncr", "npr", "ln", "pi", "e", "x", "C", "P"];

function tokenize(input: string): Token[] {
  const s = normalise(input);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new CalcError("syntax");
      // "2E" with nothing after it: the exponent is still being typed.
      if (s[i + m[0].length] === "E") throw new CalcError("incomplete");
      out.push({ t: "num", text: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      // A run of letters is read as known names, longest first: "AnsC2" is Ans C 2, "xsin(x)" is x · sin(x).
      const run = /^[A-Za-z]+/.exec(s.slice(i))![0];
      let at = 0;
      while (at < run.length) {
        const rest = run.slice(at);
        const word = WORDS.find((w) => (w.length === 1 ? rest.startsWith(w) : rest.toLowerCase().startsWith(w)));
        if (!word) throw new CalcError("unknown", rest);
        out.push({ t: "id", name: rest.slice(0, word.length) });
        at += word.length;
      }
      i += run.length;
      continue;
    }
    if ("+-*/^()!%,".includes(c)) {
      out.push({ t: "op", op: c });
      i++;
      continue;
    }
    throw new CalcError("syntax", c);
  }
  return out;
}

// ── Syntax tree ───────────────────────────────────────────────────────────

export type Node =
  | { k: "num"; text: string }
  | { k: "const"; name: "pi" | "e" }
  | { k: "ans" }
  | { k: "x" }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^" | "C" | "P"; a: Node; b: Node }
  | { k: "post"; op: "!" | "%"; a: Node }
  | { k: "call"; fn: string; args: Node[] };

/** Function names the student may type, mapped to the one the evaluator knows. */
const FUNCTIONS: Record<string, { fn: string; args: [number, number] }> = {
  sin: { fn: "sin", args: [1, 1] },
  cos: { fn: "cos", args: [1, 1] },
  tan: { fn: "tan", args: [1, 1] },
  asin: { fn: "asin", args: [1, 1] },
  acos: { fn: "acos", args: [1, 1] },
  atan: { fn: "atan", args: [1, 1] },
  arcsin: { fn: "asin", args: [1, 1] },
  arccos: { fn: "acos", args: [1, 1] },
  arctan: { fn: "atan", args: [1, 1] },
  ln: { fn: "ln", args: [1, 1] },
  log: { fn: "log", args: [1, 2] },
  exp: { fn: "exp", args: [1, 1] },
  sqrt: { fn: "sqrt", args: [1, 1] },
  cbrt: { fn: "cbrt", args: [1, 1] },
  root: { fn: "root", args: [2, 2] },
  abs: { fn: "abs", args: [1, 1] },
  ncr: { fn: "nCr", args: [2, 2] },
  npr: { fn: "nPr", args: [2, 2] },
};

const BINARY: Record<string, { bp: number; right?: boolean; op: "+" | "-" | "*" | "/" | "^" }> = {
  "+": { bp: 10, op: "+" },
  "-": { bp: 10, op: "-" },
  "*": { bp: 20, op: "*" },
  "/": { bp: 20, op: "/" },
  "^": { bp: 50, right: true, op: "^" },
};
const IMPLICIT_BP = 20;
const UNARY_BP = 30;
const CHOOSE_BP = 40;
const POSTFIX_BP = 60;

class Parser {
  private i = 0;
  private toks: Token[];
  constructor(toks: Token[]) {
    this.toks = toks;
  }

  private peek(): Token | undefined {
    return this.toks[this.i];
  }

  private isOp(op: string): boolean {
    const tok = this.peek();
    return tok?.t === "op" && tok.op === op;
  }

  parse(): Node {
    if (this.toks.length === 0) throw new CalcError("empty");
    const node = this.expr(0);
    const rest = this.peek();
    if (rest) throw new CalcError(rest.t === "op" && rest.op === ")" ? "bracket" : "syntax");
    return node;
  }

  /** A closing bracket, or the end of the line (brackets left open are closed for the student). */
  private close() {
    if (this.isOp(")")) this.i++;
    else if (this.peek()) throw new CalcError("syntax");
  }

  private startsValue(tok: Token): boolean {
    if (tok.t === "num") return true;
    if (tok.t === "op") return tok.op === "(";
    return tok.name !== "C" && tok.name !== "P";
  }

  private expr(minBp: number): Node {
    let left = this.prefix();
    for (;;) {
      const tok = this.peek();
      if (!tok) break;
      if (tok.t === "op" && (tok.op === "!" || tok.op === "%")) {
        if (POSTFIX_BP < minBp) break;
        this.i++;
        left = { k: "post", op: tok.op, a: left };
        continue;
      }
      if (tok.t === "op" && BINARY[tok.op]) {
        const { bp, right, op } = BINARY[tok.op];
        if (bp < minBp) break;
        this.i++;
        left = { k: "bin", op, a: left, b: this.expr(right ? bp : bp + 1) };
        continue;
      }
      // "5C2", "5P2": the calculator's nCr / nPr keys.
      if (tok.t === "id" && (tok.name === "C" || tok.name === "P")) {
        if (CHOOSE_BP < minBp) break;
        this.i++;
        left = { k: "bin", op: tok.name, a: left, b: this.expr(CHOOSE_BP + 1) };
        continue;
      }
      // Implicit multiplication: "2π", "3(4+1)", "2sin(30)". Never two numbers side by side.
      if (this.startsValue(tok) && tok.t !== "num") {
        if (IMPLICIT_BP < minBp) break;
        left = { k: "bin", op: "*", a: left, b: this.expr(IMPLICIT_BP + 1) };
        continue;
      }
      if (tok.t === "num") throw new CalcError("syntax");
      break;
    }
    return left;
  }

  private prefix(): Node {
    const tok = this.peek();
    if (!tok) throw new CalcError("incomplete");
    this.i++;
    if (tok.t === "num") return { k: "num", text: tok.text };
    if (tok.t === "op") {
      if (tok.op === "-") return { k: "neg", a: this.expr(UNARY_BP) };
      if (tok.op === "+") return this.expr(UNARY_BP);
      if (tok.op === "(") {
        if (!this.peek()) throw new CalcError("incomplete");
        if (this.isOp(")")) throw new CalcError("syntax");
        const inner = this.expr(0);
        this.close();
        return inner;
      }
      if (tok.op === ")") throw new CalcError("bracket");
      throw new CalcError("syntax");
    }
    const name = tok.name;
    const lower = name.toLowerCase();
    if (lower === "pi") return { k: "const", name: "pi" };
    if (name === "e") return { k: "const", name: "e" };
    if (lower === "ans") return { k: "ans" };
    if (name === "x") return { k: "x" };
    const fn = FUNCTIONS[lower];
    if (!fn) throw new CalcError("unknown", name);
    if (!this.isOp("(")) {
      // √2 and ∛8 read naturally without brackets; named functions need them.
      if (fn.fn === "sqrt" || fn.fn === "cbrt") return { k: "call", fn: fn.fn, args: [this.expr(POSTFIX_BP)] };
      throw new CalcError(this.peek() ? "needsBrackets" : "incomplete");
    }
    this.i++;
    if (!this.peek()) throw new CalcError("incomplete");
    const args: Node[] = [this.expr(0)];
    while (this.isOp(",")) {
      this.i++;
      args.push(this.expr(0));
    }
    this.close();
    if (args.length < fn.args[0] || args.length > fn.args[1]) throw new CalcError("args", name);
    return { k: "call", fn: fn.fn, args };
  }
}

/** The syntax tree for a typed line; throws CalcError when it is not a calculation. */
export function parse(input: string): Node {
  return new Parser(tokenize(input)).parse();
}

// ── Evaluation ────────────────────────────────────────────────────────────

export interface EvalOptions {
  angle?: AngleMode;
  /** The last result (`Ans`). */
  ans?: CalcValue | null;
  /** The graph variable; unset outside graph mode. */
  x?: number;
}

function finite(v: CalcValue): CalcValue {
  if (Number.isNaN(v.value)) throw new CalcError("undefined");
  if (!Number.isFinite(v.value)) throw new CalcError("tooLarge");
  return v;
}

function literal(text: string): CalcValue {
  const value = Number(text);
  const m = /^(\d*)\.?(\d*)(?:E([+-]?\d+))?$/.exec(text);
  if (!m || !Number.isFinite(value)) return finite({ value });
  const digits = `${m[1]}${m[2]}` || "0";
  const power = Number(m[3] ?? 0) - m[2].length;
  if (Math.abs(power) > MAX_EXACT_DIGITS) return { value };
  const ten = BigInt(10) ** BigInt(Math.abs(power));
  const q = power >= 0 ? frac(BigInt(digits) * ten, BigInt(1)) : frac(BigInt(digits), ten);
  return q ? { value, exact: q } : { value };
}

/** Rounds away the last bits of float noise from trig (sin 30° is 0.5, not 0.49999999999999994). */
function tidy(v: number): number {
  if (!Number.isFinite(v)) return v;
  if (Math.abs(v) < 1e-15) return 0;
  return Number(v.toPrecision(15));
}

function factorial(a: CalcValue): CalcValue {
  if (!Number.isInteger(a.value) || a.value < 0 || a.value > 170) throw new CalcError("factorial");
  let big = BigInt(1);
  for (let k = 2; k <= a.value; k++) big *= BigInt(k);
  return fromExact(frac(big, BigInt(1)), Number(big));
}

function choose(n: CalcValue, r: CalcValue, ordered: boolean): CalcValue {
  if (!Number.isInteger(n.value) || !Number.isInteger(r.value) || r.value < 0 || n.value < r.value || n.value > 1e6) {
    throw new CalcError("combination");
  }
  const N = BigInt(n.value);
  // nCr is symmetric, so count the shorter way.
  const R = ordered ? r.value : Math.min(r.value, n.value - r.value);
  if (R > 5000) throw new CalcError("tooLarge");
  let big = BigInt(1);
  for (let k = 0; k < R; k++) {
    big *= N - BigInt(k);
    if (!ordered) big /= BigInt(k + 1);
  }
  return finite(fromExact(frac(big, BigInt(1)), Number(big)));
}

function power(a: CalcValue, b: CalcValue): CalcValue {
  if (a.value === 0 && b.value < 0) throw new CalcError("divideByZero");
  const value = Math.pow(a.value, b.value);
  if (Number.isNaN(value)) throw new CalcError("undefined");
  if (a.exact && isInt(b.exact) && Math.abs(b.value) <= 512) {
    const k = BigInt(Math.abs(b.value));
    // Guard the size before raising: 9^500 has no business as a fraction.
    const size = Math.max(a.exact.n.toString().length, a.exact.d.toString().length) * Number(k);
    if (size <= MAX_EXACT_DIGITS * 2) {
      const n = a.exact.n ** k;
      const d = a.exact.d ** k;
      return finite(fromExact(b.value >= 0 ? frac(n, d) : frac(d, n), value));
    }
  }
  return finite({ value });
}

function call(fn: string, args: CalcValue[], angle: AngleMode): CalcValue {
  const a = args[0];
  const toRad = (v: number) => (angle === "deg" ? (v * Math.PI) / 180 : v);
  const fromRad = (v: number) => (angle === "deg" ? (v * 180) / Math.PI : v);
  switch (fn) {
    case "sin":
    case "cos":
    case "tan": {
      // Whole degrees reduce exactly first, so sin(180°) is 0 and tan(90°) is caught.
      const x = angle === "deg" ? a.value % 360 : a.value;
      const r = toRad(x);
      if (fn === "tan") {
        const quarter = angle === "deg" ? Math.abs(x % 180) === 90 : Math.abs(Math.cos(r)) < 1e-15;
        if (quarter) throw new CalcError("tanUndefined");
        return finite({ value: tidy(Math.tan(r)) });
      }
      return { value: tidy(fn === "sin" ? Math.sin(r) : Math.cos(r)) };
    }
    case "asin":
    case "acos":
      if (a.value < -1 || a.value > 1) throw new CalcError("inverseTrigDomain");
      return { value: tidy(fromRad(fn === "asin" ? Math.asin(a.value) : Math.acos(a.value))) };
    case "atan":
      return { value: tidy(fromRad(Math.atan(a.value))) };
    case "ln":
      if (a.value <= 0) throw new CalcError("logDomain");
      return { value: Math.log(a.value) };
    case "log": {
      if (a.value <= 0) throw new CalcError("logDomain");
      if (args.length === 1) return { value: tidy(Math.log10(a.value)) };
      const base = args[1].value;
      if (base <= 0 || base === 1) throw new CalcError("logDomain");
      return { value: tidy(Math.log(a.value) / Math.log(base)) };
    }
    case "exp":
      return finite({ value: Math.exp(a.value) });
    case "sqrt": {
      if (a.value < 0) throw new CalcError("sqrtNegative");
      if (a.exact) {
        const n = bigSqrt(a.exact.n);
        const d = bigSqrt(a.exact.d);
        if (n !== null && d !== null) return fromExact(frac(n, d), Math.sqrt(a.value));
      }
      return { value: Math.sqrt(a.value) };
    }
    case "cbrt":
      return { value: Math.cbrt(a.value) };
    case "root": {
      const n = args[1].value;
      if (n === 0) throw new CalcError("divideByZero");
      // Odd roots of negatives are real (∛−8 = −2); even ones are not.
      if (a.value < 0) {
        if (Number.isInteger(n) && Math.abs(n) % 2 === 1) return finite({ value: tidy(-Math.pow(-a.value, 1 / n)) });
        throw new CalcError("undefined");
      }
      return finite({ value: tidy(Math.pow(a.value, 1 / n)) });
    }
    case "abs":
      return a.exact ? fromExact(frac(a.exact.n < BigInt(0) ? -a.exact.n : a.exact.n, a.exact.d), Math.abs(a.value)) : { value: Math.abs(a.value) };
    case "nCr":
      return choose(a, args[1], false);
    case "nPr":
      return choose(a, args[1], true);
    default:
      throw new CalcError("unknown", fn);
  }
}

function evalNode(node: Node, opts: Required<Pick<EvalOptions, "angle">> & EvalOptions): CalcValue {
  switch (node.k) {
    case "num":
      return literal(node.text);
    case "const":
      return { value: node.name === "pi" ? Math.PI : Math.E };
    case "ans":
      if (!opts.ans) throw new CalcError("noAnswer");
      return opts.ans;
    case "x":
      if (opts.x === undefined) throw new CalcError("noVariable");
      return { value: opts.x };
    case "neg": {
      const a = evalNode(node.a, opts);
      return a.exact ? fromExact(frac(-a.exact.n, a.exact.d), -a.value) : { value: -a.value };
    }
    case "post": {
      const a = evalNode(node.a, opts);
      if (node.op === "!") return factorial(a);
      return a.exact ? fromExact(frac(a.exact.n, a.exact.d * BigInt(100)), a.value / 100) : { value: a.value / 100 };
    }
    case "call":
      return finite(call(node.fn, node.args.map((arg) => evalNode(arg, opts)), opts.angle));
    case "bin": {
      const a = evalNode(node.a, opts);
      const b = evalNode(node.b, opts);
      const both = a.exact && b.exact ? { p: a.exact, q: b.exact } : null;
      switch (node.op) {
        case "+":
          return finite(fromExact(both ? frac(both.p.n * both.q.d + both.q.n * both.p.d, both.p.d * both.q.d) : undefined, a.value + b.value));
        case "-":
          return finite(fromExact(both ? frac(both.p.n * both.q.d - both.q.n * both.p.d, both.p.d * both.q.d) : undefined, a.value - b.value));
        case "*":
          return finite(fromExact(both ? frac(both.p.n * both.q.n, both.p.d * both.q.d) : undefined, a.value * b.value));
        case "/":
          if (b.value === 0) throw new CalcError("divideByZero");
          return finite(fromExact(both ? frac(both.p.n * both.q.d, both.p.d * both.q.n) : undefined, a.value / b.value));
        case "^":
          return power(a, b);
        case "C":
          return choose(a, b, false);
        case "P":
          return choose(a, b, true);
      }
    }
  }
}

/** Works out a parsed line. */
export function evaluateNode(node: Node, options: EvalOptions = {}): CalcValue {
  return finite(evalNode(node, { ...options, angle: options.angle ?? "deg" }));
}

/** Works out a typed line; throws CalcError with a message for the student. */
export function evaluate(input: string, options: EvalOptions = {}): CalcValue {
  return evaluateNode(parse(input), options);
}

export type CalcOutcome = { ok: true; result: CalcValue } | { ok: false; code: CalcErrorCode; message: string };

/** `evaluate` without the throw, for the screen. */
export function tryEvaluate(input: string, options: EvalOptions = {}): CalcOutcome {
  try {
    return { ok: true, result: evaluate(input, options) };
  } catch (err) {
    if (err instanceof CalcError) return { ok: false, code: err.code, message: err.message };
    // A stack overflow from absurd nesting, or anything else unexpected.
    return { ok: false, code: "syntax", message: ERROR_TEXT.syntax };
  }
}
