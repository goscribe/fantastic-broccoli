/**
 * What the app already knows about the course a new student is on, before
 * they have picked anything: the note page they signed up from, the topic
 * they practised or read on the public notes before signing up, the notes
 * page an ad or a search sent them to, or the ad's keyword. The first screen
 * leads with that course, and starts its Quick 5 without asking when the
 * signal names one course.
 *
 * Everything here is read from this browser (the signup link's query,
 * localStorage); nothing is sent anywhere. Pure functions plus one guarded
 * reader, so the rules are tested.
 */
import type { Attribution } from "./attribution";
import type { CatalogBoard, CourseSummary } from "./api/courses";
import { BOARD_LABEL, BOARD_ORDER } from "./courses";
import { parseProgress, PROGRESS_KEY } from "./notes-public/progress";
import { parseReading, READING_KEY } from "./notes-public/reading";

/** Where the course came from, strongest first. */
export type KnownCourseSource = "signup" | "practice" | "reading" | "landing" | "keyword";

export interface KnownCourse {
  courseId: string;
  /** The topic they were on, when the signal names one (the Quick 5 starts there). */
  topicId?: string;
  source: KnownCourseSource;
}

/** The course a signup link named (`/signup?from=notes&course=…&topic=…`), kept until home needs it. */
export const SIGNUP_COURSE_KEY = "scribe.signupCourse.v1";
/** Set once a Quick 5 was started without asking, so it never happens twice. */
export const AUTO_START_KEY = "scribe.firstRun.autoStarted";
/** Older than this, a signal says little about what they are studying now. */
export const KNOWN_COURSE_TTL_MS = 30 * 24 * 3600 * 1000;

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export interface SignupCourse {
  courseId: string;
  topicId?: string;
  at: number;
}

/** Reads `course` / `topic` from a signup URL's query; null when there is no usable course id. */
export function signupCourseFromQuery(search: string, now: number): SignupCourse | null {
  const params = new URLSearchParams(search);
  const courseId = params.get("course")?.trim() ?? "";
  if (!ID.test(courseId)) return null;
  const topicId = params.get("topic")?.trim() ?? "";
  return { courseId, ...(ID.test(topicId) ? { topicId } : {}), at: now };
}

export function parseSignupCourse(raw: string | null | undefined): SignupCourse | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SignupCourse>;
    if (typeof p?.courseId !== "string" || !ID.test(p.courseId)) return null;
    return { courseId: p.courseId, ...(typeof p.topicId === "string" && ID.test(p.topicId) ? { topicId: p.topicId } : {}), at: Number(p.at) || 0 };
  } catch {
    return null;
  }
}

