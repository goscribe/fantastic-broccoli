"use client";

import { useEffect, useState } from "react";
import { rpc } from "@/lib/api/study-session";
import { fetchPlanCaps } from "@/lib/api/account";
import { useAuthUser } from "@/lib/api/auth";
import { hasPlanAccess } from "@/lib/plan-access";
import type { PublicCourse, PublicCourseSummary } from "@/lib/api/public-notes";

/**
 * Data for the in-app notes library, read in the browser with the learner's
 * session (the public pages read the same endpoints on the server). One fetch
 * per page load: the catalog and note counts change only with a deploy or an
 * import.
 */
let coursesCache: Promise<PublicCourseSummary[]> | null = null;
const courseCache = new Map<string, Promise<PublicCourse | null>>();

export function loadNoteCourses(): Promise<PublicCourseSummary[]> {
  coursesCache ??= rpc<PublicCourseSummary[]>("publicNotes.courses", "query", undefined).catch((err) => {
    coursesCache = null;
    throw err;
  });
  return coursesCache;
}

export function loadNoteCourse(courseId: string): Promise<PublicCourse | null> {
  let hit = courseCache.get(courseId);
  if (!hit) {
    hit = rpc<PublicCourse | null>("publicNotes.course", "query", { courseId }).catch((err) => {
      courseCache.delete(courseId);
      throw err;
    });
    courseCache.set(courseId, hit);
  }
  return hit;
}

export type Loaded<T> = { state: "loading" } | { state: "error" } | { state: "ready"; data: T };

/** Runs `load` when `key` changes; `retry` runs it again after a failure. */
export function useLoaded<T>(key: string, load: () => Promise<T>): Loaded<T> & { retry: () => void } {
  const [result, setResult] = useState<{ key: string; value: Loaded<T> }>({ key, value: { state: "loading" } });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setResult({ key, value: { state: "ready", data } }))
      .catch(() => !cancelled && setResult({ key, value: { state: "error" } }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const value: Loaded<T> = result.key === key ? result.value : { state: "loading" };
  return {
    ...value,
    retry: () => {
      setResult({ key, value: { state: "loading" } });
      setAttempt((n) => n + 1);
    },
  };
}

let entitledCache: Promise<boolean> | null = null;

/**
 * Whether locked topics are open to this learner (a plan, or staff). Only
 * decides what the lists show: the server decides what is actually served.
 * False until known, and on any failure.
 */
export function useNotesEntitled(): boolean {
  const { user } = useAuthUser();
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    let cancelled = false;
    entitledCache ??= fetchPlanCaps()
      .then((caps) => hasPlanAccess(caps))
      .catch(() => {
        entitledCache = null;
        return false;
      });
    void entitledCache.then((ok) => !cancelled && setPaid(ok));
    return () => {
      cancelled = true;
    };
  }, []);
  return paid || !!user?.isAdmin;
}

/** A course outline as this learner sees it: no locks for someone entitled to them. */
export function openFor(course: PublicCourse, entitled: boolean): PublicCourse {
  if (!entitled) return course;
  return { ...course, units: course.units.map((u) => ({ ...u, topics: u.topics.map((t) => (t.locked ? { ...t, locked: false } : t)) })) };
}
