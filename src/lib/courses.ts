/**
 * Pure helpers for "Pick your course" (catalog picker, course progress),
 * kept free of framework imports so they can be tested.
 */
import type { CatalogBoard, CatalogTopic, CatalogUnit, Course, CourseSummary, TopicProgress } from "./api/courses";

/** Picker order: international first, then US, then UK. */
export const BOARD_ORDER: CatalogBoard[] = ["IB", "AP", "GCSE", "A_LEVEL"];

/** Board family names shown on the picker; course and topic names stay in English. */
export const BOARD_LABEL: Record<CatalogBoard, string> = {
  IB: "IB Diploma",
  AP: "AP",
  GCSE: "GCSE",
  A_LEVEL: "A-level",
};

export function groupCourses(courses: CourseSummary[]): { board: CatalogBoard; courses: CourseSummary[] }[] {
  return BOARD_ORDER.map((board) => ({ board, courses: courses.filter((c) => c.board === board) })).filter(
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
