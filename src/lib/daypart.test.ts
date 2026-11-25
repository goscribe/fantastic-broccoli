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

test("the head script preloads the scene file tokens.css will pick for that hour and width", () => {
  const g = globalThis as { Date: unknown; document?: unknown; window?: unknown; matchMedia?: unknown };
  const RealDate = g.Date;
  try {
    for (const [hour, wide, href] of [
      [9, false, "/design/hero/morning-800.webp"],
      [14, true, "/design/hero/afternoon-1600.webp"],
      [22, true, "/design/hero/night-1600.webp"],
      [3, false, "/design/hero/late-800.webp"],
    ] as const) {
      const added: Record<string, string>[] = [];
      g.Date = class {
        getHours() {
          return hour;
        }
      };
      g.matchMedia = () => ({ matches: wide });
      g.window = { matchMedia: g.matchMedia };
      g.document = { documentElement: { setAttribute: () => {} }, createElement: () => ({}), head: { appendChild: (l: Record<string, string>) => added.push(l) } };
      new Function(daypartInitScript)();
      assert.deepEqual(added, [{ rel: "preload", as: "image", href }]);
    }
  } finally {
    g.Date = RealDate;
    delete g.document;
    delete g.window;
    delete g.matchMedia;
  }
});
