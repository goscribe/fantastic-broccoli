/**
 * Pure helpers for "Pick your course" (catalog picker, course progress),
 * kept free of framework imports so they can be tested.
 */
import type { CatalogBoard, CatalogTopic, CatalogUnit, Course, CourseSummary, TopicProgress } from "./api/courses";

/** Picker order when nothing says where the student is: international first, then US, then UK. */
export const BOARD_ORDER: CatalogBoard[] = ["IB", "AP", "GCSE", "A_LEVEL"];

const US_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Yakutat|Metlakatla|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/;
const UK_ZONES = /^(Europe\/(London|Belfast|Jersey|Guernsey|Isle_of_Man)|GB)$/;

/**
 * Where the student most likely sits exams: the device's time zone first
 * (a UK student's browser is often set to en-US), the language's region
 * only when the zone says nothing.
 */
export function examRegion(locale: string | undefined, timeZone: string | undefined): "US" | "UK" | "other" {
  if (timeZone && US_ZONES.test(timeZone)) return "US";
  if (timeZone && UK_ZONES.test(timeZone)) return "UK";
  if (timeZone && timeZone !== "UTC" && timeZone !== "Etc/UTC") return "other";
  const region = (locale ?? "").split(/[-_]/)[1]?.toUpperCase();
  if (region === "US") return "US";
  if (region === "GB" || region === "UK") return "UK";
  return "other";
}

/** Board order by region: US → AP first; UK → GCSE and A-level first; else IB first. */
export function boardOrder(locale: string | undefined, timeZone: string | undefined): CatalogBoard[] {
  const region = examRegion(locale, timeZone);
  if (region === "US") return ["AP", "IB", "GCSE", "A_LEVEL"];
  if (region === "UK") return ["GCSE", "A_LEVEL", "IB", "AP"];
  return BOARD_ORDER;
}

/** This browser's board order (IB first on the server, where there is no browser). */
export function localBoardOrder(): CatalogBoard[] {
  if (typeof window === "undefined") return BOARD_ORDER;
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  return boardOrder(navigator.language, tz);
}

/** Board family names shown on the picker; course and topic names stay in English. */
export const BOARD_LABEL: Record<CatalogBoard, string> = {
  IB: "IB Diploma",
  AP: "AP",
  GCSE: "GCSE",
  A_LEVEL: "A-level",
};

export function groupCourses(courses: CourseSummary[], order: CatalogBoard[] = BOARD_ORDER): { board: CatalogBoard; courses: CourseSummary[] }[] {
  return order.map((board) => ({ board, courses: courses.filter((c) => c.board === board) })).filter(
    (g) => g.courses.length > 0,
  );
}

/** IB SL drops HL-only topics; everything else studies every topic. */
export function topicsForLevel(unit: CatalogUnit, level: string | null | undefined, course: Pick<Course, "levels">): CatalogTopic[] {
  if (course.levels?.length && level === "SL") return unit.topics.filter((t) => !t.hlOnly);
  return unit.topics;
}

export function unitsForLevel(course: Course, level: string | null | undefined): CatalogUnit[] {
  return course.units
    .map((u) => ({ ...u, topics: topicsForLevel(u, level, course) }))
    .filter((u) => u.topics.length > 0);
}

/** 0–100 rounded, or null before any answer. */
export function masteryPercent(mastery: number | null | undefined): number | null {
  if (mastery === null || mastery === undefined || !Number.isFinite(mastery)) return null;
  return Math.round(Math.min(1, Math.max(0, mastery)) * 100);
}

export function unitProgress(unit: CatalogUnit, byTopic: Map<string, TopicProgress>): { done: number; total: number } {
  return { done: unit.topics.filter((t) => byTopic.get(t.id)?.done).length, total: unit.topics.length };
}

/** The first topic not done yet, in course order: what "Continue" starts. */
export function nextTopic(units: CatalogUnit[], byTopic: Map<string, TopicProgress>): { unit: CatalogUnit; topic: CatalogTopic } | null {
  for (const unit of units) {
    for (const topic of unit.topics) if (!byTopic.get(topic.id)?.done) return { unit, topic };
  }
  return null;
}

/** "A1.1 Water": codes help students find their place. */
export const topicTitle = (t: Pick<CatalogTopic, "code" | "name">) => `${t.code} ${t.name}`;

/** Unit heading: "Theme A · Unity and diversity", "Unit 3 · Cellular Energetics". */
export function unitTitle(course: Pick<Course, "unitLabel">, unit: Pick<CatalogUnit, "code" | "name">): string {
  // An empty label means the code says it (IB Chemistry "S1", "R2").
  return `${course.unitLabel ? `${course.unitLabel} ` : ""}${unit.code} · ${unit.name}`;
}

