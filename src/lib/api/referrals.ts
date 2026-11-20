import { rpc } from "./study-session";

/**
 * Client for the server's `referrals` and `share` routers (newer than the
 * published @goscribe/server types; contracts mirror the router 1:1).
 *
 * A friend who joins with your invite link and finishes their first
 * activity earns you both a free week of Starter (+100 pts each); the
 * inviter's side is capped per month.
 */

export interface ReferralSummary {
  code: string;
  joined: number;
  rewarded: number;
  pending: number;
  rewardedThisMonth: number;
  monthlyCap: number;
  rewardDays: number;
  rewardPoints: number;
  freeWeekUntil: Date | null;
}

export type ShareableKind = "MCQ_POOL" | "FLASHCARD_DECK" | "VOCAB_DECK";

export interface SharedItemView {
  title: string;
  topic: string | null;
  kind: ShareableKind;
  sharerFirstName: string | null;
  referralCode: string | null;
  questions: { question: string; options: string[]; correctIndex: number; explanation: string }[];
  cards: { front: string; back: string }[];
}

export const SHAREABLE_KINDS: readonly string[] = ["MCQ_POOL", "FLASHCARD_DECK", "VOCAB_DECK"];

export const fetchReferralSummary = () =>
  rpc<ReferralSummary>("referrals.summary", "query", undefined);

export const lookupReferral = (code: string) =>
  rpc<{ firstName: string | null } | null>("referrals.lookup", "query", { code });

export const fetchShareStatus = (artifactId: string) =>
  rpc<{ token: string | null }>("share.status", "query", { artifactId });

export const setShared = (artifactId: string, shared: boolean) =>
  rpc<{ token: string | null }>("share.set", "mutation", { artifactId, shared });

export const fetchSharedItem = (token: string) =>
  rpc<SharedItemView | null>("share.view", "query", { token });

const origin = () => (typeof window === "undefined" ? "https://scribe.study" : window.location.origin);

export const inviteUrl = (code: string) => `${origin()}/i/${code}`;
export const shareUrl = (token: string) => `${origin()}/s/${token}`;
export const signupHref = (ref: string | null | undefined) =>
  ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup";

/**
 * Native share sheet where there is one (phones), else copy to clipboard.
 * A dismissed share sheet is not an error.
 */
export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Fall through to copying (e.g. NotAllowedError on desktop).
    }
  }
  return (await copyText(data.url)) ? "copied" : "failed";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
