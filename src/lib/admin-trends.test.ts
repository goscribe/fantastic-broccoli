import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketAt,
  bucketLabel,
  chartGeometry,
  formatTrendChange,
  formatTrendValue,
  trendTone,
} from "./admin-trends";

test("values: counts, percentages and money in cents", () => {
  assert.equal(formatTrendValue(12345, "count"), "12,345");
  assert.equal(formatTrendValue(26.9, "percent"), "26.9%");
  assert.equal(formatTrendValue(1900, "money"), "$19");
  assert.equal(formatTrendValue(1950, "money"), "$19.50");
  assert.equal(formatTrendValue(null, "count"), "–");
});

test("change: percent for counts, points for percentages, signed", () => {
  assert.equal(formatTrendChange({ value: 12.5, kind: "percent" }), "+12.5%");
  assert.equal(formatTrendChange({ value: -3.1, kind: "points" }), "−3.1 pts");
  assert.equal(formatTrendChange({ value: 0, kind: "percent" }), "0%");
});

test("tone: a rise is good unless lower is better", () => {
  assert.equal(trendTone({ value: 5, kind: "percent" }, "up"), "good");
  assert.equal(trendTone({ value: -5, kind: "percent" }, "up"), "bad");
  assert.equal(trendTone({ value: 1.2, kind: "points" }, "down"), "bad");
  assert.equal(trendTone({ value: -1.2, kind: "points" }, "down"), "good");
  assert.equal(trendTone({ value: 0, kind: "percent" }, "up"), "flat");
  assert.equal(trendTone(null, "up"), null);
});

test("bucket labels name the end of the bucket", () => {
  const start = new Date("2026-11-18T21:00:00Z");
  assert.equal(bucketLabel(start, 6, "UTC"), "6 h to Nov 19, 03:00");
  assert.equal(bucketLabel(start, 24, "UTC"), "Day to Nov 19, 21:00");
  assert.equal(bucketLabel(start, 168, "UTC"), "Week to Nov 25");
});

test("chart: both series share one scale from zero; higher values sit higher", () => {
  const g = chartGeometry([0, 5, 10], [20, 20, 20], 100, 50);
  assert.deepEqual(g.points, [
    { x: 0, y: 46 },
    { x: 50, y: 35.5 },
    { x: 100, y: 25 },
  ]);
  assert.equal(g.current.length, 1);
  assert.equal(g.previous[0], "M0,4 L50,4 L100,4");
  assert.ok(g.area[0].endsWith("L100,50 L0,50 Z"));
});

test("chart: gaps split the line, an all-zero series is flat, no previous period draws nothing", () => {
  const gaps = chartGeometry([1, null, 2, 3], null, 90, 40);
  assert.equal(gaps.current.length, 2);
  assert.equal(gaps.points[1], null);
  assert.deepEqual(gaps.previous, []);
  // A lone point is drawn as a short dash and has no area.
  assert.equal(gaps.area.length, 1);
  const flat = chartGeometry([0, 0], null, 100, 40);
  assert.deepEqual(flat.points, [
    { x: 0, y: 36 },
    { x: 100, y: 36 },
  ]);
  assert.deepEqual(chartGeometry([], null, 100, 40).current, []);
});

test("pointer position maps to the nearest bucket and stays in range", () => {
  assert.equal(bucketAt(0, 300, 7), 0);
  assert.equal(bucketAt(149, 300, 7), 3);
  assert.equal(bucketAt(300, 300, 7), 6);
  assert.equal(bucketAt(999, 300, 7), 6);
  assert.equal(bucketAt(-5, 300, 7), 0);
  assert.equal(bucketAt(10, 300, 1), 0);
});
