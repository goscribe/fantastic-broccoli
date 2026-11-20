import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSendTimezone } from "./timezone-sync";

test("sends when the server has no timezone yet", () => {
  assert.equal(shouldSendTimezone("Europe/Berlin", null, null, "u1"), true);
  assert.equal(shouldSendTimezone("Europe/Berlin", undefined, null, "u1"), true);
});

test("sends when the learner moved (server zone differs)", () => {
  assert.equal(shouldSendTimezone("Asia/Manila", "Europe/Berlin", null, "u1"), true);
});

test("doesn't send when the server already has it", () => {
  assert.equal(shouldSendTimezone("Europe/Berlin", "Europe/Berlin", null, "u1"), false);
});

test("sends once per app session per user and zone", () => {
  assert.equal(shouldSendTimezone("Europe/Berlin", null, "u1:Europe/Berlin", "u1"), false);
  // Another account signed in on the same tab.
  assert.equal(shouldSendTimezone("Europe/Berlin", null, "u1:Europe/Berlin", "u2"), true);
});

test("never sends an unknown zone", () => {
  assert.equal(shouldSendTimezone(undefined, null, null, "u1"), false);
});
