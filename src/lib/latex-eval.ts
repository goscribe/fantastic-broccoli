/**
 * A small evaluator for the Desmos-style LaTeX used by note graph figures:
 * "y=x^2+1\{0\le x\le4\}", "y=\frac{1}{x}", "(2,4)". Covers numbers, x,
 * + - * / ^, implicit multiplication, \frac, \sqrt, |…|, \sin \cos \tan \ln
 * \log \exp, e and \pi, plus a trailing domain restriction. Anything else
 * returns null so callers can fall back to Desmos.
 *
 * Mirrored in goscribe/server src/lib/notes/latex-eval.ts, where the
 * generator uses it to check graphs before they are stored.
 */

export type Fn = (x: number) => number;

export type ParsedExpression =
  | { kind: "curve"; f: Fn; domain: [number, number] | null }
  | { kind: "vertical"; x: number; domain: [number, number] | null }
  | { kind: "point"; x: number; y: number };

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

const FUNCS: Record<string, (a: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
};

const COMMANDS = ["arcsin", "arccos", "arctan", "frac", "sqrt", "sin", "cos", "tan", "exp", "leq", "geq", "log", "ln", "le", "ge", "pi"];

function tokenize(src: string): Tok[] | null {
  const s = src
    .replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\!|\\ /g, "")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\dfrac|\\tfrac/g, "\\frac")
    .replace(/\\operatorname\{([a-z]+)\}/g, "\\$1")
    .replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(s.slice(i)) ?? /^\d+\.?/.exec(s.slice(i));
      if (!m) return null;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (c === "\\") {
      // Spaces are stripped, so "\\le x" arrives as "\\lex": match known commands, longest first.
      const word = /^\\([a-zA-Z]+)/.exec(s.slice(i))?.[1] ?? "";
      const known = COMMANDS.find((c) => word.startsWith(c));
      const m = known ? ([`\\${known}`, known] as const) : word ? null : /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) {
        // "\{" "\}" are restriction braces.
        if (s[i + 1] === "{" || s[i + 1] === "}") {
          out.push({ t: "op", v: s[i + 1] === "{" ? "[R" : "R]" });
          i += 2;
          continue;
        }
        return null;
      }
      const name = m[1];
      if (name === "le" || name === "leq") out.push({ t: "op", v: "<=" });
      else if (name === "ge" || name === "geq") out.push({ t: "op", v: ">=" });
      else out.push({ t: "id", v: `\\${name}` });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(c)) {
      out.push({ t: "id", v: c });
      i++;
    } else if (c === "<" || c === ">") {
      if (s[i + 1] === "=") {
        out.push({ t: "op", v: c + "=" });
        i += 2;
      } else {
        out.push({ t: "op", v: c });
        i++;
      }
    } else if ("+-*/^(){}[]|=,".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else return null;
  }
  return out;
}

class Parser {
  i = 0;
  toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }
  peek(): Tok | undefined {
    return this.toks[this.i];
  }
  isOp(v: string) {
    const p = this.peek();
    return p?.t === "op" && p.v === v;
  }
  eat(v: string) {
    if (!this.isOp(v)) throw new Error(`expected ${v}`);
    this.i++;
  }
  done() {
    return this.i >= this.toks.length;
  }
  expr(): Fn {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.toks[this.i++] as { v: string }).v;
      const a = left;
      const b = this.term();
      left = op === "+" ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
    }
    return left;
  }
  startsAtom() {
    const p = this.peek();
    if (!p) return false;
    if (p.t === "num") return true;
    if (p.t === "id") return true;
    return p.t === "op" && (p.v === "(" || p.v === "{");
  }
  term(): Fn {
    let left = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = (this.toks[this.i++] as { v: string }).v;
        const a = left;
        const b = this.unary();
        left = op === "*" ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (this.startsAtom()) {
        const a = left;
        const b = this.power();
        left = (x) => a(x) * b(x);
      } else return left;
    }
  }
  unary(): Fn {
    if (this.isOp("-")) {
      this.i++;
      const a = this.unary();
      return (x) => -a(x);
    }
    if (this.isOp("+")) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }
  power(): Fn {
    const base = this.atom();
    if (this.isOp("^")) {
      this.i++;
      const exp = this.isOp("{") ? this.group() : this.unaryAtom();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }
  unaryAtom(): Fn {
    if (this.isOp("-")) {
      this.i++;
      const a = this.atom();
      return (x) => -a(x);
    }
    return this.atom();
  }
  group(): Fn {
    this.eat("{");
    const e = this.expr();
    this.eat("}");
    return e;
  }
  atom(): Fn {
    const p = this.peek();
    if (!p) throw new Error("unexpected end");
    if (p.t === "num") {
      this.i++;
      const v = p.v;
      return () => v;
    }
    if (p.t === "op") {
      if (p.v === "(") {
        this.i++;
        const e = this.expr();
        this.eat(")");
        return e;
      }
      if (p.v === "{") return this.group();
      if (p.v === "|") {
        this.i++;
        const e = this.expr();
        this.eat("|");
        return (x) => Math.abs(e(x));
      }
      throw new Error(`unexpected ${p.v}`);
    }
    this.i++;
    const id = p.v;
    if (id === "x") return (x) => x;
    if (id === "e") return () => Math.E;
    if (id === "\\pi") return () => Math.PI;
    if (id === "\\frac") {
      const a = this.group();
      const b = this.group();
      return (x) => a(x) / b(x);
    }
    if (id === "\\sqrt") {
      let n: Fn = () => 2;
      if (this.isOp("[")) {
        this.i++;
        n = this.expr();
        this.eat("]");
      }
      const a = this.group();
      return (x) => {
        const k = n(x);
        const v = a(x);
        return k === 3 ? Math.cbrt(v) : Math.pow(v, 1 / k);
      };
    }
    const fname = id.replace(/^\\/, "");
    const f = FUNCS[fname];
    if (f) {
      let powerOf: Fn | null = null;
      if (this.isOp("^")) {
        this.i++;
        powerOf = this.isOp("{") ? this.group() : this.atom();
      }
      const arg = this.isOp("(") || this.isOp("{") ? this.atom() : this.power();
      const g = (x: number) => f(arg(x));
      return powerOf ? (x) => Math.pow(g(x), powerOf!(x)) : g;
    }
    throw new Error(`unknown ${id}`);
  }
}

