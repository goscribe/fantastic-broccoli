import assert from "node:assert/strict";
import { test } from "node:test";
import katex from "katex";
import { lineLatex, resultLatex } from "./pretty";

const cases: [string, string][] = [
  ["3÷4+√(2)", "\\frac{3}{4}+\\sqrt{2}"],
  ["(3+4)÷2", "\\frac{3+4}{2}"],
  ["sin⁻¹(0.5)", "\\sin^{-1}\\left(0.5\\right)"],
  ["5C2", "{}^{5}\\mathrm{C}_{2}"],
  ["x²+3x−4", "x^{2}+3x-4"],
  ["2π", "2\\pi"],
  ["2(3+4)", "2\\left(3+4\\right)"],
  ["3×−2", "3\\times \\left(-2\\right)"],
  ["3−(4+1)", "3-\\left(4+1\\right)"],
  ["(1÷2)²", "\\left(\\frac{1}{2}\\right)^{2}"],
  ["(−2)²", "\\left(-2\\right)^{2}"],
  ["−2²", "-2^{2}"],
  ["25%×80", "25\\%\\times 80"],
  ["log(8,2)", "\\log_{2}\\left(8\\right)"],
  ["∛(27)", "\\sqrt[3]{27}"],
  ["1.2E5×3", "1.2\\times 10^{5}\\times 3"],
  ["Ans×2", "\\mathrm{Ans}\\times 2"],
];

test("a finished line reads as textbook maths", () => {
  for (const [line, tex] of cases) assert.equal(lineLatex(line), tex, line);
});

test("a half-typed line shows a box where the rest goes", () => {
  assert.equal(lineLatex("3÷"), "\\frac{3}{\\square}");
  assert.equal(lineLatex("sin("), "\\sin\\left(\\square\\right)");
  assert.equal(lineLatex("sin"), "\\sin\\left(\\square\\right)");
  assert.equal(lineLatex("2^"), "2^{\\square}");
  assert.equal(lineLatex("2E"), "2\\times 10^{\\square}");
  assert.equal(lineLatex("√"), "\\sqrt{\\square}");
  // Brackets left open are closed, as "=" closes them.
  assert.equal(lineLatex("6.5×sin(62"), "6.5\\sin\\left(62\\right)");
});

test("degree mode marks plain angles", () => {
  assert.equal(lineLatex("sin(30)", "deg"), "\\sin\\left(30^{\\circ}\\right)");
  assert.equal(lineLatex("sin(30)", "rad"), "\\sin\\left(30\\right)");
  assert.equal(lineLatex("sin(", "deg"), "\\sin\\left(\\square\\right)");
  assert.equal(lineLatex("sin⁻¹(0.5)", "deg"), "\\sin^{-1}\\left(0.5\\right)");
});

test("nothing that is not maths yet is drawn", () => {
  assert.equal(lineLatex(""), null);
  assert.equal(lineLatex("co"), null);
  assert.equal(lineLatex("3)"), null);
});

test("results: fractions stack, powers of ten rise", () => {
  assert.equal(resultLatex("7/4"), "\\frac{7}{4}");
  assert.equal(resultLatex("-7/4"), "-\\frac{7}{4}");
  assert.equal(resultLatex("-1.2×10^-5"), "-1.2\\times 10^{-5}");
  assert.equal(resultLatex("0.5"), "0.5");
});

test("everything it writes is valid KaTeX", () => {
  const lines = [...cases.map((c) => c[0]), "3÷", "sin(", "2E", "5!", "√", "root(8,3)", "abs(−3)", "nCr(5,2)", "e^(2)", "10^(−3)", "1÷2÷3"];
  for (const line of lines) {
    const tex = lineLatex(line, "deg");
    assert.ok(tex, line);
    assert.doesNotThrow(() => katex.renderToString(tex, { throwOnError: true }), line);
  }
});
