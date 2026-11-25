import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKOUT_UNAVAILABLE_LINE, checkoutFailure, errorCode, landingAfterCheckout } from "./checkout-failure";
import { checkoutReturn } from "./checkout-return";

/** A tRPC client error as the transport throws it. */
const trpcError = (code: string, message: string) => Object.assign(new Error(message), { data: { code, httpStatus: 500 } });

test("a provider failure never shows the provider's words: one friendly line, Stripe and Airwallex alike", () => {
  for (const err of [
    trpcError("INTERNAL_SERVER_ERROR", "Your account cannot currently make live charges."),
    trpcError("SERVICE_UNAVAILABLE", "We couldn't start checkout just now."),
    trpcError("INTERNAL_SERVER_ERROR", "Insufficient permissions"),
    trpcError("PRECONDITION_FAILED", "Paid plans are coming soon."),
    new TypeError("Failed to fetch"),
    "weird",
    null,
  ]) {
    assert.deepEqual(checkoutFailure(err), { kind: "unavailable", message: CHECKOUT_UNAVAILABLE_LINE });
  }
  assert.equal(CHECKOUT_UNAVAILABLE_LINE, "Payment isn't available right now — you can keep studying free");
});

test("the student's own case keeps the server's words; signed out asks to sign in", () => {
  assert.deepEqual(checkoutFailure(trpcError("BAD_REQUEST", "You already have a paid plan.")), { kind: "answer", message: "You already have a paid plan." });
  assert.equal(checkoutFailure(trpcError("CONFLICT", "Checkout is already opening. Try again in a moment.")).kind, "answer");
  assert.equal(checkoutFailure(trpcError("BAD_REQUEST", "")).kind, "unavailable");
  assert.equal(checkoutFailure(trpcError("UNAUTHORIZED", "UNAUTHORIZED")).kind, "signin");
  assert.equal(errorCode({ shape: { data: { code: "CONFLICT" } } }), "CONFLICT");
});

test("no subject yet: straight into the first run; already studying, or unknown: stay", () => {
  assert.equal(landingAfterCheckout(0), "/");
  assert.equal(landingAfterCheckout(2), null);
  assert.equal(landingAfterCheckout(null), null);
});

test("the hosted checkout sending the student back failed reads as the same friendly line", () => {
  assert.deepEqual(checkoutReturn("failed"), { kind: "failed", message: CHECKOUT_UNAVAILABLE_LINE });
  assert.deepEqual(checkoutReturn("error"), { kind: "failed", message: CHECKOUT_UNAVAILABLE_LINE });
  assert.doesNotMatch(checkoutReturn("failed")!.message, /stripe|airwallex|charges|permission/i);
});
