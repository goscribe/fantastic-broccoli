import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExpression } from "../latex-eval";
import { fitWindow, graphOf, GRAPH_ERRORS } from "./graph";

/** The curve NoteGraph will draw for a typed function, evaluated at x. */
function plotted(expr: string, x: number): number {
  const out = graphOf(expr, -10, 10);
  assert.equal(out.ok, true, expr);
  if (!out.ok) return NaN;
  const parsed = parseExpression(out.latex);
  assert.equal(parsed?.kind, "curve", out.latex);
  return parsed?.kind === "curve" ? parsed.f(x) : NaN;
}

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("a typed function becomes LaTeX the note plot draws as the same curve", () => {
  near(plotted("x²−4", 3), 5);
  near(plotted("2x+1", -2), -3);
  near(plotted("x^3-2x", 2), 4);
  near(plotted("1÷x", 4), 0.25);
  near(plotted("√(x)", 9), 3);
  near(plotted("abs(x)−3", -5), 2);
  near(plotted("e^(−x²)", 1), Math.exp(-1));
  near(plotted("ln(x)+log(x)", 100), Math.log(100) + 2);
  near(plotted("−x²", 3), -9);
  near(plotted("y = 3x", 2), 6);
  near(plotted("2πx", 1), 2 * Math.PI);
  near(plotted("0.0000005x", 2), 0.000001);
});

test("graphs are in radians", () => {
  near(plotted("sin(x)", Math.PI / 2), 1);
  near(plotted("2cos(x)", Math.PI), -2);
});

test("the y window fits the curve on tidy numbers", () => {
  const out = graphOf("x²−4", -5, 5);
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.window.left, -5);
  assert.equal(out.window.right, 5);
  assert.ok(out.window.bottom <= -4 && out.window.top >= 20, JSON.stringify(out.window));
  // A flat line still gets a window with height.
  const flat = fitWindow(() => 3, -1, 1)!;
  assert.ok(flat.top > flat.bottom);
  // An asymptote does not flatten the rest of the curve.
  const inverse = fitWindow((x) => 1 / x, -10, 10)!;
  assert.ok(inverse.top <= 5 && inverse.bottom >= -5, JSON.stringify(inverse));
  assert.equal(fitWindow(() => NaN, 0, 1), null);
});

test("what cannot be drawn says why", () => {
  assert.deepEqual(graphOf("", -10, 10), { ok: false, message: GRAPH_ERRORS.empty });
  assert.deepEqual(graphOf("x!", -10, 10), { ok: false, message: GRAPH_ERRORS.unsupported });
  assert.deepEqual(graphOf("xC2", -10, 10), { ok: false, message: GRAPH_ERRORS.unsupported });
  assert.deepEqual(graphOf("x", 5, -5), { ok: false, message: GRAPH_ERRORS.range });
  assert.deepEqual(graphOf("√(x)", -10, -1), { ok: false, message: GRAPH_ERRORS.nothing });
  const bad = graphOf("2+", -10, 10);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.message, "Something is missing at the end");
});
