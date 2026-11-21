import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixMinutes, localizePracticeSession, masteryRow, practiceHref } from "./mistakes";

test("practice links name the subject or the finished session", () => {
  assert.equal(practiceHref(), "/mistakes/practice");
  assert.equal(practiceHref({ workspaceId: "w 1" }), "/mistakes/practice?workspace=w+1");
  assert.equal(practiceHref({ sessionId: "s1" }), "/mistakes/practice?session=s1");
  assert.equal(fixMinutes(3), 2);
  assert.equal(fixMinutes(1), 1);
  assert.equal(fixMinutes(30), 4);
});

test("mastery rows: before → after with the gain, new topics without a before", () => {
  assert.deepEqual(masteryRow({ before: 0.48, after: 0.61, delta: 0.13 }), { before: 48, after: 61, delta: 13, base: 48, gain: 13 });
  assert.deepEqual(masteryRow({ before: null, after: 0.57, delta: null }), { before: null, after: 57, delta: null, base: 0, gain: 57 });
  const drop = masteryRow({ before: 0.73, after: 0.69, delta: -0.04 });
  assert.equal(drop.delta, -4);
  assert.equal(drop.base, 69);
});

test("practice sessions get localized titles; others are untouched", () => {
  const t = (k: string) => `T(${k})`;
  const base = { id: "s", title: "Practice my mistakes", activities: [{ id: "a", type: "mcq", title: "Questions you got wrong" }, { id: "b", type: "reading", title: "R" }] };
  const plain = { ...base, mistakesPractice: false } as never;
  assert.equal(localizePracticeSession(plain, t), plain);
  const out = localizePracticeSession({ ...base, mistakesPractice: true } as never, t) as unknown as typeof base;
  assert.equal(out.title, "T(mistakes.sessionTitle)");
  assert.deepEqual(out.activities.map((a) => a.title), ["T(mistakes.actMcq)", "R"]);
  assert.equal(localizePracticeSession(undefined, t), undefined);
});

test("every mistakes string is translated in all 7 locales", () => {
  const src = readFileSync(new URL("./i18n/mistakes.ts", import.meta.url), "utf8");
  const blocks = src.split(/\n  (?=(?:es|fr|de|zh|hi|tl): \{)/);
  const keysOf = (block: string) => new Set([...block.matchAll(/^\s+"([a-z]+\.[A-Za-z]+)":/gm)].map((m) => m[1]));
  const english = keysOf(blocks[0].slice(0, blocks[0].indexOf("registerTranslations(")));
  assert.ok(english.size > 40);
  assert.equal(blocks.length, 7);
  for (const b of blocks.slice(1)) {
    const code = b.slice(0, 2);
    assert.deepEqual([...english].filter((k) => !keysOf(b).has(k)), [], `${code} is missing keys`);
  }
});
