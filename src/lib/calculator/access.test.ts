import assert from "node:assert/strict";
import { test } from "node:test";
import { PAPER_CALCULATOR, paperAllowsCalculator } from "../exam-papers";
import { SUBJECT_FAMILIES } from "../subject-family";
import { CALCULATOR_FAMILIES, calculatorPlacement, isNonCalculator, saysNonCalculator, sessionCalculatorContext } from "./access";

test("the calculator is in the toolbar for subjects with numbers, behind Tools for the rest", () => {
  for (const family of ["maths", "physics", "chemistry", "economics", "computing", "biology"] as const) {
    assert.equal(calculatorPlacement(family), "toolbar", family);
  }
  for (const family of SUBJECT_FAMILIES) {
    if (!CALCULATOR_FAMILIES.includes(family)) assert.equal(calculatorPlacement(family), "tools", family);
  }
  assert.equal(calculatorPlacement("history"), "tools");
  assert.equal(calculatorPlacement(null), "tools");
  assert.equal(calculatorPlacement(undefined), "tools");
});

test("paper ids: the non-calculator papers are the ones the server marks so", () => {
  // Pinned against goscribe/server src/lib/exam-papers.ts (calculator: false).
  assert.deepEqual(
    Object.keys(PAPER_CALCULATOR).filter((id) => !PAPER_CALCULATOR[id]).sort(),
    ["ib-math-p1", "ib-sci-p1"],
  );
  assert.equal(paperAllowsCalculator("ib-math-p1"), false);
  assert.equal(paperAllowsCalculator("ib-math-p2"), true);
  assert.equal(paperAllowsCalculator("ib-hist-p1"), null);
  assert.equal(paperAllowsCalculator(null), null);
});

test("a paper marked non-calculator turns the calculator off", () => {
  assert.equal(isNonCalculator({ paper: { name: "Paper 1-style", calculator: false } }), true);
  assert.equal(isNonCalculator({ paper: { name: "Paper 2-style", calculator: true } }), false);
  assert.equal(isNonCalculator({ paper: { name: "Paper 1-style", calculator: null } }), false);
  assert.equal(isNonCalculator({}), false);
});

test("a paper's name or instructions can say it: GCSE Paper 1, AP no-calculator", () => {
  assert.equal(isNonCalculator({ paper: { name: "GCSE Maths Paper 1 (Non-Calculator)" } }), true);
  assert.equal(isNonCalculator({ paper: { name: "Paper 1", instructions: ["You are not permitted access to any calculator."] } }), true);
  assert.equal(isNonCalculator({ paper: { name: "Paper 1", calculator: true, instructions: ["Calculators are not allowed in this paper."] } }), true);
  assert.equal(isNonCalculator({ paper: { name: "Paper 2 (Calculator)", instructions: ["A graphic display calculator is required."] } }), false);
  for (const text of ["Non-calculator", "non calculator paper", "No calculator", "No-calc section", "Without a calculator", "Calculators may not be used", "Calculator not permitted"]) {
    assert.equal(saysNonCalculator(text), true, text);
  }
  for (const text of ["Calculator allowed", "A calculator is required", "Paper 1", "", null, undefined]) {
    assert.equal(saysNonCalculator(text), false, String(text));
  }
});

test("a no-calculator section turns it off for that section only (AP Calculus)", () => {
  const paper = { name: "AP Calculus AB", calculator: true };
  assert.equal(isNonCalculator({ paper, sections: ["Section I, Part A: no calculator"] }), true);
  assert.equal(isNonCalculator({ paper, sections: ["Section I, Part B: graphing calculator required"] }), false);
  assert.equal(isNonCalculator({ paper, sections: [undefined, null] }), false);
});

test("the paper chosen on the start check applies to the whole session", () => {
  assert.equal(isNonCalculator({ paperFocus: "ib-math-p1" }), true);
  assert.equal(isNonCalculator({ paperFocus: "ib-sci-p1" }), true);
  assert.equal(isNonCalculator({ paperFocus: "ib-math-p2" }), false);
  assert.equal(isNonCalculator({ paperFocus: "something-new" }), false);
  assert.equal(isNonCalculator({ paperFocus: null }), false);
  // A practice paper's own cover wins over the remembered focus.
  assert.equal(isNonCalculator({ paper: { name: "Paper 2-style", calculator: true }, paperFocus: "ib-math-p1" }), false);
});

test("a session's context: the paper on screen, its section, and the start-check paper", () => {
  const paperOne = { type: "worksheet", paper: { name: "Paper 1-style", calculator: false }, steps: [{ section: "Section A" }, { section: "Section B" }] };
  const mcq = { type: "mcq" };
  // A practice paper: off on its worksheet, and on anything else in that session.
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: paperOne }], active: { content: paperOne }, itemIndex: 0 })), true);
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: mcq }, { content: paperOne }], active: { content: mcq } })), true);
  // An ordinary session (a Quick 5, a worksheet): on.
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: mcq }], active: { content: mcq } })), false);
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [], active: null })), false);
  // The start check's "Paper 1" makes an ordinary session non-calculator.
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: mcq }], active: { content: mcq }, paperFocus: "ib-math-p1" })), true);
  // AP: the section of the step on screen decides.
  const ap = { type: "worksheet", paper: { name: "AP Calculus AB", calculator: true }, steps: [{ section: "Part A (no calculator)" }, { section: "Part B (calculator)" }] };
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: ap }], active: { content: ap }, itemIndex: 0 })), true);
  assert.equal(isNonCalculator(sessionCalculatorContext({ activities: [{ content: ap }], active: { content: ap }, itemIndex: 1 })), false);
});
