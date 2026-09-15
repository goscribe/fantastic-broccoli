declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const STUDY_SESSION_CONVERSION = "AW-18375140054/rT6GCMGkl90cENbF-blE";
const SIGNUP_CONVERSION = "AW-18375140054/9RI7CPXVxPccENbF-blE";

/** Query flag appended to the OAuth landing URL for a newly created account. */
export const SIGNUP_FLAG_PARAM = "signup";

const PENDING_OAUTH_SIGNUP_KEY = "scribe_pending_oauth_signup";
const SENT_SIGNUP_CONVERSION_KEY = "scribe_signup_conversion_sent";
const PENDING_OAUTH_SIGNUP_TTL_MS = 10 * 60 * 1000;

/**
 * Queues a gtag command, working even before the gtag.js snippet has executed
 * (e.g. on a hard navigation straight into a page that reports a conversion):
 * commands pushed onto `dataLayer` as an Arguments object are replayed by
 * gtag.js once it loads.
 */
function gtag(..._args: unknown[]) {
  if (typeof window.gtag === "function") {
    window.gtag(..._args);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage unavailable (private mode / blocked)
  }
}

function storageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage unavailable
  }
}

/** Remember that the visitor started Google OAuth from the signup page. */
export function markPendingOAuthSignup(): void {
  if (typeof window === "undefined") return;
  storageSet(PENDING_OAUTH_SIGNUP_KEY, String(Date.now()));
}

/** Drop a leftover OAuth-signup marker (login page, failed OAuth, etc.). */
export function clearPendingOAuthSignup(): void {
  if (typeof window === "undefined") return;
  storageRemove(PENDING_OAUTH_SIGNUP_KEY);
}

function consumePendingOAuthSignup(): boolean {
  const raw = storageGet(PENDING_OAUTH_SIGNUP_KEY);
  storageRemove(PENDING_OAUTH_SIGNUP_KEY);
  if (!raw) return false;
  const started = Number(raw);
  return Number.isFinite(started) && Date.now() - started < PENDING_OAUTH_SIGNUP_TTL_MS;
}

/** Reports the Google Ads conversion for a successfully created account. */
export function reportSignupConversion() {
  if (typeof window === "undefined") return;
  if (storageGet(SENT_SIGNUP_CONVERSION_KEY) === "1") return;
  storageSet(SENT_SIGNUP_CONVERSION_KEY, "1");
  storageRemove(PENDING_OAUTH_SIGNUP_KEY);
  gtag("event", "conversion", { send_to: SIGNUP_CONVERSION });
}

/**
 * Fires the signup conversion when the page was reached with `?signup=1`
 * (set by the server after a new Google account, or by the signup-page
 * Google button as a fallback), then strips the flag so a reload can't
 * report it twice.
 */
export function reportSignupConversionFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(SIGNUP_FLAG_PARAM) !== "1") return;
  reportSignupConversion();
  url.searchParams.delete(SIGNUP_FLAG_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Fires the signup conversion after Google OAuth when the visitor started
 * from the signup page and we now have an authenticated session. Used when
 * the server drops `?signup=1` from the redirect. Does not fire for an
 * unauthenticated visitor (abandoned / failed OAuth).
 */
export function reportPendingOAuthSignupConversion() {
  if (typeof window === "undefined") return;
  if (!consumePendingOAuthSignup()) return;
  reportSignupConversion();
}

/** Reports a Google Ads conversion when the user views a study session. */
export function reportStudySessionConversion() {
  if (typeof window === "undefined") return;
  gtag("event", "conversion", {
    send_to: STUDY_SESSION_CONVERSION,
    value: 1.0,
    currency: "USD",
  });
}
