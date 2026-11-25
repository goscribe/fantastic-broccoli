"use client";

import { api } from "./api/trpc-client";
import { toast } from "./toast";
import { checkoutFailure, landingAfterCheckout, CHECKOUT_UNAVAILABLE_LINE } from "./checkout-failure";

type Router = { push(href: string): void; replace(href: string): void };

/** Subjects the student has (null when it can't be told). */
async function subjectCount(): Promise<number | null> {
  try {
    const { workspaces } = await api.workspace.getTree.query();
    return Array.isArray(workspaces) ? workspaces.length : null;
  } catch {
    return null;
  }
}

/** Where to go after a checkout came back closed or failed: "/" (the first run) with no subject yet, else null. */
export async function landingAfterCheckoutReturn(): Promise<"/" | null> {
  return landingAfterCheckout(await subjectCount());
}

/** Into the product: the first run for a student with no subject yet, else where they are. */
export async function landInProduct(router: Router, how: "push" | "replace" = "push"): Promise<void> {
  const to = landingAfterCheckout(await subjectCount());
  if (to) router[how](to);
}

/**
 * Creating a checkout failed: one friendly line, never the provider's words,
 * and a student with no subject yet goes straight into the first run.
 * Returns the line shown.
 */
export async function handleCheckoutFailure(err: unknown, router: Router): Promise<string> {
  const failure = checkoutFailure(err);
  if (failure.kind === "answer") {
    toast.error(failure.message, { id: failure.message });
    return failure.message;
  }
  if (failure.kind === "signin") {
    toast(failure.message, { id: failure.message });
    router.push("/login");
    return failure.message;
  }
  // Calm, not an error: there is nothing for the student to fix.
  toast(CHECKOUT_UNAVAILABLE_LINE, { id: CHECKOUT_UNAVAILABLE_LINE });
  await landInProduct(router);
  return CHECKOUT_UNAVAILABLE_LINE;
}