// ---------- one search over courses and topics ----------

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/a[\s-]?levels?/g, "alevel")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
const words = (s: string) => fold(s).split(" ").filter(Boolean);

export interface TopicHit {
  course: Course;
  unit: CatalogUnit;
  topic: CatalogTopic;
}

/**
 * Type-to-filter for "Pick your course": "IB Biology" finds the course,
 * "osmosis" finds the topics that teach it, "ap bio osmosis" both narrowed.
 * Every word typed must appear (as a word start) in the course's or topic's
 * text; topics whose name matches rank above those matched in objectives.
 */
export function searchCatalog(
  query: string,
  summaries: CourseSummary[],
  courses: Course[],
  order: CatalogBoard[] = BOARD_ORDER,
  limit = 8,
): { courses: CourseSummary[]; topics: TopicHit[] } {
  const q = words(query);
  if (q.length === 0) return { courses: [], topics: [] };
  const has = (text: string[], w: string) => text.some((t) => t.startsWith(w));
  const all = (text: string[]) => q.every((w) => has(text, w));
  const rank = (b: CatalogBoard) => order.indexOf(b);
  const courseText = (c: Pick<CourseSummary, "title" | "board" | "boardName" | "subject" | "qualification">) =>
    words(`${c.title} ${BOARD_LABEL[c.board]} ${c.board} ${c.boardName} ${c.subject} ${c.qualification}`);

  const courseHits = summaries.filter((c) => all(courseText(c))).sort((a, b) => rank(a.board) - rank(b.board));

  const scored: { hit: TopicHit; score: number }[] = [];
  for (const course of courses) {
    const ct = courseText(course);
    for (const unit of course.units) {
      for (const topic of unit.topics) {
        const name = words(`${topic.code} ${topic.name}`);
        const obj = words(topic.objectives.join(" "));
        // A course word alone ("biology") must not list every topic in it.
        const topicWords = q.filter((w) => has(name, w) || has(obj, w));
        if (topicWords.length === 0 || !q.every((w) => has(name, w) || has(obj, w) || has(ct, w))) continue;
        const inName = q.filter((w) => has(name, w)).length;
        scored.push({ hit: { course, unit, topic }, score: inName * 10 - rank(course.board) });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return { courses: courseHits, topics: scored.slice(0, limit).map((s) => s.hit) };
}

/**
 * The small badge on a course-linked subject's tile: the course and level,
 * or only what the subject's own name does not already say
 * ("IB Biology" + HL → "HL course").
 */
export function courseBadge(subjectTitle: string, courseTitle: string, level: string | null | undefined): string {
  const named = fold(subjectTitle).includes(fold(courseTitle));
  if (!named) return level ? `${courseTitle} · ${level}` : courseTitle;
  if (level && !fold(subjectTitle).split(" ").includes(level.toLowerCase())) return `${level} course`;
  return "Course";
}

// ---------- the first screen: likely courses, and where a course starts ----------

/**
 * The topic a course's Quick 5 starts on when the student only tapped the
 * course: the first one everyone on it studies (not HL-only, BC-only, higher
 * tier or second-year content, and not behind a plan). Syllabus order, so it
 * is the topic a class starts the year with.
 */
export function firstTopic(course: Pick<Course, "units">): { unit: CatalogUnit; topic: CatalogTopic } | null {
  let fallback: { unit: CatalogUnit; topic: CatalogTopic } | null = null;
  for (const unit of course.units) {
    for (const topic of unit.topics) {
      if (topic.locked) continue;
      fallback ??= { unit, topic };
      if (!topic.hlOnly && !topic.bcOnly && !topic.higherTierOnly && !topic.advanced) return { unit, topic };
    }
  }
  return fallback;
}

/**
 * The few courses offered as tiles on "What are you studying?": the courses
 * named in `lead` first (what the app already knows about this student), then
 * the boards in the student's order, one course per subject from each (AP
 * Calculus AB, not AB and BC), so six tiles cover six subjects. Boards later
 * in the order only fill what the first ones leave.
 */
export function likelyCourses(courses: CourseSummary[], order: CatalogBoard[] = BOARD_ORDER, limit = 6, lead: string[] = []): CourseSummary[] {
  const out: CourseSummary[] = [];
  const add = (c: CourseSummary | undefined) => {
    if (c && out.length < limit && !out.includes(c)) out.push(c);
  };
  for (const id of lead) add(courses.find((c) => c.id === id));
  const groups = groupCourses(courses, order);
  for (const group of groups) {
    const subjects = new Set(out.filter((c) => c.board === group.board).map((c) => c.subject));
    for (const c of group.courses) {
      if (subjects.has(c.subject)) continue;
      subjects.add(c.subject);
      add(c);
    }
  }
  // A small catalog: second courses of a subject fill the rest.
  for (const group of groups) for (const c of group.courses) add(c);
  return out;
}