/** `/notes/<course>/<topic>` (the public notes, where ads and searches land) → its ids. */
export function courseFromLandingPage(landingPage: string | undefined): { courseId: string; topicId?: string } | null {
  const path = (landingPage ?? "").split(/[?#]/)[0];
  const m = /^\/notes\/([^/]+)(?:\/([^/]+))?\/?$/.exec(path);
  if (!m || !ID.test(m[1])) return null;
  return { courseId: m[1], ...(m[2] && ID.test(m[2]) ? { topicId: m[2] } : {}) };
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/a[\s-]?levels?/g, "alevel")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Words of an ad keyword that say nothing about the course ("ib biology revision notes free"). */
const FILLER = new Set(
  "a an and app best exam exams flashcard flashcards for free guide help how in learn my notes of on online paper papers past practice prep question questions quiz quizzes revise revision scribe study test tests the to tool with".split(" "),
);

const BOARD_WORDS: Record<string, CatalogBoard> = { ib: "IB", ibdp: "IB", ap: "AP", gcse: "GCSE", igcse: "GCSE", alevel: "A_LEVEL" };

/**
 * The courses an ad keyword or campaign name points at ("ib biology notes",
 * "ap_bio_quiz"), in the student's board order. Every meaningful word must
 * start a word of the course's name, board or subject, and at least one must
 * be about the subject itself: "ib" alone names no course.
 */
export function coursesFromKeyword(text: string | undefined, courses: CourseSummary[], order: CatalogBoard[] = BOARD_ORDER): CourseSummary[] {
  const words = fold(text ?? "").split(" ").filter((w) => w && !FILLER.has(w));
  if (words.length === 0 || words.every((w) => w in BOARD_WORDS)) return [];
  const hits = courses.filter((c) => {
    const hay = fold(`${c.title} ${BOARD_LABEL[c.board]} ${c.board} ${c.boardName} ${c.subject} ${c.qualification}`).split(" ");
    return words.every((w) => hay.some((h) => h.startsWith(w)));
  });
  return hits.sort((a, b) => order.indexOf(a.board) - order.indexOf(b.board));
}

export interface KnownCourseSignals {
  signup?: SignupCourse | null;
  /** Raw localStorage values of the public notes' practice and reading progress. */
  practiceRaw?: string | null;
  readingRaw?: string | null;
  attribution?: Attribution | null;
}

/** The most recently touched "<course>/<topic>" key of a progress map that is a catalog course and still fresh. */
function latestTopic(topics: Record<string, { updatedAt: number }>, known: Set<string>, now: number): { courseId: string; topicId: string } | null {
  let best: { courseId: string; topicId: string; at: number } | null = null;
  for (const [key, t] of Object.entries(topics)) {
    const [courseId, topicId] = key.split("/");
    if (!courseId || !topicId || !known.has(courseId)) continue;
    if (now - t.updatedAt > KNOWN_COURSE_TTL_MS) continue;
    if (!best || t.updatedAt > best.at) best = { courseId, topicId, at: t.updatedAt };
  }
  return best && { courseId: best.courseId, topicId: best.topicId };
}

/**
 * The course this student is on, and the courses to lead the tiles with.
 * `known` is set only when one course is named (a keyword matching several,
 * like "biology revision", only orders the tiles). Ids are checked against
 * the catalog, so a retired course or a mangled link is ignored.
 */
export function knownCourse(
  signals: KnownCourseSignals,
  courses: CourseSummary[],
  order: CatalogBoard[] = BOARD_ORDER,
  now: number = Date.now(),
): { known: KnownCourse | null; lead: string[] } {
  const ids = new Set(courses.map((c) => c.id));
  const found: KnownCourse[] = [];
  const s = signals.signup;
  if (s && ids.has(s.courseId) && now - s.at <= KNOWN_COURSE_TTL_MS) found.push({ courseId: s.courseId, ...(s.topicId ? { topicId: s.topicId } : {}), source: "signup" });
  const practised = latestTopic(parseProgress(signals.practiceRaw).topics, ids, now);
  if (practised) found.push({ ...practised, source: "practice" });
  const read = latestTopic(parseReading(signals.readingRaw).topics, ids, now);
  if (read) found.push({ ...read, source: "reading" });
  const landed = courseFromLandingPage(signals.attribution?.landingPage);
  if (landed && ids.has(landed.courseId)) found.push({ ...landed, source: "landing" });
  const a = signals.attribution;
  let keywordHits: CourseSummary[] = [];
  for (const text of [a?.utmTerm, a?.utmContent, a?.utmCampaign]) {
    keywordHits = coursesFromKeyword(text, courses, order);
    if (keywordHits.length > 0) break;
  }
  if (keywordHits.length === 1) found.push({ courseId: keywordHits[0].id, source: "keyword" });
  const lead = [...new Set([...found.map((f) => f.courseId), ...keywordHits.map((c) => c.id)])];
  return { known: found[0] ?? null, lead };
}

// ---------- this browser ----------

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Called by the signup page: keeps the course its link named (a note page's "Sign up" button). */
export function rememberSignupCourse(search: string): void {
  const found = signupCourseFromQuery(search, Date.now());
  if (!found) return;
  try {
    window.localStorage.setItem(SIGNUP_COURSE_KEY, JSON.stringify(found));
  } catch {
    // Storage blocked: home asks instead.
  }
}

/** Everything this browser knows, for `knownCourse`. */
export function readKnownCourseSignals(attribution: Attribution | null): KnownCourseSignals {
  if (typeof window === "undefined") return {};
  return { signup: parseSignupCourse(read(SIGNUP_COURSE_KEY)), practiceRaw: read(PROGRESS_KEY), readingRaw: read(READING_KEY), attribution };
}

export const hasAutoStarted = (): boolean => typeof window !== "undefined" && read(AUTO_START_KEY) === "1";

export function markAutoStarted(): void {
  try {
    window.localStorage.setItem(AUTO_START_KEY, "1");
  } catch {
    // Storage blocked: the screen's own state still stops a second start in this visit.
  }
}

/** True when this browser holds anything `knownCourse` could read a course from (so the first screen waits for the catalog before it draws the choice). */
export function mayKnowCourse(signals: KnownCourseSignals): boolean {
  const a = signals.attribution;
  return !!(signals.signup || signals.practiceRaw || signals.readingRaw || courseFromLandingPage(a?.landingPage) || a?.utmTerm || a?.utmContent || a?.utmCampaign);
}

/** The session a Quick 5 was started in without asking; kept for this tab only. */
const AUTO_SESSION_KEY = "scribe.firstRun.autoSession";

/** Remembers the subject and session made without asking, so their wait screen can offer "Not your course? Change". */
export function rememberAutoSession(workspaceId: string, sessionId: string): void {
  try {
    window.sessionStorage.setItem(AUTO_SESSION_KEY, `${workspaceId}/${sessionId}`);
  } catch {
    // Storage blocked: the wait screen just has no "Change" link.
  }
}

export function isAutoSession(workspaceId: string, sessionId: string): boolean {
  try {
    return window.sessionStorage.getItem(AUTO_SESSION_KEY) === `${workspaceId}/${sessionId}`;
  } catch {
    return false;
  }
}

export function forgetAutoSession(): void {
  try {
    window.sessionStorage.removeItem(AUTO_SESSION_KEY);
  } catch {
    // nothing to forget
  }
}
