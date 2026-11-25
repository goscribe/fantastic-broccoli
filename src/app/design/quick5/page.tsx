"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BuildStage } from "@/components/session/build-stage";
import { WaitConfidenceCard, type WaitConfidenceState } from "@/components/session/wait-confidence";
import { SessionDebrief } from "@/components/session/session-debrief";
import type { ApiSessionDebrief, ApiSessionStats } from "@/lib/api/study-session";
import type { SessionActivity } from "@/types";

/**
 * Design preview of the confidence question on a session's wait screen and
 * of a Quick 5's end screen, with fixture data and no network:
 *   ?view=wait      a Quick 5 being written, the question under the cat
 *   ?view=papers    the first session of a course with several papers
 *   ?view=ready     the questions came first; one tap to start
 *   ?view=debrief   "You said 7/10 → You got 3/5" and the exam-level line
 */
const noop = () => {};
const state = (over: Partial<WaitConfidenceState> = {}): WaitConfidenceState => ({
  open: true,
  what: "Sectional conflict",
  papers: [],
  quickStart: true,
  answer: noop,
  skip: noop,
  pending: false,
  ...over,
});

const PAPERS = [
  { id: "ap-mcq", name: "Section I Part A", blurb: "Multiple choice on sources" },
  { id: "ap-hist-saq", name: "Section I Part B", blurb: "Short-answer questions" },
  { id: "ap-hist-dbq", name: "Section II DBQ", blurb: "Document-based essay" },
];

function Wait({ papers = false }: { papers?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 pb-12 pt-2">
        <BuildStage title="5.5 Sectional conflict" pct={0.42} label="Writing your questions" stageIndex={2} stageCount={5} writing hint="About a minute. It opens here by itself." />
        <WaitConfidenceCard state={state(papers ? { papers: PAPERS, quickStart: true, what: "Sectional conflict" } : {})} />
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

function Debrief() {
  const queryClient = useQueryClient();
  // Seeded before the first render, so nothing is fetched.
  useState(() => {
    queryClient.setQueryData(["session-stats", "fixture-session"], STATS);
    queryClient.setQueryData(["session-debrief", "fixture-session"], DEBRIEF);
    return true;
  });
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-10">
      <SessionDebrief activities={ACTIVITIES} confidenceBefore={7} sessionId="fixture-session" subjectTitle="AP US History" quickStart onBack={noop} />
    </main>
  );
}

function Inner() {
  const view = useSearchParams().get("view") ?? "wait";
  if (view === "debrief") return <Debrief />;
  if (view === "ready") {
    return (
      <main className="mx-auto w-full max-w-[640px] px-5 pt-8">
        <WaitConfidenceCard state={state()} ready />
      </main>
    );
  }
  return <Wait papers={view === "papers"} />;
}

export default function Quick5Preview() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
