import { test } from "node:test";
import assert from "node:assert/strict";
import { chipAction, filesForCourseTopics, latestUpload, newSessionScope, pickSubjectNext, reviewBreakdown, subjectChips, subjectNextCopy } from "./subject-page";

const base = { loading: false, sessions: [], review: { mistakes: 0, dueItems: 0, dueCards: 0 }, planTasks: [], courseNext: null, materialCount: 2 };
const session = (o: Partial<{ id: string; status: string; generating: boolean; quickStart: boolean; createdAt: string; done: number; open: number }>) => ({
  id: o.id ?? "s1",
  title: "Cell transport",
  status: o.status ?? "active",
  generating: o.generating ?? false,
  quickStart: o.quickStart ?? false,
  createdAt: o.createdAt ?? "2026-11-01T00:00:00Z",
  activities: [
    ...Array.from({ length: o.done ?? 1 }, () => ({ status: "completed", title: "Read", estimatedMinutes: 3 })),
    ...Array.from({ length: o.open ?? 2 }, (_, i) => ({ status: "pending", title: i ? "Exam questions" : "Diffusion quiz", estimatedMinutes: 4 })),
  ],
});

test("the band's one next thing follows home's order: mistakes, plan, started work, review, course topic, quick 5", () => {
  assert.equal(pickSubjectNext({ ...base, loading: true }).kind, "loading");
  assert.deepEqual(pickSubjectNext({ ...base, review: { mistakes: 3, dueItems: 4, dueCards: 6 }, sessions: [session({})] }), { kind: "mistakes", count: 3, minutes: 2 });
  assert.equal(pickSubjectNext({ ...base, planTasks: [{ id: "t1", label: "Osmosis", minutes: 8, status: "planned" }], sessions: [session({})] }).kind, "plan");
  const cont = pickSubjectNext({ ...base, sessions: [session({ id: "new", createdAt: "2026-11-05T00:00:00Z" }), session({ id: "old" })], review: { mistakes: 0, dueItems: 4, dueCards: 0 } });
  assert.equal(cont.kind, "continue");
  assert.equal(cont.kind === "continue" && cont.sessionId, "old");
  assert.equal(cont.kind === "continue" && cont.activityTitle, "Diffusion quiz");
  assert.deepEqual(pickSubjectNext({ ...base, review: { mistakes: 0, dueItems: 4, dueCards: 6 } }), { kind: "review", review: "review_items", count: 4, minutes: 2 });
  assert.deepEqual(pickSubjectNext({ ...base, review: { mistakes: 0, dueItems: 0, dueCards: 6 } }), { kind: "review", review: "cards", count: 6, minutes: 2 });
  const course = { topicId: "b1", title: "B1.1 Carbohydrates and lipids", course: "IB Biology HL" };
  assert.deepEqual(pickSubjectNext({ ...base, courseNext: course }), { kind: "topic", ...course });
  assert.deepEqual(pickSubjectNext(base), { kind: "quick5", fromFiles: true });
  assert.deepEqual(pickSubjectNext({ ...base, materialCount: 0 }), { kind: "quick5", fromFiles: false });
  // A session still being written is opened, not duplicated.
  assert.equal(pickSubjectNext({ ...base, sessions: [session({ generating: true, done: 0, open: 0 })] }).kind, "building");
  // Finished sessions never come back as the next thing.
  assert.equal(pickSubjectNext({ ...base, sessions: [session({ status: "completed", open: 0 })] }).kind, "quick5");
});

test("copy says 1 mistake / 3 mistakes, never 'Fix 1 mistakes'", () => {
  assert.equal(subjectNextCopy({ kind: "mistakes", count: 1, minutes: 1 }, "Biology").cta, "Fix 1 mistake");
  assert.match(subjectNextCopy({ kind: "mistakes", count: 1, minutes: 1 }, "Biology").sentence, /^1 answer you got wrong in Biology is waiting\. Fix it/);
  assert.equal(subjectNextCopy({ kind: "mistakes", count: 3, minutes: 2 }, "Biology").cta, "Fix 3 mistakes");
  assert.equal(subjectNextCopy({ kind: "review", review: "review_items", count: 1, minutes: 2 }, "Bio").cta, "Review 1 question");
  assert.equal(subjectNextCopy({ kind: "review", review: "cards", count: 6, minutes: 2 }, "Bio").cta, "Review 6 cards");
  assert.equal(reviewBreakdown({ mistakes: 1, dueItems: 0, dueCards: 2 }), "1 mistake · 2 cards");
});

