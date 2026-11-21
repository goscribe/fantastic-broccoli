"use client";

import { useQuery } from "@tanstack/react-query";
import { coursesApi } from "@/lib/api/courses";
import { courseBadge } from "@/lib/courses";

/** React Query key for the learner's course-linked subjects. */
export const MY_COURSES_KEY = ["course-mine"] as const;

/** Subject id → its small course badge ("IB Biology · HL"), for course-linked subjects only. */
export function useCourseBadges(): Map<string, string> {
  const { data } = useQuery({ queryKey: MY_COURSES_KEY, queryFn: () => coursesApi.mine(), staleTime: 60_000, retry: false });
  const out = new Map<string, string>();
  for (const c of data ?? []) {
    const badge = courseBadge(c.title, c.courseTitle, c.level);
    if (badge) out.set(c.workspaceId, badge);
  }
  return out;
}
