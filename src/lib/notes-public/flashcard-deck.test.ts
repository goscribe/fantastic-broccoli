import { test } from "node:test";
import assert from "node:assert/strict";
import { cardId, checkCards, DECK_LIMITS, FREE_FLASHCARDS, isDeck, SAFE_ID, splitDeck } from "./flashcard-deck";

const card = (i: number, extra: Record<string, unknown> = {}) => ({ kind: "term", front: `What is term ${i}?`, back: `Term ${i} is a thing.`, hint: "", sectionId: "s1", ...extra });
const deck = (n: number) => Array.from({ length: n }, (_, i) => card(i + 1));

test("a good deck passes and gets stable, unique ids", () => {
  const { problems, cards } = checkCards(deck(10), ["s1"]);
  assert.deepEqual(problems, []);
  assert.equal(cards.length, 10);
  assert.equal(new Set(cards.map((c) => c.id)).size, 10);
  assert.equal(cards[0].id, cardId("What is term 1?"));
  assert.equal(cards[0].hint, undefined, "an empty hint is dropped");
});

test("deck size, lengths, kinds, maths and duplicates are reported", () => {
  assert.match(checkCards(deck(DECK_LIMITS.minCards - 1), ["s1"]).problems[0], /between/);
  const bad = [
    ...deck(8),
    card(20, { kind: "trivia" }),
    card(21, { back: "x".repeat(DECK_LIMITS.backMax + 1) }),
    card(22, { front: "Solve $x^2 = 4" }),
    card(1),
  ];
  const p = checkCards(bad, ["s1"]).problems.join("\n");
  assert.match(p, /Card 9: kind/);
  assert.match(p, /Card 10: back is/);
  assert.match(p, /Card 11: unbalanced \$/);
  assert.match(p, /Card 12: duplicate/);
});

test("a hint that gives the answer away is reported; an unknown section is dropped", () => {
  const r = checkCards([...deck(8), card(30, { back: "Velocity", hint: "It is velocity" }), card(31, { sectionId: "s9" })], ["s1"]);
  assert.match(r.problems.join("\n"), /Card 9: the hint gives the answer away/);
  assert.equal(r.cards[9].sectionId, undefined);
});

test("visitors get the free cards; signed-in learners the whole deck", () => {
  const all = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(splitDeck(all, false), { open: all.slice(0, FREE_FLASHCARDS), lockedCount: all.length - FREE_FLASHCARDS });
  assert.deepEqual(splitDeck(all, true), { open: all, lockedCount: 0 });
  assert.deepEqual(splitDeck([1, 2], false), { open: [1, 2], lockedCount: 0 });
});

test("ids that could leave the deck folder are refused", () => {
  assert.ok(SAFE_ID.test("ib-physics") && SAFE_ID.test("a-1"));
  for (const bad of ["../x", "a/b", "", ".hidden", "A-1"]) assert.ok(!SAFE_ID.test(bad), bad);
});

test("isDeck accepts a written deck and rejects junk", () => {
  const ok = { schemaVersion: 1, courseId: "c", topicId: "t", topicCode: "1", topicName: "T", noteVersion: 1, model: "m", generatedAt: "", cards: [{ id: "a", kind: "term", front: "f", back: "b" }] };
  assert.ok(isDeck(ok));
  assert.ok(!isDeck({ ...ok, schemaVersion: 2 }));
  assert.ok(!isDeck({ ...ok, cards: [{ front: 1 }] }));
  assert.ok(!isDeck(null));
});

test("LaTeX mangled by a single JSON backslash (\\frac → form feed + 'rac') is reported", () => {
  const r = checkCards([...deck(8), card(40, { back: "Use $\frac{a}{b}$" })], ["s1"]);
  assert.match(r.problems.join("\n"), /Card 9: contains a control character/);
});
