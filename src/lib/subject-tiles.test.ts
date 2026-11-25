import { test } from "node:test";
import assert from "node:assert/strict";
import { byRecentActivity, repeatsTitle, titleHints } from "./subject-tiles";

test("repeatsTitle: a session named after its subject adds nothing", () => {
  assert.equal(repeatsTitle("B4 Thermodynamics Guide +3", "B4 Thermodynamics Guide +3"), true);
  assert.equal(repeatsTitle("A 2.1.5 Data Transmission", "a 2.1.5  data transmission"), true);
  assert.equal(repeatsTitle("Biology", "Biology: session 2"), true);
  // The server cuts long session titles off: still the same words.
  assert.equal(repeatsTitle("Cl1 T3 AAHL ChainProductQuotientToughQuestions", "Cl1 T3 AAHL ChainProductQuotien"), true);
  assert.equal(repeatsTitle("Biology", ""), true);
  assert.equal(repeatsTitle("Biology", null), true);
});

test("repeatsTitle: a real next step is kept", () => {
  assert.equal(repeatsTitle("Biology", "Cell transport"), false);
  assert.equal(repeatsTitle("A 2.1.2 Modern Digital Infrastructures (2)", "10 Sept 20:38 Study session"), false);
  assert.equal(repeatsTitle("Biology and chemistry", "Bio"), false);
  assert.equal(repeatsTitle("", "Osmosis"), false);
});

test("byRecentActivity: newest activity first, sessions count, ties keep their order", () => {
  const ws = [
    { id: "a", createdAt: "2026-01-01T00:00:00Z" },
    { id: "b", createdAt: "2026-03-01T00:00:00Z" },
    { id: "c", createdAt: "2026-01-01T00:00:00Z" },
    { id: "d", createdAt: "2026-01-01T00:00:00Z" },
  ];
  const sessions = [
    { workspaceId: "d", updatedAt: "2026-06-01T00:00:00Z" },
    { workspaceId: "zz", updatedAt: "2027-01-01T00:00:00Z" },
  ];
  assert.deepEqual(byRecentActivity(ws, sessions).map((w) => w.id), ["d", "b", "a", "c"]);
  assert.deepEqual(byRecentActivity(ws, []).map((w) => w.id), ["b", "a", "c", "d"]);
  // Bad or missing dates sort last and never throw.
  assert.deepEqual(byRecentActivity([{ id: "x", createdAt: "nope" }, { id: "y" }, { id: "z", createdAt: "2026-01-01" }], []).map((w) => w.id), ["z", "x", "y"]);
});

test("titles that a tile cuts to the same text get the part that tells them apart", () => {
  const hints = titleHints([
    { id: "a", title: "B4 Thermodynamics Guide +3" },
    { id: "b", title: "B4 Thermodynamics Short Answer Questions" },
    { id: "c", title: "A 2.1.5 Data Transmission" },
    { id: "d", title: "Biology" },
  ]);
  assert.equal(hints.get("a"), "Guide +3");
  assert.equal(hints.get("b"), "Short Answer Questions");
  assert.equal(hints.has("c"), false, "unique in what the tile shows");
  assert.equal(hints.has("d"), false, "short titles are shown whole");
});

test("no hint for a title that is only the shared part, and case does not matter", () => {
  const hints = titleHints([
    { id: "a", title: "Cl1 AAHL T3 Differentiation" },
    { id: "b", title: "CL1 AAHL T3 differentiation tangents" },
  ]);
  assert.equal(hints.has("a"), false);
  assert.equal(hints.get("b"), "tangents");
});
