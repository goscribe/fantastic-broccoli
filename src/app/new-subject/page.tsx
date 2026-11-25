"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FirstRun } from "@/components/onboarding/first-run";

/** Another subject later: the first-run screen itself (your course, upload or paste; no notes required). */
function NewSubject() {
  const router = useRouter();
  // `?paste=1`: an upload elsewhere didn't finish and the student chose "Paste text instead".
  const paste = useSearchParams().get("paste") === "1";
  return <FirstRun context="new_subject" initialMode={paste ? "paste" : undefined} onSkip={() => router.push("/")} />;
}

export default function NewSubjectPage() {
  return (
    <Suspense fallback={null}>
      <NewSubject />
    </Suspense>
  );
}
