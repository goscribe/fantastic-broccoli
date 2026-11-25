import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { insideItems, isLocked, lockedBadge, lockedCountLabel, paywallHref, unlockLead } from "./gate";
import { LOCKED_SELECTOR, lockedPageJsonLd, topicDescription } from "./seo";
import type { LockedSummary } from "@/lib/api/public-notes";

const summary: LockedSummary = {
  locked: true,
  kind: "HL",
  sections: 4,
  shownSections: 1,
  questions: 10,
  shownQuestions: 2,
  workedExamples: 1,
  keyTerms: 5,
  figures: 0,
  recall: 5,
};

describe("notes paid gate copy", () => {
  test("isLocked only for a locked summary", () => {
    assert.equal(isLocked(undefined), false);
    assert.equal(isLocked({ locked: false }), false);
    assert.equal(isLocked(summary), true);
  });

  test("counts read naturally", () => {
    assert.equal(lockedCountLabel(12, "HL"), "12 HL topics with a plan");
    assert.equal(lockedCountLabel(1, "A_LEVEL"), "1 second-year A-level topic with a plan");
    assert.equal(lockedCountLabel(3, "PLAN"), "3 topics with a plan");
    assert.equal(lockedBadge("HL"), "HL · with a plan");
  });

  test("what's inside lists only what is hidden", () => {
    assert.deepEqual(insideItems(summary), [
      "3 more sections of the note",
      "1 worked example",
      "5 key-term cards",
      "5 exam-style recall questions with mark schemes",
      "8 more practice questions with worked answers",
    ]);
    assert.deepEqual(insideItems({ ...summary, sections: 1, workedExamples: 0, keyTerms: 0, recall: 0, questions: 2 }), []);
  });

  test("lead and paywall link", () => {
    assert.match(unlockLead("HL"), /^HL topics .* stays free\.$/);
    assert.match(unlockLead("A_LEVEL"), /^Second-year A-level topics/);
    assert.equal(paywallHref("ib-biology", "a2-1"), "/pricing?from=notes_unlock&course=ib-biology&topic=a2-1");
  });
});

describe("locked page SEO", () => {
  test("paywall markup points at the unlock panel and says it is not free", () => {
    const ld = lockedPageJsonLd({ siteUrl: "https://scribe.study", path: "/notes/ib-biology/x", title: "T", locale: "en-GB" });
    assert.equal(ld.isAccessibleForFree, false);
    assert.equal(ld.hasPart["@type"], "WebPageElement");
    assert.equal(ld.hasPart.isAccessibleForFree, false);
    assert.equal(ld.hasPart.cssSelector, LOCKED_SELECTOR);
    assert.match(LOCKED_SELECTOR, /^\.[a-z-]+$/, "Google allows class selectors only");
  });

  test("a locked description does not promise everything free", () => {
    const t = { code: "A2.1", name: "Origins of cells", objectives: ["Explain how cells arose"] };
    const d = topicDescription({ title: "IB Biology" }, t, true, 10, true);
    assert.ok(!d.includes("Free, no sign-up"));
    assert.match(d, /first section and try 2 practice questions free/);
    assert.ok(d.length <= 158);
    assert.match(topicDescription({ title: "IB Biology" }, t, true, 10), /Free, no sign-up/);
  });
});
