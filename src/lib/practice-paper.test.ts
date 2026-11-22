import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boardLabel, formatClock, formatPaperMinutes, paperTimeLeft } from "./practice-paper";

describe("practice paper helpers", () => {
  it("counts down and past zero", () => {
    assert.equal(paperTimeLeft(0, 90, 0), 5400);
    assert.equal(paperTimeLeft(0, 1, 90_000), -30);
  });

  it("formats the clock", () => {
    assert.equal(formatClock(3909), "1:05:09");
    assert.equal(formatClock(2700), "45:00");
    assert.equal(formatClock(59), "0:59");
    assert.equal(formatClock(-5), "0:00");
  });

  it("formats durations and boards", () => {
    assert.equal(formatPaperMinutes(135, { min: "min", h: "h" }), "2 h 15 min");
    assert.equal(formatPaperMinutes(45, { min: "min", h: "h" }), "45 min");
    assert.equal(boardLabel("A_LEVEL"), "A-Level");
  });
});
