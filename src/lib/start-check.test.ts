import { test } from "node:test";
import assert from "node:assert/strict";
import type { TopicNoteContent } from "./api/notes";
import {
  CONFIDENCE_FACES,
  SKIP_QUIET_MS,
  confidenceCat,
  confidenceFace,
  confidenceResult,
  notePrimer,
  parseCourseTopics,
  primerPlan,
  readingOrder,
  readingPoints,
  sessionPath,
  skippedRecently,
  sliderKeyValue,
  tidyFocusNote,
  valueFromPointer,
  materialName,
  type MaterialPrimer,
} from "./start-check";

test("the cat's face follows the scale: worried, unsure, neutral, happy, delighted", () => {
  const faces = Array.from({ length: 11 }, (_, v) => confidenceFace(v));
  assert.deepEqual(faces, ["worried", "worried", "worried", "unsure", "unsure", "neutral", "neutral", "happy", "happy", "delighted", "delighted"]);
  assert.deepEqual([...new Set(faces)], CONFIDENCE_FACES);
  assert.equal(confidenceCat("unsure"), "/design/cat3-unsure.webp");
  assert.equal(confidenceFace(-3), "worried");
  assert.equal(confidenceFace(99), "delighted");
});

test("slider keys: arrows step by one, Page keys by two, Home and End jump, digits set, and the ends hold", () => {
  assert.equal(sliderKeyValue(5, "ArrowRight"), 6);
  assert.equal(sliderKeyValue(5, "ArrowUp"), 6);
  assert.equal(sliderKeyValue(5, "ArrowLeft"), 4);
  assert.equal(sliderKeyValue(5, "ArrowDown"), 4);
  assert.equal(sliderKeyValue(5, "PageUp"), 7);
  assert.equal(sliderKeyValue(5, "PageDown"), 3);
  assert.equal(sliderKeyValue(5, "Home"), 0);
  assert.equal(sliderKeyValue(5, "End"), 10);
  assert.equal(sliderKeyValue(5, "8"), 8);
  assert.equal(sliderKeyValue(10, "ArrowRight"), 10);
  assert.equal(sliderKeyValue(0, "ArrowLeft"), 0);
  assert.equal(sliderKeyValue(9, "PageUp"), 10);
  // Keys the slider leaves alone, so Tab still moves on and Enter still submits.
  assert.equal(sliderKeyValue(5, "Tab"), null);
  assert.equal(sliderKeyValue(5, "Enter"), null);
  assert.equal(sliderKeyValue(5, "a"), null);
});

test("a touch on the track picks the nearest whole number and stays on the scale", () => {
  assert.equal(valueFromPointer(100, 100, 300), 0);
  assert.equal(valueFromPointer(400, 100, 300), 10);
  assert.equal(valueFromPointer(250, 100, 300), 5);
  assert.equal(valueFromPointer(163, 100, 300), 2);
  assert.equal(valueFromPointer(20, 100, 300), 0);
  assert.equal(valueFromPointer(900, 100, 300), 10);
  assert.equal(valueFromPointer(10, 0, 0), 5);
});

test("confidence picks the path: low reads the notes, medium gets a recap, high (or not asked) goes straight in", () => {
  assert.deepEqual([0, 2, 4].map(sessionPath), ["notes", "notes", "notes"]);
  assert.deepEqual([5, 6, 7].map(sessionPath), ["recap", "recap", "recap"]);
  assert.deepEqual([8, 9, 10].map(sessionPath), ["questions", "questions", "questions"]);
  assert.equal(sessionPath(null), "questions");
  assert.equal(sessionPath(undefined), "questions");
});

