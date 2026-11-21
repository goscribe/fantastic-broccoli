import { test } from "node:test";
import assert from "node:assert/strict";
import { blockKey, editNote, figureNumbers, flagsByBlock, libraryCourseHref, libraryPathFor, noteHref, noteLabelKey, recallMarks, sortClaims, tidyMath } from "./notes";
import { defaultNotesSelection, OFFER_MAX_NOTES } from "./notes-offer";
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
  // Notes open in the reader inside the app; the public pages keep /notes.
  assert.equal(noteHref("ib-biology", "a1-1"), "/library/ib-biology/a1-1");
  assert.equal(libraryCourseHref("ib-biology"), "/library/ib-biology");
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

test("libraryPathFor maps a public notes page to its in-app page, and nothing else", () => {
  assert.equal(libraryPathFor("/notes"), "/library");
  assert.equal(libraryPathFor("/notes/"), "/library");
  assert.equal(libraryPathFor("/notes/ib-biology"), "/library/ib-biology");
  assert.equal(libraryPathFor("/notes/ib-biology/a1-1-water"), "/library/ib-biology/a1-1-water");
  assert.equal(libraryPathFor("/notes/ib-biology/unit-a-unity-and-diversity"), "/library/ib-biology/unit-a-unity-and-diversity");
  // Sitemaps, images and other paths have no in-app page.
  assert.equal(libraryPathFor("/notes/sitemap/0.xml"), null);
  assert.equal(libraryPathFor("/notes/ib-biology/a1-1/opengraph-image"), null);
  assert.equal(libraryPathFor("/landing"), null);
});

test("defaultNotesSelection: the first unit with readable notes, at the student's level", () => {
  const t = (id: string, o: { note?: "draft" | "reviewed" | null; locked?: boolean; hlOnly?: boolean } = {}) => ({ id, note: o.note === undefined ? ("draft" as const) : o.note, ...(o.locked ? { locked: true } : {}), ...(o.hlOnly ? { hlOnly: true } : {}) });
  const units = [
    { id: "u0", topics: [t("x1", { note: null }), t("x2", { locked: true })] },
    { id: "u1", topics: [t("a1"), t("a2", { note: null }), t("a3", { hlOnly: true }), t("a4", { locked: true }), t("a5", { note: "reviewed" })] },
    { id: "u2", topics: [t("b1")] },
  ];
  const hl = defaultNotesSelection(units, "HL")!;
  assert.equal(hl.unit.id, "u1");
  assert.deepEqual(hl.topics.map((x) => x.id), ["a1", "a3", "a5"]);
  // SL leaves HL-only topics out; a locked or missing note is never offered.
  assert.deepEqual(defaultNotesSelection(units, "SL")!.topics.map((x) => x.id), ["a1", "a5"]);
  // No notes anywhere (production before the import): no offer.
  assert.equal(defaultNotesSelection([{ id: "u", topics: [t("n", { note: null })] }]), null);
  assert.equal(defaultNotesSelection([]), null);
  // A long unit is capped.
  const long = [{ id: "big", topics: Array.from({ length: 30 }, (_, i) => t(`t${i}`)) }];
  assert.equal(defaultNotesSelection(long)!.topics.length, OFFER_MAX_NOTES);
});
