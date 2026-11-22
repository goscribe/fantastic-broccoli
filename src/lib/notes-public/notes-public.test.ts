import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { coursePath, neighbours, resolveSegment, slugify, topicPath, topicSlug, unitPath, unitSlug } from "./slug";
import {
  breadcrumbJsonLd,
  crumbsFor,
  indexDraftsFromEnv,
  isTopicIndexable,
  MIN_INDEXABLE_QUESTIONS,
  plainText,
  topicDescription,
  topicQuizJsonLd,
  topicTitle,
} from "./seo";
import { emptyProgress, parseProgress, PROMPT_AFTER, PROMPT_SNOOZE_MS, recordAnswer, resetTopic, shouldPrompt, topicScore, totalAnswered } from "./progress";
import { hasMath, tokenizeInline } from "./inline";
import { notesRouteDecision } from "./route-decision";
import { notesSitemapEntries } from "./sitemap";
import { splitInline } from "./inline-split";
import { emptyReading, markRead, parseReading, readingMinutes, topicState } from "./reading";

const units = [
  {
    id: "a",
    name: "Unity and diversity",
    topics: [
      { id: "a1-1", name: "Water" },
      { id: "a1-10", name: "Something & else" },
    ],
  },
  { id: "c", name: "Interaction and interdependence", topics: [{ id: "c1-1", name: "Enzymes and metabolism" }] },
];

describe("slug / URL logic", () => {
  test("slugify is ASCII, word-safe and capped", () => {
    assert.equal(slugify("Enzymes and metabolism"), "enzymes-and-metabolism");
    assert.equal(slugify("Hardy–Weinberg & Darwin's ideas"), "hardy-weinberg-and-darwins-ideas");
    assert.equal(slugify("Équilibrium (Kc)"), "equilibrium-kc");
    const long = slugify("word ".repeat(40));
    assert.ok(long.length <= 60 && !long.endsWith("-"));
  });
  test("paths", () => {
    assert.equal(coursePath("ib-biology"), "/notes/ib-biology");
    assert.equal(topicPath("ib-biology", { id: "c1-1", name: "Enzymes and metabolism" }), "/notes/ib-biology/c1-1-enzymes-and-metabolism");
    assert.equal(unitPath("ib-biology", { id: "a", name: "Unity and diversity" }), "/notes/ib-biology/unit-a-unity-and-diversity");
    assert.equal(topicSlug({ id: "1-1", name: "???" }), "1-1");
    assert.equal(unitSlug({ id: "3", name: "" }), "unit-3");
  });
  test("resolveSegment: canonical, bare id, stale name, longest id wins, units, unknown", () => {
    const c = resolveSegment(units, "a1-1-water");
    assert.ok(c && c.kind === "topic" && c.topic.id === "a1-1" && c.canonical);
    const bare = resolveSegment(units, "a1-1");
    assert.ok(bare && bare.kind === "topic" && !bare.canonical && bare.slug === "a1-1-water");
    const stale = resolveSegment(units, "a1-1-old-name");
    assert.ok(stale && stale.kind === "topic" && stale.topic.id === "a1-1" && !stale.canonical);
    const ten = resolveSegment(units, "a1-10-something-and-else");
    assert.ok(ten && ten.kind === "topic" && ten.topic.id === "a1-10" && ten.canonical);
    const u = resolveSegment(units, "unit-a");
    assert.ok(u && u.kind === "unit" && u.unit.id === "a" && !u.canonical && u.slug === "unit-a-unity-and-diversity");
    assert.equal(resolveSegment(units, "z9-9"), null);
    assert.equal(resolveSegment(units, "A1-1-WATER")?.kind, "topic");
  });
  test("neighbours run across units", () => {
    assert.deepEqual(neighbours(units, "a1-10"), { prev: units[0].topics[0], next: units[1].topics[0] });
    assert.deepEqual(neighbours(units, "a1-1").prev, null);
    assert.deepEqual(neighbours(units, "nope"), { prev: null, next: null });
  });
  test("proxy decision: 404 unknown, 308 non-canonical, pass reserved files", () => {
    const outline = { id: "ib-biology", units };
    assert.deepEqual(notesRouteDecision("ib-biology", "a1-1", outline), { action: "redirect", path: "/notes/ib-biology/a1-1-water" });
    assert.deepEqual(notesRouteDecision("ib-biology", "a1-1-water", outline), { action: "next" });
    assert.deepEqual(notesRouteDecision("ib-biology", "zz", outline), { action: "not_found" });
    assert.deepEqual(notesRouteDecision("nope", undefined, null), { action: "not_found" });
    assert.deepEqual(notesRouteDecision("ib-biology", undefined, outline), { action: "next" });
    assert.deepEqual(notesRouteDecision("sitemap", "0.xml", undefined), { action: "next" });
    assert.deepEqual(notesRouteDecision("ib-biology", "opengraph-image", outline), { action: "next" });
    assert.deepEqual(notesRouteDecision("ib-biology", "a1-1", undefined), { action: "next" }, "API down: let the page decide");
  });
});

