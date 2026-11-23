import { test } from "node:test";
import assert from "node:assert/strict";
import { LabelPlacer, around, regionBetween, sketchDrawable, sketchSamples, sketchYAt, spread, textWidth } from "./sketch";

test("a sketch curve is sampled as the server samples it", () => {
  // Straight: just its points. Smooth: through every point, flat at a turning point, no overshoot.
  assert.deepEqual(sketchSamples([{ x: 1, y: 2 }, { x: 9, y: 8 }], true), [[1, 2], [9, 8]]);
  const u = sketchSamples([{ x: 1, y: 6 }, { x: 5, y: 2 }, { x: 9, y: 6 }], true);
  assert.equal(u.length, 41);
  assert.equal(sketchYAt(u, 5), 2);
  assert.ok(u.every(([, y]) => y >= 2 - 1e-9 && y <= 6 + 1e-9));
  // A curve that turns back on itself still passes through its points.
  const loop = sketchSamples([{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 2, y: 8 }], true);
  assert.ok(loop.some(([x, y]) => Math.abs(x - 5) < 1e-9 && Math.abs(y - 5) < 1e-9));
});

test("a region between two curves is closed along both", () => {
  const upper = sketchSamples([{ x: 0, y: 0 }, { x: 10, y: 10 }], false);
  const outline = regionBetween(upper, null, 2, 4, 0);
  assert.deepEqual(outline[0], [2, 2]);
  assert.deepEqual(outline.at(-1), [2, 0]);
  assert.equal(outline.length, 82);
});

test("labels go where they cover nothing, in order of preference", () => {
  const placer = new LabelPlacer({ x: 0, y: 0, w: 400, h: 300 }, [[210, 100], [215, 100]]);
  // The first choice crosses a line: the next one is taken.
  const b = placer.place([{ x: 200, y: 90, w: 30, h: 20 }, { x: 200, y: 120, w: 30, h: 20 }]);
  assert.equal(b.y, 120);
  // Out of the frame loses to inside it.
  assert.equal(placer.place([{ x: 390, y: 10, w: 30, h: 20 }, { x: 300, y: 10, w: 30, h: 20 }]).x, 300);
  assert.equal(around(100, 100, 20, 10, 5, 0)[0].x, 105);
  assert.ok(textWidth("SRAS", 14) > textWidth("AD", 14));
});

test("axis marks are spread so none overlaps the next", () => {
  const [a, b] = spread([{ at: 100, size: 20 }, { at: 104, size: 20 }], 0, 400);
  assert.ok(b - a >= 24);
  assert.ok(sketchDrawable({ xLabel: "", yLabel: "", axes: false, bounds: { left: 0, right: 10, bottom: 0, top: 10 }, curves: [], points: [], marks: [], arrows: [{ from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, label: null, double: false }], regions: [], texts: [] }));
});
