import { test } from "node:test";
import assert from "node:assert/strict";
import { answerToDoc, docToAnswer, hasRichContent } from "./rich-answer";

test("answerToDoc: lines, maths, bold, italics", () => {
  assert.deepEqual(answerToDoc("$2 + 2 = 4$\nso **four** is *it*"), {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "2 + 2 = 4" } }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "so " },
          { type: "text", text: "four", marks: [{ type: "bold" }] },
          { type: "text", text: " is " },
          { type: "text", text: "it", marks: [{ type: "italic" }] },
        ],
      },
    ],
  });
});

test("answerToDoc: an escaped dollar is a dollar; empty lines stay", () => {
  assert.deepEqual(answerToDoc("costs \\$5\n"), {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "costs $5" }] }, { type: "paragraph" }],
  });
});

test("round trip: what the editor saves reads back the same", () => {
  for (const value of [
    "$2 + 2 = 4$",
    "$4 + 3 = 7$\nso $\\frac{7}{1}$",
    "$\\frac{3}{7}$ of the fruit are **apples**",
    "it costs \\$5 and *that* is all",
    "plain words",
  ]) {
    assert.equal(docToAnswer(answerToDoc(value)), value);
  }
});

test("docToAnswer keeps spaces outside bold, and escapes dollars typed as text", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "the " },
          { type: "text", text: "big one ", marks: [{ type: "bold" }] },
          { type: "text", text: "costs $3" },
        ],
      },
    ],
  };
  assert.equal(docToAnswer(doc), "the **big one** costs \\$3");
});

test("hasRichContent", () => {
  assert.equal(hasRichContent("2 + 2 = 4"), false);
  assert.equal(hasRichContent("$2 + 2 = 4$"), true);
  assert.equal(hasRichContent("it is **big**"), true);
  assert.equal(hasRichContent("3 * 4 * 5"), false);
});
