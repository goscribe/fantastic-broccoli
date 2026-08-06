declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const STUDY_SESSION_CONVERSION = "AW-18375140054/rT6GCMGkl90cENbF-blE";

/** Reports a Google Ads conversion when the user views a study session. */
export function reportStudySessionConversion() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", "conversion", {
    send_to: STUDY_SESSION_CONVERSION,
    value: 1.0,
    currency: "USD",
  });
}
