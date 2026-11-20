import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal browser stand-ins: attribution only touches window.location,
// window.localStorage, document.referrer and crypto.randomUUID.
const store = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = {
  location: { search: "", pathname: "/", hostname: "scribe.study" },
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};
g.document = { referrer: "" };

const { captureAttribution, getReferral, getSignupAttribution, rememberReferral } = await import("./attribution");
const win = g.window as { location: { search: string; pathname: string } };

beforeEach(() => {
  store.clear();
  win.location.search = "";
});

test("?ref= is captured and sent with signup alongside a device id", () => {
  win.location.search = "?ref=AbCd2345";
  captureAttribution();
  assert.equal(getReferral(), "abcd2345");
  const payload = getSignupAttribution();
  assert.equal(payload?.ref, "abcd2345");
  assert.match(payload?.deviceId ?? "", /^[0-9a-f-]{36}$/);
  // The device id is stable for this browser.
  assert.equal(getSignupAttribution()?.deviceId, payload?.deviceId);
});

test("the first invite wins and junk codes are ignored", () => {
  rememberReferral("../../etc");
  assert.equal(getReferral(), undefined);
  rememberReferral("first234");
  rememberReferral("second23");
  assert.equal(getReferral(), "first234");
});

test("an invite older than 30 days is no longer credited", () => {
  store.set("scribe_ref_v1", JSON.stringify({ ref: "oldcode1", at: Date.now() - 31 * 24 * 3600 * 1000 }));
  assert.equal(getReferral(), undefined);
});

test("campaign attribution still rides along with the ref", () => {
  win.location.search = "?utm_source=tiktok&ref=mixd2345";
  captureAttribution();
  const payload = getSignupAttribution();
  assert.equal(payload?.utmSource, "tiktok");
  assert.equal(payload?.ref, "mixd2345");
});
