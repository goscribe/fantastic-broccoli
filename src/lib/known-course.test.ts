import { test } from "node:test";
import assert from "node:assert/strict";
import { courseFromLandingPage, coursesFromKeyword, knownCourse, KNOWN_COURSE_TTL_MS, parseSignupCourse, signupCourseFromQuery } from "./known-course";
import { boardOrder, firstTopic, likelyCourses } from "./courses";
import type { CatalogTopic, CourseSummary } from "./api/courses";

const c = (id: string, title: string, board: CourseSummary["board"], subject: string): CourseSummary => ({
  id,
  title,
  board,
  boardName: board === "IB" ? "IB Diploma Programme" : board === "AP" ? "College Board AP" : "AQA",
  subject,
  qualification: board === "A_LEVEL" ? "A-level" : board,
  unitCount: 1,
  topicCount: 1,
});

const CATALOG = [
  c("ib-biology", "IB Biology", "IB", "Biology"),
  c("ib-chemistry", "IB Chemistry", "IB", "Chemistry"),
  c("ib-math-aa", "IB Mathematics: Analysis and Approaches", "IB", "Mathematics"),
  c("ib-math-ai", "IB Mathematics: Applications and Interpretation", "IB", "Mathematics"),
  c("ap-biology", "AP Biology", "AP", "Biology"),
  c("ap-calculus-ab", "AP Calculus AB", "AP", "Mathematics"),
  c("ap-calculus-bc", "AP Calculus BC", "AP", "Mathematics"),
  c("ap-psychology", "AP Psychology", "AP", "Psychology"),
  c("aqa-gcse-biology", "AQA GCSE Biology", "GCSE", "Biology"),
  c("aqa-alevel-biology", "AQA A-level Biology", "A_LEVEL", "Biology"),
  c("aqa-alevel-psychology", "AQA A-level Psychology", "A_LEVEL", "Psychology"),
];
const NOW = 1_800_000_000_000;
const US = boardOrder("en-US", "America/Chicago");
const UK = boardOrder("en-GB", "Europe/London");

test("likelyCourses: the student's board first, one course per subject, later boards fill the rest", () => {
  assert.deepEqual(likelyCourses(CATALOG, US, 4).map((x) => x.id), ["ap-biology", "ap-calculus-ab", "ap-psychology", "ib-biology"]);
  assert.deepEqual(likelyCourses(CATALOG, UK, 4).map((x) => x.id), ["aqa-gcse-biology", "aqa-alevel-biology", "aqa-alevel-psychology", "ib-biology"]);
  assert.deepEqual(likelyCourses(CATALOG, undefined, 3).map((x) => x.id), ["ib-biology", "ib-chemistry", "ib-math-aa"]);
});

test("likelyCourses: a known course leads, is not repeated, and unknown ids are dropped", () => {
  assert.deepEqual(likelyCourses(CATALOG, US, 3, ["aqa-alevel-psychology", "nope"]).map((x) => x.id), ["aqa-alevel-psychology", "ap-biology", "ap-calculus-ab"]);
  assert.deepEqual(likelyCourses(CATALOG, US, 3, ["ap-calculus-bc"]).map((x) => x.id), ["ap-calculus-bc", "ap-biology", "ap-psychology"]);
});

test("likelyCourses: a small catalog is shown whole, without repeats", () => {
  const small = CATALOG.filter((x) => x.board === "AP");
  assert.deepEqual(likelyCourses(small, US, 6).map((x) => x.id), ["ap-biology", "ap-calculus-ab", "ap-psychology", "ap-calculus-bc"]);
  assert.deepEqual(likelyCourses([], US), []);
});

test("firstTopic: the first topic everyone on the course studies, never a locked one", () => {
  const t = (id: string, extra: Partial<CatalogTopic> = {}): CatalogTopic => ({ id, code: id, name: id, objectives: [], ...extra });
  const units = [
    { id: "u1", code: "1", name: "One", topics: [t("a", { locked: true }), t("b", { hlOnly: true }), t("c")] },
    { id: "u2", code: "2", name: "Two", topics: [t("d")] },
  ];
  assert.equal(firstTopic({ units })?.topic.id, "c");
  assert.equal(firstTopic({ units: [{ id: "u", code: "1", name: "One", topics: [t("x", { locked: true }), t("y", { advanced: true })] }] })?.topic.id, "y");
  assert.equal(firstTopic({ units: [{ id: "u", code: "1", name: "One", topics: [t("x", { locked: true })] }] }), null);
  assert.equal(firstTopic({ units: [] }), null);
});

test("signup link: course and topic are read, anything odd is ignored", () => {
  assert.deepEqual(signupCourseFromQuery("?from=notes&course=ib-biology&topic=a1-1-water", NOW), { courseId: "ib-biology", topicId: "a1-1-water", at: NOW });
  assert.deepEqual(signupCourseFromQuery("?course=ib-biology&topic=<x>", NOW), { courseId: "ib-biology", at: NOW });
  assert.equal(signupCourseFromQuery("?from=notes", NOW), null);
  assert.equal(signupCourseFromQuery("?course=../../etc", NOW), null);
  assert.equal(parseSignupCourse("{not json"), null);
  assert.equal(parseSignupCourse(JSON.stringify({ courseId: 7 })), null);
  assert.deepEqual(parseSignupCourse(JSON.stringify({ courseId: "ap-biology", at: 5 })), { courseId: "ap-biology", at: 5 });
});

