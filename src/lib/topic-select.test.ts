import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SELECTED_TOPICS, groupState, mixedSessionMinutes, selectedInOrder, toggleGroup, toggleTopic } from "./topic-select";

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
