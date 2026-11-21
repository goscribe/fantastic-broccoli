import { cache } from "react";
import { publicNotesApi } from "@/lib/api/public-notes";
import { indexDraftsFromEnv, isTopicIndexable } from "./seo";

/**
 * Server-side data for the public note pages, memoised per request (metadata
 * and page share one fetch) on top of fetch's ISR cache.
 */
export const getCourses = cache(() => publicNotesApi.courses());
export const getCourse = cache((courseId: string) => publicNotesApi.course(courseId));
export const getTopic = cache((courseId: string, topicId: string) => publicNotesApi.topic(courseId, topicId));
export const getSitemapRows = cache(() => publicNotesApi.sitemap());

export const indexDrafts = () => indexDraftsFromEnv();

/** Topic indexability from a course-outline row. */
export const rowIndexable = (row: { note: "reviewed" | "draft" | null; questionCount: number }) =>
  isTopicIndexable({ note: row.note, questionCount: row.questionCount, indexDrafts: indexDrafts() });
