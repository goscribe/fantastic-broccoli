/** Learner-facing wording for the Google Calendar connect return and disconnect result. */

export type CalendarNotice = { tone: "success" | "error" | "info"; text: string };

/**
 * `?calendar=…` on the Planner after the Google consent screen. `cancelled`
 * shows nothing: the learner backed out on purpose.
 */
export function calendarReturnNotice(result: string | null | undefined): CalendarNotice | null {
  if (!result || result === "cancelled") return null;
  if (result === "connected") {
    return { tone: "success", text: "Google Calendar connected — let's set up your plan." };
  }
  if (result === "unconfigured") {
    return { tone: "error", text: "Google Calendar isn't set up on the server yet." };
  }
  if (result === "permission_missing") {
    return {
      tone: "error",
      text: "Calendar not connected: Google didn't share your calendar events. Connect again and leave the calendar permission ticked.",
    };
  }
  return { tone: "error", text: "Couldn't connect Google Calendar. Try again." };
}

export type CalendarDisconnectResult = { ok: boolean; revoked?: boolean; manualRevokeUrl?: string | null };

/**
 * After Disconnect. Scribe's own copy of the connection is always removed; the
 * revoke at Google is only reported when the server confirmed it. An older
 * server that returns no `revoked` flag makes no claim about Google either way.
 */
export function calendarDisconnectNotice(
  result: CalendarDisconnectResult,
): CalendarNotice & { manualRevokeUrl?: string } {
  if (result.revoked === true) {
    return {
      tone: "success",
      text: "Google Calendar disconnected and Scribe's access was removed at Google. Google may ask you to approve Scribe again next time you sign in with Google.",
    };
  }
  if (result.revoked === false) {
    const url = safeGoogleUrl(result.manualRevokeUrl);
    return {
      tone: "info",
      text: url
        ? "Disconnected from Scribe, but Google didn't confirm removing access. Remove Scribe in your Google Account permissions to finish."
        : "Disconnected from Scribe. Google didn't confirm removing access; you can remove Scribe in your Google Account permissions.",
      ...(url ? { manualRevokeUrl: url } : {}),
    };
  }
  return { tone: "success", text: "Google Calendar disconnected from Scribe." };
}

/** Only a Google-hosted https link is ever offered as the "finish at Google" action. */
function safeGoogleUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "google.com" || u.hostname.endsWith(".google.com")) ? url : undefined;
  } catch {
    return undefined;
  }
}
