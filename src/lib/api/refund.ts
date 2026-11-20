import { rpc } from "./study-session";

/**
 * Client for the server's `refund` router ("Refund my pass", one click within
 * 14 days; the same link cancels a free trial). Newer than the published
 * @goscribe/server types; contracts mirror the router 1:1.
 */

export type RefundIneligible =
  | "window_passed"
  | "already_refunded"
  | "account_used"
  | "payment_method_used"
  | "not_refundable"
  | "trial_already_cancelled";

export interface RefundView {
  kind: "pass_refund" | "trial_cancel";
  eligible: boolean;
  reason: RefundIneligible | null;
  status: "done" | "pending" | "failed" | null;
  planName: string;
  /** Minor units. */
  amount: number;
  currency: string;
  paidAt: string | Date | null;
  refundableUntil: string | Date | null;
  trialEndsAt: string | Date | null;
  paidBySomeoneElse: boolean;
  refundDays: number;
}

export const fetchRefund = (token: string) => rpc<RefundView | null>("refund.view", "query", { token });

export const confirmRefund = (token: string) =>
  rpc<{ kind: RefundView["kind"]; status: "done" | "pending" }>("refund.confirm", "mutation", { token });

export const fetchMyRefundLink = () =>
  rpc<{ kind: RefundView["kind"]; url: string; until: string | Date } | null>("refund.myLink", "query", undefined);

/** The path part of a refund link, so the app navigates within itself. */
export function refundPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** `$29.00`-style amount from minor units. */
export function formatAmount(minor: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
