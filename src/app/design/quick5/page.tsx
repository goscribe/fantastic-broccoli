"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BuildStage } from "@/components/session/build-stage";
import { WaitConfidenceCard, type WaitConfidenceState } from "@/components/session/wait-confidence";
import { SessionDebrief } from "@/components/session/session-debrief";
import type { ApiSessionDebrief, ApiSessionStats } from "@/lib/api/study-session";
import type { SessionActivity, StudySession } from "@/types";

/**
 * Design preview of the confidence question on a session's wait screen and
 * of a Quick 5's end screen, with fixture data and no network:
 *   ?view=wait      a Quick 5 being written, the question under the cat
 *   ?view=ready     the questions came first; one tap to start
 *   ?view=debrief   "You said 7/10 → You got 3/5" and the exam-level line
 *   ?view=debrief&full=1   the same end screen for a full (not Quick 5) session
 *   ?view=study     the end of a "Just study the topic" session: no score, "Ready for practice questions?"
 * The end screen's reminder ask ("When do you want to study tomorrow?") reads
 * the reminders API, so it only shows here when a test mocks `reminders.get`.
 */
const noop = () => {};
const state = (over: Partial<WaitConfidenceState> = {}): WaitConfidenceState => ({
  open: true,
  what: "Sectional conflict",
  quickStart: true,
  answer: noop,
  skip: noop,
  pending: false,
  ...over,
});

function Wait() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 pb-12 pt-2">
        <BuildStage title="5.5 Sectional conflict" pct={0.42} label="Writing your questions" stageIndex={2} stageCount={5} writing hint="About a minute. It opens here by itself." />
        <WaitConfidenceCard state={state()} />
      </div>
    </main>
  );
}

const q = (question: string, difficulty: "easy" | "medium" | "hard", options: string[]) => ({ question, options, correctIndex: 0, explanation: "", difficulty });
const ACTIVITIES: SessionActivity[] = [
  {
    id: "fixture-mcq",
    sessionId: "fixture-session",
    type: "mcq",
    title: "Quick 5: 5.5 Sectional conflict",
    order: 0,
    status: "completed",
    estimatedMinutes: 3,
    content: {
      type: "mcq",
      questions: [
        q("What principle did the Kansas-Nebraska Act use?", "easy", ["Popular sovereignty", "", "", ""]),
        q("What followed most directly in Kansas?", "medium", ["Violent struggle", "", "", ""]),
        q("Which consequence of Dred Scott most angered the North?", "medium", ["Congress could not ban slavery in territories", "", "", ""]),
        q("Which conflict best explains their opposing priorities?", "hard", ["Slavery's expansion", "", "", ""]),
        q("Why did Southern leaders still see the election as a threat?", "hard", ["Its political future", "", "", ""]),
      ],
    },
    // Right on the warm-up and one medium; the two hard ones missed.
    draft: { answersByQ: [0, 0, 1, 2, 1] },
  },
];
const STATS: ApiSessionStats = { activitiesDone: 1, activitiesTotal: 1, answered: 5, correct: 2, accuracy: 0.4, minutes: 4, points: 20, mistakes: 3, mastery: [] };
const DEBRIEF: ApiSessionDebrief = { headline: "", summary: "", sections: [] };

function Debrief({ full = false }: { full?: boolean }) {
  const queryClient = useQueryClient();
  // Seeded before the first render, so nothing is fetched.
  useState(() => {
    queryClient.setQueryData(["session-stats", "fixture-session"], STATS);
    queryClient.setQueryData(["session-debrief", "fixture-session"], DEBRIEF);
    return true;
  });
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-10">
      <SessionDebrief activities={ACTIVITIES} confidenceBefore={7} sessionId="fixture-session" subjectTitle="AP US History" quickStart={!full} onBack={noop} />
    </main>
  );
}

const READING = (id: string, title: string): SessionActivity => ({
  id,
  sessionId: "fixture-study",
  type: "reading",
  title,
  order: 0,
  status: "completed",
  estimatedMinutes: 5,
  content: { type: "reading", text: "## Idea\n\nText.", completed: true },
});
const STUDY_SESSION: StudySession = {
  id: "fixture-study",
  workspaceId: "fixture-workspace",
  title: "5.5 Sectional conflict",
  depth: "moderate",
  durationMinutes: 20,
  comments: [],
  activities: [READING("r1", "Popular sovereignty"), READING("r2", "Bleeding Kansas"), READING("r3", "Dred Scott and 1860")],
  progress: 100,
  generating: false,
  quickStart: false,
  mode: "study",
  courseTopic: "ap-us-history:5-5",
  status: "completed",
  startDate: "2026-11-27T09:00:00.000Z",
  createdAt: "2026-11-27T09:00:00.000Z",
  updatedAt: "2026-11-27T09:20:00.000Z",
};
// Nothing was asked, so nothing was answered: no accuracy, no score.
const STUDY_STATS: ApiSessionStats = { activitiesDone: 3, activitiesTotal: 3, answered: 0, correct: 0, accuracy: null, minutes: 14, points: 55, mistakes: 0, mastery: [] };

/** The end of a "Just study the topic" session: no score, and "Ready for practice questions?". */
function StudyDone() {
  const queryClient = useQueryClient();
  useState(() => {
    queryClient.setQueryData(["session-stats", "fixture-study"], STUDY_STATS);
    queryClient.setQueryData(["session-debrief", "fixture-study"], DEBRIEF);
    return true;
  });
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-10">
      <SessionDebrief activities={STUDY_SESSION.activities} confidenceBefore={4} studySession={STUDY_SESSION} sessionId="fixture-study" subjectTitle="AP US History" onBack={noop} />
    </main>
  );
}

function Inner() {
  const params = useSearchParams();
  const view = params.get("view") ?? "wait";
  if (view === "debrief") return <Debrief full={params.get("full") === "1"} />;
  if (view === "study") return <StudyDone />;
  if (view === "ready") {
    return (
      <main className="mx-auto w-full max-w-[640px] px-5 pt-8">
        <WaitConfidenceCard state={state()} ready />
      </main>
    );
  }
  return <Wait />;
}

export default function Quick5Preview() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
