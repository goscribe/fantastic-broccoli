/**
 * What the student sees when a checkout can't open or comes back unpaid.
 *
 * In production a checkout that failed at the provider (Stripe "Your account
 * cannot currently make live charges", Oct 23–Nov 13; Airwallex "Insufficient
 * permissions", Nov 21/23) showed the provider's raw message and left the
 * student on the pricing page: a dead end. Now any failure reads as one
 * friendly line, and a student with no subject yet goes straight into the
 * first run to start a free Quick 5. Answers that are the student's own case
 * (already subscribed, a checkout already opening) keep the server's words.
 *
 * Pure, so the rules are tested (checkout-failure.test.ts); the toast and the
 * navigation live in checkout-landing.ts.
 */

export const CHECKOUT_UNAVAILABLE_LINE = "Payment isn't available right now — you can keep studying free";
/** A checkout closed unpaid by a student with no subject yet, who is taken into the first run. */
export const CHECKOUT_CLOSED_FREE_LINE = "Checkout closed — you can keep studying free";

export type CheckoutFailure =
  /** The provider or our setup: never the raw message. */
  | { kind: "unavailable"; message: string }
  /** The server's own answer to this student (already subscribed, already opening). */
  | { kind: "answer"; message: string }
  /** Not signed in. */
  | { kind: "signin"; message: string };

/** The tRPC error code on a client error, wherever the transport put it. */
export function errorCode(err: unknown): string | undefined {
  const e = err as { data?: { code?: unknown }; shape?: { data?: { code?: unknown } }; code?: unknown } | null;
  const code = e?.data?.code ?? e?.shape?.data?.code ?? e?.code;
  return typeof code === "string" ? code : undefined;
}

const ANSWER_CODES = new Set(["BAD_REQUEST", "CONFLICT"]);

export function checkoutFailure(err: unknown): CheckoutFailure {
  const code = errorCode(err);
  const message = err instanceof Error ? err.message.trim() : "";
  if (code === "UNAUTHORIZED") return { kind: "signin", message: "Sign in to choose a plan." };
  if (code && ANSWER_CODES.has(code) && message) return { kind: "answer", message };
  return { kind: "unavailable", message: CHECKOUT_UNAVAILABLE_LINE };
}

/**
 * Where a student lands after a checkout that failed or came back unpaid:
 * home, which is the first run for someone with no subject (so they can start
 * a Quick 5), or nowhere new (null) for someone already studying, who stays
 * where they were. An unknown subject count (the request failed) also stays.
 */
export function landingAfterCheckout(subjectCount: number | null): "/" | null {
  return subjectCount === 0 ? "/" : null;
}
