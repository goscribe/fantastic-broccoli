import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUBBLE_GAP,
  BUBBLE_MAX_OPENS,
  COPILOT_BUBBLE_DISMISSED_KEY,
  COPILOT_OPENS_KEY,
  bubbleAllowed,
  BUBBLE_MIN_WIDTH,
  bubbleRoom,
  countCopilotOpen,
  dismissBubble,
} from "./copilot-bubble";

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test("a new device may see the bubble", () => {
  assert.equal(bubbleAllowed(store()), true);
});

test("no storage means no bubble (it could not be dismissed for good)", () => {
  assert.equal(bubbleAllowed(null), false);
  assert.equal(bubbleAllowed(undefined), false);
});

test("the × dismisses it for good", () => {
  const s = store();
  dismissBubble(s);
  assert.equal(s.m.get(COPILOT_BUBBLE_DISMISSED_KEY), "1");
  assert.equal(bubbleAllowed(s), false);
});

test("opening Copilot yourself twice retires it", () => {
  const s = store();
  countCopilotOpen(s);
  assert.equal(bubbleAllowed(s), true, "one open is not enough");
  countCopilotOpen(s);
  assert.equal(s.m.get(COPILOT_OPENS_KEY), String(BUBBLE_MAX_OPENS));
  assert.equal(bubbleAllowed(s), false);
});

test("a garbled count is treated as zero", () => {
  assert.equal(bubbleAllowed(store({ [COPILOT_OPENS_KEY]: "abc" })), true);
  const s = store({ [COPILOT_OPENS_KEY]: "-4" });
  countCopilotOpen(s);
  assert.equal(s.m.get(COPILOT_OPENS_KEY), "1");
});

test("a throwing store hides the bubble and never throws", () => {
  const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.equal(bubbleAllowed(bad), false);
  assert.doesNotThrow(() => dismissBubble(bad));
  assert.doesNotThrow(() => countCopilotOpen(bad));
});

test("it only shows when it fits in the gutter beside the content column", () => {
  // 1512 wide: the 768 column ends at 1140, the tab starts at 1463.
  assert.equal(bubbleRoom(1140, 1463), 1463 - 1140 - BUBBLE_GAP * 2);
  // 1280 wide: a narrower gutter, still room for two lines.
  assert.ok((bubbleRoom(1024, 1231) ?? 0) >= BUBBLE_MIN_WIDTH);
  // 1024 and 768 wide: the gutter is too small, or the column runs under the tab.
  assert.equal(bubbleRoom(896, 975), null);
  assert.equal(bubbleRoom(728, 719), null);
  // Exactly the minimum plus a gap on both sides.
  assert.equal(bubbleRoom(0, BUBBLE_MIN_WIDTH + BUBBLE_GAP * 2), BUBBLE_MIN_WIDTH);
  assert.equal(bubbleRoom(0, BUBBLE_MIN_WIDTH + BUBBLE_GAP * 2 - 1), null);
});
