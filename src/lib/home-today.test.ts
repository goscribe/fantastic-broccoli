import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isBrandNew, pickResumable, pickTodayAction, type TodayInputs } from "./home-today";

const s = (o: Partial<TodayInputs["sessions"][number]> = {}): TodayInputs["sessions"][number] => ({
  id: "s1",
  workspaceId: "w1",
  quickStart: false,
  status: "active",
  generating: false,
  createdAt: "2026-11-10T09:00:00Z",
  activities: [{ status: "completed" }, { status: "pending" }],
  ...o,
});
const base = (o: Partial<TodayInputs> = {}): TodayInputs => ({
  loading: false,
  openMistakes: 0,
  practiceMinutes: 0,
  planTasks: [],
  workspaces: [{ id: "w1", materialCount: 2 }],
  sessions: [s()],
  ...o,
});

test("waits for everything the choice depends on", () => {
  assert.deepEqual(pickTodayAction(base({ loading: true, openMistakes: 3 })), { kind: "loading" });
});

test("a learner with no notes and no sessions gets the single upload action", () => {
  const input = base({ workspaces: [{ id: "w1", materialCount: 0 }], sessions: [], openMistakes: 0 });
  assert.equal(isBrandNew(input), true);
  assert.deepEqual(pickTodayAction(input), { kind: "upload" });
  assert.deepEqual(pickTodayAction(base({ workspaces: [], sessions: [] })), { kind: "upload" });
});

test("priority: mistakes → plan task → Quick 5", () => {
  const plan = [{ id: "t0", status: "done" }, { id: "t1", status: "planned" }];
  assert.deepEqual(pickTodayAction(base({ openMistakes: 4, practiceMinutes: 2, planTasks: plan })), { kind: "mistakes", count: 4, minutes: 2 });
  assert.deepEqual(pickTodayAction(base({ planTasks: plan })), { kind: "plan", taskId: "t1" });
  assert.deepEqual(pickTodayAction(base({ planTasks: [{ id: "t0", status: "done" }] })), { kind: "quick5", workspaceId: "w1", resumeSessionId: null });
});

test("an unfinished Quick 5 is resumed rather than rebuilt", () => {
  const sessions = [s(), s({ id: "q1", workspaceId: "w2", quickStart: true, activities: [{ status: "in_progress" }] })];
  assert.deepEqual(pickTodayAction(base({ sessions })), { kind: "quick5", workspaceId: "w2", resumeSessionId: "q1" });
  const finished = [s({ id: "q1", quickStart: true, status: "completed", activities: [{ status: "completed" }] })];
  assert.equal(pickTodayAction(base({ sessions: finished })).kind, "quick5");
  assert.equal((pickTodayAction(base({ sessions: finished })) as { resumeSessionId: string | null }).resumeSessionId, null);
});

test("the 'or continue' line is a started, unfinished full session", () => {
  const fresh = s({ id: "fresh", activities: [{ status: "pending" }] });
  const half = s({ id: "half", createdAt: "2026-11-12T09:00:00Z" });
  const quick = s({ id: "q", quickStart: true });
  assert.equal(pickResumable([fresh, quick, half])?.id, "half");
  assert.equal(pickResumable([half], "half"), undefined);
});

test("every Today string is translated in all 7 locales", () => {
  const src = readFileSync(new URL("./i18n/today.ts", import.meta.url), "utf8");
  const blocks = src.split(/\n  (?=(?:es|fr|de|zh|hi|tl): \{)/);
  const keysOf = (block: string) => new Set([...block.matchAll(/^\s+"([a-z]+\.[A-Za-z0-9]+)":/gm)].map((m) => m[1]));
  const english = keysOf(blocks[0].slice(0, blocks[0].indexOf("registerTranslations(")));
  assert.ok(english.size > 20);
  assert.equal(blocks.length, 7);
  for (const b of blocks.slice(1)) {
    assert.deepEqual([...english].filter((k) => !keysOf(b).has(k)), [], `${b.slice(0, 2)} is missing keys`);
  }
});