test("New session with nothing picked covers the whole subject, never silently the first file", () => {
  const files = newSessionScope({ subject: "Biology", picked: [], topics: ["Membranes", "Enzymes"], materials: ["Osmosis notes.pdf", "Slides.pptx"] });
  assert.equal(files.title, "Biology: all topics");
  assert.equal(files.topics, "Membranes, Enzymes");
  assert.ok(!files.title.includes("Osmosis notes"));
  // A course-only subject with no files still gets a title (the server rejects an empty one).
  const courseOnly = newSessionScope({ subject: "IB Biology", picked: [], topics: ["Water", "Nucleic acids"], materials: [] });
  assert.equal(courseOnly.title, "IB Biology: all topics");
  assert.equal(courseOnly.topics, "Water, Nucleic acids");
  const empty = newSessionScope({ subject: "", picked: [], topics: [], materials: [] });
  assert.ok(empty.title.length > 0 && empty.topics.length > 0);
  // Files only, no outline yet: every file, not the first.
  assert.equal(newSessionScope({ subject: "Bio", picked: [], topics: [], materials: ["a.pdf", "b.pdf"] }).topics, "a.pdf, b.pdf");
  // Picked files: exactly those.
  assert.deepEqual(newSessionScope({ subject: "Bio", picked: ["a.pdf", "b.pdf", "c.pdf"], topics: ["x"], materials: [] }), { title: "a.pdf + 2 more", topics: "a.pdf, b.pdf, c.pdf" });
});

test("composer chips are offered only when they can do what they say", () => {
  assert.deepEqual(subjectChips({ latestUploadTitle: null, openMistakes: 0 }), []);
  assert.deepEqual(subjectChips({ latestUploadTitle: "Osmosis.pdf", openMistakes: 2 }).map((c) => c.id), ["flashcards", "mistakes"]);
  assert.deepEqual(subjectChips({ latestUploadTitle: null, openMistakes: 1 }).map((c) => c.id), ["mistakes"]);
  assert.ok(!subjectChips({ latestUploadTitle: "x", openMistakes: 1 }).some((c) => /everything here/i.test(c.label)));
  const files = [
    { id: "a", updatedAt: "2026-11-01T00:00:00Z" },
    { id: "note", updatedAt: "2026-11-09T00:00:00Z" },
    { id: "b", updatedAt: "2026-11-05T00:00:00Z" },
  ];
  assert.equal(latestUpload(files, (m) => m.id === "note")?.id, "b");
  assert.equal(latestUpload([]), null);
});

test("each chip runs its real action: a deck from the latest upload, or this subject's mistakes practice", () => {
  assert.deepEqual(chipAction("flashcards", { workspaceId: "w1", latestUploadId: "u3" }), { kind: "deck", fileId: "u3" });
  assert.equal(chipAction("flashcards", { workspaceId: "w1", latestUploadId: null }), null);
  assert.deepEqual(chipAction("mistakes", { workspaceId: "w 1", latestUploadId: null }), { kind: "go", href: "/mistakes/practice?workspace=w%201" });
});

test("the student's files land on the course topic they cover; the rest stay listed", () => {
  const topics = [
    { id: "b2", name: "Membranes and membrane transport" },
    { id: "c1", name: "Enzymes and metabolism" },
    { id: "a1", name: "Water" },
  ];
  const outline = [
    { title: "Membrane transport", fileIds: ["u2"] },
    { title: "Enzymes", fileIds: ["u3"] },
    { title: "Exam technique", fileIds: ["u9"] },
  ];
  const { byTopic, unmatched } = filesForCourseTopics(topics, outline, [{ id: "u1", title: "Water notes.pdf" }, { id: "u5", title: "IMG 2041.jpg" }]);
  assert.deepEqual(byTopic.get("b2"), ["u2"]);
  assert.deepEqual(byTopic.get("a1"), ["u1"]);
  assert.deepEqual(byTopic.get("c1"), ["u3"]);
  assert.equal(byTopic.get("x"), undefined);
  assert.deepEqual(unmatched.map((o) => o.title), ["Exam technique"]);
});
