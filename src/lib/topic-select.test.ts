import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SELECTED_TOPICS, groupState, mixedSessionMinutes, pickSummary, selectedInOrder, toggleGroup, toggleTopic } from "./topic-select";

const ids = (n: number, prefix = "t") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

test("a tick adds a topic, a second tick removes it, and the set given is left alone", () => {
  const none: ReadonlySet<string> = new Set();
  const one = toggleTopic(none, "3-1");
  assert.deepEqual([...one.next], ["3-1"]);
  assert.equal(none.size, 0);
  const back = toggleTopic(one.next, "3-1");
  assert.equal(back.next.size, 0);
  assert.equal(back.capped, false);
});

test("a full selection takes no more, but still lets a topic go", () => {
  const full = new Set(ids(MAX_SELECTED_TOPICS));
  const more = toggleTopic(full, "extra");
  assert.equal(more.capped, true);
  assert.equal(more.next.size, MAX_SELECTED_TOPICS);
  assert.equal(more.next.has("extra"), false);
  const less = toggleTopic(full, "t1");
  assert.equal(less.capped, false);
  assert.equal(less.next.size, MAX_SELECTED_TOPICS - 1);
});

test("a unit's box is empty, part picked or ticked", () => {
  const unit = ["a", "b", "c"];
  assert.equal(groupState(unit, new Set()), "none");
  assert.equal(groupState(unit, new Set(["b", "z"])), "some");
  assert.equal(groupState(unit, new Set(["a", "b", "c", "z"])), "all");
  assert.equal(groupState([], new Set(["a"])), "none");
});

test("a unit's box picks the rest of the unit, and clears a unit that is all picked", () => {
  const unit = ["a", "b", "c"];
  const rest = toggleGroup(new Set(["b", "z"]), unit);
  assert.deepEqual([...rest.next].sort(), ["a", "b", "c", "z"]);
  assert.equal(rest.capped, false);
  const cleared = toggleGroup(rest.next, unit);
  assert.deepEqual([...cleared.next], ["z"]);
});

test("a unit that does not fit is picked from the top until the selection is full", () => {
  const have = new Set(ids(MAX_SELECTED_TOPICS - 2, "x"));
  const out = toggleGroup(have, ["a", "b", "c", "d"]);
  assert.equal(out.capped, true);
  assert.equal(out.next.size, MAX_SELECTED_TOPICS);
  assert.equal(out.next.has("a") && out.next.has("b"), true);
  assert.equal(out.next.has("c") || out.next.has("d"), false);
  // Nothing fits: nothing changes, and it says so.
  const none = toggleGroup(new Set(ids(MAX_SELECTED_TOPICS, "x")), ["a"]);
  assert.equal(none.capped, true);
  assert.equal(none.next.size, MAX_SELECTED_TOPICS);
});

test("the start sends the picked topics in the list's order, without ones no longer listed", () => {
  const units = [{ topics: [{ id: "1-1" }, { id: "1-2" }] }, { topics: [{ id: "3-1" }, { id: "3-2" }] }];
  assert.deepEqual(selectedInOrder(units, new Set(["3-2", "gone", "1-2", "3-1"])), ["1-2", "3-1", "3-2"]);
});

test("a mixed session runs 15 to 45 minutes by the number of topics", () => {
  assert.deepEqual([1, 2, 3, 4, 8, 20].map(mixedSessionMinutes), [15, 15, 20, 25, 45, 45]);
});

const course = [
  { topics: ids(8, "a").map((id) => ({ id })) },
  { topics: ids(9, "b").map((id) => ({ id })) },
  { topics: ids(7, "c").map((id) => ({ id })) },
];
const unitIds = (i: number) => course[i].topics.map((t) => t.id);

test("whole units ticked one after another add up, and the first stays picked", () => {
  let picked: ReadonlySet<string> = new Set();
  picked = toggleGroup(picked, unitIds(2), Infinity).next;
  picked = toggleGroup(picked, unitIds(0), Infinity).next;
  assert.equal(groupState(unitIds(0), picked), "all");
  assert.equal(groupState(unitIds(1), picked), "none");
  assert.equal(groupState(unitIds(2), picked), "all");
  const sum = pickSummary(course, picked);
  assert.equal(sum.ids.length, 15);
  assert.equal(sum.unitCount, 2);
  assert.equal(sum.over, false);
  // Syllabus order, not the order the units were ticked in.
  assert.deepEqual(sum.startIds, [...unitIds(0), ...unitIds(2)]);
});

test("a topic unticked inside a ticked unit leaves a dash there and the other unit alone", () => {
  let picked = toggleGroup(new Set<string>(), unitIds(0), Infinity).next;
  picked = toggleGroup(picked, unitIds(1), Infinity).next;
  picked = toggleTopic(picked, "b4", Infinity).next;
  assert.equal(groupState(unitIds(0), picked), "all");
  assert.equal(groupState(unitIds(1), picked), "some");
  const sum = pickSummary(course, picked);
  assert.equal(sum.ids.length, 16);
  assert.equal(sum.unitCount, 2);
  assert.equal(sum.ids.includes("b4"), false);
});

test("a single topic in one unit and a whole other unit count as two units", () => {
  let picked = toggleTopic(new Set<string>(), "c2", Infinity).next;
  picked = toggleGroup(picked, unitIds(0), Infinity).next;
  assert.deepEqual(pickSummary(course, picked).ids, [...unitIds(0), "c2"]);
  assert.equal(pickSummary(course, picked).unitCount, 2);
  // The dashed unit's box pressed fills it; pressed again clears it and nothing else.
  picked = toggleGroup(picked, unitIds(2), Infinity).next;
  assert.equal(groupState(unitIds(2), picked), "all");
  picked = toggleGroup(picked, unitIds(2), Infinity).next;
  assert.deepEqual(pickSummary(course, picked).ids, unitIds(0));
  assert.equal(pickSummary(course, picked).unitCount, 1);
});

test("more than one session takes: every pick is kept, and the session starts on the first 20 in syllabus order", () => {
  let picked: ReadonlySet<string> = new Set();
  for (const i of [2, 1, 0]) {
    const change = toggleGroup(picked, unitIds(i), Infinity);
    assert.equal(change.capped, false);
    picked = change.next;
  }
  const sum = pickSummary(course, picked);
  assert.equal(sum.ids.length, 24);
  assert.equal(sum.unitCount, 3);
  assert.equal(sum.over, true);
  assert.equal(sum.startIds.length, MAX_SELECTED_TOPICS);
  assert.deepEqual(sum.startIds, [...unitIds(0), ...unitIds(1), "c1", "c2", "c3"]);
});

test("exactly the cap is not over, and nothing picked is an empty summary", () => {
  const twenty = new Set([...unitIds(0), ...unitIds(1), "c1", "c2", "c3"]);
  assert.equal(pickSummary(course, twenty).over, false);
  assert.equal(pickSummary(course, twenty).startIds.length, 20);
  assert.deepEqual(pickSummary(course, new Set()), { ids: [], unitCount: 0, startIds: [], over: false });
});

test("picks for topics the level no longer lists do not count", () => {
  const picked = new Set(["a1", "b2", "hl-only-9"]);
  const sum = pickSummary(course.slice(0, 1), picked);
  assert.deepEqual(sum.ids, ["a1"]);
  assert.equal(sum.unitCount, 1);
});
