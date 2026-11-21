"use client";

import dynamic from "next/dynamic";
import { useAuthUser } from "@/lib/api/auth";

// The signed-in reader (and its maths renderer) is its own chunk, fetched only when it is shown.
const SignedInNoteReader = dynamic(() => import("./signed-in-reader").then((m) => m.SignedInNoteReader), { ssr: false });

/** For a topic without a public note: the signed-in reader for a signed-in learner; nothing for visitors. */
export function SignedInNoteFallback({ courseId, topicId }: { courseId: string; topicId: string }) {
  const { user, loading } = useAuthUser();
  if (loading || !user) return null;
  return <SignedInNoteReader courseId={courseId} topicId={topicId} />;
}
