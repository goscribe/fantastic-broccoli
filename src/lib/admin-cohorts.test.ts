import { test } from "node:test";
import assert from "node:assert/strict";
import { cellTint, columnMaxima, groupSpans, weekLabel } from "./admin-cohorts";

test("week label: Monday to Sunday, month repeated only when it changes", () => {
  assert.equal(weekLabel(new Date("2026-11-16T00:00:00Z")), "Nov 16 – 22");
  assert.equal(weekLabel(new Date("2026-10-26T00:00:00Z")), "Oct 26 – Nov 1");
});

test("tint is the share of the column's highest value", () => {
  assert.equal(cellTint(20, 40), 0.5);
  assert.equal(cellTint(40, 40), 1);
  assert.equal(cellTint(0, 40), 0);
  assert.equal(cellTint(5, 0), 0);
});

test("column maxima ignore empty cells", () => {
  const cohorts = [
    { cells: { a: { pct: 10 }, b: null } },
    { cells: { a: { pct: 30 }, b: { pct: 4 } } },
  ];
  assert.deepEqual(columnMaxima(cohorts, ["a", "b", "c"]), { a: 30, b: 4, c: 0 });
});

test("group spans follow column order", () => {
  const cols = [{ group: "x" }, { group: "x" }, { group: "y" }, { group: "x" }];
  assert.deepEqual(groupSpans(cols), [
    { group: "x", span: 2 },
    { group: "y", span: 1 },
    { group: "x", span: 1 },
  ]);
});