describe("indexability rule", () => {
  test("needs a note and enough checked questions; drafts unless the flag turns them off", () => {
    const n = MIN_INDEXABLE_QUESTIONS;
    assert.equal(n, 6);
    assert.equal(isTopicIndexable({ note: "reviewed", questionCount: n, indexDrafts: false }), true);
    assert.equal(isTopicIndexable({ note: "reviewed", questionCount: n - 1, indexDrafts: true }), false);
    assert.equal(isTopicIndexable({ note: null, questionCount: 10, indexDrafts: true }), false);
    assert.equal(isTopicIndexable({ note: "draft", questionCount: 10, indexDrafts: false }), false);
    assert.equal(isTopicIndexable({ note: "draft", questionCount: 10, indexDrafts: true }), true);
  });
  test("NOTES_INDEX_DRAFTS parsing", () => {
    assert.equal(indexDraftsFromEnv(undefined), true);
    assert.equal(indexDraftsFromEnv("1"), true);
    assert.equal(indexDraftsFromEnv("true"), true);
    assert.equal(indexDraftsFromEnv("0"), false);
    assert.equal(indexDraftsFromEnv("false"), false);
  });
  test("sitemap lists only indexable topics and the hubs that lead to them", () => {
    const rows = [
      { courseId: "ib-biology", unitId: "a", unitName: "Unity and diversity", topicId: "a1-1", topicName: "Water", note: "reviewed" as const, questionCount: 10, updatedAt: "2026-11-20T10:00:00.000Z" },
      { courseId: "ib-biology", unitId: "a", unitName: "Unity and diversity", topicId: "a1-2", topicName: "Nucleic acids", note: "draft" as const, questionCount: 10, updatedAt: null },
      { courseId: "ib-biology", unitId: "c", unitName: "Interaction", topicId: "c1-1", topicName: "Enzymes", note: "reviewed" as const, questionCount: 3, updatedAt: null },
      { courseId: "ap-biology", unitId: "1", unitName: "Chemistry of life", topicId: "1-1", topicName: "Water", note: null, questionCount: 10, updatedAt: null },
    ];
    const courses = [{ id: "ib-biology" }, { id: "ap-biology" }];
    const paths = notesSitemapEntries(courses, rows, false).map((e) => e.path);
    assert.deepEqual(paths, ["/notes", "/notes/ib-biology", "/notes/ib-biology/unit-a-unity-and-diversity", "/notes/ib-biology/a1-1-water"]);
    assert.ok(notesSitemapEntries(courses, rows, true).some((e) => e.path === "/notes/ib-biology/a1-2-nucleic-acids"));
    assert.equal(notesSitemapEntries(courses, rows, false)[0].lastModified, "2026-11-20T10:00:00.000Z");
  });
});

describe("titles and descriptions", () => {
  const course = { title: "IB Biology" };
  const topic = { code: "C1.1", name: "Enzymes and metabolism", objectives: ["Explain how enzymes lower activation energy", "Describe enzyme specificity"] };
  test("unique, descriptive titles", () => {
    assert.equal(topicTitle(course, topic, true, 10), "IB Biology C1.1 Enzymes and metabolism: notes and practice questions");
    assert.equal(topicTitle(course, topic, false, 10), "IB Biology C1.1 Enzymes and metabolism: practice questions");
    assert.equal(topicTitle(course, topic, true, 0), "IB Biology C1.1 Enzymes and metabolism: revision notes");
  });
  test("descriptions fit a snippet", () => {
    const d = topicDescription(course, topic, true, 10);
    assert.ok(d.length <= 158, d);
    assert.match(d, /10 exam-style questions/);
  });
});

