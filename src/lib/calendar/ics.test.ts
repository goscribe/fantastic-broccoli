import { test } from "node:test";
import assert from "node:assert/strict";
import { CalendarParseError, looksLikeIcs, parseIcs } from "./ics";

// An invented school calendar export: nobody's real events.
const SAMPLE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Northfield Academy//Timetable//EN",
  "X-WR-CALNAME:Year 13 exams",
  "BEGIN:VEVENT",
  "UID:exam-bio-p1@northfield.example",
  "SUMMARY:IB Biology HL Paper 1",
  "DTSTART;TZID=Europe/London:20270504T133000",
  "DTEND;TZID=Europe/London:20270504T153000",
  "DESCRIPTION:Seat 14\\, bring a calculator. Invigilator: Mr Example",
  "LOCATION:Sports hall",
  "ATTENDEE;CN=Someone:mailto:someone@northfield.example",
  "BEGIN:VALARM",
  "TRIGGER:-PT30M",
  "DESCRIPTION:Reminder",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:exam-chem-mock@northfield.example",
  "SUMMARY:Chemistry mock exam",
  "DTSTART;VALUE=DATE:20270114",
  "DTEND;VALUE=DATE:20270115",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:study-leave@northfield.example",
  "SUMMARY:Study leave",
  "DTSTART;VALUE=DATE:20270501",
  "DTEND;VALUE=DATE:20270515",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:lesson-maths@northfield.example",
  "SUMMARY:Maths",
  "DTSTART:20260907T090000Z",
  "DTEND:20260907T100000Z",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "EXDATE:20261130T090000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:folded@northfield.example",
  "SUMMARY:History Paper 2 \; source",
  "  paper",
  "DTSTART:20270518T080000Z",
  "DURATION:PT1H30M",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled@northfield.example",
  "SUMMARY:Physics test",
  "STATUS:CANCELLED",
  "DTSTART:20270201T090000Z",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:past@northfield.example",
  "SUMMARY:Geography test",
  "DTSTART:20261001T090000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const NOW = new Date(2026, 10, 23, 10, 0, 0);

test("upcoming events come out with title, start/end and an opaque id only", () => {
  const { events, totalInFile } = parseIcs(SAMPLE, { windowStart: NOW });
  assert.equal(totalInFile, 7);
  assert.deepEqual(
    events.map((e) => [e.title, e.allDay, e.date ?? e.start, e.end, e.days, e.recurring]),
    [
      ["Chemistry mock exam", true, "2027-01-14", null, 1, false],
      ["Study leave", true, "2027-05-01", null, 14, false],
      // 13:30 in London in May is 12:30 UTC.
      ["IB Biology HL Paper 1", false, "2027-05-04T12:30:00.000Z", "2027-05-04T14:30:00.000Z", 1, false],
      ["History Paper 2 ; source paper", false, "2027-05-18T08:00:00.000Z", "2027-05-18T09:30:00.000Z", 1, false],
      // The weekly lesson is one row: its next occurrence.
      ["Maths", false, "2026-11-23T09:00:00.000Z", "2026-11-23T10:00:00.000Z", 1, true],
    ],
  );
  // Nothing but these fields exists on an event: no description, location or attendee.
  for (const e of events) assert.deepEqual(Object.keys(e).sort(), ["allDay", "date", "days", "end", "id", "recurring", "start", "title"]);
  assert.equal(JSON.stringify(events).includes("northfield"), false);
  assert.equal(JSON.stringify(events).includes("Seat 14"), false);
});

test("an event keeps its id when its date changes, so the planner can follow it", () => {
  const before = parseIcs(SAMPLE, { windowStart: NOW }).events.find((e) => e.title === "IB Biology HL Paper 1")!;
  const moved = parseIcs(SAMPLE.replace("20270504T133000", "20270506T090000").replace("20270504T153000", "20270506T110000"), { windowStart: NOW }).events.find(
    (e) => e.title === "IB Biology HL Paper 1",
  )!;
  assert.equal(moved.id, before.id);
  assert.equal(moved.start, "2027-05-06T08:00:00.000Z");
  const ids = parseIcs(SAMPLE, { windowStart: NOW }).events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("files that are not calendars, or hold no events, say so", () => {
  assert.throws(() => parseIcs("Subject,Date\nBiology,04/05/2027"), (e) => e instanceof CalendarParseError && e.reason === "not_ics");
  assert.throws(() => parseIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR"), (e) => e instanceof CalendarParseError && e.reason === "empty");
  // Once every dated event is in the past, only the endless weekly lesson is left.
  assert.deepEqual(parseIcs(SAMPLE, { windowStart: new Date(2029, 0, 1) }).events.map((e) => e.title), ["Maths"]);
  // An excluded occurrence (EXDATE 30 Nov) is skipped: the next one is a week later.
  assert.equal(parseIcs(SAMPLE, { windowStart: new Date(2026, 10, 24) }).events.find((e) => e.title === "Maths")!.start, "2026-12-07T09:00:00.000Z");
});

test("an .ics is recognised by name, type or content", () => {
  assert.equal(looksLikeIcs({ name: "exams.ics" }), true);
  assert.equal(looksLikeIcs({ name: "download", type: "text/calendar" }), true);
  assert.equal(looksLikeIcs({ name: "export.txt" }, "BEGIN:VCALENDAR\r\nVERSION:2.0"), true);
  assert.equal(looksLikeIcs({ name: "timetable.pdf", type: "application/pdf" }, "%PDF-1.4"), false);
});
