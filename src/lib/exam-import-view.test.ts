import { test } from "node:test";
import assert from "node:assert/strict";
import { filterEvents, importHeadline, syncNote, timeLabel, whenLabel } from "./exam-import-view";

const t = (k: string) =>
  ({
    "ei.time.am": "Morning",
    "ei.time.pm": "Afternoon",
    "ei.added.google": "Added {n} exams from your calendar",
    "ei.added.googleOne": "Added 1 exam from your calendar",
    "ei.added.file": "Added {n} exams from your file",
    "ei.added.fileOne": "Added 1 exam from your file",
    "ei.added.body": "body",
    "ei.onlyMaybe.google": "Nothing was added yet",
    "ei.onlyMaybe.file": "Check these before they're added",
    "ei.none.google": "No exams found in your calendar",
    "ei.none.googleBody": "none body",
    "ei.none.file": "No exams found in that file",
    "ei.none.fileBody": "none file body",
    "ei.maybe.heading": "{n} events might be tests",
    "ei.maybe.headingOne": "1 event might be a test",
    "ei.moved": "{title} moved to {day} in your calendar",
  })[k] ?? k;

const exam = (title: string) => ({ id: title, title, date: "2027-05-04", time: null, workspaceId: "w", subject: "Biology", kind: "exam" as const });
const maybe = (title: string) => ({ source: "google" as const, eventId: title, title, date: "2027-05-04", time: null, start: null, end: null, workspaceId: null, kind: "exam" as const, reason: "unsure" as const });

test("times: a clock time, a session, or nothing for all-day", () => {
  assert.equal(timeLabel("13:30", t), "13:30");
  assert.equal(timeLabel("pm", t), "Afternoon");
  assert.equal(timeLabel(null, t), "");
  assert.equal(whenLabel("2027-05-04", "13:30", "en-GB", t), "Tue 4 May · 13:30");
  assert.equal(whenLabel("2027-05-04", "am", "en-GB", t), "Tue 4 May · Morning");
  assert.equal(whenLabel("2027-05-04", null, "en-GB", t), "Tue 4 May");
  assert.equal(whenLabel(null, null, "en-GB", t), "");
});

test("the summary headline says what was added, or that nothing was", () => {
  assert.equal(importHeadline({ source: "google", added: [exam("a"), exam("b"), exam("c"), exam("d")], suggested: [] }, t).title, "Added 4 exams from your calendar");
  assert.equal(importHeadline({ source: "ics", added: [exam("a")], suggested: [] }, t).title, "Added 1 exam from your file");
  assert.equal(importHeadline({ source: "file", added: [], suggested: [maybe("x")] }, t).title, "Check these before they're added");
  assert.deepEqual(importHeadline({ source: "google", added: [], suggested: [] }, t), { title: "No exams found in your calendar", body: "none body" });
});

test("the planner's note after a calendar read", () => {
  assert.deepEqual(syncNote({ added: [exam("a"), exam("b"), exam("c")], suggested: [maybe("x")], moved: [] }, "en-GB", t), { text: "Added 3 exams from your calendar", action: "review" });
  assert.deepEqual(syncNote({ added: [], suggested: [maybe("x"), maybe("y")], moved: [] }, "en-GB", t), { text: "2 events might be tests", action: "check" });
  assert.deepEqual(syncNote({ added: [], suggested: [], moved: [{ id: "1", title: "Biology Paper 1", from: "2027-05-04", to: "2026-12-03" }] }, "en-GB", t), {
    text: "Biology Paper 1 moved to Thu 3 Dec in your calendar",
    action: null,
  });
  assert.equal(syncNote({ added: [], suggested: [], moved: [] }, "en-GB", t), null);
});

test("searching events matches every typed word", () => {
  const events = [{ title: "IB Biology HL Paper 1" }, { title: "Football" }, { title: "Biology revision" }];
  assert.deepEqual(filterEvents(events, "bio paper").map((e) => e.title), ["IB Biology HL Paper 1"]);
  assert.deepEqual(filterEvents(events, "  ").length, 3);
  assert.deepEqual(filterEvents(events, "chess"), []);
});