function parseFn(toks: Tok[]): Fn | null {
  try {
    const p = new Parser(toks);
    const f = p.expr();
    return p.done() ? f : null;
  } catch {
    return null;
  }
}

/** Splits a trailing "\{a<x<b\}" / "{a\le x\le b}" restriction off a token list. */
function splitRestriction(toks: Tok[]): { body: Tok[]; domain: [number, number] | null } | null {
  let start = -1;
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.t === "op" && (t.v === "[R" || t.v === "{")) {
      const rest = toks.slice(i);
      if (rest.some((r) => r.t === "op" && /[<>]/.test(r.v))) start = i;
      break;
    }
  }
  if (start < 0) return { body: toks, domain: null };
  const inner = toks.slice(start + 1, -1);
  const close = toks[toks.length - 1];
  if (!(close.t === "op" && (close.v === "R]" || close.v === "}"))) return null;
  const cmp = inner.map((t, i) => ({ t, i })).filter(({ t }) => t.t === "op" && /[<>]/.test(t.v));
  const num = (ts: Tok[]) => {
    const f = parseFn(ts);
    return f ? f(0) : NaN;
  };
  let lo = -Infinity;
  let hi = Infinity;
  if (cmp.length === 2) {
    const a = num(inner.slice(0, cmp[0].i));
    const b = num(inner.slice(cmp[1].i + 1));
    const less = (cmp[0].t as { v: string }).v.startsWith("<");
    lo = less ? a : b;
    hi = less ? b : a;
  } else if (cmp.length === 1) {
    const left = inner.slice(0, cmp[0].i);
    const right = inner.slice(cmp[0].i + 1);
    const less = (cmp[0].t as { v: string }).v.startsWith("<");
    const xLeft = left.length === 1 && left[0].t === "id" && left[0].v === "x";
    const v = num(xLeft ? right : left);
    if (xLeft === less) hi = v;
    else lo = v;
  } else return null;
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return null;
  return { body: toks.slice(0, start), domain: [lo, hi] };
}

/** Parses one Desmos-style expression, or null when it is outside the supported subset. */
export function parseExpression(latex: string): ParsedExpression | null {
  const toks = tokenize(latex);
  if (!toks?.length) return null;
  // Point "(a,b)".
  const comma = toks.findIndex((t) => t.t === "op" && t.v === ",");
  if (comma > 0 && toks[0].t === "op" && toks[0].v === "(" && toks[toks.length - 1].t === "op" && (toks[toks.length - 1] as { v: string }).v === ")") {
    const a = parseFn(toks.slice(1, comma));
    const b = parseFn(toks.slice(comma + 1, -1));
    if (!a || !b) return null;
    const x = a(0);
    const y = b(0);
    return Number.isFinite(x) && Number.isFinite(y) ? { kind: "point", x, y } : null;
  }
  const split = splitRestriction(toks);
  if (!split) return null;
  let body = split.body;
  const eq = body.findIndex((t) => t.t === "op" && t.v === "=");
  if (eq >= 0) {
    const lhs = body.slice(0, eq);
    const rhs = body.slice(eq + 1);
    if (lhs.length === 1 && lhs[0].t === "id" && lhs[0].v === "x") {
      const f = parseFn(rhs);
      return f ? { kind: "vertical", x: f(0), domain: split.domain } : null;
    }
    const isY = lhs.length === 1 && lhs[0].t === "id" && lhs[0].v === "y";
    const isFx = lhs.length === 4 && lhs[0].t === "id" && lhs[1].t === "op" && lhs[1].v === "(";
    if (!isY && !isFx) return null;
    body = rhs;
  }
  if (body.some((t) => t.t === "id" && t.v.length === 1 && t.v !== "x" && t.v !== "e")) return null;
  const f = parseFn(body);
  return f ? { kind: "curve", f, domain: split.domain } : null;
}

/** "Nice" tick step for a range (1, 2 or 5 × 10^k) giving about `target` ticks. */
export function niceStep(range: number, target = 5): number {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}

/** Samples a curve into polyline runs inside the window, breaking at gaps and asymptotes. */
export function sampleCurve(
  f: Fn,
  domain: [number, number] | null,
  win: { left: number; right: number; bottom: number; top: number },
  n = 300,
): [number, number][][] {
  const lo = Math.max(win.left, domain?.[0] ?? -Infinity);
  const hi = Math.min(win.right, domain?.[1] ?? Infinity);
  if (!(hi > lo)) return [];
  const runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  const span = win.top - win.bottom;
  let prev: number | null = null;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const y = f(x);
    const ok = Number.isFinite(y) && y >= win.bottom - span && y <= win.top + span;
    if (!ok || (prev !== null && Math.abs(y - prev) > span)) {
      if (cur.length > 1) runs.push(cur);
      cur = [];
      prev = ok ? y : null;
      if (ok) cur.push([x, y]);
      continue;
    }
    cur.push([x, y]);
    prev = y;
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}
