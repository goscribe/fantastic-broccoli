import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

// A bare window: the modules only dispatch events on it.
(globalThis as { window?: EventTarget }).window ??= new EventTarget();

const { PLAN_LIMIT_EVENT, refusalToast } = await import("./plan-limit");
const { surfaceRefusal } = await import("./refusals");

const shown: string[] = [];
refusalToast.show = (message: string) => void shown.push(message);
beforeEach(() => {
  shown.length = 0;
});

const capMessage = (n: number) =>
  `Free plan limit reached: the free plan includes ${n} workspaces. Upgrade (from $5/mo) for unlimited workspaces.`;

test("a plan-limit refusal the subscribe wall claims opens the wall, without a toast", () => {
  const seen: string[] = [];
  const claim = (event: Event) => {
    event.preventDefault();
    seen.push((event as CustomEvent<string>).detail);
  };
  window.addEventListener(PLAN_LIMIT_EVENT, claim);
  try {
    surfaceRefusal("workspace.create", capMessage(2), "FORBIDDEN");
  } finally {
    window.removeEventListener(PLAN_LIMIT_EVENT, claim);
  }
  assert.deepEqual(seen, [capMessage(2)]);
  assert.deepEqual(shown, []);
});

test("a plan-limit refusal nobody claims (no wall mounted) still shows the server's message", () => {
  surfaceRefusal("studySession.create", capMessage(3), "FORBIDDEN");
  assert.deepEqual(shown, [capMessage(3)]);
});

test("running out of tokens counts as a plan limit on any path", () => {
  const msg = "Not enough tokens for flashcards (needs 10, you have 4). Upgrade your plan.";
  surfaceRefusal("flashcards.generateFromPrompt", msg, "FORBIDDEN");
  assert.deepEqual(shown, [msg]);
});

test("the same refusal surfaced twice in a row (transport + call site) is shown once", () => {
  surfaceRefusal("workspace.create", capMessage(4), "FORBIDDEN");
  surfaceRefusal("workspace.create", capMessage(4), "FORBIDDEN");
  assert.equal(shown.length, 1);
});

test("other refusals on subject, session and upload paths show the server's message", () => {
  surfaceRefusal("workspace.create", "Please verify your email to create more workspaces", "FORBIDDEN");
  surfaceRefusal(
    "workspace.uploadAndAnalyzeMediaConcurrent",
    "Free AI generation from this network has hit today's limit.",
    "TOO_MANY_REQUESTS",
  );
  surfaceRefusal("workspace.uploadFiles", "Storage limit reached for your plan.", "FORBIDDEN");
  assert.equal(shown.length, 3);
});

test("validation errors and unrelated paths are left to the caller", () => {
  surfaceRefusal("workspace.create", "Name is required", "BAD_REQUEST");
  surfaceRefusal("workspace.update", "You do not have access", "FORBIDDEN");
  surfaceRefusal("workspace.create", undefined, "FORBIDDEN");
  assert.deepEqual(shown, []);
});
