import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKOUT_REFRESH_DELAYS_MS, checkoutReturn } from "./checkout-return";

test("a finished checkout is reported as waiting for confirmation, never as paid or subscribed", () => {
  const out = checkoutReturn("success");
  assert.equal(out?.kind, "finished");
  assert.match(out!.message, /once the payment provider confirms/);
  assert.doesNotMatch(out!.message, /subscribed|you're on|you are on|payment received|thank/i);
});

test("a closed checkout points at the current plan and does not claim nothing was started or charged", () => {
  assert.deepEqual(checkoutReturn("cancelled"), {
    kind: "closed",
    message: "Checkout closed. Check your current plan below.",
  });
  assert.doesNotMatch(checkoutReturn("cancelled")!.message, /no plan|not charged|nothing was|no charge|cancelled/i);
});

test("no provider is named, so the copy holds for Stripe and Airwallex", () => {
  for (const p of ["success", "cancelled"]) {
    assert.doesNotMatch(checkoutReturn(p)!.message, /stripe|airwallex/i);
  }
});

test("anything else in the URL shows nothing", () => {
  for (const p of [null, undefined, "", "paid", "SUCCESS", "success "]) assert.equal(checkoutReturn(p), null);
});

test("the plan is re-read a few times after either return, then left alone", () => {
  assert.deepEqual([...CHECKOUT_REFRESH_DELAYS_MS], [3000, 10000, 30000]);
});
