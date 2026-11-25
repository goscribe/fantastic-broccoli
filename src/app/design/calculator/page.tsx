"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Mic, X } from "lucide-react";
import { CalculatorTool } from "@/components/calculator/calculator-tool";
import { ScribeEditor } from "@/components/editor/scribe-editor";
import { McqActivity } from "@/components/session/mcq-activity";
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import { isNonCalculator, sessionCalculatorContext } from "@/lib/calculator/access";
import type { SubjectFamily } from "@/lib/subject-family";
import type { McqContent, WorksheetContent } from "@/types";

/**
 * Design preview of the calculator: the session player's shell (or a note's
 * page) with the real activities and the real calculator on sample content,
 * no signed-in session. /design is a dev-only route.
 *
 *   ?case=mcq         a Quick 5-style question in a maths subject
 *   ?case=worksheet   a physics worksheet (Insert writes into the answer)
 *   ?case=noncalc     an IB Maths Paper 1-style paper: the calculator is off
 *   ?case=tools       a history subject: the calculator sits behind "Tools"
 *   ?case=note        the document editor (coursework, My notes)
 */
const MCQ: McqContent = {
  type: "mcq",
  questions: [
    {
      question: "A ladder 6.5 m long leans against a wall and makes an angle of 62° with the ground. How high up the wall does it reach, to 3 significant figures?",
      options: ["3.05 m", "5.74 m", "6.50 m", "7.36 m"],
      correctIndex: 1,
      explanation: "height = 6.5 × sin 62° = 5.74 m (3 s.f.).",
    },
    {
      question: "How many ways can a committee of 3 be chosen from 8 students?",
      options: ["24", "56", "336", "512"],
      correctIndex: 1,
      explanation: "8C3 = 56.",
    },
  ],
};

const WORKSHEET: WorksheetContent = {
  type: "worksheet",
  steps: [
    {
      title: "Stopping distance",
      intro: "A car of mass 1250 kg travels at 27 m/s. The brakes apply a constant force of 6.8 kN until it stops.",
      parts: [
        { label: "a", prompt: "Calculate the car's kinetic energy before braking.", type: "numeric", marks: 2 },
        { label: "b", prompt: "Calculate the braking distance. Show your working.", type: "text", marks: 3 },
      ],
    },
  ],
};

const PAPER_ONE: WorksheetContent = {
  type: "worksheet",
  paper: {
    id: "ib-math-p1",
    board: "IB",
    name: "Paper 1-style",
    minutes: 120,
    calculator: false,
    totalMarks: 110,
    instructions: ["You are not permitted access to any calculator.", "Answer all questions. Show your working."],
  },
  steps: [
    {
      title: "Question 1",
      section: "Section A",
      intro: "Consider the function f(x) = 2x² − 8x + 3.",
      parts: [
        { label: "a", prompt: "Write f(x) in the form a(x − h)² + k.", type: "text", marks: 3 },
        { label: "b", prompt: "Hence state the coordinates of the vertex.", type: "text", marks: 2 },
      ],
    },
  ],
};

const NOTE = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Standard deviation of the sample" }] },
    { type: "paragraph", content: [{ type: "text", text: "Reaction times (s) for the eight trials: 0.31, 0.28, 0.35, 0.30, 0.27, 0.33, 0.29, 0.32." }] },
    { type: "paragraph", content: [{ type: "text", text: "The mean reaction time is" }] },
  ],
};

type Case = "mcq" | "worksheet" | "noncalc" | "tools" | "note";

function Preview() {
  const which = (useSearchParams().get("case") ?? "mcq") as Case;
  const content = useRef<HTMLDivElement>(null);
  const family: SubjectFamily = which === "tools" ? "history" : which === "worksheet" ? "physics" : which === "note" ? "biology" : "maths";
  const worksheet = which === "noncalc" ? PAPER_ONE : WORKSHEET;
  const blocked = which === "noncalc" && isNonCalculator(sessionCalculatorContext({ activities: [{ content: worksheet }], active: { content: worksheet }, itemIndex: 0 }));

  if (which === "note") {
    return (
      <div ref={content} className="mx-auto w-full max-w-[800px] px-4 pb-[calc(3rem+var(--calc-sheet,0px))] pt-4 sm:px-6">
        <p className="text-[17px] font-extrabold">Reaction time practical</p>
        <ScribeEditor
          content={NOTE}
          label="Your note"
          placeholder="Start writing"
          toolbarEnd={<CalculatorTool look="text" family={family} scope={content} />}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background pb-[var(--calc-sheet,0px)]">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
            <button type="button" aria-label="Close" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
              <X className="size-[22px]" />
            </button>
            <span className="flex-1 truncate text-small font-bold text-muted-foreground">{which === "mcq" ? "Quick 5 · 1 of 2" : which === "noncalc" ? "Practice paper" : "Practice · 3 of 5"}</span>
            <button type="button" aria-label="Talk to write" className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <Mic className="size-4" />
            </button>
            <CalculatorTool family={family} blocked={blocked} scope={content} />
            <button type="button" aria-label="Session notes" className="relative -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <MessageSquare className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-10 sm:pt-6">
          <div ref={content} className="mx-auto w-full max-w-3xl">
            {which === "mcq" || which === "tools" ? (
              <McqActivity activityId={`design-calc-${which}`} content={MCQ} onAnswer={() => {}} onComplete={() => {}} />
            ) : (
              <WorksheetActivity activityId={`design-calc-${which}`} content={worksheet} onComplete={() => {}} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalculatorPreview() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
