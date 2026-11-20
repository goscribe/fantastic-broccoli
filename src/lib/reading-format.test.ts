import { test } from "node:test";
import assert from "node:assert/strict";
import { boldRanges, calloutIsEmpty, checksBySection, parseCallout, parseList, splitBold } from "./reading-format";

test("bold ranges index the text with the markers removed", () => {
  const raw = "A **balanced equation** gives the **mole ratio**.";
  const plain = raw.replace(/\*\*/g, "");
  const ranges = boldRanges(raw);
  assert.deepEqual(ranges.map(([s, e]) => plain.slice(s, e)), ["balanced equation", "mole ratio"]);
  const pieces = splitBold(plain, 0, plain.length, ranges);
  assert.deepEqual(pieces.filter((p) => p.bold).map((p) => p.text), ["balanced equation", "mole ratio"]);
  assert.equal(pieces.map((p) => p.text).join(""), plain);
  // A slice that starts inside a bold term keeps it bold.
  assert.deepEqual(splitBold(plain, 5, 12, ranges), [{ text: plain.slice(5, 12), bold: true, start: 5 }]);
});

test("labelled paragraphs become callouts; Scribe-written ones are marked", () => {
  assert.deepEqual(parseCallout("**In short:** Diffusion needs no energy."), {
    kind: "in_short", label: "In short", body: "Diffusion needs no energy.", scribe: true,
  });
  const note = parseCallout("**Note (added by Scribe):** Your notes don't explain Bohr's model.");
  assert.equal(note?.kind, "note");
  assert.equal(note?.scribe, true);
  const term = parseCallout("**Key term — osmosis:** Osmosis is the diffusion of water across a membrane.");
  assert.equal(term?.kind, "key_term");
  assert.equal(term?.scribe, false);
  const worked = parseCallout("**Worked example**\nMoles Mg = 6 / 24 = 0.25 mol.\nMass = 0.25 × 40 = 10 g.");
  assert.deepEqual(worked?.lines, ["Moles Mg = 6 / 24 = 0.25 mol.", "Mass = 0.25 × 40 = 10 g."]);
  assert.equal(parseCallout("**Diffusion** is passive."), null);
});

test("lists: bullets and numbered steps", () => {
  assert.deepEqual(parseList(["- a", "- b"]), { ordered: false, items: ["a", "b"] });
  assert.deepEqual(parseList(["1. Write the equation.", "2. Work out moles."]), {
    ordered: true, items: ["Write the equation.", "Work out moles."],
  });
  assert.equal(parseList(["1. a", "b"]), null);
});

test("quick checks follow the section they belong to", () => {
  const check = (q: string) => ({ type: "check", question: q, options: ["a", "b", "c", "d"], correctIndex: 1, feedbackCorrect: "Correct.", feedbackWrong: "Not quite." });
  const map = checksBySection([
    { type: "objective", text: "x" },
    { type: "heading", text: "Concentration of solutions" },
    { type: "paragraph", text: "…" },
    check("Q1"),
    { type: "heading", text: "Titration calculations" },
    check("Q2"),
    { type: "check", question: "bad", options: ["a"], correctIndex: 3 },
  ]);
  assert.deepEqual([...map.keys()], ["Concentration of solutions", "Titration calculations"]);
  assert.equal(map.get("Titration calculations")?.length, 1);
  assert.equal(checksBySection(undefined).size, 0);
});

test("a callout with a blank body is empty (never rendered as a bare label)", () => {
  assert.equal(calloutIsEmpty(parseCallout("**In short:**")!), true);
  assert.equal(calloutIsEmpty(parseCallout("**In short:**   ** **")!), true);
  assert.equal(calloutIsEmpty(parseCallout("**In short:** Moles link mass and Mr.")!), false);
});
