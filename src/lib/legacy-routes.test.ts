import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../next.config";

test("/courses/<subject> redirects to the subject page; /courses itself stays", async () => {
  const rules = (await nextConfig.redirects?.()) ?? [];
  const rule = rules.find((r) => r.source === "/courses/:workspaceId");
  assert.ok(rule, "redirect rule exists");
  assert.equal(rule.destination, "/workspace/:workspaceId");
  assert.equal(rule.permanent, true);
  // The pattern is one segment: /courses (the picker) does not match it.
  assert.ok(!rules.some((r) => r.source === "/courses" || r.source.startsWith("/courses/:path")));
});