describe("JSON-LD", () => {
  test("BreadcrumbList", () => {
    const ld = breadcrumbJsonLd("https://scribe.study", crumbsFor.topic({ id: "ib-biology", title: "IB Biology" }, { id: "c", code: "C", name: "Interaction" }, { id: "c1-1", code: "C1.1", name: "Enzymes" }));
    assert.equal(ld["@type"], "BreadcrumbList");
    assert.deepEqual(
      ld.itemListElement.map((i) => [i.position, i.name, i.item]),
      [
        [1, "Notes", "https://scribe.study/notes"],
        [2, "IB Biology", "https://scribe.study/notes/ib-biology"],
        [3, "C Interaction", "https://scribe.study/notes/ib-biology/unit-c-interaction"],
        [4, "C1.1 Enzymes", "https://scribe.study/notes/ib-biology/c1-1-enzymes"],
      ],
    );
  });
  test("Quiz with Question/acceptedAnswer parts in plain text", () => {
    const ld = topicQuizJsonLd({
      siteUrl: "https://scribe.study",
      path: "/notes/ib-physics/a1-1-kinematics",
      course: { title: "IB Physics", subject: "Physics", qualification: "IB Diploma" },
      topic: { code: "A.1", name: "Kinematics" },
      locale: "en-GB",
      questions: [
        {
          stem: "Calculate the speed of a wave with $f = 5\\,\\text{Hz}$ and $\\lambda = 2\\,\\text{m}$.",
          options: ["$10\\,\\text{m s}^{-1}$.", "$2.5$", "$7$", "$0.4$"],
          correctIndex: 0,
          explanation: "Use **v = fλ**: 5 × 2 = 10.",
        },
      ],
    });
    assert.equal(ld["@context"], "https://schema.org");
    assert.equal(ld["@type"], "Quiz");
    assert.equal(ld.url, "https://scribe.study/notes/ib-physics/a1-1-kinematics#practice");
    assert.equal(ld.hasPart.length, 1);
    const q = ld.hasPart[0];
    assert.equal(q["@type"], "Question");
    assert.equal(q.eduQuestionType, "Flashcard");
    assert.equal(q.text, "Calculate the speed of a wave with f = 5 Hz and \\lambda = 2 m.");
    assert.equal(q.acceptedAnswer["@type"], "Answer");
    assert.match(q.acceptedAnswer.text, /^10 m s\^\{-1\}\. Use v = fλ/);
    assert.ok(!JSON.stringify(ld).includes("**"));
    assert.ok(!JSON.stringify(ld).includes(".."), "no doubled full stops");
    assert.ok(!("dateCreated" in ld) && !("aggregateRating" in ld), "no claims we cannot back");
  });
  test("plainText strips markdown, keeps meaning", () => {
    assert.equal(plainText("The **active site** is *specific*: $6.0 \\times 10^{3}$"), "The active site is specific: 6.0 × 10^{3}");
  });
});

describe("progress (localStorage)", () => {
  test("first answer wins, score counts questions on the page, reset", () => {
    let p = emptyProgress();
    p = recordAnswer(p, "c/t", "q1", 2, true, 1);
    p = recordAnswer(p, "c/t", "q1", 0, false, 2);
    p = recordAnswer(p, "c/t", "q2", 1, false, 3);
    assert.deepEqual(topicScore(p, "c/t", ["q1", "q2", "q3"]), { answered: 2, correct: 1, total: 3 });
    assert.deepEqual(topicScore(p, "c/t", ["q2"]), { answered: 1, correct: 0, total: 1 }, "removed questions do not count");
    assert.equal(totalAnswered(p), 2);
    assert.deepEqual(topicScore(resetTopic(p, "c/t"), "c/t", ["q1"]), { answered: 0, correct: 0, total: 1 });
  });
  test("parse is defensive", () => {
    assert.deepEqual(parseProgress("not json"), emptyProgress());
    assert.deepEqual(parseProgress(JSON.stringify({ v: 2 })), emptyProgress());
    const p = parseProgress(JSON.stringify({ v: 1, topics: { "c/t": { answers: { a: 1, b: -1, c: 1.5 }, correct: { a: true, z: true }, updatedAt: 5 } }, promptDismissedAt: "x" }));
    assert.deepEqual(p.topics["c/t"], { answers: { a: 1 }, correct: { a: true }, updatedAt: 5 });
    assert.equal(p.promptDismissedAt, null);
  });
  test("soft prompt after a few answers, snoozed after dismiss, never when signed in", () => {
    const p = emptyProgress();
    assert.equal(shouldPrompt(p, PROMPT_AFTER - 1, 0, false), false);
    assert.equal(shouldPrompt(p, PROMPT_AFTER, 0, false), true);
    assert.equal(shouldPrompt(p, PROMPT_AFTER, 0, true), false);
    const dismissed = { ...p, promptDismissedAt: 1000 };
    assert.equal(shouldPrompt(dismissed, 9, 2000, false), false);
    assert.equal(shouldPrompt(dismissed, 9, 1000 + PROMPT_SNOOZE_MS + 1, false), true);
  });
});

