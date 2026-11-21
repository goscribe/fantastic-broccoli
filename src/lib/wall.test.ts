import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  claimEndScreenAsk,
  countCompletedFullSessions,
  examPassPitch,
  freePerks,
  freePlanSummary,
  limitSentence,
  paidPerks,
  postSessionWallDue,
  resetEndScreenAsks,
  sessionsPerMonth,
  wallReason,
} from "./wall";

const CAPS = { workspaces: 2, studySessions: 3, flashcardTests: 2 };
const due = (over: Partial<Parameters<typeof postSessionWallDue>[0]> = {}) =>
  postSessionWallDue({ quickStart: false, completedFullSessions: 2, alreadyShown: false, hasAccess: false, ...over });

/* ---------- Timing ---------- */

test("the wall never covers the first win: not after a first Quick 5, not after a first full session", () => {
  assert.equal(due({ quickStart: true, completedFullSessions: 0 }), false, "first Quick 5");
  assert.equal(due({ completedFullSessions: 1 }), false, "first full session");
});

test("the post-session wall opens from the second completed full session", () => {
  assert.equal(due({ completedFullSessions: 2 }), true);
  assert.equal(due({ completedFullSessions: 5 }), true);
});

test("a Quick 5's end screen never gets the wall, however many sessions came before (its ask is the habit prompt)", () => {
  assert.equal(due({ quickStart: true, completedFullSessions: 4 }), false);
});

test("an unknown count, a wall already shown on this device, or a plan in hand: no wall", () => {
  assert.equal(due({ completedFullSessions: null }), false);
  assert.equal(due({ alreadyShown: true }), false);
  assert.equal(due({ hasAccess: true }), false);
});

test("counting full sessions: completed non-Quick 5 sessions, the one on screen included, each once", () => {
  const sessions = [
    { id: "q", quickStart: true, status: "completed" },
    { id: "a", quickStart: false, status: "completed" },
    { id: "b", quickStart: false, status: "active" },
    { id: "c", quickStart: false, status: "COMPLETED" },
  ];
  assert.equal(countCompletedFullSessions(sessions, { id: "b", quickStart: false }), 3);
  assert.equal(countCompletedFullSessions(sessions, { id: "c", quickStart: false }), 2, "not counted twice");
  assert.equal(countCompletedFullSessions(sessions.slice(0, 1), { id: "q", quickStart: true }), 0);
});

beforeEach(() => resetEndScreenAsks());

test("one ask per end screen: the habit prompt holds it, the wall then stays closed", () => {
  assert.equal(claimEndScreenAsk("s1", "habit"), true);
  assert.equal(claimEndScreenAsk("s1", "wall"), false);
  assert.equal(claimEndScreenAsk("s1", "habit"), true, "the holder may re-claim");
  assert.equal(claimEndScreenAsk("s2", "wall"), true, "another end screen is free");
  assert.equal(claimEndScreenAsk("s2", "habit"), false);
});

/* ---------- Reasons and words ---------- */

const cap = (n: number, what: string) =>
  `Free plan limit reached: the free plan includes ${n} ${what}. Upgrade (from $5/mo) for unlimited ${what}, a much bigger monthly token allowance and our strongest AI model on every activity.`;

test("wall.shown reasons come from the server's refusal", () => {
  assert.equal(wallReason(cap(2, "workspaces")), "plan_limit_workspaces");
  assert.equal(wallReason(cap(3, "study sessions")), "plan_limit_sessions");
  assert.equal(wallReason(cap(2, "flashcard tests")), "plan_limit_tests");
  assert.equal(wallReason("Not enough tokens for content generation (needs 40, you have 10). Upgrade your plan."), "token_limit");
  assert.equal(wallReason("Free plan limit reached: HL topics are included with a plan or exam pass. Try a plan free."), "locked_topic");
  assert.equal(wallReason("Free plan limit reached: today's free Quick 5 is done — come back tomorrow for 5 more."), "other");
  assert.equal(wallReason(null), "other");
});

test("the student reads the limit in plain words: subjects, not workspaces; never tokens", () => {
  assert.equal(
    limitSentence(cap(2, "workspaces"), { caps: CAPS }),
    "The free plan includes 2 subjects. Your subjects stay free to use; a plan lets you add more.",
  );
  assert.equal(
    limitSentence(cap(3, "study sessions")),
    "The free plan includes 3 full study sessions. Your daily Quick 5 stays free.",
  );
  assert.equal(limitSentence(cap(1, "flashcard test")), "The free plan includes 1 flashcard test.");
  const tokens = limitSentence("Not enough tokens for content generation (needs 40, you have 10). Upgrade your plan.");
  assert.ok(tokens && !/token/i.test(tokens), tokens ?? "");
  assert.equal(
    limitSentence("Free plan limit reached: today's free Quick 5 is done — come back tomorrow for 5 more. Upgrade (from $5/mo)."),
    "Today's free Quick 5 is done — come back tomorrow for 5 more.",
  );
  assert.equal(limitSentence(undefined), null);
});

