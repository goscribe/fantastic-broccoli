/**
 * iCalendar (.ics, RFC 5545) parsing for calendar import.
 *
 * Runs entirely in the browser: the file is never uploaded. Recurring events
 * (weekly classes) are expanded into occurrences inside the planning window,
 * and each event gets an inferred kind (exam / deadline / class / other).
 */

export type CalendarEventKind = "exam" | "deadline" | "class" | "other";

export const CALENDAR_EVENT_KINDS: CalendarEventKind[] = [
  "exam",
  "deadline",
  "class",
  "other",
];

export interface CalendarEvent {
  /** Opaque, stable per occurrence (hash of UID + start). */
  id: string;
  /** Opaque, shared by every occurrence of a recurring event. */
  seriesId: string;
  title: string;
  /** ISO instant. */
  start: string;
  /** ISO instant; equals `start` for point-in-time events. */
  end: string;
  allDay: boolean;
  location?: string;
  inferredKind: CalendarEventKind;
  recurring: boolean;
  /** False for all-day and "free" (TRANSP:TRANSPARENT) events. */
  busy: boolean;
}

export interface ParsedCalendar {
  events: CalendarEvent[];
  calendarNames: string[];
  /** VEVENTs in the file, before windowing/expansion. */
  totalInFile: number;
}

