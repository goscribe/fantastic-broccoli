import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  catalogTopicForLabel,
  fixMinutes,
  localizePracticeSession,
  masteryRow,
  mistakeSessionHref,
  mistakeTopicHref,
  mixedRoundSubjects,
  practiceHref,
  practiceRoundSubjects,
  sessionMistakesHref,
} from "./mistakes";

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

test("a mistake links its topic: the note when Scribe has one, else the topic in its subject", () => {
  const topic = { courseId: "ib-biology", topicId: "b2", code: "B2.1", title: "Membranes" };
  assert.equal(mistakeTopicHref({ workspaceId: "w1", label: "Osmosis", courseTopic: topic, note: { courseId: "ib-biology", topicId: "b2" }, hasNote: true }), "/library/ib-biology/b2");
  assert.equal(mistakeTopicHref({ workspaceId: "w1", label: "Osmosis", courseTopic: topic, note: null, hasNote: false }), "/workspace/w1?topic=b2");
  // A note practice question's own note (older rows) still links.
  assert.equal(mistakeTopicHref({ workspaceId: "w1", label: "x", detail: { note: { courseId: "c", topicId: "t" } } }), "/library/c/t");
  assert.equal(mistakeTopicHref({ workspaceId: "w1", label: "Osmosis" }), null);
});

test("a mistake links the end screen of the session it came from", () => {
  assert.equal(mistakeSessionHref({ workspaceId: "w1", label: "x", sessionId: "s1", session: { id: "s1", title: "Osmosis", date: "2026-11-20" } }), "/workspace/w1/session/s1?view=summary");
  assert.equal(mistakeSessionHref({ workspaceId: "w1", label: "x", sessionId: null, session: null }), null);
  assert.equal(sessionMistakesHref("w1", "s1"), "/mistakes?workspace=w1&session=s1");
  assert.equal(sessionMistakesHref(undefined, "s1"), "/mistakes?session=s1");
});

test("a mixed round names its subjects, most to fix first", () => {
  assert.equal(mixedRoundSubjects([{ title: "Chemistry", open: 1 }, { title: "Biology", open: 3 }]), "Biology, Chemistry");
  assert.equal(mixedRoundSubjects([{ title: "A", open: 4 }, { title: "B", open: 3 }, { title: "C", open: 2 }, { title: "D", open: 1 }, { title: "E", open: 0 }]), "A, B, C +1");
  assert.equal(practiceRoundSubjects("Practice my mistakes · Biology, Chemistry"), "Biology, Chemistry");
  assert.equal(practiceRoundSubjects("Practice my mistakes"), null);
  const t = (k: string) => `T(${k})`;
  const out = localizePracticeSession({ id: "s", title: "Practice my mistakes · Biology, Chemistry", mistakesPractice: true, activities: [] } as never, t) as unknown as { title: string };
  assert.equal(out.title, "T(mistakes.sessionTitle) · Biology, Chemistry");
});

test("end-screen mastery labels find their catalog topic like the server does", () => {
  const units = [{ topics: [{ id: "a1", code: "A1.1", name: "Water" }, { id: "b2", code: "B2.1", name: "Membranes and membrane transport" }] }];
  assert.equal(catalogTopicForLabel(units, "water")?.id, "a1");
  assert.equal(catalogTopicForLabel(units, "B2.1 Membranes and membrane transport")?.id, "b2");
  assert.equal(catalogTopicForLabel(units, "Membranes and membrane transport")?.id, "b2");
  assert.equal(catalogTopicForLabel(units, "Water potential"), null);
});

test("every purpose-audit string is translated in all 7 locales", () => {
  const src = readFileSync(new URL("./i18n/purpose.ts", import.meta.url), "utf8");
  const blocks = src.split(/\n  (?=(?:es|fr|de|zh|hi|tl): \{)/);
  const keysOf = (block: string) => new Set([...block.matchAll(/^\s+"([a-z]+\.[A-Za-z]+)":/gm)].map((m) => m[1]));
  const english = keysOf(blocks[0].slice(0, blocks[0].indexOf("registerTranslations(")));
  assert.ok(english.size > 25);
  assert.equal(blocks.length, 7);
  for (const b of blocks.slice(1)) assert.deepEqual([...english].filter((k) => !keysOf(b).has(k)), [], `${b.slice(0, 2)} is missing keys`);
});
