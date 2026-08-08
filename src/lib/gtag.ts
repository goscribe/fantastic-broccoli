declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const STUDY_SESSION_CONVERSION = "AW-18375140054/rT6GCMGkl90cENbF-blE";

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

/** Reports a Google Ads conversion when the user views a study session. */
export function reportStudySessionConversion() {
  if (typeof window === "undefined") return;
  gtag("event", "conversion", {
    send_to: STUDY_SESSION_CONVERSION,
    value: 1.0,
    currency: "USD",
  });
}
