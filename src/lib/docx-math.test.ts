import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyMath, LONE_PAGE_NUMBER } from "./docx-math";

test("the body equations of a Word file's HTML, in order, without its footnotes", () => {
  const html =
    '<span data-scribe-docx="2"></span><p>so <span data-type="inline-math" data-latex="a&lt;b">$a&lt;b$</span> holds</p>' +
    '<div data-type="block-math" data-latex="\\hat{y}=\\frac{1}{2}">$$\\hat{y}=\\frac{1}{2}$$</div>' +
    '<table><tr><td><p><span data-type="inline-math" data-latex="\\displaystyle c">$\\displaystyle c$</span></p></td></tr></table>' +
    '<ol><li id="footnote-1"><p>note <span data-type="inline-math" data-latex="z">$z$</span></p></li></ol>';
  assert.deepEqual(bodyMath(html), [
    { latex: "a<b", block: false },
    { latex: "\\hat{y}=\\frac{1}{2}", block: true },
    { latex: "\\displaystyle c", block: true },
  ]);
  assert.deepEqual(bodyMath(null), []);
  assert.deepEqual(bodyMath("<p>An old reading without maths.</p>"), []);
});

test("a header or footer that is only a page number", () => {
  for (const t of ["1", " 12 ", "Page 3", "3 of 12", "- 4 -", "7/20"]) assert.ok(LONE_PAGE_NUMBER.test(t), t);
  for (const t of ["Candidate 1234 Maths exploration", "Section 2", "2026"]) assert.ok(!LONE_PAGE_NUMBER.test(t), t);
});
