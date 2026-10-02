import { icsEscape, utcStamp } from "@/lib/review-reminders";
import { plannedSessionLink, type AcceptedSession } from "./store";

/**
 * Exports accepted study sessions to the learner's own calendar. Text is
 * passed in already translated; the link opens the session in Scribe.
 */

export interface SessionExportText {
  summary: string;
  description: string;
}

const linkFor = (session: AcceptedSession, origin: string) =>
  origin + plannedSessionLink(session, "calendar");

export function sessionGoogleCalendarUrl(
  session: AcceptedSession,
  text: SessionExportText,
  origin: string,
): string {
  const url = linkFor(session, origin);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: text.summary,
    dates: `${utcStamp(new Date(session.start))}/${utcStamp(new Date(session.end))}`,
    details: `${text.description}\nStart: ${url}`,
    location: url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function studyPlanIcs(
  sessions: AcceptedSession[],
  textFor: (s: AcceptedSession) => SessionExportText,
  origin: string,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scribe//Study plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Scribe study plan",
  ];
  const stamp = utcStamp(new Date());
  for (const s of sessions) {
    const url = linkFor(s, origin);
    const { summary, description } = textFor(s);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@scribe.study`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(new Date(s.start))}`,
      `DTEND:${utcStamp(new Date(s.end))}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(`${description}\nStart: ${url}`)}`,
      `URL:${url}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(summary)}`,
      "TRIGGER:-PT10M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function downloadTextFile(name: string, content: string, type = "text/calendar"): void {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
