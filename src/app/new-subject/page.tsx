"use client";
import { useRouter } from "next/navigation";
import { SubjectOnboarding } from "@/components/onboarding/subject-onboarding";

/** Same three steps as first run, for adding another subject later. */
export default function NewSubjectPage() {
  const router = useRouter();
  return <SubjectOnboarding onSkip={() => router.push("/")} />;
}