const fig = (id: string) => ({ id, kind: "html" as const, static: true, title: `Figure ${id}`, caption: `Caption ${id}`, alt: "", brief: "", html: "<svg/>" });
const NOTE: TopicNoteContent = {
  schemaVersion: 1,
  courseId: "ib-biology",
  topicId: "a1-1",
  topicCode: "A1.1",
  topicName: "Water",
  unitCode: "A1",
  unitName: "Molecules",
  locale: "en-GB",
  objectiveLine: "Explain the properties of water.",
  sections: [
    {
      id: "s1",
      heading: "Polarity",
      blocks: [
        { type: "paragraph", text: "Water is a polar molecule. Its oxygen pulls electrons harder than its hydrogens." },
        { type: "figure", figureId: "f2" },
        { type: "bullets", items: [{ text: "Oxygen is slightly negative", sub: [] }, { text: "Hydrogen is slightly positive", sub: [] }] },
      ],
    },
    { id: "s2", heading: "Hydrogen bonds", blocks: [{ type: "figure", figureId: "f1" }, { type: "paragraph", text: "Hydrogen bonds form between molecules. They are weak alone." }] },
    { id: "s3", heading: "Cohesion", blocks: [{ type: "bullets", items: [{ text: "Cohesion is water sticking to water", sub: [] }] }, { type: "figure", figureId: "f3" }] },
    { id: "s4", heading: "Solvent", blocks: [{ type: "bullets", items: [{ text: "Polar solutes dissolve", sub: [] }] }, { type: "figure", figureId: "f4" }] },
  ],
  keyTerms: Array.from({ length: 8 }, (_, i) => ({ term: `Term ${i + 1}`, definition: `Definition ${i + 1}`, sectionId: "s1" })),
  figures: [fig("f1"), fig("f2"), fig("f3"), fig("f4")],
  recall: [],
};

test("not confident: the note's figures first (in the note's order), its opening explanation and key terms, no bullet points", () => {
  const p = notePrimer(NOTE, "notes");
  assert.deepEqual(p.figures.map((f) => f.id), ["f2", "f1", "f3"]);
  assert.equal(p.lead, "Water is a polar molecule. Its oxygen pulls electrons harder than its hydrogens.");
  assert.equal(p.terms.length, 6);
  assert.deepEqual(p.points, []);
  assert.equal(p.topicName, "Water");
});

test("fairly confident: one or two figures and at most three points, one a section", () => {
  const p = notePrimer(NOTE, "recap");
  assert.deepEqual(p.figures.map((f) => f.id), ["f2", "f1"]);
  assert.deepEqual(p.points, ["Oxygen is slightly negative", "Hydrogen bonds form between molecules.", "Cohesion is water sticking to water"]);
  assert.equal(p.lead, "Water is a polar molecule.");
  assert.deepEqual(p.terms, []);
});

test("a note with no figure blocks still offers its figures; one with no paragraph leads with its objective", () => {
  const bare: TopicNoteContent = { ...NOTE, sections: [{ id: "s1", heading: "H", blocks: [{ type: "bullets", items: [{ text: "One", sub: [] }] }] }] };
  const p = notePrimer(bare, "notes");
  assert.equal(p.figures.length, 3);
  assert.equal(p.lead, "Explain the properties of water.");
});

const material = (over: Partial<MaterialPrimer> = {}): MaterialPrimer => ({ status: "ready", reading: { artifactId: "a", title: "Membranes", text: "- one\n- two", figures: [] }, images: [], ...over });
const noFigures = { ...notePrimer(NOTE, "notes"), figures: [] };

test("which screen comes first: Scribe's note when it has a figure, else the learner's own material, else nothing", () => {
  const note = notePrimer(NOTE, "notes");
  assert.deepEqual(primerPlan({ path: "questions", notes: [note], material: material() }), { kind: "none" });
  assert.deepEqual(primerPlan({ path: "notes", notes: [note], material: null }), { kind: "note", path: "notes" });
  assert.deepEqual(primerPlan({ path: "recap", notes: [notePrimer(NOTE, "recap")], material: null }), { kind: "note", path: "recap" });
  // Own material: no Scribe note at all.
  assert.deepEqual(primerPlan({ path: "notes", notes: [], material: material() }), { kind: "material", path: "notes" });
  // A note without figures gives way to material; with no material its words still show.
  assert.deepEqual(primerPlan({ path: "notes", notes: [noFigures], material: material() }), { kind: "material", path: "notes" });
  assert.deepEqual(primerPlan({ path: "notes", notes: [noFigures], material: material({ status: "none", reading: null }) }), { kind: "note", path: "notes" });
  // The note for their material is still being written.
  assert.deepEqual(primerPlan({ path: "notes", notes: [], material: material({ status: "preparing", reading: null }) }), { kind: "preparing" });
  // Nothing anywhere: the session's own reading does the teaching.
  assert.deepEqual(primerPlan({ path: "notes", notes: [], material: material({ status: "none", reading: null }) }), { kind: "none" });
  assert.deepEqual(primerPlan({ path: "notes", notes: [], material: null }), { kind: "none" });
});

