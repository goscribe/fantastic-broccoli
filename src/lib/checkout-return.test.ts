import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKOUT_REFRESH_DELAYS_MS, checkoutReturn } from "./checkout-return";

test("a finished checkout is reported as waiting for confirmation, never as paid or subscribed", () => {
  const out = checkoutReturn("success");
  assert.equal(out?.kind, "pending");
  assert.equal(out?.refresh, true);
  assert.match(out!.message, /once the payment provider confirms/);
  assert.doesNotMatch(out!.message, /subscribed|you're on|you are on|payment received|thank/i);
});

test("a closed checkout says no plan was started and triggers no refresh", () => {
  assert.deepEqual(checkoutReturn("cancelled"), {
    kind: "cancelled",
    message: "Checkout closed. No plan was started.",
    refresh: false,
  });
});

test("no provider is named, so the copy holds for Stripe and Airwallex", () => {
  for (const p of ["success", "cancelled"]) {
    assert.doesNotMatch(checkoutReturn(p)!.message, /stripe|airwallex/i);
  }
});

test("anything else in the URL shows nothing", () => {
  for (const p of [null, undefined, "", "paid", "SUCCESS", "success "]) assert.equal(checkoutReturn(p), null);
});

test("the plan is re-read a few times, then left alone", () => {
  assert.deepEqual([...CHECKOUT_REFRESH_DELAYS_MS], [3000, 10000, 30000]);
});
