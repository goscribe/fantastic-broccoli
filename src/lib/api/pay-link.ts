import { rpc } from "./study-session";

/**
 * Client for the server's `payLink` router ("Ask a parent to pay"; newer than
 * the published @goscribe/server types, contracts mirror the router 1:1).
 */

export interface PayLinkPlan {
  id: string;
  name: string;
  price: number;
  interval: string | null;
  accessUntil: string | Date | null;
  monthlyTokens: number;
  kind: "pass" | "recurring";
}

export interface CreatedPayLink {
  token: string;
  url: string;
  expiresAt: string | Date;
  firstName: string | null;
  plan: PayLinkPlan;
}

export type PayLinkStatus = "open" | "paid" | "expired" | "unavailable";

export interface PayLinkView {
  status: PayLinkStatus;
  firstName: string | null;
  plan: PayLinkPlan;
  expiresAt: string | Date;
  refundDays: number;
  payable: boolean;
}

export const createPayLink = (planId: string, firstName: string | null) =>
  rpc<CreatedPayLink>("payLink.create", "mutation", { planId, firstName });

export const fetchPayLink = (token: string, confirm = false) =>
  rpc<PayLinkView | null>("payLink.view", "query", { token, confirm });

export const openPayLinkCheckout = (token: string, email: string) =>
  rpc<{ url: string }>("payLink.checkout", "mutation", { token, email });