test("a recap of own material only shows when there is something to look at", () => {
  assert.deepEqual(primerPlan({ path: "recap", notes: [], material: material() }), { kind: "none" });
  const withImage = material({ images: [{ id: "i", type: "image", url: "k", caption: "A cell" }] });
  assert.deepEqual(primerPlan({ path: "recap", notes: [], material: withImage }), { kind: "material", path: "recap" });
  const withFigure = material({ reading: { artifactId: "a", title: "T", text: "[[figure:f]]\n\nText", figures: [] } });
  assert.deepEqual(primerPlan({ path: "recap", notes: [], material: withFigure }), { kind: "material", path: "recap" });
  assert.deepEqual(primerPlan({ path: "recap", notes: [], material: material({ status: "preparing", reading: null }) }), { kind: "none" });
});

test("a recap takes a reading's key points, else its first three bullets", () => {
  assert.deepEqual(readingPoints("- a\n- b", ["K1", " K2 ", "", "K3", "K4"]), ["K1", "K2", "K3"]);
  assert.deepEqual(readingPoints("# H\n\nIntro\n\n- one\n* two\n1. three\n- four"), ["one", "two", "three"]);
  assert.deepEqual(readingPoints("Just prose."), []);
});

test("a first reading that opens on bullets shows its figure, then its explanation, then the points", () => {
  const r = readingOrder(["heading", "list", "paragraph", "figure", "list"]);
  assert.deepEqual(r.order, [0, 3, 2, 1, 4]);
  assert.equal(r.needsLead, false);
  assert.equal(r.bulletLed, true);
  // Bullets only: nothing of its own to lead with, so the caller brings a visual.
  assert.deepEqual(readingOrder(["heading", "list", "list"]), { order: [0, 1, 2], needsLead: true, bulletLed: true });
  assert.deepEqual(readingOrder(["list", "widget"]).order, [1, 0]);
  // A reading that already opens on prose or a figure is left exactly as written.
  assert.deepEqual(readingOrder(["heading", "paragraph", "list", "figure"]), { order: [0, 1, 2, 3], needsLead: false, bulletLed: false });
  assert.deepEqual(readingOrder(["figure", "list"]).order, [0, 1]);
  assert.deepEqual(readingOrder([]), { order: [], needsLead: false, bulletLed: false });
});

test("the end screen sets what they said beside what they got", () => {
  assert.deepEqual(confidenceResult(3, 7, 10), { said: 3, got: 7, verdict: "better" });
  assert.deepEqual(confidenceResult(9, 3, 5), { said: 9, got: 6, verdict: "tougher" });
  assert.deepEqual(confidenceResult(6, 4, 5), { said: 6, got: 8, verdict: "better" });
  assert.deepEqual(confidenceResult(7, 4, 5), { said: 7, got: 8, verdict: "asExpected" });
  assert.equal(confidenceResult(null, 4, 5), null);
  assert.equal(confidenceResult(5, 0, 0), null);
});

test("small helpers: the session's topics, the focus note, and a skip that stays quiet for a week", () => {
  assert.deepEqual(parseCourseTopics("ib-biology:a1-1,a1-2"), { courseId: "ib-biology", topicIds: ["a1-1", "a1-2"] });
  assert.equal(parseCourseTopics(null), null);
  assert.equal(parseCourseTopics("nocolon"), null);
  assert.equal(tidyFocusNote("  mitosis \n vs   meiosis "), "mitosis vs meiosis");
  assert.equal(tidyFocusNote("x".repeat(400)).length, 200);
  assert.equal(skippedRecently(1000, 1000 + SKIP_QUIET_MS - 1), true);
  assert.equal(skippedRecently(1000, 1000 + SKIP_QUIET_MS + 1), false);
  assert.equal(skippedRecently(null, 5), false);
});

test("own material is asked about by name, without \"notes\" tacked on; a title that names nothing asks about \"this\"", () => {
  assert.equal(materialName("Cell membranes notes"), "Cell membranes");
  assert.equal(materialName("Cell membranes"), "Cell membranes");
  assert.equal(materialName("My Physics revision notes"), "Physics");
  assert.equal(materialName("Chapter 3 - Notes"), "Chapter 3");
  assert.equal(materialName("thermodynamics.pdf"), "thermodynamics");
  assert.equal(materialName("Notes"), "");
  assert.equal(materialName("Quick 5"), "");
  assert.equal(materialName("Review: Water"), "");
  assert.equal(materialName("  "), "");
  // A catalog topic's name never goes through this: "Water" stays "Water".
  assert.equal(materialName("Keynotes on jazz"), "Keynotes on jazz");
});
