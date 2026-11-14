import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDisconnectNotice, calendarReturnNotice } from "./calendar-messages";

const PERMISSIONS = "https://myaccount.google.com/permissions";

test("connect return: each server result has its own wording; cancelled and no result are silent", () => {
  assert.equal(calendarReturnNotice(null), null);
  assert.equal(calendarReturnNotice("cancelled"), null);
  assert.equal(calendarReturnNotice("connected")?.tone, "success");
  assert.match(calendarReturnNotice("unconfigured")!.text, /isn't set up/);
  assert.match(calendarReturnNotice("failed")!.text, /Couldn't connect/);
});

test("connect return: missing permission says the calendar is not connected and how to fix it", () => {
  const n = calendarReturnNotice("permission_missing")!;
  assert.equal(n.tone, "error");
  assert.match(n.text, /not connected/);
  assert.match(n.text, /Connect again/);
  assert.notEqual(n.text, calendarReturnNotice("failed")!.text);
});

test("disconnect: a confirmed revoke says so and warns about the next Google sign-in", () => {
  const n = calendarDisconnectNotice({ ok: true, revoked: true });
  assert.equal(n.tone, "success");
  assert.match(n.text, /access was removed at Google/);
  assert.match(n.text, /sign in with Google/);
  assert.equal(n.manualRevokeUrl, undefined);
});

test("disconnect: an unconfirmed revoke never claims removal at Google and offers the manual link", () => {
  const n = calendarDisconnectNotice({ ok: true, revoked: false, manualRevokeUrl: PERMISSIONS });
  assert.equal(n.tone, "info");
  assert.match(n.text, /Disconnected from Scribe/);
  assert.match(n.text, /didn't confirm/);
  assert.doesNotMatch(n.text, /was removed at Google/);
  assert.equal(n.manualRevokeUrl, PERMISSIONS);
});

test("disconnect: an unconfirmed revoke without a usable link still makes no claim and offers no action", () => {
  for (const manualRevokeUrl of [undefined, null, "", "javascript:alert(1)", "http://myaccount.google.com/permissions", "https://google.com.evil.example/permissions"]) {
    const n = calendarDisconnectNotice({ ok: true, revoked: false, manualRevokeUrl });
    assert.doesNotMatch(n.text, /was removed at Google/);
    assert.equal(n.manualRevokeUrl, undefined);
  }
});

test("disconnect: a server without the revoked flag makes no claim about Google", () => {
  const n = calendarDisconnectNotice({ ok: true });
  assert.equal(n.text, "Google Calendar disconnected from Scribe.");
  assert.doesNotMatch(n.text, /Google didn't|removed at Google/);
});
