import { test } from "node:test";
import assert from "node:assert/strict";
import { COPILOT_OPEN_KEY, initialCopilotOpen, rememberCopilotOpen } from "./copilot-pref";

const store = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

test("copilot starts closed with no stored choice, on any screen", () => {
  assert.equal(initialCopilotOpen(store(), true), false);
  assert.equal(initialCopilotOpen(store(), false), false);
  assert.equal(initialCopilotOpen(null, true), false);
});

test("an explicit open is remembered on a wide screen only", () => {
  const s = store();
  rememberCopilotOpen(s, true);
  assert.equal(s.m.get(COPILOT_OPEN_KEY), "1");
  assert.equal(initialCopilotOpen(s, true), true);
  assert.equal(initialCopilotOpen(s, false), false, "a phone never starts with the panel over the question");
});

test("closing it is remembered too", () => {
  const s = store({ [COPILOT_OPEN_KEY]: "1" });
  rememberCopilotOpen(s, false);
  assert.equal(initialCopilotOpen(s, true), false);
});

test("a throwing store falls back to closed and does not throw", () => {
  const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.equal(initialCopilotOpen(bad, true), false);
  assert.doesNotThrow(() => rememberCopilotOpen(bad, true));
});
