import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attemptIdFromRedirect,
  decodePendingTry,
  encodePendingTry,
  isTryTool,
  pasteReady,
  safeRedirect,
  scoreTone,
  topicReady,
  tryMessage,
  tryRefusalOf,
  trySignupHref,
} from "./try";

test("refusals are read off the server's message prefix", () => {
  assert.equal(tryRefusalOf("anon_browser_limit: You've used today's free tries."), "anon_browser_limit");
  assert.equal(tryRefusalOf("anon_captcha_required: Please confirm"), "anon_captcha_required");
  assert.equal(tryRefusalOf("Type a topic to start."), null);
  assert.equal(tryRefusalOf(undefined), null);
  assert.equal(tryMessage("anon_budget: Today's free tries are used up."), "Today's free tries are used up.");
  assert.equal(tryMessage("Plain message: with a colon"), "Plain message: with a colon");
});

test("signup goes back to the same quiz's results", () => {
  assert.equal(trySignupHref("ck123"), "/signup?redirect=%2Ftry%2Fck123&from=try");
  assert.equal(trySignupHref("ck123", { login: true, ref: "abc123" }), "/login?redirect=%2Ftry%2Fck123&from=try&ref=abc123");
  assert.equal(attemptIdFromRedirect("/try/ck123?signup=1"), "ck123");
  assert.equal(attemptIdFromRedirect("/workspace/x"), null);
});

test("redirects stay on this site", () => {
  assert.equal(safeRedirect("/try/a"), "/try/a");
  assert.equal(safeRedirect("//evil.example"), "/");
  assert.equal(safeRedirect("/\\evil.example"), "/");
  assert.equal(safeRedirect("https://evil.example"), "/");
  assert.equal(safeRedirect(null), "/");
});

test("input readiness matches the server's limits", () => {
  assert.equal(topicReady(" a "), false);
  assert.equal(topicReady("AP Bio"), true);
  assert.equal(pasteReady("short"), false);
  assert.equal(pasteReady("x".repeat(40)), true);
});

test("pending claims expire after 7 days and reject junk", () => {
  const now = Date.now();
  assert.equal(decodePendingTry(encodePendingTry("ck1", now), now), "ck1");
  assert.equal(decodePendingTry(encodePendingTry("ck1", now - 8 * 86_400_000), now), null);
  assert.equal(decodePendingTry('{"id":"../x","at":1}', now), null);
  assert.equal(decodePendingTry("nope", now), null);
});

test("tools and score tones", () => {
  assert.equal(isTryTool("pdf-to-quiz"), true);
  assert.equal(isTryTool("pricing"), false);
  assert.equal(scoreTone(5, 5), "great");
  assert.equal(scoreTone(3, 5), "good");
  assert.equal(scoreTone(1, 5), "keep");
});
