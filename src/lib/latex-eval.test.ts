import { test } from "node:test";
import assert from "node:assert/strict";
import { niceStep, parseExpression, sampleCurve } from "./latex-eval";

const val = (latex: string, x: number) => {
  const p = parseExpression(latex);
  assert.ok(p && p.kind === "curve", latex);
  return p.f(x);
};

test("evaluates common forms", () => {
  assert.equal(val("y=x^2+1", 3), 10);
  assert.equal(val("y=2x", 4), 8);
  assert.equal(val("y=\\frac{1}{x}", 4), 0.25);
  assert.equal(val("y=\\sqrt{x}", 9), 3);
  assert.equal(val("y=-x^2", 3), -9);
  assert.equal(val("y=3(x-1)^{2}", 3), 12);
  assert.ok(Math.abs(val("y=\\sin(x)", Math.PI / 2) - 1) < 1e-12);
  assert.ok(Math.abs(val("y=e^{-0.5x}", 2) - Math.exp(-1)) < 1e-12);
  assert.ok(Math.abs(val("y=\\ln x", Math.E) - 1) < 1e-12);
  assert.equal(val("y=|x-2|", 0), 2);
  assert.equal(val("y=0.4x\\left\\{0\\le x\\le5\\right\\}", 2), 0.8);
  assert.equal(val("f(x)=x\\cdot 3", 2), 6);
});

test("reads domain restrictions", () => {
  const p = parseExpression("y=x^2+1\\{0\\le x\\le4\\}");
  assert.ok(p && p.kind === "curve");
  assert.deepEqual(p.domain, [0, 4]);
  const q = parseExpression("y=2x\\{x>1\\}");
  assert.ok(q && q.kind === "curve");
  assert.deepEqual(q.domain, [1, Infinity]);
});

test("points and vertical lines", () => {
  assert.deepEqual(parseExpression("(2,0.8)"), { kind: "point", x: 2, y: 0.8 });
  assert.deepEqual(parseExpression("(-1, \\frac{1}{2})"), { kind: "point", x: -1, y: 0.5 });
  const v = parseExpression("x=3");
  assert.equal(v?.kind, "vertical");
});

test("unsupported input returns null", () => {
  assert.equal(parseExpression("y=\\log_{2}x"), null);
  assert.equal(parseExpression("y=ax+b"), null);
  assert.equal(parseExpression("y=\\int x dx"), null);
  assert.equal(parseExpression(""), null);
});

test("sampling breaks at asymptotes", () => {
  const p = parseExpression("y=\\frac{1}{x}");
  assert.ok(p && p.kind === "curve");
  const runs = sampleCurve(p.f, null, { left: -2, right: 2, bottom: -5, top: 5 });
  assert.equal(runs.length, 2);
});

test("niceStep", () => {
  assert.equal(niceStep(10), 2);
  assert.equal(niceStep(1), 0.2);
  assert.equal(niceStep(100, 4), 20);
});
