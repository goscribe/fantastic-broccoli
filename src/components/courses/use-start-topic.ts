"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { coursesApi, type CatalogTopic, type Course, type CourseLevel } from "@/lib/api/courses";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";

/**
 * Starts a Quick 5 on a catalog topic (the server reuses or creates the
 * course's subject) and opens the session. One start at a time.
 */
export function useStartCourseTopic(opts: { onStarted?: (workspaceId: string) => void; onError?: (message: string) => void } = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null);
  const started = useRef(false);

  const start = async (course: Course, topic: CatalogTopic, level?: CourseLevel) => {
    if (started.current) return;
    started.current = true;
    setBusyTopicId(topic.id);
    try {
      const { workspaceId, sessionId } = await coursesApi.startTopic({
        courseId: course.id,
        topicId: topic.id,
        ...(level ? { level } : {}),
      });
      emitTreeChanged();
      opts.onStarted?.(workspaceId);
      router.push(`/workspace/${workspaceId}/session/${sessionId}`);
    } catch (err) {
      started.current = false;
      setBusyTopicId(null);
      const message = toastError(err, t("course.errorStart"));
      opts.onError?.(message);
    }
  };

  return { start, busyTopicId };
}