test("the free plan summary has real plurals and says subjects", () => {
  assert.equal(freePlanSummary(CAPS), "one Quick 5 a day, 3 full study sessions, 2 subjects and 2 flashcard tests");
  assert.equal(freePlanSummary({ workspaces: 1, studySessions: 1, flashcardTests: 1 }), "one Quick 5 a day, 1 full study session, 1 subject and 1 flashcard test");
});

/* ---------- Plan bullets ---------- */

const starter = { name: "starter", priceDollars: 5, interval: "month", monthlyTokens: 600 };
const pro = { name: "pro", priceDollars: 12, interval: "month", monthlyTokens: 2000 };
const pass = { name: "exam_pass", priceDollars: 29, interval: null, kind: "pass", monthlyTokens: 600, accessUntil: "2027-07-15T23:59:59.000Z" };

test("bullets sell outcomes, never tokens, and sessions per month follow the allowance", () => {
  for (const p of [starter, pro, pass]) {
    for (const line of paidPerks(p)) assert.ok(!/token|workspace/i.test(line), line);
  }
  assert.equal(sessionsPerMonth(600), 15);
  assert.equal(sessionsPerMonth(0), null);
  assert.ok(paidPerks(starter).includes("Up to 15 new study sessions a month"));
  assert.ok(paidPerks(pro).includes("Up to 50 new study sessions a month"));
  assert.ok(!paidPerks({ ...starter, monthlyTokens: 0 }).some((l) => /study sessions a month/.test(l)));
});

test("Starter and the pass never show the same list: recurring versus one payment", () => {
  assert.notDeepEqual(paidPerks(starter), paidPerks(pass));
  assert.equal(paidPerks(starter).at(-1), "Renews every month, cancel anytime");
  assert.equal(paidPerks(pass).at(-1), "One payment, nothing renews");
  assert.deepEqual(paidPerks(pass, { examLine: "Covers your exam on Thu 3 Dec" }).slice(-2), ["Covers your exam on Thu 3 Dec", "One payment, nothing renews"]);
});

test("the free list has plurals and no tokens", () => {
  assert.deepEqual(freePerks(CAPS), ["2 subjects", "3 full study sessions and 2 flashcard tests", "One Quick 5 every day"]);
});

/* ---------- Exam Pass by exam date ---------- */

const exam = (date: string, kind: "exam" | "test" | "coursework" = "exam", title = "Biology Paper 1") => ({ title, kind, date });

test("with an exam date the pass is pitched until that exam, pay once", () => {
  const p = examPassPitch([exam("2026-12-03")], pass, "2026-11-21");
  assert.ok(p);
  assert.equal(p.date, "2026-12-03");
  assert.equal(p.dateLabel, "Thu 3 Dec");
  assert.equal(p.headline, "Everything until your exam on Thu 3 Dec — pay once");
  assert.equal(p.line, "Covers your exam on Thu 3 Dec");
});

test("without an exam date (or only past ones) the usual presentation stays", () => {
  assert.equal(examPassPitch([], pass, "2026-11-21"), null);
  assert.equal(examPassPitch([exam("2026-11-01")], pass, "2026-11-21"), null);
  assert.equal(examPassPitch([exam("2026-12-03")], null, "2026-11-21"), null, "no pass on sale");
});

test("several exams: the pitch runs to the last one the pass covers; tests only count when there is no exam", () => {
  const p = examPassPitch([exam("2026-12-03"), exam("2027-05-12"), exam("2026-12-20", "test")], pass, "2026-11-21");
  assert.equal(p?.date, "2027-05-12");
  assert.match(p?.headline ?? "", /^Everything until your last exam on /);
  const t = examPassPitch([exam("2026-12-20", "test", "Mock")], pass, "2026-11-21");
  assert.match(t?.headline ?? "", /until your test on Sun 20 Dec/);
});

test("a pass that ends before the exam is never pitched as covering it", () => {
  assert.equal(examPassPitch([exam("2027-08-01")], pass, "2026-11-21"), null);
  const p = examPassPitch([exam("2027-05-12"), exam("2027-08-01")], pass, "2026-11-21");
  assert.equal(p?.date, "2027-05-12", "the last exam it does cover");
  assert.equal(examPassPitch([exam("2027-08-01")], { accessUntil: null }, "2026-11-21")?.date, "2027-08-01", "no end date sent: covers");
});
