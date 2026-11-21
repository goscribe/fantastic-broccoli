import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionCopy,
  funnelKind,
  homeSubjects,
  isMissingProcedure,
  pickHomeAction,
  tileSummary,
  toSessionInput,
  type HomeAction,
  type HomeActionInputs,
  type HomeSessionInput,
  type HomeWorkspaceInput,
} from "./home-action";

const EN: Record<string, string> = {
  "home.fixMany": "Fix {n} {subject} mistakes",
  "home.fixOne": "Fix 1 {subject} mistake",
  "home.fixCta": "Fix them",
  "home.fixAny": "Fix {n} mistakes",
  "home.fixAnyOne": "Fix 1 mistake",
  "home.fixCtaOne": "Fix it",
  "home.planTitle": "Today's plan in {subject}: {task}",
  "home.nextIn": "Next in {subject}: {title}",
  "home.finishQuick5": "Finish your 5 questions in {subject}",
  "home.firstFive": "Start your first 5 questions in {subject}",
  "home.quick5": "5 quick questions in {subject}",
  "home.min": "{m} min",
  "home.start": "Start",
  "home.continue": "Continue",
  "ep.task.mock": "Mock: {exam}",
  "ep.task.recap": "Last look: {exam}",
};
const t = (k: string) => EN[k] ?? k;

const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 10));
const ws = (id: string, title: string, o: Partial<HomeWorkspaceInput> = {}): HomeWorkspaceInput => ({
  id, title, folderId: null, subjectFamily: null, createdAt: day(0), updatedAt: day(0), materialCount: 1, ...o,
});
const act = (status: string, title = "Quiz", estimatedMinutes = 3) => ({ status, title, estimatedMinutes });
const sess = (id: string, workspaceId: string, o: Partial<HomeSessionInput> = {}): HomeSessionInput => ({
  id, workspaceId, title: id, status: "ACTIVE", generating: false, quickStart: false, createdAt: day(1), updatedAt: day(1),
  activities: [act("PENDING", "Reading", 4), act("PENDING", "Quiz", 4)], ...o,
});
const inputs = (o: Partial<HomeActionInputs>): HomeActionInputs => ({ workspaces: [], sessions: [], mistakes: { count: 0, workspaceId: null }, planTasks: [], ...o });

test("ranking matches the server: upload → mistakes → plan → Quick 5 → new subject → half-done → next → Quick 5", () => {
  assert.deepEqual(pickHomeAction(inputs({ workspaces: [ws("w1", "Bio", { materialCount: 0 })] })), { kind: "upload" });
  const w = [ws("w1", "Biology"), ws("w2", "Chemistry")];
  const task = { id: "t1", workspaceId: "w1", subject: "Biology", kind: "practice", label: "Osmosis", topic: "osmosis", examTitle: null, minutes: 8, sessionId: null };
  const half = sess("half", "w1", { title: "Cells", activities: [act("COMPLETED"), act("PENDING", "A2.1 Origins of cells", 8)] });
  const q5 = sess("q5", "w2", { quickStart: true, activities: [act("IN_PROGRESS", "Quick 5", 5)], updatedAt: day(3) });
  const all = inputs({ workspaces: w, sessions: [half, q5], mistakes: { count: 4, workspaceId: "w1" }, planTasks: [task] });
  assert.equal(pickHomeAction(all).kind, "mistakes");
  assert.equal(pickHomeAction({ ...all, mistakes: { count: 0, workspaceId: null } }).kind, "plan");
  assert.deepEqual(pickHomeAction({ ...all, mistakes: { count: 9, workspaceId: null } }), { kind: "mistakes", workspaceId: null, subject: null, count: 9, minutes: 4, href: "/mistakes/practice" });
  const noPlan = { ...all, mistakes: { count: 0, workspaceId: null }, planTasks: [] };
  assert.deepEqual(pickHomeAction(noPlan), { kind: "continue", workspaceId: "w2", subject: "Chemistry", sessionId: "q5", title: "q5", activityTitle: "Quick 5", quick: true, minutes: 5, href: "/workspace/w2/session/q5" });
  const newer = { ...noPlan, sessions: [half], workspaces: [...w, ws("w3", "Physics", { createdAt: day(4), materialCount: 0 })] };
  assert.deepEqual(pickHomeAction(newer), { kind: "quick5", workspaceId: "w3", subject: "Physics", first: true, minutes: 5, topics: "Physics" });
  assert.deepEqual(pickHomeAction({ ...noPlan, sessions: [half] }), { kind: "continue", workspaceId: "w1", subject: "Biology", sessionId: "half", title: "Cells", activityTitle: "A2.1 Origins of cells", quick: false, minutes: 8, href: "/workspace/w1/session/half" });
  const fresh = sess("fresh", "w2", { title: "Bonding", createdAt: day(2) });
  assert.equal(pickHomeAction({ ...noPlan, sessions: [fresh] }).kind, "next");
  const done = sess("done", "w2", { status: "COMPLETED", activities: [act("COMPLETED")] });
  assert.deepEqual(pickHomeAction({ ...noPlan, sessions: [done] }), { kind: "quick5", workspaceId: "w2", subject: "Chemistry", first: false, minutes: 5, topics: null });
});