export class CalendarParseError extends Error {
  constructor(
    public reason: "not_ics" | "empty" | "unreadable",
    message: string,
  ) {
    super(message);
  }
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface WallTime {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  /** "utc", "local" (floating) or an IANA zone name. */
  zone: string;
  allDay: boolean;
}

interface RawEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  categories: string;
  start?: WallTime;
  end?: WallTime;
  durationMs?: number;
  rrule?: string;
  exdates: number[];
  recurrenceId?: number;
  cancelled: boolean;
  transparent: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES_PER_SERIES = 400;
const MAX_ITERATIONS = 5000;

/** FNV-1a, so ids never carry UIDs (which can embed emails/domains). */
export function hashId(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function unfold(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function parseLine(line: string): Prop | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) {
      params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
    }
  }
  return { name: rawName.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(v: string): string {
  return v
    .replace(/\\[nN]/g, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

const WINDOWS_ZONES: Record<string, string> = {
  "eastern standard time": "America/New_York",
  "central standard time": "America/Chicago",
  "mountain standard time": "America/Denver",
  "us mountain standard time": "America/Phoenix",
  "pacific standard time": "America/Los_Angeles",
  "alaskan standard time": "America/Anchorage",
  "hawaiian standard time": "Pacific/Honolulu",
  "atlantic standard time": "America/Halifax",
  "gmt standard time": "Europe/London",
  "greenwich standard time": "Atlantic/Reykjavik",
  "w. europe standard time": "Europe/Berlin",
  "central europe standard time": "Europe/Budapest",
  "central european standard time": "Europe/Warsaw",
  "romance standard time": "Europe/Paris",
  "e. europe standard time": "Europe/Bucharest",
  "russian standard time": "Europe/Moscow",
  "india standard time": "Asia/Kolkata",
  "china standard time": "Asia/Shanghai",
  "singapore standard time": "Asia/Singapore",
  "tokyo standard time": "Asia/Tokyo",
  "korea standard time": "Asia/Seoul",
  "aus eastern standard time": "Australia/Sydney",
  "e. australia standard time": "Australia/Brisbane",
  "new zealand standard time": "Pacific/Auckland",
  "sa pacific standard time": "America/Bogota",
  "e. south america standard time": "America/Sao_Paulo",
  "utc": "UTC",
};

const zoneFormatters = new Map<string, Intl.DateTimeFormat | null>();

function zoneFormatter(zone: string): Intl.DateTimeFormat | null {
  if (zoneFormatters.has(zone)) return zoneFormatters.get(zone)!;
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  } catch {
    fmt = null;
  }
  zoneFormatters.set(zone, fmt);
  return fmt;
}

function normalizeZone(tzid: string): string {
  const cleaned = tzid.replace(/^\/+/, "").trim();
  return WINDOWS_ZONES[cleaned.toLowerCase()] ?? cleaned;
}

/** Milliseconds the zone's wall clock is ahead of UTC at `utcMs`. */
function zoneOffset(utcMs: number, fmt: Intl.DateTimeFormat): number {
  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function wallToMs(w: WallTime): number {
  if (w.allDay || w.zone === "local") {
    return new Date(w.y, w.mo - 1, w.d, w.h, w.mi, w.s).getTime();
  }
  const naive = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  if (w.zone === "utc") return naive;
  const fmt = zoneFormatter(w.zone);
  // Unknown zone names fall back to the learner's own clock.
  if (!fmt) return new Date(w.y, w.mo - 1, w.d, w.h, w.mi, w.s).getTime();
  const first = zoneOffset(naive, fmt);
  let utc = naive - first;
  const second = zoneOffset(utc, fmt);
  if (second !== first) utc = naive - second;
  return utc;
}

function parseDateValue(value: string, params: Record<string, string>): WallTime | null {
  const v = value.trim();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (date || params.VALUE === "DATE") {
    const m = date ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0, zone: "local", allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  return {
    y: +m[1],
    mo: +m[2],
    d: +m[3],
    h: +m[4],
    mi: +m[5],
    s: m[6] ? +m[6] : 0,
    zone: m[7] ? "utc" : params.TZID ? normalizeZone(params.TZID) : "local",
    allDay: false,
  };
}

function parseDuration(v: string): number | undefined {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return undefined;
  const ms =
    ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 * 3600 +
      +(m[4] ?? 0) * 3600 +
      +(m[5] ?? 0) * 60 +
      +(m[6] ?? 0)) *
    1000;
  return m[1] === "-" ? -ms : ms;
}

/** Calendar arithmetic on the wall clock (keeps 9:00 at 9:00 across DST). */
function addToWall(w: WallTime, days: number, months = 0): WallTime {
  const d = new Date(Date.UTC(w.y, w.mo - 1 + months, w.d + days));
  return { ...w, y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function weekday(w: WallTime): number {
  return new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
}

const BYDAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface RRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  untilMs?: number;
  byDay?: number[];
}

function parseRRule(raw: string): RRule | null {
  const parts = Object.fromEntries(
    raw.split(";").map((kv) => {
      const [k, v = ""] = kv.split("=");
      return [k.toUpperCase(), v.toUpperCase()];
    }),
  );
  const freq = parts.FREQ;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const until = parts.UNTIL ? parseDateValue(parts.UNTIL, {}) : null;
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(",")
        .map((d: string) => BYDAY_CODES[d.replace(/^[+-]?\d+/, "")])
        .filter((d: number | undefined): d is number => d !== undefined)
    : undefined;
  return {
    freq: freq as RRule["freq"],
    interval: Math.max(1, parseInt(parts.INTERVAL ?? "1", 10) || 1),
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : undefined,
    // An all-day UNTIL date includes that whole day.
    untilMs: until ? wallToMs(until) + (until.allDay ? DAY_MS - 1 : 0) : undefined,
    byDay: byDay && byDay.length > 0 ? byDay : undefined,
  };
}

/** Occurrence start times (wall clock) of a recurring event, in order. */
function expandRRule(start: WallTime, rule: RRule, windowEndMs: number, windowStartMs: number): WallTime[] {
  const out: WallTime[] = [];
  const startMs = wallToMs(start);
  let emitted = 0;
  const accept = (w: WallTime): boolean => {
    const ms = wallToMs(w);
    if (ms < startMs) return true;
    if (rule.untilMs !== undefined && ms > rule.untilMs) return false;
    if (ms > windowEndMs) return false;
    if (rule.count !== undefined && emitted >= rule.count) return false;
    emitted++;
    if (ms >= windowStartMs - 7 * DAY_MS) out.push(w);
    return out.length < MAX_OCCURRENCES_PER_SERIES;
  };

  // Without COUNT, jump close to the window instead of walking years of history.
  const skipPeriods = (periodDays: number) => {
    if (rule.count !== undefined) return 0;
    const gap = Math.floor((windowStartMs - startMs) / DAY_MS / (periodDays * rule.interval)) - 1;
    return Math.max(0, gap);
  };

  if (rule.freq === "WEEKLY") {
    const days = rule.byDay ?? [weekday(start)];
    // Weeks start on Monday (RFC 5545 default WKST=MO).
    const weekStart = addToWall(start, -((weekday(start) + 6) % 7));
    const offsets = days.map((d) => (d + 6) % 7).sort((a, b) => a - b);
    for (let k = skipPeriods(7), i = 0; i < MAX_ITERATIONS; k++, i++) {
      const week = addToWall(weekStart, k * 7 * rule.interval);
      for (const off of offsets) {
        if (!accept(addToWall(week, off))) return out;
      }
    }
    return out;
  }

  for (let k = rule.freq === "DAILY" ? skipPeriods(1) : 0, i = 0; i < MAX_ITERATIONS; k++, i++) {
    let w: WallTime;
    if (rule.freq === "DAILY") {
      w = addToWall(start, k * rule.interval);
      if (rule.byDay && !rule.byDay.includes(weekday(w))) continue;
    } else {
      w = addToWall(start, 0, k * rule.interval * (rule.freq === "YEARLY" ? 12 : 1));
      // Skip months without that day (e.g. the 31st) instead of rolling over.
      if (w.d !== start.d) continue;
    }
    if (!accept(w)) return out;
  }
  return out;
}

// --- Kind inference -------------------------------------------------------

const DEADLINE_STRONG =
  /\b(due|deadline|submit|submission|hand[- ]?in|turn[- ]?in|entrega|abgabe|rendu)\b/i;
const EXAM_WORDS =
  /\b(exams?|examen(es)?|midterms?|mid-terms?|finals?|quiz(zes)?|tests?|assessments?|mocks?|orals?|paper\s*\d|prüfung|klausur|parcial|prova|controle)\b/i;
const DEADLINE_WORDS =
  /\b(assignments?|homework|hw\d*|problem\s*sets?|psets?|essays?|reports?|projects?|coursework|ia|ee|tok|portfolio|tarea|devoir)\b/i;
const CLASS_WORDS =
  /\b(lectures?|class(es)?|seminars?|labs?|tutorials?|recitations?|lessons?|workshops?|discussion|section|period|module|clase|cours|vorlesung|lezione)\b/i;
const COURSE_CODE = /\b[A-Z]{2,5}\s?-?\d{2,4}[A-Z]?\b/;
const NOT_FINAL = /\bfinal\s+(project|essay|report|paper\s+due)\b/i;

export function inferEventKind(input: {
  title: string;
  description?: string;
  categories?: string;
  recurring?: boolean;
}): CalendarEventKind {
  const text = `${input.title} ${input.categories ?? ""}`;
  if (DEADLINE_STRONG.test(text)) return "deadline";
  if (EXAM_WORDS.test(text) && !NOT_FINAL.test(text)) return "exam";
  if (DEADLINE_WORDS.test(text)) return "deadline";
  if (CLASS_WORDS.test(text)) return "class";
  if (input.recurring && COURSE_CODE.test(input.title)) return "class";
  // Fall back to the description only for the strongest signals.
  const desc = input.description ?? "";
  if (/\b(exam|midterm|final exam)\b/i.test(desc) && !input.recurring) return "exam";
  return "other";
}

const SUBJECT_NOISE = new RegExp(
  [
    DEADLINE_STRONG.source,
    EXAM_WORDS.source,
    DEADLINE_WORDS.source,
    CLASS_WORDS.source,
    /\b(for|the|on|of|and|at|in|#?\d+|unit|chapter|week|online|in-class|take-home|reminder)\b/.source,
  ].join("|"),
  "gi",
);

/** Best-effort subject from an event title ("Chemistry HL Paper 1" → "Chemistry HL"). */
export function subjectOf(title: string): string {
  const cleaned = title
    .replace(/[:–—\-|()[\],.!]+/g, " ")
    .replace(SUBJECT_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || title.trim();
}

// --- Parse ------------------------------------------------------------------

export interface ParseOptions {
  /** Start of the planning window (default: start of today). */
  windowStart?: Date;
  /** Days after `windowStart` to keep (default 56). */
  horizonDays?: number;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseIcs(texts: string | string[], options: ParseOptions = {}): ParsedCalendar {
  const files = Array.isArray(texts) ? texts : [texts];
  const windowStartMs = startOfLocalDay(options.windowStart ?? new Date()).getTime();
  const windowEndMs = windowStartMs + (options.horizonDays ?? 56) * DAY_MS;

  const raws: RawEvent[] = [];
  const calendarNames: string[] = [];
  let sawCalendar = false;

  for (const text of files) {
    if (!/BEGIN:VCALENDAR/i.test(text)) continue;
    sawCalendar = true;
    let current: RawEvent | null = null;
    let depth = 0;
    for (const line of unfold(text)) {
      if (!line) continue;
      const prop = parseLine(line);
      if (!prop) continue;
      if (prop.name === "BEGIN") {
        if (prop.value.toUpperCase() === "VEVENT") {
          current = {
            uid: "",
            summary: "",
            description: "",
            location: "",
            categories: "",
            exdates: [],
            cancelled: false,
            transparent: false,
          };
          depth = 0;
        } else if (current) depth++;
        continue;
      }
      if (prop.name === "END") {
        if (prop.value.toUpperCase() === "VEVENT" && current) {
          raws.push(current);
          current = null;
        } else if (current) depth--;
        continue;
      }
      if (!current) {
        if (prop.name === "X-WR-CALNAME") calendarNames.push(unescapeText(prop.value));
        continue;
      }
      // Skip VALARM etc. nested inside the event.
      if (depth > 0) continue;
      switch (prop.name) {
        case "UID":
          current.uid = prop.value.trim();
          break;
        case "SUMMARY":
          current.summary = unescapeText(prop.value);
          break;
        case "DESCRIPTION":
          current.description = unescapeText(prop.value).slice(0, 500);
          break;
        case "LOCATION":
          current.location = unescapeText(prop.value);
          break;
        case "CATEGORIES":
          current.categories = unescapeText(prop.value);
          break;
        case "DTSTART":
          current.start = parseDateValue(prop.value, prop.params) ?? undefined;
          break;
        case "DTEND":
          current.end = parseDateValue(prop.value, prop.params) ?? undefined;
          break;
        case "DURATION":
          current.durationMs = parseDuration(prop.value);
          break;
        case "RRULE":
          current.rrule = prop.value;
          break;
        case "EXDATE":
          for (const v of prop.value.split(",")) {
            const w = parseDateValue(v, prop.params);
            if (w) current.exdates.push(wallToMs(w));
          }
          break;
        case "RECURRENCE-ID": {
          const w = parseDateValue(prop.value, prop.params);
          if (w) current.recurrenceId = wallToMs(w);
          break;
        }
        case "STATUS":
          current.cancelled = prop.value.trim().toUpperCase() === "CANCELLED";
          break;
        case "TRANSP":
          current.transparent = prop.value.trim().toUpperCase() === "TRANSPARENT";
          break;
      }
    }
  }

  if (!sawCalendar) {
    throw new CalendarParseError("not_ics", "This file isn't an iCalendar (.ics) file.");
  }

  // RECURRENCE-ID entries replace (or cancel) one occurrence of their series.
  const overridden = new Set<string>();
  for (const r of raws) {
    if (r.recurrenceId !== undefined) overridden.add(`${r.uid}|${r.recurrenceId}`);
  }

  const events: CalendarEvent[] = [];
  const seen = new Set<string>();
  for (const r of raws) {
    if (!r.start || r.cancelled) continue;
    const title = r.summary || "Untitled event";
    const uid = r.uid || `${title}|${wallToMs(r.start)}`;
    const startMs0 = wallToMs(r.start);
    const durationMs =
      r.end !== undefined
        ? Math.max(0, wallToMs(r.end) - startMs0)
        : r.durationMs !== undefined
          ? Math.max(0, r.durationMs)
          : r.start.allDay
            ? DAY_MS
            : 0;
    const rule = r.rrule && r.recurrenceId === undefined ? parseRRule(r.rrule) : null;
    const starts = rule ? expandRRule(r.start, rule, windowEndMs, windowStartMs) : [r.start];
    const exdates = new Set(r.exdates);
    const recurring = !!rule || r.recurrenceId !== undefined;
    const inferredKind = inferEventKind({
      title,
      description: r.description,
      categories: r.categories,
      recurring,
    });
    const seriesId = hashId(uid);

    for (const w of starts) {
      const startMs = wallToMs(w);
      if (rule && (exdates.has(startMs) || overridden.has(`${uid}|${startMs}`))) continue;
      const endMs = startMs + durationMs;
      if (endMs < windowStartMs || startMs >= windowEndMs) continue;
      if (endMs === startMs && startMs < windowStartMs) continue;
      const id = hashId(`${uid}|${startMs}`);
      if (seen.has(id)) continue;
      seen.add(id);
      events.push({
        id,
        seriesId,
        title,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        allDay: w.allDay,
        location: r.location || undefined,
        inferredKind,
        recurring,
        busy: !w.allDay && !r.transparent,
      });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  if (raws.length === 0) {
    throw new CalendarParseError("empty", "This calendar file has no events in it.");
  }
  return { events, calendarNames: [...new Set(calendarNames)], totalInFile: raws.length };
}
