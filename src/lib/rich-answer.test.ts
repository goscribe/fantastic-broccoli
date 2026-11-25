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

// ---------------------------------------------------------------- tables and figures

import { answerFigures, cleanCaption, hasAnswerBlocks, splitTableCells } from "./rich-answer";

const TABLE = "| $x$ | $y = x^2$ |\n| --- | --- |\n| 1 | **1** |\n| 2 | $4$ |";

test("answerToDoc: a GFM table is a table, header row first, maths and bold in cells", () => {
  const doc = answerToDoc(TABLE);
  assert.equal(doc.content.length, 1);
  const table = doc.content[0];
  assert.equal(table.type, "table");
  if (table.type !== "table") return;
  assert.equal(table.content.length, 3);
  assert.deepEqual(table.content[0].content.map((c) => c.type), ["tableHeader", "tableHeader"]);
  assert.deepEqual(table.content[1].content.map((c) => c.type), ["tableCell", "tableCell"]);
  assert.deepEqual(table.content[0].content[1].content[0].content, [{ type: "inlineMath", attrs: { latex: "y = x^2" } }]);
  assert.deepEqual(table.content[1].content[1].content[0].content, [{ type: "text", text: "1", marks: [{ type: "bold" }] }]);
});

test("round trip: tables, maths in cells, escaped pipes, line breaks, figures and the text around them", () => {
  for (const value of [
    TABLE,
    `So the values are:\n\n${TABLE}\n\nwhich is a parabola.`,
    "| a \\| b | $\\|v\\|$ and $\\lvert x \\rvert$ |\n| --- | --- |\n| costs \\$5 | line one<br>line two |",
    "| empty |   |\n| --- | --- |\n|   | x |",
    "![the cell after osmosis](https://api.scribe.study/answer-figures/cm123abc)",
    "My sketch:\n\n![](https://api.scribe.study/answer-figures/f1)\n\n![velocity–time graph](https://api.scribe.study/answer-figures/f2)\n\nand $v = u + at$",
    `${TABLE}\n\n![graph of $y = x^2$](https://api.scribe.study/answer-figures/f3)`,
    "line\n\n\n| a |\n| --- |\n| b |\n\n\nafter an empty line",
  ]) {
    assert.equal(docToAnswer(answerToDoc(value)), value);
  }
});

test("a pipe in a cell's text or maths is escaped, and reads back as a pipe", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "table",
        content: [
          { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "a|b" }] }] }, { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "|x|" } }] }] }] },
          { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }, { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }, { type: "paragraph", content: [{ type: "text", text: "two" }] }] }] },
        ],
      },
    ],
  };
  const text = docToAnswer(doc);
  assert.equal(text, "| a\\|b | $\\|x\\|$ |\n| --- | --- |\n|   | one<br>two |");
  const back = answerToDoc(text).content[0];
  assert.equal(back.type, "table");
  if (back.type !== "table") return;
  assert.deepEqual(back.content[0].content[0].content[0].content, [{ type: "text", text: "a|b" }]);
  assert.deepEqual(back.content[0].content[1].content[0].content, [{ type: "inlineMath", attrs: { latex: "|x|" } }]);
  assert.deepEqual(back.content[1].content[1].content[0].content, [{ type: "text", text: "one" }, { type: "hardBreak" }, { type: "text", text: "two" }]);
  assert.deepEqual(splitTableCells("| a \\| b | c |"), ["a | b", "c"]);
});

test("short rows are padded to the header's width; a table needs its separator row", () => {
  const doc = answerToDoc("| a | b | c |\n| --- | --- | --- |\n| 1 |");
  const t = doc.content[0];
  assert.equal(t.type === "table" && t.content[1].content.length, 3);
  assert.equal(docToAnswer(doc), "| a | b | c |\n| --- | --- | --- |\n| 1 |   |   |");
  assert.equal(answerToDoc("| not a table |").content[0].type, "paragraph");
});

test("figures: their own block, caption kept clean, listed in order", () => {
  const doc = answerToDoc("see\n\n![my rough sketch](https://api.scribe.study/answer-figures/f1)");
  assert.deepEqual(doc.content, [
    { type: "paragraph", content: [{ type: "text", text: "see" }] },
    { type: "answerFigure", attrs: { caption: "my rough sketch", src: "https://api.scribe.study/answer-figures/f1" } },
  ]);
  const saved = docToAnswer({ type: "doc", content: [{ type: "answerFigure", attrs: { src: "https://x/answer-figures/f1", caption: "a [b]\nc" } }] });
  assert.equal(saved, "![a b c](https://x/answer-figures/f1)");
  assert.equal(cleanCaption(" two\n lines "), "two lines");
  assert.deepEqual(answerFigures("![a](u1)\ntext ![inline](u2)\n![b](u3)"), [{ caption: "a", src: "u1" }, { caption: "b", src: "u3" }]);
  assert.equal(hasAnswerBlocks(TABLE), true);
  assert.equal(hasAnswerBlocks("![a](u1)"), true);
  assert.equal(hasAnswerBlocks("plain | text"), false);
  assert.equal(hasRichContent("![a](u1)"), true);
});
