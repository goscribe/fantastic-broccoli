import { test } from "node:test";
import assert from "node:assert/strict";
import { DELETION_GRACE_DAYS, deletionDate, isDeletionConfirmed } from "./account-deletion";

test("the confirm button stays disabled until DELETE or the account email is typed", () => {
  for (const typed of ["", " ", "DELET", "DELETED", "delete me", "yes", "m@x.tes", "DELETE m@x.test"]) {
    assert.equal(isDeletionConfirmed(typed, "m@x.test"), false, JSON.stringify(typed));
  }
  for (const typed of ["DELETE", "delete", " Delete ", "m@x.test", "M@X.TEST", "  m@x.test  "]) {
    assert.equal(isDeletionConfirmed(typed, "m@x.test"), true, JSON.stringify(typed));
  }
});

test("without an email on file only the word confirms, and an empty email never matches", () => {
  for (const email of [undefined, null, "", "  "]) {
    assert.equal(isDeletionConfirmed("DELETE", email), true);
    assert.equal(isDeletionConfirmed("", email), false);
    assert.equal(isDeletionConfirmed("  ", email), false);
  }
});

test("permanent deletion is the server's 30 days after the request", () => {
  assert.equal(DELETION_GRACE_DAYS, 30);
  const at = new Date("2026-11-21T10:00:00Z");
  assert.equal(deletionDate(at).toISOString(), "2026-12-21T10:00:00.000Z");
});
