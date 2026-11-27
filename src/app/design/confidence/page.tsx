"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StartStepSheet } from "@/components/session/start-step-host";
import { SaidGotRow } from "@/components/session/session-debrief";
import { confidenceFace, confidenceResult } from "@/lib/start-check";

const PAPERS = [
  { id: "ib-sci-p1", name: "Paper 1", blurb: "Multiple choice and data-based questions" },
  { id: "ib-sci-p2", name: "Paper 2", blurb: "Short-answer and extended-response questions" },
];

/**
 * Design preview of the start step (the one screen before a session is
 * made) and the debrief's "You said / You got" row, with fixture data and no
 * network.
 *   (default)        a full session in a new subject: practice or study, and the confidence
 *   ?first=1         a learner's first session: also how long
 *   ?papers=1        a course with several papers, none chosen yet
 *   ?quick=1         started from a Quick 5 button
 *   ?mode=study      "Just study the topic" selected
 *   ?only=mode       nothing but the length is due (a second session in a rated subject)
 *   ?v=6             the slider on a score
 *   ?view=debrief    the "You said / You got" row for each pose
 */
function Inner() {
  const q = useSearchParams();
  if (q.get("view") === "debrief") {
    const rows = [confidenceResult(1, 4, 10)!, confidenceResult(3, 7, 10)!, confidenceResult(6, 6, 10)!, confidenceResult(8, 9, 10)!, confidenceResult(10, 8, 10)!];
    return (
      <main className="mx-auto min-h-dvh max-w-[640px] bg-background px-5 py-8">
        <h1 className="text-[28px] font-extrabold tracking-tight">7 of 10 right</h1>
        <p className="mt-1 text-ui text-muted-foreground">Cell membranes · 12 min</p>
        {rows.map((r, i) => (
          <SaidGotRow key={i} said={r.said} got={r.got} verdict={r.verdict} className="mt-6 px-1" />
        ))}
        {/* A Quick 5: its own score out of five, and the exam-level line. */}
        <SaidGotRow said={7} got={3} of={5} gotFace={confidenceFace(6)} verdict="asExpected" className="mt-6 px-1">
          <p className="mt-2 text-ui font-semibold text-muted-foreground">
            <span className="font-extrabold text-foreground">Exam-level: 1 of 2.</span> Those are pitched at the real exam.
          </p>
        </SaidGotRow>
      </main>
    );
  }
  const first = q.get("first") === "1";
  const papers = q.get("papers") === "1";
  const onlyMode = q.get("only") === "mode";
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4">
      <StartStepSheet
        request={{
          what: "Cell membranes",
          topicNames: [],
          asks: { length: first || onlyMode, confidence: !onlyMode, paper: papers },
          quickStart: q.get("quick") === "1",
          initialMinutes: 15,
          papers: papers ? PAPERS : [],
          paperId: null,
        }}
        onAnswer={() => {}}
        initialConfidence={Number(q.get("v") ?? 5)}
        initialMode={q.get("mode") === "study" ? "study" : "practice"}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