test("landing page: only the public notes paths name a course", () => {
  assert.deepEqual(courseFromLandingPage("/notes/ib-biology/a1-1-water?utm_source=google"), { courseId: "ib-biology", topicId: "a1-1-water" });
  assert.deepEqual(courseFromLandingPage("/notes/ap-biology"), { courseId: "ap-biology" });
  assert.equal(courseFromLandingPage("/notes"), null);
  assert.equal(courseFromLandingPage("/landing/pricing"), null);
  assert.equal(courseFromLandingPage(undefined), null);
});

test("ad keyword: filler words dropped, every other word must fit, a board alone names nothing", () => {
  assert.deepEqual(coursesFromKeyword("ib biology revision notes", CATALOG).map((x) => x.id), ["ib-biology"]);
  assert.deepEqual(coursesFromKeyword("AP_Bio_quiz", CATALOG).map((x) => x.id), ["ap-biology"]);
  assert.deepEqual(coursesFromKeyword("a level psychology past papers", CATALOG).map((x) => x.id), ["aqa-alevel-psychology"]);
  assert.deepEqual(coursesFromKeyword("biology revision", CATALOG, UK).map((x) => x.id), ["aqa-gcse-biology", "aqa-alevel-biology", "ib-biology", "ap-biology"]);
  assert.deepEqual(coursesFromKeyword("ib math", CATALOG).map((x) => x.id), ["ib-math-aa", "ib-math-ai"]);
  assert.deepEqual(coursesFromKeyword("ib", CATALOG), []);
  assert.deepEqual(coursesFromKeyword("free study app", CATALOG), []);
  assert.deepEqual(coursesFromKeyword("organic chemistry tutor near me", CATALOG), []);
  assert.deepEqual(coursesFromKeyword(undefined, CATALOG), []);
});

test("knownCourse: the signup link wins, then what they practised, read, landed on, then the keyword", () => {
  const practiceRaw = JSON.stringify({ v: 1, topics: { "ap-biology/1-1": { answers: { q1: 0 }, correct: { q1: true }, updatedAt: NOW - 1000 }, "ib-chemistry/s1-1": { answers: {}, correct: {}, updatedAt: NOW - 5000 } }, promptDismissedAt: null });
  const readingRaw = JSON.stringify({ v: 1, topics: { "ib-chemistry/s1-1": { read: ["s1"], total: 3, updatedAt: NOW - 10 } } });
  const attribution = { landingPage: "/notes/aqa-gcse-biology/cells", utmTerm: "ib biology notes" };
  const all = knownCourse({ signup: { courseId: "ib-math-aa", topicId: "1-1", at: NOW - 60_000 }, practiceRaw, readingRaw, attribution }, CATALOG, undefined, NOW);
  assert.deepEqual(all.known, { courseId: "ib-math-aa", topicId: "1-1", source: "signup" });
  assert.deepEqual(all.lead, ["ib-math-aa", "ap-biology", "ib-chemistry", "aqa-gcse-biology", "ib-biology"]);
  assert.deepEqual(knownCourse({ practiceRaw, readingRaw, attribution }, CATALOG, undefined, NOW).known, { courseId: "ap-biology", topicId: "1-1", source: "practice" });
  assert.deepEqual(knownCourse({ readingRaw, attribution }, CATALOG, undefined, NOW).known, { courseId: "ib-chemistry", topicId: "s1-1", source: "reading" });
  assert.deepEqual(knownCourse({ attribution }, CATALOG, undefined, NOW).known, { courseId: "aqa-gcse-biology", topicId: "cells", source: "landing" });
  assert.deepEqual(knownCourse({ attribution: { utmTerm: "ib biology notes" } }, CATALOG, undefined, NOW).known, { courseId: "ib-biology", source: "keyword" });
});

test("knownCourse: a keyword that fits several courses orders the tiles but starts nothing", () => {
  const out = knownCourse({ attribution: { utmCampaign: "biology_revision" } }, CATALOG, US, NOW);
  assert.equal(out.known, null);
  assert.deepEqual(out.lead, ["ap-biology", "ib-biology", "aqa-gcse-biology", "aqa-alevel-biology"]);
});

test("knownCourse: stale signals, courses not in the catalog and broken storage are ignored", () => {
  const old = NOW - KNOWN_COURSE_TTL_MS - 1;
  assert.deepEqual(knownCourse({ signup: { courseId: "ib-biology", at: old } }, CATALOG, undefined, NOW), { known: null, lead: [] });
  assert.deepEqual(knownCourse({ signup: { courseId: "retired-course", at: NOW } }, CATALOG, undefined, NOW), { known: null, lead: [] });
  const practiceRaw = JSON.stringify({ v: 1, topics: { "ib-biology/a1": { answers: {}, correct: {}, updatedAt: old }, "gone/x": { answers: {}, correct: {}, updatedAt: NOW } }, promptDismissedAt: null });
  assert.deepEqual(knownCourse({ practiceRaw, readingRaw: "{oops", attribution: { landingPage: "/notes/gone/x" } }, CATALOG, undefined, NOW), { known: null, lead: [] });
  assert.deepEqual(knownCourse({}, CATALOG, undefined, NOW), { known: null, lead: [] });
});

test("mayKnowCourse: only signals that could name a course hold the first screen back", async () => {
  const { mayKnowCourse } = await import("./known-course");
  assert.equal(mayKnowCourse({}), false);
  assert.equal(mayKnowCourse({ attribution: { utmSource: "google", landingPage: "/landing", referrer: "https://www.google.com/" } }), false);
  assert.equal(mayKnowCourse({ attribution: { utmTerm: "ib biology" } }), true);
  assert.equal(mayKnowCourse({ attribution: { landingPage: "/notes/ib-biology" } }), true);
  assert.equal(mayKnowCourse({ signup: { courseId: "ib-biology", at: 1 } }), true);
});
