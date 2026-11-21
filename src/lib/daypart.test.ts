import { test } from "node:test";
import assert from "node:assert/strict";
import { daypartForHour, daypartInitScript } from "./daypart";

test("every hour falls in one bucket, on the documented boundaries", () => {
  assert.deepEqual([0, 4].map(daypartForHour), ["late", "late"]);
  assert.deepEqual([5, 11].map(daypartForHour), ["morning", "morning"]);
  assert.deepEqual([12, 16].map(daypartForHour), ["afternoon", "afternoon"]);
  assert.deepEqual([17, 20].map(daypartForHour), ["evening", "evening"]);
  assert.deepEqual([21, 23].map(daypartForHour), ["night", "night"]);
});

test("the head script agrees with daypartForHour for all 24 hours", () => {
  const g = globalThis as { Date: unknown; document?: unknown };
  const RealDate = g.Date;
  try {
    for (let h = 0; h < 24; h++) {
      let written = "";
      g.Date = class {
        getHours() {
          return h;
        }
      };
      g.document = { documentElement: { setAttribute: (_: string, v: string) => (written = v) } };
      new Function(daypartInitScript)();
      assert.equal(written, daypartForHour(h));
    }
  } finally {
    g.Date = RealDate;
    delete g.document;
  }
});
