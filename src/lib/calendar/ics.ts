/**
 * iCalendar (.ics, RFC 5545) parsing for the exam import.
 *
 * Runs entirely in the browser: the file itself is never uploaded. Only each
 * upcoming event's title, start/end and an opaque id leave this module (and
 * go to the server, which picks out the exams); descriptions, locations and
 * attendees are not even read. A repeating event (a weekly lesson) is
 * reduced to its next occurrence and marked `recurring`.
 *
 * The parser (line unfolding, TZID incl. Windows zone names, all-day events,
 * RRULE daily / weekly BYDAY / monthly / yearly with COUNT and UNTIL, EXDATE,
 * RECURRENCE-ID overrides, cancelled events) comes from the earlier calendar
 * import (#217), with its event-kind guessing and study planner left behind.
 */

export interface IcsEvent {
  /** Opaque and stable: a hash of the UID (so a moved event keeps its id), plus the start for one occurrence of a series. */
  id: string;
  title: string;
  /** ISO instant; for an all-day event, its first day YYYY-MM-DD. */
  start: string;
  /** ISO instant; null for all-day and point-in-time events. */
  end: string | null;
  allDay: boolean;
  /** All-day events: the day, YYYY-MM-DD, as written in the file (no timezone shift). */
  date: string | null;
  /** All-day events: how many days it covers. */
  days: number;
  recurring: boolean;
}

export interface ParsedCalendar {
  events: IcsEvent[];
  /** VEVENTs in the file, before windowing. */
  totalInFile: number;
}

export class CalendarParseError extends Error {
  reason: "not_ics" | "empty";
  constructor(reason: "not_ics" | "empty", message: string) {
    super(message);
    this.reason = reason;
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
  start?: WallTime;
  end?: WallTime;
  durationMs?: number;
  rrule?: string;
  exdates: number[];
  recurrenceId?: number;
  cancelled: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES_PER_SERIES = 400;
const MAX_ITERATIONS = 5000;

/** Two FNV-1a passes (64 bits together), so ids never carry UIDs, which can embed emails and domains. */
export function hashId(input: string): string {
  const pass = (seed: number) => {
    let h = seed;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36).padStart(7, "0");
  };
  return `${pass(0x811c9dc5)}${pass(0x9747b28c)}`;
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

// --- Parse ------------------------------------------------------------------

export interface ParseOptions {
  /** Start of the window (default: start of today). */
  windowStart?: Date;
  /** Days after `windowStart` to keep (default: 12 months). */
  horizonDays?: number;
}

/** Most events sent on to the server; one-off events are kept ahead of repeating ones. */
export const MAX_ICS_EVENTS = 1500;

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const pad = (n: number) => String(n).padStart(2, "0");
const wallDay = (w: WallTime) => `${w.y}-${pad(w.mo)}-${pad(w.d)}`;

export function parseIcs(texts: string | string[], options: ParseOptions = {}): ParsedCalendar {
  const files = Array.isArray(texts) ? texts : [texts];
  const windowStartMs = startOfLocalDay(options.windowStart ?? new Date()).getTime();
  const windowEndMs = windowStartMs + (options.horizonDays ?? 366) * DAY_MS;

  const raws: RawEvent[] = [];
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
          current = { uid: "", summary: "", exdates: [], cancelled: false };
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
      // Outside an event, or inside a VALARM nested in one: nothing to read.
      if (!current || depth > 0) continue;
      // DESCRIPTION, LOCATION, ATTENDEE, ORGANIZER and the rest are skipped unread.
      switch (prop.name) {
        case "UID":
          current.uid = prop.value.trim();
          break;
        case "SUMMARY":
          current.summary = unescapeText(prop.value).replace(/\s+/g, " ");
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
      }
    }
  }

  if (!sawCalendar) throw new CalendarParseError("not_ics", "This file isn't an iCalendar (.ics) file.");
  if (raws.length === 0) throw new CalendarParseError("empty", "This calendar file has no events in it.");

  // RECURRENCE-ID entries replace (or cancel) one occurrence of their series.
  const overridden = new Set<string>();
  for (const r of raws) {
    if (r.recurrenceId !== undefined) overridden.add(`${r.uid}|${r.recurrenceId}`);
  }

  const single: IcsEvent[] = [];
  const repeating: IcsEvent[] = [];
  const seen = new Set<string>();
  for (const r of raws) {
    if (!r.start || r.cancelled || !r.summary) continue;
    const title = r.summary.slice(0, 300);
    const startMs0 = wallToMs(r.start);
    const uid = r.uid || `${title}|${startMs0}`;
    const durationMs =
      r.end !== undefined ? Math.max(0, wallToMs(r.end) - startMs0) : r.durationMs !== undefined ? Math.max(0, r.durationMs) : r.start.allDay ? DAY_MS : 0;
    const rule = r.rrule && r.recurrenceId === undefined ? parseRRule(r.rrule) : null;
    const recurring = !!rule || r.recurrenceId !== undefined;
    const starts = rule ? expandRRule(r.start, rule, windowEndMs, windowStartMs) : [r.start];
    const exdates = new Set(r.exdates);

    for (const w of starts) {
      const startMs = wallToMs(w);
      if (rule && (exdates.has(startMs) || overridden.has(`${uid}|${startMs}`))) continue;
      // Upcoming only: an event that has started is too late to plan for.
      if (startMs < windowStartMs || startMs >= windowEndMs) continue;
      const id = recurring ? hashId(`${uid}|${startMs}`) : hashId(uid);
      if (seen.has(id)) continue;
      seen.add(id);
      (recurring ? repeating : single).push(
        w.allDay
          ? { id, title, start: wallDay(w), end: null, allDay: true, date: wallDay(w), days: Math.max(1, Math.round(durationMs / DAY_MS)), recurring }
          : { id, title, start: new Date(startMs).toISOString(), end: durationMs > 0 ? new Date(startMs + durationMs).toISOString() : null, allDay: false, date: null, days: 1, recurring },
      );
      // A series is one row: its next occurrence.
      if (rule) break;
    }
  }

  const byStart = (a: IcsEvent, b: IcsEvent) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
  single.sort(byStart);
  repeating.sort(byStart);
  const events = [...single.slice(0, MAX_ICS_EVENTS), ...repeating.slice(0, Math.max(0, MAX_ICS_EVENTS - single.length))];
  return { events, totalInFile: raws.length };
}

/** A file is an .ics by its name, its type, or how it starts. */
export function looksLikeIcs(file: { name: string; type?: string }, head?: string): boolean {
  return /\.ics$/i.test(file.name) || /^text\/calendar/i.test(file.type ?? "") || /^\uFEFF?\s*BEGIN:VCALENDAR/i.test(head ?? "");
}
