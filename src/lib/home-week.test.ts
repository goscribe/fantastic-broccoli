import { test } from "node:test";
import assert from "node:assert/strict";
import { isEmptyWeek, localYmd, plannedLabel, slotHref, weekCells, weekDates, weekdayOf } from "./home-week";

test("weekDates: Monday to Sunday around today", () => {
  assert.deepEqual(weekDates("2026-11-21"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  // Sunday belongs to the week that started the Monday before.
  assert.equal(weekDates("2026-11-22")[0], "2026-11-16");
  assert.equal(weekDates("2026-11-16")[0], "2026-11-16");
  assert.equal(weekdayOf("2026-11-16"), 0);
  assert.equal(weekdayOf("2026-11-22"), 6);
});

test("weekCells: planner days in order, minutes and links, today and past marked", () => {
  const input = weekDates("2026-11-21").map((date) => ({ date, slots: [] as { id: string; kind: "session" | "review"; title: string; start: number; end: number; sessionId?: string; workspaceId?: string }[] }));
  input[5].slots.push({ id: "b", kind: "review", title: "Flashcards", start: 1080, end: 1095 });
  input[5].slots.push({ id: "a", kind: "session", title: "Cell transport", start: 1020, end: 1040, sessionId: "s3", workspaceId: "w1" });
  input[6].slots.push({ id: "c", kind: "session", title: "Bonding", start: 960, end: 990 });
  const cells = weekCells("2026-11-21", input);
  assert.equal(cells.length, 7);
  assert.equal(cells[5].isToday, true);
  assert.equal(cells[4].past, true);
  assert.equal(cells[6].past, false);
  assert.equal(cells[5].minutes, 35);
  assert.deepEqual(cells[5].items.map((i) => [i.time, i.title, i.href]), [
    ["17:00", "Cell transport", "/workspace/w1/session/s3"],
    ["18:00", "Flashcards", "/flashcards/review"],
  ]);
  assert.equal(cells[6].items[0].href, "/planner");
  assert.equal(cells[6].day, 22);
});

test("weekCells: before the planner answers, the week is drawn from today alone", () => {
  const cells = weekCells("2026-11-21", null);
  assert.equal(cells.length, 7);
  assert.equal(cells[0].date, "2026-11-16");
  assert.ok(cells.every((c) => c.items.length === 0 && c.minutes === 0));
  assert.equal(cells.filter((c) => c.isToday).length, 1);
});

test("isEmptyWeek: only a loaded week with nothing in it", () => {
  assert.equal(isEmptyWeek(undefined), false);
  assert.equal(isEmptyWeek([{ date: "2026-11-16", slots: [] }]), true);
  assert.equal(isEmptyWeek([{ date: "2026-11-16", slots: [{ id: "x", kind: "session", title: "t", start: 0, end: 30 }] }]), false);
});

test("plannedLabel and slotHref", () => {
  assert.equal(plannedLabel(20), "20 min");
  assert.equal(plannedLabel(60), "1 h");
  assert.equal(plannedLabel(150), "2.5 h");
  assert.equal(slotHref({ kind: "session" }), "/planner");
  assert.equal(localYmd(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});
