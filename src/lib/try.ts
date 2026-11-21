/**
 * Pure helpers for "try before signing up" (an anonymous Quick 5), kept free
 * of framework imports so they can be tested.
 */

/** Refusal kinds the server prefixes its anon.start messages with (server: anon-limits.ts). */
export type TryRefusal =
  | "anon_disabled"
  | "anon_budget"
  | "anon_ip_limit"
  | "anon_browser_limit"
  | "anon_captcha_required";

const REFUSALS: readonly TryRefusal[] = [
  "anon_disabled",
  "anon_budget",
  "anon_ip_limit",
  "anon_browser_limit",
  "anon_captcha_required",
];

/** Which cap (if any) refused an anonymous start, read off the error message. */
export function tryRefusalOf(message: string | undefined | null): TryRefusal | null {
  if (!message) return null;
  const head = message.split(":", 1)[0].trim();
  return (REFUSALS as readonly string[]).includes(head) ? (head as TryRefusal) : null;
}

/** The server's message without its machine-readable prefix. */
export function tryMessage(message: string): string {
  return tryRefusalOf(message) ? message.slice(message.indexOf(":") + 1).trim() : message;
}

/** Where an anonymous attempt's results live (and where signup sends them back). */
export function tryResultsPath(attemptId: string): string {
  return `/try/${encodeURIComponent(attemptId)}`;
}

/** Signup (or login) that returns to the attempt's results, carrying an invite code. */
export function trySignupHref(attemptId: string, opts: { login?: boolean; ref?: string | null } = {}): string {
  const params = new URLSearchParams({ redirect: tryResultsPath(attemptId), from: "try" });
  if (opts.ref) params.set("ref", opts.ref);
  return `/${opts.login ? "login" : "signup"}?${params.toString()}`;
}

/** Same-site relative redirect target, else "/". */
export function safeRedirect(target: string | null | undefined): string {
  return target && target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\") ? target : "/";
}

/** The attempt id in a /try/<id> redirect target, if it is one. */
export function attemptIdFromRedirect(target: string | null | undefined): string | null {
  const m = /^\/try\/([A-Za-z0-9_-]{1,64})(?:[?#].*)?$/.exec(target ?? "");
  return m ? m[1] : null;
}

export const TRY_TOPIC_MIN = 2;
export const TRY_TOPIC_MAX = 100;
export const TRY_PASTE_MIN = 40;
export const TRY_PASTE_MAX = 100_000;
export const TRY_PDF_MAX_BYTES = 8 * 1024 * 1024;

export function topicReady(topic: string): boolean {
  const len = topic.replace(/\s+/g, " ").trim().length;
  return len >= TRY_TOPIC_MIN && len <= TRY_TOPIC_MAX;
}

export function pasteReady(text: string): boolean {
  const len = text.trim().length;
  return len >= TRY_PASTE_MIN && len <= TRY_PASTE_MAX;
}

/** Score line tone for the results screen. */
export function scoreTone(correct: number, total: number): "great" | "good" | "keep" {
  if (total === 0) return "keep";
  const share = correct / total;
  return share >= 0.8 ? "great" : share >= 0.5 ? "good" : "keep";
}

/** Ad / SEO landing pages that open straight on the try box. */
export const TRY_TOOLS = ["ai-quiz-generator", "ai-flashcard-generator", "ai-study-guide-generator", "pdf-to-quiz"] as const;
export type TryTool = (typeof TRY_TOOLS)[number];

export function isTryTool(slug: string): slug is TryTool {
  return (TRY_TOOLS as readonly string[]).includes(slug);
}

/** Pending claim kept in the browser so any signup path (header, login) can attach the attempt. */
export const PENDING_TRY_KEY = "scribe_try_pending_v1";
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function encodePendingTry(attemptId: string, now = Date.now()): string {
  return JSON.stringify({ id: attemptId, at: now });
}

export function decodePendingTry(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const { id, at } = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
    if (typeof at !== "number" || now - at > PENDING_TTL_MS || at > now + 60_000) return null;
    return id;
  } catch {
    return null;
  }
}
