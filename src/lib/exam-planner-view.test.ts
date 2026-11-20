import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageBar, fill, fmtDuration, monthGrid, taskTitle, weekdayNames } from "./exam-planner-view";

const en: Record<string, string> = {
  "ep.dur.m": "{m} min",
  "ep.dur.h": "{h} h",
  "ep.dur.hm": "{h} h {m} min",
  "ep.task.mock": "Mock: {exam}",
  "ep.task.recap": "Last look: {exam}",
};
const t = (k: string) => en[k] ?? k;

test("fills placeholders and leaves unknown ones", () => {
  assert.equal(fill("{n} of {t}", { n: 2, t: 5 }), "2 of 5");
  assert.equal(fill("{x}", {}), "{x}");
});

test("formats durations", () => {
  assert.equal(fmtDuration(45, t), "45 min");
  assert.equal(fmtDuration(60, t), "1 h");
  assert.equal(fmtDuration(95, t), "1 h 35 min");
});

test("names whole-paper tasks after the exam", () => {
  assert.equal(taskTitle({ kind: "mock", label: "Biology Paper 1", topic: null }, t), "Mock: Biology Paper 1");
  assert.equal(taskTitle({ kind: "quick5", label: "Biology Paper 1", topic: null }, t), "Last look: Biology Paper 1");
  assert.equal(taskTitle({ kind: "learn", label: "Cells", topic: "cells" }, t), "Cells");
});

test("coverage bar keeps secure inside covered", () => {
  assert.deepEqual(coverageBar({ topics: 20, covered: 10, secure: 4 }), { covered: 50, secure: 20 });
  assert.deepEqual(coverageBar({ topics: 0, covered: 0, secure: 0 }), { covered: 0, secure: 0 });
});

test("month grid starts on the Monday on or before the 1st", () => {
  const g = monthGrid("2026-11-20");
  assert.equal(g.length, 42);
  assert.equal(g[0], "2026-10-26");
  assert.ok(g.includes("2026-11-30"));
});

test("weekday names are Monday first", () => {
  assert.equal(weekdayNames("en")[0], "Mon");
  assert.equal(weekdayNames("en")[6], "Sun");
});
