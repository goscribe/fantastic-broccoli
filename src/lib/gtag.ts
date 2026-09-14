declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const STUDY_SESSION_CONVERSION = "AW-18375140054/rT6GCMGkl90cENbF-blE";
const SIGNUP_CONVERSION = "AW-18375140054/9RI7CPXVxPccENbF-blE";

/** Query flag the server appends to the OAuth landing URL for new accounts. */
export const SIGNUP_FLAG_PARAM = "signup";

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

/** Reports the Google Ads conversion for a successfully created account. */
export function reportSignupConversion() {
  if (typeof window === "undefined") return;
  gtag("event", "conversion", { send_to: SIGNUP_CONVERSION });
}

/**
 * Fires the signup conversion when the page was reached with `?signup=1`
 * (set by the server after a Google sign-up creates a new account), then
 * strips the flag so a reload can't report it twice.
 */
export function reportSignupConversionFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(SIGNUP_FLAG_PARAM) !== "1") return;
  reportSignupConversion();
  url.searchParams.delete(SIGNUP_FLAG_PARAM);
  window.history.replaceState(window.history.state, "", url.toString());
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
