"use client";

/**
 * First-touch acquisition attribution. Captured from the URL (utm_* params,
 * Google Ads gclid) and document.referrer on the visitor's first page view,
 * persisted in localStorage, and sent to the server when they sign up so
 * each user records where they came from.
 */

const STORAGE_KEY = "scribe_attribution_v1";

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  referrer?: string;
  landingPage?: string;
  capturedAt?: string;
}

const clean = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : undefined;
};

function fromCurrentUrl(): Attribution | null {
  const params = new URLSearchParams(window.location.search);
  const utm: Attribution = {
    utmSource: clean(params.get("utm_source")),
    utmMedium: clean(params.get("utm_medium")),
    utmCampaign: clean(params.get("utm_campaign")),
    utmTerm: clean(params.get("utm_term")),
    utmContent: clean(params.get("utm_content")),
    gclid: clean(params.get("gclid")),
  };
  const hasCampaign = Object.values(utm).some(Boolean);

  // A gclid without explicit utm params still means a Google Ads click.
  if (utm.gclid && !utm.utmSource) {
    utm.utmSource = "google";
    utm.utmMedium ??= "cpc";
  }

  const referrer = clean(document.referrer);
  const externalReferrer =
    referrer && !referrer.includes(window.location.hostname)
      ? referrer
      : undefined;

  if (!hasCampaign && !externalReferrer) return null;

  return {
    ...utm,
    referrer: externalReferrer,
    landingPage: clean(window.location.pathname + window.location.search),
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Records attribution for this visitor. Campaign-tagged visits (utm params
 * or gclid) overwrite an earlier capture that had no campaign; otherwise the
 * first capture wins.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const current = fromCurrentUrl();
    if (!current) return;
    const stored = getAttribution();
    const storedHasCampaign =
      !!stored && !!(stored.utmSource || stored.gclid);
    const currentHasCampaign = !!(current.utmSource || current.gclid);
    if (stored && (storedHasCampaign || !currentHasCampaign)) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage unavailable (private mode / blocked) — attribution is best-effort.
  }
}

export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** Attribution payload for the signup mutation / Google OAuth handoff. */
export function getSignupAttribution():
  | Pick<
      Attribution,
      | "utmSource"
      | "utmMedium"
      | "utmCampaign"
      | "utmTerm"
      | "utmContent"
      | "gclid"
      | "referrer"
    >
  | undefined {
  const stored = getAttribution();
  if (!stored) return undefined;
  const { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, referrer } =
    stored;
  const payload = { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, gclid, referrer };
  return Object.values(payload).some(Boolean) ? payload : undefined;
}
