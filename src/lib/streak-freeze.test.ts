import { test } from "node:test";
import assert from "node:assert/strict";
import { freezeSaveLine } from "./streak-freeze";

const t = (k: string) => (k === "purpose.freezeSavedBought" ? "saved {n} · {p} points" : "saved {n}");

test("a freeze save is one line, naming the points only when a freeze was bought", () => {
  assert.equal(freezeSaveLine({ at: "x", days: ["2026-11-19"], streak: 5, bought: 0, pointsSpent: 0 }, t), "saved 5");
  assert.equal(freezeSaveLine({ at: "x", days: ["2026-11-19"], streak: 5, bought: 1, pointsSpent: 50 }, t), "saved 5 · 50 points");
  assert.equal(freezeSaveLine(null, t), null);
  assert.equal(freezeSaveLine({ at: "x", days: [], streak: 5, bought: 0, pointsSpent: 0 }, t), null);
});
