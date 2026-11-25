import { test } from "node:test";
import assert from "node:assert/strict";
import { groupCourses, masteryPercent, nextTopic, topicTitle, unitProgress, unitTitle, unitsForLevel } from "./courses";
import type { Course, CourseSummary, TopicProgress } from "./api/courses";

const summary = (id: string, board: CourseSummary["board"]): CourseSummary => ({
  id,
  title: id,
  board,
  boardName: board,
  subject: "x",
  qualification: board,
  unitCount: 1,
  topicCount: 1,
});

const course: Course = {
  id: "ib-biology",
  title: "IB Biology",
  board: "IB",
  boardName: "IB Diploma Programme",
  subject: "Biology",
  qualification: "IB Diploma",
  levels: ["SL", "HL"],
  specRef: "",
  unitLabel: "Theme",
  version: 1,
  sourceNote: "",
  units: [
    {
      id: "a",
      code: "A",
      name: "Unity and diversity",
      topics: [
        { id: "a1-1", code: "A1.1", name: "Water", objectives: ["Describe water"] },
        { id: "a2-1", code: "A2.1", name: "Origins of cells", objectives: ["Outline"], hlOnly: true },
      ],
    },
    { id: "x", code: "X", name: "HL only", topics: [{ id: "x1", code: "X1", name: "Only HL", objectives: ["a"], hlOnly: true }] },
  ],
};

test("courses group by board in picker order, empty boards dropped", () => {
  const groups = groupCourses([summary("aqa", "GCSE"), summary("ap", "AP"), summary("ib", "IB")]);
  assert.deepEqual(groups.map((g) => g.board), ["IB", "AP", "GCSE"]);
});

test("SL hides HL-only topics and empty units; HL keeps all", () => {
  const sl = unitsForLevel(course, "SL");
  assert.equal(sl.length, 1);
  assert.deepEqual(sl[0].topics.map((t) => t.id), ["a1-1"]);
  assert.equal(unitsForLevel(course, "HL").length, 2);
  assert.equal(unitsForLevel({ ...course, levels: undefined }, "SL").length, 2);
});

test("progress helpers", () => {
  const byTopic = new Map<string, TopicProgress>([
    ["a1-1", { topicId: "a1-1", done: true, attempts: 3, mastery: 0.8, level: "secure" }],
  ]);
  assert.deepEqual(unitProgress(course.units[0], byTopic), { done: 1, total: 2 });
  assert.equal(nextTopic(course.units, byTopic)?.topic.id, "a2-1");
  assert.equal(nextTopic(unitsForLevel(course, "SL"), byTopic), null);
  assert.equal(masteryPercent(0.814), 81);
  assert.equal(masteryPercent(null), null);
  assert.equal(masteryPercent(1.4), 100);
  assert.equal(topicTitle(course.units[0].topics[0]), "A1.1 Water");
  assert.equal(unitTitle(course, course.units[0]), "Theme A · Unity and diversity");
  assert.equal(unitTitle({ unitLabel: "" }, { code: "S1", name: "Models of the particulate nature of matter" }), "S1 · Models of the particulate nature of matter");
});

test("boards are ordered for where the student sits exams: time zone first, then language", async () => {
  const { boardOrder, examRegion } = await import("./courses");
  assert.deepEqual(boardOrder("en-US", "America/Chicago"), ["AP", "IB", "GCSE", "A_LEVEL"]);
  assert.deepEqual(boardOrder("en-US", "Pacific/Honolulu")[0], "AP");
  assert.deepEqual(boardOrder("en-US", "Europe/London"), ["GCSE", "A_LEVEL", "IB", "AP"]);
  assert.deepEqual(boardOrder("en-GB", undefined), ["GCSE", "A_LEVEL", "IB", "AP"]);
  assert.deepEqual(boardOrder("en-US", "Asia/Singapore"), ["IB", "AP", "GCSE", "A_LEVEL"]);
  assert.deepEqual(boardOrder("de-DE", "Europe/Berlin"), ["IB", "AP", "GCSE", "A_LEVEL"]);
  assert.equal(examRegion("en-US", "UTC"), "US");
  assert.equal(examRegion(undefined, undefined), "other");
  assert.deepEqual(groupCourses([summary("g", "GCSE"), summary("a", "AP"), summary("i", "IB")], boardOrder("en-US", "America/New_York")).map((g) => g.board), ["AP", "IB", "GCSE"]);
});

test("one search finds courses by name and topics by name or objective, falling back to nothing", async () => {
  const { searchCatalog } = await import("./courses");
  const bio = { ...summary("ib-biology", "IB"), title: "IB Biology", subject: "Biology" };
  const apBio = { ...summary("ap-biology", "AP"), title: "AP Biology", subject: "Biology" };
  const chem = { ...summary("ib-chemistry", "IB"), title: "IB Chemistry", subject: "Chemistry" };
  const full = [
    { ...course, id: "ib-biology", units: [{ id: "B", code: "B", name: "Form", topics: [{ id: "b2", code: "B2.1", name: "Membranes and membrane transport", objectives: ["Explain osmosis across membranes"] }, { id: "b3", code: "B2.2", name: "Osmosis in plants", objectives: [] }] }] },
  ] as Course[];
  const r1 = searchCatalog("IB Biology", [bio, apBio, chem], full);
  assert.deepEqual(r1.courses.map((c) => c.id), ["ib-biology"]);
  assert.equal(r1.topics.length, 0, "a course name alone does not list every topic in it");
  const r2 = searchCatalog("osmosis", [bio, apBio, chem], full);
  assert.deepEqual(r2.courses, []);
  assert.deepEqual(r2.topics.map((h) => h.topic.id), ["b3", "b2"], "name matches rank above objective matches");
  assert.deepEqual(searchCatalog("biology", [bio, apBio, chem], full, ["AP", "IB", "GCSE", "A_LEVEL"]).courses.map((c) => c.id), ["ap-biology", "ib-biology"]);
  assert.deepEqual(searchCatalog("a-level psych", [{ ...summary("aqa-psy", "A_LEVEL"), title: "AQA A-level Psychology" }], []).courses.length, 1);
  const none = searchCatalog("medieval falconry", [bio], full);
  assert.equal(none.courses.length + none.topics.length, 0);
  assert.deepEqual(searchCatalog("  ", [bio], full), { courses: [], topics: [] });
});

test("course badge on a subject tile says only what the name doesn't", async () => {
  const { courseBadge } = await import("./courses");
  assert.equal(courseBadge("Biology", "IB Biology", "HL"), "IB Biology · HL");
  assert.equal(courseBadge("IB Biology", "IB Biology", "HL"), "HL course");
  assert.equal(courseBadge("IB Biology HL", "IB Biology", "HL"), "Course");
  assert.equal(courseBadge("My chem", "AP Chemistry", null), "AP Chemistry");
});
