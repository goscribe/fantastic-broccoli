import { test } from "node:test";
import assert from "node:assert/strict";
import { barWidths, changeTone, formatChange, formatMetric, levelSplit, quartileNote, rateCell, scoreBucketLabel, trackingNote } from "./admin-metrics";

test("values are formatted by unit, unknown as a dash", () => {
  assert.equal(formatMetric(1234, "count"), "1,234");
  assert.equal(formatMetric(12.34, "percent"), "12.3%");
  assert.equal(formatMetric(2.5, "minutes"), "2.5 min");
  assert.equal(formatMetric(0.68, "usd"), "$0.68");
  assert.equal(formatMetric(125000, "cents"), "$1,250");
  assert.equal(formatMetric(2862.8, "usd"), "$2,863");
  assert.equal(formatMetric(16.894, "usd"), "$16.89");
  assert.equal(formatMetric(null, "count"), "—");
});

test("changes read as percent or points, and say whether they are better", () => {
  assert.equal(formatChange({ value: 12.5, kind: "percent" }), "+12.5%");
  assert.equal(formatChange({ value: -3, kind: "points" }), "−3 pts");
  assert.equal(formatChange(null), "");
  assert.equal(changeTone({ value: 5, kind: "percent" }), "good");
  assert.equal(changeTone({ value: 5, kind: "percent" }, "down"), "bad");
  assert.equal(changeTone(null), null);
});

test("rate cells show the counts behind a share", () => {
  assert.equal(rateCell(12, 30, 40), "40% (12/30)");
  assert.equal(rateCell(0, 0, null), "—");
});

test("tracking note only when the data starts inside the window", () => {
  const prevFrom = "2026-10-25T00:00:00Z";
  assert.equal(trackingNote("2026-10-01T00:00:00Z", prevFrom), null);
  assert.equal(trackingNote("2026-11-24T09:00:00Z", prevFrom), "Tracking since Nov 24");
  assert.equal(trackingNote(null, prevFrom, "2026-11-24"), "Tracking since Nov 24: no data yet");
});

test("bar widths are relative to the largest value", () => {
  assert.deepEqual(barWidths([5, 10, 0]), [50, 100, 0]);
  assert.deepEqual(barWidths([0, 0]), [0, 0]);
});

test("score buckets, quartiles and level splits read plainly", () => {
  assert.equal(scoreBucketLabel(0), "0–9%");
  assert.equal(scoreBucketLabel(4), "40–49%");
  assert.equal(scoreBucketLabel(9), "90–100%");
  assert.equal(quartileNote(40, 66.7), "middle half 40–66.7%");
  assert.equal(quartileNote(null, 80), "");
  assert.equal(levelSplit([{ level: "HL", students: 5 }, { level: "SL", students: 3 }]), "HL 5 · SL 3");
});
