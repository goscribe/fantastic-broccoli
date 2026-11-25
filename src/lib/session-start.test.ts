import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handOffCta, isNoMaterialsError } from "./session-start";

describe("Quick 5 hand-off button", () => {
  it("finishes the full session already made", () => {
    assert.deepEqual(handOffCta({ hasFullSession: true, nextTitle: "1.2 Competitive markets" }), { key: "session.quick5FinishCta" });
  });
  it("names the course's next topic, which is what the start opens", () => {
    assert.deepEqual(handOffCta({ hasFullSession: false, nextTitle: "1.2 Competitive markets" }), {
      key: "session.quick5NextCta",
      topic: "1.2 Competitive markets",
    });
  });
  it("is today's session for a subject without a course (or before the next topic is known)", () => {
    assert.deepEqual(handOffCta({ hasFullSession: false, nextTitle: null }), { key: "session.quick5StartCta" });
    assert.deepEqual(handOffCta({ hasFullSession: false, nextTitle: "  " }), { key: "session.quick5StartCta" });
  });
});

describe("isNoMaterialsError", () => {
  it("recognises the server's refusal for a subject with nothing to plan from", () => {
    const err = new Error(
      "This workspace has no analyzed materials yet. Upload materials or pick a subject so we know what to plan the session around.",
    );
    assert.equal(isNoMaterialsError(err), true);
    assert.equal(isNoMaterialsError(new Error("Couldn't start")), false);
    assert.equal(isNoMaterialsError("This workspace has no analyzed materials yet."), false);
  });
});