test("the banner says what, where and how long, in one sentence", () => {
  const cases: [HomeAction, string, string, string][] = [
    [{ kind: "mistakes", workspaceId: "w1", subject: "Biology", count: 4, minutes: 2, href: "/x" }, "Fix 4 Biology mistakes", "2 min", "Fix them"],
    [{ kind: "mistakes", workspaceId: "w1", subject: "Biology", count: 1, minutes: 1, href: "/x" }, "Fix 1 Biology mistake", "1 min", "Fix it"],
    [{ kind: "mistakes", workspaceId: null, subject: null, count: 6, minutes: 3, href: "/x" }, "Fix 6 mistakes", "3 min", "Fix them"],
    [{ kind: "plan", workspaceId: "w1", subject: "Biology", taskId: "t", taskKind: "practice", label: "Osmosis", topic: "osmosis", examTitle: "Paper 1", minutes: 8, sessionId: null }, "Today's plan in Biology: Osmosis", "8 min", "Start"],
    [{ kind: "plan", workspaceId: "w1", subject: "Biology", taskId: "t", taskKind: "mock", label: "x", topic: null, examTitle: "Paper 1", minutes: 45, sessionId: null }, "Today's plan in Biology: Mock: Paper 1", "45 min", "Start"],
    [{ kind: "continue", workspaceId: "w1", subject: "IB Biology", sessionId: "s", title: "Cells", activityTitle: "A2.1 Origins of cells", quick: false, minutes: 8, href: "/x" }, "Next in IB Biology: A2.1 Origins of cells", "8 min", "Continue"],
    [{ kind: "continue", workspaceId: "w1", subject: "Biology", sessionId: "s", title: "Q", activityTitle: "Q", quick: true, minutes: 3, href: "/x" }, "Finish your 5 questions in Biology", "3 min", "Continue"],
    [{ kind: "next", workspaceId: "w1", subject: "Chemistry", sessionId: "s", title: "Bonding", activityTitle: null, minutes: 12, href: "/x" }, "Next in Chemistry: Bonding", "12 min", "Start"],
    [{ kind: "quick5", workspaceId: "w1", subject: "Physics", first: true, minutes: 5, topics: null }, "Start your first 5 questions in Physics", "5 min", "Start"],
    [{ kind: "quick5", workspaceId: "w1", subject: "Physics", first: false, minutes: 5, topics: null }, "5 quick questions in Physics", "5 min", "Start"],
  ];
  for (const [a, title, meta, cta] of cases) {
    assert.deepEqual(actionCopy(a as Exclude<HomeAction, { kind: "upload" }>, t), { title, meta, cta });
  }
});

test("funnel kinds stay within the server's accepted list", () => {
  assert.equal(funnelKind({ kind: "next", workspaceId: "w", subject: "", sessionId: "s", title: "", activityTitle: null, minutes: 1, href: "" }), "continue");
  assert.equal(funnelKind({ kind: "continue", workspaceId: "w", subject: "", sessionId: "s", title: "", activityTitle: null, quick: true, minutes: 1, href: "" }), "quick5");
  assert.equal(funnelKind({ kind: "upload" }), "upload");
});

test("tile lines: next session, building, or counts when the next title only repeats the subject", () => {
  const repeats = (a: string, b: string) => b.toLowerCase().startsWith(a.toLowerCase());
  const base = { title: "Biology", materialCount: 2, sessionsTotal: 4, sessionsDone: 1 };
  assert.deepEqual(tileSummary({ ...base, next: { sessionId: "s", title: "Osmosis", generating: false } }, undefined, repeats), { sub: "Next: Osmosis", progress: 0.25, action: "Continue" });
  assert.equal(tileSummary({ ...base, next: { sessionId: "s", title: "Osmosis", generating: true } }, undefined, repeats).sub, "Building the next session…");
  assert.equal(tileSummary({ ...base, next: { sessionId: "s", title: "Biology notes", generating: false } }, undefined, repeats).sub, "2 materials · 1/4 sessions");
  assert.deepEqual(tileSummary({ ...base, sessionsTotal: 0, sessionsDone: 0, materialCount: 1, next: null }, undefined, repeats), { sub: "1 material", progress: null, action: "Open" });
  assert.equal(tileSummary({ ...base, next: null }, "Guide +3", repeats).sub, "Guide +3");
});

test("subjects come most recently active first; app sessions are normalised", () => {
  const s = toSessionInput({ id: "a", workspaceId: "w2", title: "x", status: "completed", generating: false, quickStart: false, createdAt: day(1).toISOString(), updatedAt: day(9).toISOString(), activities: [{ status: "completed", title: "q", estimatedMinutes: 3 }] });
  assert.equal(s.status, "COMPLETED");
  const out = homeSubjects({ workspaces: [ws("w1", "A", { updatedAt: day(5) }), ws("w2", "B")], sessions: [s] });
  assert.deepEqual(out.map((x) => [x.id, x.sessionsDone, x.sessionsTotal]), [["w2", 1, 1], ["w1", 0, 0]]);
});

test("only a missing procedure falls back to the old calls; other failures are errors", () => {
  assert.equal(isMissingProcedure(404, { error: { json: { data: { code: "NOT_FOUND" } } } }), true);
  assert.equal(isMissingProcedure(404, { error: { data: { code: "NOT_FOUND" } } }), true);
  assert.equal(isMissingProcedure(401, { error: { json: { data: { code: "UNAUTHORIZED" } } } }), false);
  assert.equal(isMissingProcedure(500, null), false);
  assert.equal(isMissingProcedure(404, null), false);
});
