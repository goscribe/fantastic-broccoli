"use client";
import { useRouter } from "next/navigation";
import { FirstRun } from "@/components/onboarding/first-run";

/** Another subject later: the first-run screen itself (your course, upload or paste; no notes required). */
export default function NewSubjectPage() {
  const router = useRouter();
  return <FirstRun context="new_subject" onSkip={() => router.push("/")} />;
}
