import { test } from "node:test";
import assert from "node:assert/strict";
import { blockKey, editNote, figureNumbers, flagsByBlock, noteHref, noteLabelKey, recallMarks, sortClaims, tidyMath } from "./notes";
import type { CheckedClaim, TopicNoteContent } from "./api/notes";

const note: TopicNoteContent = {
  schemaVersion: 1,
  courseId: "ib-biology",
  topicId: "a1-1",
  topicCode: "A1.1",
  topicName: "Water",
  unitCode: "A",
  unitName: "Unity and diversity",
  locale: "en-GB",
  objectiveLine: "Explain water.",
  sections: [
    { id: "s1", heading: "Water is polar", blocks: [{ type: "paragraph", text: "x" }, { type: "figure", figureId: "f2" }] },
    { id: "s2", heading: "Ice floats on water", blocks: [{ type: "figure", figureId: "f1" }] },
  ],
  keyTerms: [],
  figures: [],
  recall: [
    { id: "q1", commandTerm: "State", question: "State x.", marks: 1, modelAnswer: "x", markPoints: ["x"] },
    { id: "q2", commandTerm: "Explain", question: "Explain y.", marks: 3, modelAnswer: "y", markPoints: ["a", "b", "c"] },
  ],
};

const claim = (where: string, verdict: CheckedClaim["verdict"], applied = false): CheckedClaim => ({
  id: where,
  where,
  claim: "c",
  verdict,
  reason: "",
  fix: null,
  applied,
});

test("blockKey maps locations to blocks", () => {
  assert.equal(blockKey("s2.b3.1"), "s2.b3");
  assert.equal(blockKey("[s1.heading]"), "s1.heading");
  assert.equal(blockKey("q3.mp1"), "q3");
  assert.equal(blockKey("f1.caption"), "f1");
  assert.equal(blockKey("term4.definition"), "terms");
});

test("flagsByBlock counts unresolved flags, fixes and lint errors", () => {
  const m = flagsByBlock(
    [claim("s1.b1", "doubtful"), claim("s1.b1", "wrong", true), claim("s1.b2", "ok")],
    [{ rule: "spelling", where: "s1.b1", message: "m", severity: "error" }, { rule: "x", where: "s2.b1", message: "m", severity: "warning" }],
  );
  assert.deepEqual(m.get("s1.b1"), { flagged: 1, fixed: 1, lint: 1 });
  assert.equal(m.has("s1.b2"), false);
  assert.equal(m.has("s2.b1"), false);
});

test("figureNumbers follow reading order", () => {
  const n = figureNumbers(note);
  assert.equal(n.get("f2"), 1);
  assert.equal(n.get("f1"), 2);
});

test("labels, links and marks", () => {
  assert.equal(noteLabelKey("reviewed"), "notes.labelReviewed");
  assert.equal(noteLabelKey("draft"), "notes.labelDraft");
  assert.equal(noteHref("ib-biology", "a1-1"), "/notes/ib-biology/a1-1");
  assert.equal(recallMarks(note), 4);
});

test("sortClaims puts open flags first", () => {
  const s = sortClaims([claim("a", "ok"), claim("b", "wrong", true), claim("c", "doubtful")]);
  assert.deepEqual(s.map((c) => c.where), ["c", "b", "a"]);
});

test("editNote does not mutate the original", () => {
  const next = editNote(note, (d) => {
    d.sections[0].heading = "Changed";
  });
  assert.equal(note.sections[0].heading, "Water is polar");
  assert.equal(next.sections[0].heading, "Changed");
});

test("tidyMath unwraps plain numbers only", () => {
  assert.equal(tidyMath("Starts with $120$ and $3.5$ but $24+8=32$."), "Starts with 120 and 3.5 but $24+8=32$.");
});
