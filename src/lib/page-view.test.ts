import { test } from "node:test";
import assert from "node:assert/strict";
import { pageViewFor, pageViewKey, routePattern } from "./page-view";

test("dynamic segments are replaced by their param names", () => {
  assert.equal(routePattern("/planner", {}), "/planner");
  assert.equal(routePattern("/", {}), "/");
  assert.equal(routePattern("/workspace/cmw123/study", { id: "cmw123" }), "/workspace/[id]/study");
  assert.equal(
    routePattern("/workspace/cmw123/session/cms456", { id: "cmw123", sessionId: "cms456" }),
    "/workspace/[id]/session/[sessionId]",
  );
  assert.equal(routePattern("/flashcards/42", { id: "42" }), "/flashcards/[id]");
});

test("two params with the same value each take one segment", () => {
  assert.equal(routePattern("/workspace/x/bank/x", { id: "x", itemId: "x" }), "/workspace/[id]/bank/[itemId]");
});

test("encoded and catch-all params are matched too", () => {
  assert.equal(routePattern("/landing/blog/caf%C3%A9-notes", { slug: "café-notes" }), "/landing/blog/[slug]");
  assert.equal(routePattern("/docs/a/b", { parts: ["a", "b"] }), "/docs/[parts]/[parts]");
});

test("a query string or fragment never makes it into the pattern", () => {
  assert.equal(routePattern("/marketplace?q=private+search#top", {}), "/marketplace");
});

test("subject pages carry their subject id separately; other pages carry none", () => {
  assert.deepEqual(pageViewFor("/workspace/cmw123/study", { id: "cmw123" }), {
    path: "/workspace/[id]/study",
    workspaceId: "cmw123",
  });
  assert.deepEqual(pageViewFor("/flashcards/42", { id: "42" }), { path: "/flashcards/[id]" });
  assert.deepEqual(pageViewFor("/planner", {}), { path: "/planner" });
});

test("the same page in another subject is a different page view; another session id is not", () => {
  const a = pageViewKey(pageViewFor("/workspace/a/study", { id: "a" }));
  const b = pageViewKey(pageViewFor("/workspace/b/study", { id: "b" }));
  assert.notEqual(a, b);
  assert.equal(
    pageViewKey(pageViewFor("/workspace/a/session/1", { id: "a", sessionId: "1" })),
    pageViewKey(pageViewFor("/workspace/a/session/2", { id: "a", sessionId: "2" })),
  );
});