describe("inline markdown tokenizer", () => {
  test("maths, bold, currency and escapes", () => {
    assert.deepEqual(tokenizeInline("A **key** term and $x^2$."), [
      { t: "text", v: "A " },
      { t: "strong", v: "key" },
      { t: "text", v: " term and " },
      { t: "math", latex: "x^2", display: false },
      { t: "text", v: "." },
    ]);
    assert.deepEqual(tokenizeInline("costs $800,000 or $300,000"), [{ t: "text", v: "costs $800,000 or $300,000" }]);
    assert.equal(hasMath(["plain", "with $v = f\\lambda$"]), true);
    assert.equal(hasMath(["plain only"]), false);
  });
});

describe("inline quick checks", () => {
  const qs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `q${i}`, difficulty: i < 2 ? "hard" : "easy" }));
  test("two easy/medium questions between sections of a long note; each question once", () => {
    const { inline, rest } = splitInline(6, qs(10));
    assert.deepEqual([...inline.entries()].map(([k, q]) => [k, q.id]), [
      [1, "q2"],
      [3, "q3"],
    ]);
    assert.equal(rest.length, 8);
    assert.ok(!rest.some((q) => q.id === "q2" || q.id === "q3"));
  });
  test("short notes or few questions keep everything in the practice section", () => {
    assert.equal(splitInline(2, qs(10)).inline.size, 0);
    assert.equal(splitInline(6, qs(7)).inline.size, 0);
    assert.equal(splitInline(3, qs(10)).inline.size, 1);
  });
});

describe("reading time and reading progress", () => {
  test("reading time comes from the note's own words, never under a minute", () => {
    const para = (n: number) => ({ type: "paragraph" as const, text: Array.from({ length: n }, () => "word").join(" ") });
    assert.equal(readingMinutes({ sections: [{ id: "s1", heading: "A", blocks: [para(10)] }], keyTerms: [] }), 1);
    assert.equal(readingMinutes({ sections: [{ id: "s1", heading: "A", blocks: [para(570)] }], keyTerms: [] }), 3);
    // A collapsed "Go deeper" block is optional reading and does not count.
    assert.equal(
      readingMinutes({ sections: [{ id: "s1", heading: "A", blocks: [para(189), { type: "deeper", title: "More", paragraphs: [para(900).text] }] }], keyTerms: [] }),
      1,
    );
  });
  test("marking sections read is idempotent and survives a round trip", () => {
    let p = markRead(emptyReading(), "c/t", "s1", 3, 10);
    const same = markRead(p, "c/t", "s1", 3, 20);
    assert.equal(same, p);
    p = markRead(p, "c/t", "s2", 3, 30);
    assert.deepEqual(parseReading(JSON.stringify(p)).topics["c/t"], { read: ["s1", "s2"], total: 3, updatedAt: 30 });
    assert.deepEqual(parseReading("{oops"), emptyReading());
    assert.deepEqual(parseReading(JSON.stringify({ v: 2, topics: {} })), emptyReading());
  });
  test("a topic is started after one section or answer, done when read through or fully answered", () => {
    assert.equal(topicState(undefined, 0, 10), "new");
    assert.equal(topicState({ read: ["s1"], total: 3, updatedAt: 1 }, 0, 10), "started");
    assert.equal(topicState(undefined, 2, 10), "started");
    assert.equal(topicState({ read: ["s1", "s2", "s3"], total: 3, updatedAt: 1 }, 0, 10), "done");
    assert.equal(topicState(undefined, 10, 10), "done");
    assert.equal(topicState(undefined, 0, 0), "new");
  });
});
