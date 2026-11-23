import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultNoteSubject, docHighlights, isDiagramFigure, locateAnchor, locateInNote, makeAnchor, ownNoteHref, quotePreview, sortByPlace, treeLevels, wrapLabel } from "./my-notes";

const TEXT = "Water is a polar molecule. Hydrogen bonds form between water molecules. Hydrogen bonds make water cohesive.";

test("a note opens inside its subject", () => {
  assert.equal(ownNoteHref("ws 1", "n/1"), "/workspace/ws%201/note/n%2F1");
});

test("New note offers the subject last written in, else the most recent", () => {
  const subjects = [{ id: "a" }, { id: "b" }];
  assert.equal(defaultNoteSubject(subjects, "b")?.id, "b");
  assert.equal(defaultNoteSubject(subjects, "gone")?.id, "a");
  assert.equal(defaultNoteSubject([], "b"), null);
});

test("an anchor keeps the words, their surroundings and their place, without the selection's stray spaces", () => {
  const start = TEXT.indexOf("Hydrogen bonds form");
  const a = makeAnchor("s1", TEXT, start - 1, start + "Hydrogen bonds form".length + 1);
  assert.deepEqual(a, { sectionId: "s1", quote: "Hydrogen bonds form", prefix: "Water is a polar molecule. ", suffix: TEXT.slice(start + 19, start + 19 + 40), startOffset: start });
  assert.equal(makeAnchor("s1", TEXT, 5, 5), null);
  assert.equal(makeAnchor("s1", "a   b", 1, 4), null);
});

test("an anchor is found at its offset, or re-found by its words and surroundings after an edit", () => {
  const start = TEXT.lastIndexOf("Hydrogen bonds");
  const a = makeAnchor("s1", TEXT, start, start + "Hydrogen bonds".length)!;
  assert.deepEqual(locateAnchor(TEXT, a), { start, end: start + 14, moved: false });
  // A sentence added before it: the offset is stale, the second "Hydrogen bonds" is still the one (its surroundings match).
  const edited = `Water covers most of the planet. ${TEXT}`;
  const found = locateAnchor(edited, a)!;
  assert.equal(found.moved, true);
  assert.equal(found.start, edited.lastIndexOf("Hydrogen bonds"));
  // The words were rewritten: dropped, not guessed.
  assert.equal(locateAnchor("Water is polar. H-bonds hold it together.", a), null);
});

test("a highlight follows its words to another section, and orphans are left out", () => {
  const a = makeAnchor("s2", TEXT, 0, 5)!;
  const sections = [
    { id: "s1", text: "Intro. Water is everywhere." },
    { id: "s2", text: "Nothing here now." },
  ];
  assert.deepEqual(locateInNote(sections, a), { sectionId: "s1", start: 7, end: 12, moved: true });
  assert.equal(locateInNote([{ id: "s2", text: "Nothing here now." }], a), null);
  assert.deepEqual(sortByPlace([{ sectionId: "s2", start: 1 }, { sectionId: "s1", start: 9 }, { sectionId: "s1", start: 2 }], ["s1", "s2"]).map((x) => `${x.sectionId}:${x.start}`), ["s1:2", "s1:9", "s2:1"]);
});

test("the highlights list shows one line per highlight", () => {
  assert.equal(quotePreview("a  b\nc"), "a b c");
  const long = quotePreview("word ".repeat(60), 40);
  assert.ok(long.length <= 40 && long.endsWith("…"));
});

test("highlights in an editor document are its highlight marks, in reading order", () => {
  const mark = (color: string) => [{ type: "highlight", attrs: { color } }];
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Plain " }, { type: "text", text: "first", marks: mark("green") }, { type: "text", text: " half", marks: [{ type: "bold" }, ...mark("green")] }, { type: "text", text: " tail" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "second", marks: mark("nonsense") }, { type: "text", text: "third", marks: mark("pink") }] }] }] },
    ],
  };
  assert.deepEqual(docHighlights(doc), [
    { index: 0, text: "first half", color: "green" },
    { index: 1, text: "second", color: "yellow" },
    { index: 2, text: "third", color: "pink" },
  ]);
  assert.deepEqual(docHighlights(null), []);
});

test("a figure block is only drawn from a well-formed spec", () => {
  assert.ok(isDiagramFigure({ kind: "graph", title: "t", caption: "", alt: "", graph: { xLabel: "x", yLabel: "y", bounds: { left: 0, right: 1, bottom: 0, top: 1 }, expressions: [] } }));
  assert.ok(isDiagramFigure({ kind: "diagram", title: "t", caption: "", alt: "", diagram: { layout: "flow", nodes: [], edges: [] } }));
  const sketch = { xLabel: "Real GDP (Y)", yLabel: "Price level (PL)", axes: true, bounds: { left: 0, right: 10, bottom: 0, top: 10 }, curves: [], points: [], marks: [], arrows: [], regions: [], texts: [] };
  assert.ok(isDiagramFigure({ kind: "sketch", title: "t", caption: "", alt: "", sketch }));
  assert.ok(!isDiagramFigure({ kind: "sketch", title: "t", caption: "", alt: "", sketch: { ...sketch, curves: undefined } }));
  assert.ok(!isDiagramFigure({ kind: "graph", title: "t" }));
  assert.ok(!isDiagramFigure({ kind: "html", title: "t", html: "<svg/>" }));
  assert.ok(!isDiagramFigure(null));
});

test("a tree is laid out level by level; labels wrap at spaces", () => {
  const node = (id: string) => ({ id, label: id, detail: null });
  const edge = (from: string, to: string) => ({ from, to, label: null });
  assert.deepEqual(treeLevels({ layout: "tree", nodes: ["a", "b", "c", "d"].map(node), edges: [edge("a", "b"), edge("a", "c"), edge("b", "d")] }), [["a"], ["b", "c"], ["d"]]);
  // A loop does not hang the layout.
  assert.deepEqual(treeLevels({ layout: "tree", nodes: ["a", "b"].map(node), edges: [edge("a", "b"), edge("b", "a")] }), [["a"], ["b"]]);
  assert.deepEqual(wrapLabel("Chromosomes line up at the equator", 16), ["Chromosomes line", "up at the", "equator"]);
  assert.deepEqual(wrapLabel("one two three four five six seven", 8, 2), ["one two", "thre…"]);
});
