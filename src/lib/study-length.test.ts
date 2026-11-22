import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyStudyLength,
  clampStudyMinutes,
  colorForMinutes,
  depthForMinutes,
  formatStudyLength,
  shouldAskStudyLength,
  stageForMinutes,
} from "./study-length";

describe("study length picker", () => {
  it("asks on the first and second session only, and never when the count is unknown", () => {
    assert.equal(shouldAskStudyLength(0), true);
    assert.equal(shouldAskStudyLength(1), true);
    assert.equal(shouldAskStudyLength(2), false);
    assert.equal(shouldAskStudyLength(null), false);
  });

  it("snaps to 5 minutes between 5 and 120", () => {
    assert.equal(clampStudyMinutes(0), 5);
    assert.equal(clampStudyMinutes(33), 35);
    assert.equal(clampStudyMinutes(500), 120);
    assert.equal(clampStudyMinutes(Number.NaN), 30);
  });

  it("maps minutes to depth and to the cat", () => {
    assert.deepEqual([5, 15, 20, 45, 50, 120].map(depthForMinutes), ["light", "light", "moderate", "moderate", "deep", "deep"]);
    assert.deepEqual([5, 15, 20, 45, 50, 75, 80].map(stageForMinutes), ["chill", "chill", "focus", "focus", "sweat", "sweat", "drenched"]);
    // The cat never says "deep" while the depth is lighter.
    const order = { light: 0, moderate: 1, deep: 2 } as const;
    const stageDepth = { chill: 0, focus: 1, sweat: 2, drenched: 2 } as const;
    for (let m = 5; m <= 120; m += 5) assert.equal(stageDepth[stageForMinutes(m)], order[depthForMinutes(m)], `at ${m} min`);
  });

  it("goes teal, green, amber, red", () => {
    assert.equal(colorForMinutes(5), "hsl(170 78% 44%)");
    assert.equal(colorForMinutes(30), "hsl(130 78% 44%)");
    assert.equal(colorForMinutes(60), "hsl(38 78% 44%)");
    assert.equal(colorForMinutes(120), "hsl(0 78% 44%)");
  });

  it("formats the label", () => {
    const labels = { min: "min", h: "h" };
    assert.equal(formatStudyLength(45, labels), "45 min");
    assert.equal(formatStudyLength(60, labels), "1 h");
    assert.equal(formatStudyLength(90, labels), "1 h 30 min");
  });

  it("applies the answer: a long Quick 5 becomes a full plan, a short one stays quick", () => {
    const quick = { workspaceId: "w", title: "t", depth: "light" as const, durationMinutes: 5, quickStart: true };
    assert.deepEqual(applyStudyLength(quick, 10), { ...quick, durationMinutes: 10, depth: "light", quickStart: true });
    assert.deepEqual(applyStudyLength(quick, 60), { ...quick, durationMinutes: 60, depth: "deep", quickStart: false });
    const full = { workspaceId: "w", title: "t", depth: "moderate" as const, durationMinutes: 25 };
    assert.deepEqual(applyStudyLength(full, 15), { ...full, durationMinutes: 15, depth: "light" });
  });
});
