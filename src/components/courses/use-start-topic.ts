"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { coursesApi, type CatalogTopic, type Course, type CourseLevel } from "@/lib/api/courses";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import { prepareTopicStart } from "@/lib/start-step-client";
import { MAX_SELECTED_TOPICS, mixedSessionMinutes } from "@/lib/topic-select";

/**
 * One session over several picked topics of a course (the server reuses or
 * creates the course's subject, so this also adds the subject). A single pick
 * is that topic's usual 5 questions. What is asked first (how long, practice
 * or just study, how confident) is asked on one screen, and passed on.
 */
export async function startPickedTopics(
  input: { courseId: string; topicIds: string[]; level?: CourseLevel; /** Topic names by id, for the start step's title. */ topicNames?: Record<string, string> },
  /** Called once the length is settled and the session is being made. */
  onBuilding?: () => void,
): Promise<{ workspaceId: string; sessionId: string }> {
  const topicIds = input.topicIds.slice(0, MAX_SELECTED_TOPICS);
  const several = topicIds.length > 1;
  // One screen, before anything is made: how long (several topics, a learner's first sessions), practice or
  // just study, and how confident they are (once per course).
  const step = await prepareTopicStart({
    courseId: input.courseId,
    topics: topicIds.map((id) => ({ id, name: input.topicNames?.[id] ?? "" })),
    quickStart: !several,
    durationMinutes: several ? mixedSessionMinutes(topicIds.length) : 15,
    askLength: several,
  });
  onBuilding?.();
  const out = await coursesApi.startTopics({
    courseId: input.courseId,
    topicIds,
    ...(input.level ? { level: input.level } : {}),
    ...(step.durationMinutes ? { durationMinutes: step.durationMinutes } : {}),
    ...(step.mode ? { mode: step.mode } : {}),
    ...(step.startCheck ? { startCheck: step.startCheck } : {}),
  });
  step.started(out.workspaceId);
  return out;
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
      // One screen first, once per course: practice or just study, and how confident they are.
      const step = await prepareTopicStart({
        courseId: course.id,
        topics: [{ id: topic.id, name: topic.name }],
        quickStart: mode !== "session",
        durationMinutes: mode === "session" ? 30 : 15,
        askLength: false,
      });
      const { workspaceId, sessionId } = await coursesApi.startTopic({
        courseId: course.id,
        topicId: topic.id,
        ...(level ? { level } : {}),
        ...(step.mode ? { mode: step.mode } : mode ? { mode } : {}),
        ...(step.startCheck ? { startCheck: step.startCheck } : {}),
      });
      step.started(workspaceId);
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
