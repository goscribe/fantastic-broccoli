"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { coursesApi, type CatalogTopic, type Course, type CourseLevel } from "@/lib/api/courses";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import { askTopicsStartCheck } from "@/lib/start-check-client";
import { chooseStudyLength } from "@/lib/study-length-client";
import { MAX_SELECTED_TOPICS, mixedSessionMinutes } from "@/lib/topic-select";

/**
 * One session over several picked topics of a course (the server reuses or
 * creates the course's subject, so this also adds the subject). A single pick
 * is that topic's usual 5 questions. A learner's first sessions are asked how
 * long; an answer is passed on, otherwise the server sets the length.
 */
export async function startPickedTopics(
  input: { courseId: string; topicIds: string[]; level?: CourseLevel; /** Topic names by id, for the start check's title; without them it is not asked. */ topicNames?: Record<string, string> },
  /** Called once the length is settled and the session is being made. */
  onBuilding?: () => void,
): Promise<{ workspaceId: string; sessionId: string }> {
  const topicIds = input.topicIds.slice(0, MAX_SELECTED_TOPICS);
  const usual = { depth: "moderate" as const, durationMinutes: mixedSessionMinutes(topicIds.length), quickStart: false };
  const chosen = topicIds.length > 1 ? await chooseStudyLength(usual) : usual;
  // Topics they have not rated yet: one "How confident are you?" for them (never holds the start up).
  const startCheck = input.topicNames
    ? await askTopicsStartCheck({ courseId: input.courseId, topics: topicIds.map((id) => ({ id, name: input.topicNames?.[id] ?? id })) })
    : undefined;
  onBuilding?.();
  return coursesApi.startTopics({
    courseId: input.courseId,
    topicIds,
    ...(input.level ? { level: input.level } : {}),
    ...(chosen !== usual ? { durationMinutes: chosen.durationMinutes } : {}),
    ...(startCheck ? { startCheck } : {}),
  });
}

/**
 * Starts a Quick 5 on a catalog topic (the server reuses or creates the
 * course's subject) and opens the session; `startMany` does the same for
 * several picked topics as one mixed session. One start at a time.
 */
export function useStartCourseTopic(opts: { onStarted?: (workspaceId: string) => void; onError?: (message: string) => void } = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"quick5" | "session" | null>(null);
  const [startingMany, setStartingMany] = useState(false);
  const started = useRef(false);

  const start = async (course: Course, topic: CatalogTopic, level?: CourseLevel, mode?: "quick5" | "session") => {
    if (started.current) return;
    started.current = true;
    setBusyTopicId(topic.id);
    setBusyMode(mode ?? "quick5");
    try {
      const startCheck = await askTopicsStartCheck({ courseId: course.id, topics: [{ id: topic.id, name: topic.name }] });
      const { workspaceId, sessionId } = await coursesApi.startTopic({
        courseId: course.id,
        topicId: topic.id,
        ...(level ? { level } : {}),
        ...(mode ? { mode } : {}),
        ...(startCheck ? { startCheck } : {}),
      });
      emitTreeChanged();
      opts.onStarted?.(workspaceId);
      router.push(`/workspace/${workspaceId}/session/${sessionId}`);
    } catch (err) {
      started.current = false;
      setBusyTopicId(null);
      setBusyMode(null);
      const message = toastError(err, t("course.errorStart"));
      opts.onError?.(message);
    }
  };

  /** Several topics picked together: one mixed session over them. */
  const startMany = async (course: Course, topics: CatalogTopic[], level?: CourseLevel) => {
    if (started.current || topics.length === 0) return;
    started.current = true;
    setStartingMany(true);
    try {
      const { workspaceId, sessionId } = await startPickedTopics({ courseId: course.id, topicIds: topics.map((x) => x.id), level, topicNames: Object.fromEntries(topics.map((x) => [x.id, x.name])) });
      emitTreeChanged();
      opts.onStarted?.(workspaceId);
      router.push(`/workspace/${workspaceId}/session/${sessionId}`);
    } catch (err) {
      started.current = false;
      setStartingMany(false);
      const message = toastError(err, t("course.errorStart"));
      opts.onError?.(message);
    }
  };

  return { start, busyTopicId, busyMode, startMany, startingMany };
}
