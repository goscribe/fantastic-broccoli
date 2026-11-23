"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LongAnswerActivity } from "@/components/session/long-answer-activity";
import type { PartMarking, WorksheetContent } from "@/types";

/**
 * Design preview of a long-answer question in the session player's shell, on
 * a real generated IB Biology LAQ and a real marking of a middling answer
 * (gpt-6-luna, Nov 2026). "Submit for marking" returns that marking after a
 * short pause; no signed-in session. /design is a dev-only route.
 */
const CONTENT: WorksheetContent = {
  "type": "worksheet",
  "format": "long_answer",
  "steps": [
    {
      "title": "Aerobic respiration and ATP production",
      "intro": "",
      "parts": [
        {
          "label": "a",
          "prompt": "Explain how the stages of aerobic respiration lead to ATP production, linking substrate breakdown, reduced carriers, electron transport, the proton gradient and oxygen. [6]",
          "type": "essay",
          "commandTerm": "Explain",
          "answer": "During glycolysis, glucose is broken down into pyruvate, and some ATP is produced by substrate-level phosphorylation. Pyruvate is further oxidised in the link reaction and the Krebs cycle, releasing carbon dioxide and transferring energy to reduced NAD and reduced FAD. These reduced carriers deliver electrons to the electron transport chain on the inner mitochondrial membrane. As electrons pass along the chain, energy released is used to pump protons from the mitochondrial matrix into the intermembrane space. This creates an electrochemical proton gradient. Protons then move back into the matrix through ATP synthase, and this flow drives the phosphorylation of ADP with inorganic phosphate to form ATP. Oxygen accepts electrons at the end of the electron transport chain and combines with them and protons to form water. By accepting electrons, oxygen allows electron transport to continue, sustaining proton pumping and the gradient required for oxidative phosphorylation.",
          "marks": 6,
          "markScheme": {
            "points": [
              {
                "point": 1,
                "requirements": "Explains that glucose or its breakdown products are oxidised, releasing energy."
              },
              {
                "point": 1,
                "requirements": "Links oxidation during respiration to the production of reduced NAD and/or reduced FAD."
              },
              {
                "point": 1,
                "requirements": "States that reduced carriers deliver electrons to the electron transport chain."
              },
              {
                "point": 1,
                "requirements": "Links electron transfer to energy being used to pump protons across the inner mitochondrial membrane."
              },
              {
                "point": 1,
                "requirements": "Explains that protons flowing down their gradient through ATP synthase drive ATP formation from ADP and phosphate."
              },
              {
                "point": 1,
                "requirements": "States that oxygen accepts electrons at the chain's end and combines with protons to form water."
              }
            ],
            "totalPoints": 6
          }
        }
      ]
    }
  ]
};

const ANSWER = "Glycolysis takes place in the cytoplasm, where glucose is split into two pyruvate molecules and a small amount of ATP is made. The pyruvate then goes into the mitochondria and enters the Krebs cycle, which releases carbon dioxide.\n\nThe electron transport chain is on the inner mitochondrial membrane. Electrons are passed along it and the energy is used to pump protons across the membrane. Oxygen is the final electron acceptor and forms water. Most of the ATP is made here.";

const MARKING: PartMarking = {
  "points": [
    {
      "point": 1,
      "requirements": "Explains that glucose or its breakdown products are oxidised, releasing energy.",
      "achievedPoints": 0.0,
      "quote": "glucose is split into two pyruvate molecules and a small amount of ATP is made",
      "feedback": "You describe glucose being split, but do not explain that glucose or its products are oxidised, releasing energy."
    },
    {
      "point": 1,
      "requirements": "Links oxidation during respiration to the production of reduced NAD and/or reduced FAD.",
      "achievedPoints": 0.0,
      "quote": "",
      "feedback": "You do not mention reduced NAD or reduced FAD being produced during oxidation."
    },
    {
      "point": 1,
      "requirements": "States that reduced carriers deliver electrons to the electron transport chain.",
      "achievedPoints": 0.0,
      "quote": "Electrons are passed along it",
      "feedback": "You mention electrons passing along the chain, but not that reduced carriers deliver them there."
    },
    {
      "point": 1,
      "requirements": "Links electron transfer to energy being used to pump protons across the inner mitochondrial membrane.",
      "achievedPoints": 1.0,
      "quote": "Electrons are passed along it and the energy is used to pump protons across the membrane.",
      "feedback": "You correctly link electron transfer along the chain to energy being used to pump protons across the membrane."
    },
    {
      "point": 1,
      "requirements": "Explains that protons flowing down their gradient through ATP synthase drive ATP formation from ADP and phosphate.",
      "achievedPoints": 0.0,
      "quote": "Most of the ATP is made here.",
      "feedback": "You do not explain proton flow through ATP synthase driving ATP formation from ADP and phosphate."
    },
    {
      "point": 1,
      "requirements": "States that oxygen accepts electrons at the chain's end and combines with protons to form water.",
      "achievedPoints": 1.0,
      "quote": "Oxygen is the final electron acceptor and forms water.",
      "feedback": "You correctly state that oxygen is the final electron acceptor and that water forms."
    }
  ],
  "achievedPoints": 2.0,
  "totalPoints": 6,
  "correct": false,
  "summary": "You correctly explain proton pumping and oxygen's role, earning 2/6. To gain the most marks, connect reduced carriers to electron delivery and explain how the proton gradient drives ATP synthesis through ATP synthase."
};

const fakeMark = async () => {
  await new Promise((r) => setTimeout(r, 600));
  return MARKING;
};

export default function LongAnswerPreview() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
          <button type="button" aria-label="Close" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
            <X className="size-[22px]" />
          </button>
          <span className="flex-1 text-small font-bold text-muted-foreground">Practice · 9 of 9</span>
          <button type="button" className="text-small font-bold text-muted-foreground" onClick={() => setRun((r) => r + 1)} data-testid="fill">
            Fill sample answer
          </button>
        </div>
      </div>
      <div className="px-4 pb-28 pt-4 sm:px-10 sm:pt-6">
        <div className="mx-auto w-full max-w-3xl">
          <LongAnswerActivity
            key={run}
            activityId={`bank-design-laq-${run}`}
            content={CONTENT}
            draft={run > 0 ? { answer: ANSWER, marking: null } : undefined}
            estimatedMinutes={8}
            onComplete={() => {}}
            mark={fakeMark}
          />
        </div>
      </div>
    </div>
  );
}
