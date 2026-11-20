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
