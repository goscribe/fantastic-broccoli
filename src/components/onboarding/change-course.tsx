"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkspace } from "@/lib/api/workspace";
import { emitTreeChanged } from "@/lib/tree-events";
import { forgetAutoSession, isAutoSession } from "@/lib/known-course";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";

const never = () => () => {};

/**
 * "Not your course? Change", on the wait screen of a Quick 5 the first screen
 * started without asking (it knew the course from the signup link, the notes
 * they practised, or the ad). The subject was made for them, not by them, so
 * changing removes it and goes back to "What are you studying?". Shown only
 * in the tab that made the session, and only for that session.
 */
export function ChangeCourseLink({ workspaceId, sessionId }: { workspaceId: string; sessionId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const show = useSyncExternalStore(never, () => isAutoSession(workspaceId, sessionId), () => false);
  if (!show && !leaving) return null;
  const change = async () => {
    if (leaving) return;
    setLeaving(true);
    forgetAutoSession();
    const removed = await deleteWorkspace(workspaceId).then(
      () => true,
      () => false,
    );
    emitTreeChanged();
    // Home with no subject is the question itself; if the subject could not be removed, ask on "Add a subject".
    router.push(removed ? "/" : "/new-subject");
  };
  return (
    <button
      type="button"
      onClick={() => void change()}
      disabled={leaving}
      className="flex min-h-11 items-center text-ui font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground disabled:opacity-60"
    >
      {t("firstRun.changeCourse")}
    </button>
  );
}
