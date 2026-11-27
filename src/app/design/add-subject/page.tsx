"use client";

import { FirstRun } from "@/components/onboarding/first-run";

/** "Add a subject" (/new-subject) without the app shell or a signed-in student: /design/add-subject */
export default function AddSubjectPreview() {
  return <FirstRun context="new_subject" onSkip={() => {}} />;
}
