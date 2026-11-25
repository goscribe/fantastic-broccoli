"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthUser } from "@/lib/api/auth";
import { trackNoteEvent, type LockedKind, type PublicTopic } from "@/lib/api/public-notes";

// The whole-note view (and its maths renderer) is its own chunk, fetched only for entitled readers.
const UnlockedTopic = dynamic(() => import("./unlocked-topic").then((m) => m.UnlockedTopic), { ssr: false });

/**
 * Wraps the server-rendered preview of a locked topic. The preview (and the
 * cached HTML) never contains the locked text; for a signed-in learner this
 * asks the server (`topicNote.page`, which runs the entitlement check) and,
 * when they have a plan, a pass or reviewer access, swaps the preview for the
 * whole note and every question. Visitors and free learners keep the preview.
 */
export function LockedTopicGate({
  courseId,
  topicId,
  kind,
  signupHref,
  children,
}: {
  courseId: string;
  topicId: string;
  kind: LockedKind;
  signupHref: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuthUser();
  const [full, setFull] = useState<PublicTopic | null>(null);
  const [fetched, setFetched] = useState(false);
  // Visitors need no check; signed-in learners once the server has answered.
  const checked = !loading && (!user || fetched);
  const tracked = useRef(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    import("@/lib/api/notes")
      .then(({ notesApi }) => notesApi.page(courseId, topicId))
      .then((data) => {
        if (cancelled) return;
        if (data && data.access && !data.access.locked) setFull(data);
        setFetched(true);
      })
      .catch(() => !cancelled && setFetched(true));
    return () => {
      cancelled = true;
    };
  }, [user, loading, courseId, topicId]);

  useEffect(() => {
    if (!checked || full || tracked.current) return;
    tracked.current = true;
    trackNoteEvent("notes.locked_viewed", courseId, topicId, { lockedKind: kind, signedIn: !!user, viewportWidth: window.innerWidth });
  }, [checked, full, courseId, topicId, kind, user]);

  if (full) return <UnlockedTopic data={full} signupHref={signupHref} />;
  return <>{children}</>;
}
