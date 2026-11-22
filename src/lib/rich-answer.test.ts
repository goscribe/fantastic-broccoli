import { test } from "node:test";
import assert from "node:assert/strict";
import { applySnippet, hasRichContent, insideMath } from "./rich-answer";

test("insideMath counts unescaped dollars before the caret", () => {
  assert.equal(insideMath("x $a + b$ y", 5), true);
  assert.equal(insideMath("x $a + b$ y", 10), false);
  assert.equal(insideMath("costs \\$5 and", 10), false);
});

test("maths snippets wrap themselves in $…$ outside maths, not inside", () => {
  assert.deepEqual(applySnippet("x = ", 4, 4, "frac"), { value: "x = $\\frac{}{}$", caret: 11 });
  assert.deepEqual(applySnippet("$x = $", 5, 5, "frac"), { value: "$x = \\frac{}{}$", caret: 11 });
});

test("a selection goes inside the snippet", () => {
  assert.deepEqual(applySnippet("area is x", 8, 9, "pow"), { value: "area is $x^{}$", caret: 12 });
  assert.deepEqual(applySnippet("very important", 5, 14, "bold"), { value: "very **important**", caret: 16 });
  assert.deepEqual(applySnippet("16", 0, 2, "sqrt"), { value: "$\\sqrt{16}$", caret: 9 });
});

test("hasRichContent", () => {
  assert.equal(hasRichContent("2 + 2 = 4"), false);
  assert.equal(hasRichContent("$2 + 2 = 4$"), true);
  assert.equal(hasRichContent("it is **big**"), true);
  assert.equal(hasRichContent("3 * 4 * 5"), false);
});
