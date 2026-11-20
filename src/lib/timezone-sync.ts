/**
 * Tells the server the browser's timezone once per app session, so local
 * days (streak, the next-day "your Quick 5 is ready" message, the streak
 * reminder) follow the learner's clock instead of UTC.
 *
 * Kept free of React and API imports so the decision can be unit tested;
 * the caller passes the sender.
 */

export const TIMEZONE_SENT_KEY = "scribe.tz-sent";

/** The browser's IANA zone, e.g. "Europe/Berlin"; undefined when unknown. */
export function browserTimezone(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length <= 64 ? tz : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether to send: the browser knows its zone, it differs from what the
 * server has (or the server has none), and this session hasn't sent it for
 * this user already.
 */
export function shouldSendTimezone(
  browserTz: string | undefined,
  serverTz: string | null | undefined,
  sentMarker: string | null,
  userId: string,
): boolean {
  if (!browserTz) return false;
  if (serverTz === browserTz) return false;
  return sentMarker !== `${userId}:${browserTz}`;
}

/** Fire-and-forget; failures (e.g. an older server) are ignored and retried next session. */
export function syncTimezone(
  userId: string,
  serverTz: string | null | undefined,
  send: (timezone: string) => Promise<unknown>,
): void {
  if (typeof window === "undefined") return;
  const tz = browserTimezone();
  let marker: string | null = null;
  try {
    marker = window.sessionStorage.getItem(TIMEZONE_SENT_KEY);
  } catch {
    // Storage blocked: still send (at most once per page load, see below).
  }
  if (!shouldSendTimezone(tz, serverTz, marker, userId) || !tz) return;
  try {
    window.sessionStorage.setItem(TIMEZONE_SENT_KEY, `${userId}:${tz}`);
  } catch {
    // ignore
  }
  send(tz).catch(() => {
    try {
      window.sessionStorage.removeItem(TIMEZONE_SENT_KEY);
    } catch {
      // ignore
    }
  });
}
