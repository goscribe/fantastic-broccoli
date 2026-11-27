import { test } from "node:test";
import assert from "node:assert/strict";
import { confidenceSkipKey, difficultyResults, quick5Path, quick5SaidGot } from "./quick5-confidence";

test("the answer's band matches the server's mix (0-4 gentle, 5-7 mixed, 8-10 hard)", () => {
  assert.deepEqual([0, 2, 4, 5, 7, 8, 9, 10].map(quick5Path), ["gentle", "gentle", "gentle", "mixed", "mixed", "hard", "hard", "hard"]);
});

test("skip is remembered per subject: the question is asked once per subject", () => {
  assert.equal(confidenceSkipKey({ workspaceId: "ws1" }), "subject:ws1");
});

test("a Quick 5 shows its own score out of 5; the verdict still compares on one scale", () => {
  assert.deepEqual(quick5SaidGot(7, 3, 5), { said: 7, got: 3, of: 5, verdict: "asExpected" });
  assert.deepEqual(quick5SaidGot(9, 2, 5), { said: 9, got: 2, of: 5, verdict: "tougher" });
  assert.deepEqual(quick5SaidGot(2, 4, 5), { said: 2, got: 4, of: 5, verdict: "better" });
  assert.equal(quick5SaidGot(null, 3, 5), null);
  assert.equal(quick5SaidGot(5, 0, 0), null);
});

const q = (difficulty: string | undefined, correctIndex = 0) => ({ question: "q", options: ["a", "b", "c", "d"], correctIndex, explanation: "", ...(difficulty ? { difficulty } : {}) });

test("exam-level results count medium and hard answers, never the warm-up", () => {
  const activities = [
    {
      id: "a1",
      type: "mcq",
      content: { questions: [q("easy"), q("medium"), q("medium"), q("hard"), q("hard")] },
      draft: { answersByQ: [1, 0, 0, 0, 2] },
    },
  ];
  assert.deepEqual(difficultyResults(activities), { examLevel: { right: 3, total: 4 }, hard: { right: 1, total: 2 } });
  // Unanswered questions are left out; the draft from local storage wins over the server's.
  assert.deepEqual(
    difficultyResults(activities, () => ({ answersByQ: [0, 0, null, 1] })),
    { examLevel: { right: 1, total: 2 }, hard: { right: 0, total: 1 } },
  );
});

test("untagged questions (older Quick 5s, full sessions) give no exam-level line", () => {
  assert.equal(difficultyResults([{ id: "a", type: "mcq", content: { questions: [q(undefined)] }, draft: { answersByQ: [0] } }]), null);
  assert.equal(difficultyResults([]), null);
});
