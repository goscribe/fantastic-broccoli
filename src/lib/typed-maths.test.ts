import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeLatex, typedToLatex } from "./typed-maths";

test("maths typed on a keyboard becomes LaTeX", () => {
  assert.equal(typedToLatex("a/b"), "\\frac{a}{b}");
  assert.equal(typedToLatex("(a+b)/(c+d)"), "\\frac{a+b}{c+d}");
  assert.equal(typedToLatex("sqrt(x^2+1)/2"), "\\frac{\\sqrt{x^2+1}}{2}");
  assert.equal(typedToLatex("sqrt(sqrt(x))"), "\\sqrt{\\sqrt{x}}");
  assert.equal(typedToLatex("sin(x)/x"), "\\frac{\\sin(x)}{x}");
  assert.equal(typedToLatex("3*10^8"), "3 \\times 10^8");
  assert.equal(typedToLatex("x^12 + y_10"), "x^{12} + y_{10}");
  assert.equal(typedToLatex("x^(n+1)"), "x^{n+1}");
  assert.equal(typedToLatex("x >= 2 pi"), "x \\ge 2 \\pi");
  assert.equal(typedToLatex("rate = delta c/delta t"), "rate = \\frac{\\delta c}{\\delta t}");
});

test("LaTeX is left exactly as typed", () => {
  assert.equal(looksLikeLatex("\\frac{1}{2}"), true);
  assert.equal(looksLikeLatex("x^2"), false);
  assert.equal(typedToLatex("\\frac{1}{2}"), "\\frac{1}{2}");
  assert.equal(typedToLatex("  "), "");
});
