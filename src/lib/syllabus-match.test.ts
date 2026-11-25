import { test } from "node:test";
import assert from "node:assert/strict";
import { boardGuessLine, boardOfCourseId, boardOrder, coursesForBoard, matchHeadline, shouldShowMatch, type SyllabusMatch } from "./syllabus-match";
import type { CourseSummary } from "./api/courses";

const suggestion: NonNullable<SyllabusMatch["suggestion"]> = {
  courseId: "aqa-gcse-biology",
  courseTitle: "AQA GCSE Biology",
  label: "AQA GCSE Biology",
  boardName: "AQA",
  qualification: "GCSE",
  level: null,
  levels: null,
  topics: [{ id: "4-1-1", code: "4.1.1", name: "Cell structure", unitCode: "4.1", unitName: "Cell biology", confidence: 0.9 }],
};
const match = (over: Partial<SyllabusMatch> = {}): SyllabusMatch => ({ status: "suggested", prompt: "confirm", band: "high", confidence: 0.9, suggestion, options: [], boardGuess: null, ...over });

test("the confirm headline names the course and the unit of the best topic", () => {
  assert.equal(matchHeadline(suggestion), "Looks like AQA GCSE Biology · 4.1 Cell biology. Right?");
  assert.equal(matchHeadline({ ...suggestion, label: "IB Chemistry HL", topics: [] }), "Looks like IB Chemistry HL. Right?");
  // A unit named as a question does not end in "?. Right?".
  const q = { ...suggestion.topics[0], unitCode: "R1", unitName: "What drives chemical reactions?" };
  assert.equal(matchHeadline({ ...suggestion, label: "IB Chemistry", topics: [q] }), "Looks like IB Chemistry · R1 What drives chemical reactions. Right?");
});

test("shown only with a prompt from the server, and not once answered here", () => {
  assert.equal(shouldShowMatch(match(), false), true);
  assert.equal(shouldShowMatch(match(), true), false);
  assert.equal(shouldShowMatch(match({ prompt: null }), false), false);
  assert.equal(shouldShowMatch(null, false), false);
});

test("board-first picker: awarding body from the course id; the suggestion's board leads", () => {
  assert.equal(boardOfCourseId("edexcel-alevel-maths"), "Edexcel");
  assert.equal(boardOfCourseId("ib-math-aa"), "IB");
  assert.equal(boardOfCourseId("sat-reading"), null);
  assert.deepEqual(boardOrder(match()), ["AQA", "IB", "AP", "Edexcel", "OCR"]);
  assert.deepEqual(boardOrder(match({ suggestion: null, boardGuess: { board: "OCR", qualification: "A_LEVEL" } })).slice(0, 2), ["OCR", "IB"]);
  assert.deepEqual(boardOrder(null), ["IB", "AP", "AQA", "Edexcel", "OCR"]);
});

test("a board's courses: GCSE before A-level, then by title", () => {
  const c = (id: string, title: string, board: CourseSummary["board"]) => ({ id, title, board }) as CourseSummary;
  const list = [c("aqa-alevel-biology", "AQA A-level Biology", "A_LEVEL"), c("aqa-gcse-biology", "AQA GCSE Biology", "GCSE"), c("ib-biology", "IB Biology", "IB")];
  assert.deepEqual(coursesForBoard(list, "AQA").map((x) => x.id), ["aqa-gcse-biology", "aqa-alevel-biology"]);
});

test("a board guess without a catalog course is said plainly; an unknown board says nothing", () => {
  assert.equal(boardGuessLine({ board: "Edexcel", qualification: "GCSE" }), "It looks like Edexcel GCSE, which isn't in our courses yet.");
  assert.equal(boardGuessLine({ board: "Cambridge", qualification: "IGCSE" }), "It looks like Cambridge IGCSE, which isn't in our courses yet.");
  assert.equal(boardGuessLine({ board: "unknown", qualification: "unknown" }), null);
  assert.equal(boardGuessLine(null), null);
});
