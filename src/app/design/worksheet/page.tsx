"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import type { PartMarking, WorksheetContent } from "@/types";

/**
 * Design preview of a session worksheet with the finishable-written flow: a
 * real generated IB Physics question (gpt-6-luna, Nov 2026) with its hint,
 * first step and worked answers, and real markings of a middling answer by
 * the new part marker (part b is marked error carried forward from a).
 * "Check" returns those markings after a short pause; no signed-in session.
 * "Fill sample answers" types them. /design is a dev-only route.
 */
const CONTENT: WorksheetContent = {
  "type": "worksheet",
  "steps": [
    {
      "title": "IB Paper 2-style: Horizontal projectile motion",
      "intro": "A ball is launched horizontally at $12.0\\ \\text{m s}^{-1}$ from a platform $45.0\\ \\text{m}$ above level ground. Air resistance is negligible. Take the magnitude of the acceleration due to gravity as $9.81\\ \\text{m s}^{-2}$.",
      "parts": [
        {
          "label": "a",
          "prompt": "Calculate the time taken for the ball to reach the ground. [2]",
          "type": "numeric",
          "answer": "3.03 s",
          "marks": 2,
          "answerGuide": "One line of working and the answer",
          "hint": "Use the vertical motion; the initial vertical velocity is zero.",
          "firstStep": "$45.0=\\frac{1}{2}(9.81)t^2$",
          "workedAnswer": "For vertical motion, $s=ut+\\frac{1}{2}at^2$. Thus $45.0=\\frac{1}{2}(9.81)t^2$, so $t=\\sqrt{\\frac{2(45.0)}{9.81}}=3.03\\ \\text{s}$.",
          "markScheme": {
            "points": [
              {
                "point": 1,
                "requirements": "Uses vertical displacement with zero initial vertical velocity: $45.0=\\frac{1}{2}(9.81)t^2$."
              },
              {
                "point": 1,
                "requirements": "Obtains $t=3.03\\ \\text{s}$."
              }
            ],
            "totalPoints": 2
          }
        },
        {
          "label": "b",
          "prompt": "Determine the horizontal distance travelled by the ball before it reaches the ground. [2]",
          "type": "numeric",
          "answer": "36.4 m",
          "marks": 2,
          "answerGuide": "One line of working and the answer",
          "hint": "Horizontal velocity is constant during the flight.",
          "firstStep": "$x=v_xt=(12.0)(t)$",
          "workedAnswer": "Horizontal motion has constant velocity, so $x=v_xt=(12.0)(3.03)=36.4\\ \\text{m}$.",
          "markScheme": {
            "points": [
              {
                "point": 1,
                "requirements": "Uses $x=v_xt$ with horizontal speed $12.0\\ \\text{m s}^{-1}$ and the time from (a)."
              },
              {
                "point": 1,
                "requirements": "Obtains $x=36.4\\ \\text{m}$."
              }
            ],
            "totalPoints": 2
          }
        },
        {
          "label": "c",
          "prompt": "Explain why the ball's horizontal velocity remains constant while its vertical velocity changes during flight. [2]",
          "type": "text",
          "answer": "Negligible air resistance means there is no horizontal force, so horizontal acceleration is zero and horizontal velocity stays constant. Gravity acts vertically, causing vertical acceleration and a changing vertical velocity.",
          "marks": 2,
          "answerGuide": "One or two sentences",
          "hint": "Consider the direction of the gravitational force and the resultant horizontal force.",
          "firstStep": "There is no horizontal force because air resistance is negligible.",
          "workedAnswer": "There is no horizontal force because air resistance is negligible, so horizontal acceleration is zero and horizontal velocity stays constant. Gravity acts vertically, causing vertical acceleration and a changing vertical velocity.",
          "markScheme": {
            "points": [
              {
                "point": 1,
                "requirements": "States that no horizontal force acts (or horizontal acceleration is zero), so horizontal velocity is constant."
              },
              {
                "point": 1,
                "requirements": "States that gravity causes vertical acceleration, so vertical velocity changes."
              }
            ],
            "totalPoints": 2
          }
        }
      ]
    }
  ]
};

const ANSWERS: string[] = ["45 = 0.5 x 9.81 x t^2 so t^2 = 10.9, t = 3.3 s", "x = 12 x 3.3 = 39.6 m", "Gravity only pulls down so the horizontal speed stays the same"];

const MARKINGS: Record<number, PartMarking> = {
  "0": {
    "points": [
      {
        "point": 1,
        "requirements": "Uses vertical displacement with zero initial vertical velocity: $45.0=\\frac{1}{2}(9.81)t^2$.",
        "achievedPoints": 1,
        "feedback": "You correctly use the vertical displacement and zero initial vertical velocity in the equation."
      },
      {
        "point": 1,
        "requirements": "Obtains $t=3.03\\ \\text{s}$.",
        "achievedPoints": 0,
        "feedback": "Your final value, 3.3 s, is incorrect; the time is 3.03 s."
      }
    ],
    "achievedPoints": 1,
    "totalPoints": 2,
    "correct": false
  },
  "1": {
    "points": [
      {
        "point": 1,
        "requirements": "Uses $x=v_xt$ with horizontal speed $12.0\\ \\text{m s}^{-1}$ and the time from (a).",
        "achievedPoints": 1,
        "feedback": "You correctly use $x=vt$ with $12.0\\ \\text{m s}^{-1}$ and your time from (a)."
      },
      {
        "point": 1,
        "requirements": "Obtains $x=36.4\\ \\text{m}$.",
        "achievedPoints": 1,
        "feedback": "Your $39.6\\ \\text{m}$ is correct using your time from (a), so this earns the answer mark by ECF."
      }
    ],
    "achievedPoints": 2,
    "totalPoints": 2,
    "correct": true
  },
  "2": {
    "points": [
      {
        "point": 1,
        "requirements": "States that no horizontal force acts (or horizontal acceleration is zero), so horizontal velocity is constant.",
        "achievedPoints": 1,
        "feedback": "You state that gravity acts only downward and that horizontal speed stays the same, so the horizontal motion is correctly explained."
      },
      {
        "point": 1,
        "requirements": "States that gravity causes vertical acceleration, so vertical velocity changes.",
        "achievedPoints": 0,
        "feedback": "You identify gravity as downward, but do not state that it accelerates the ball vertically and changes its vertical velocity."
      }
    ],
    "achievedPoints": 1,
    "totalPoints": 2,
    "correct": false
  }
};

const fakeMark = async ({ partIndex }: { partIndex: number }) => {
  await new Promise((r) => setTimeout(r, 700));
  return MARKINGS[partIndex];
};

export default function WorksheetPreview() {
  const [run, setRun] = useState(0);
  const filled = run > 0;
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
          <button type="button" aria-label="Close" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
            <X className="size-[22px]" />
          </button>
          <span className="flex-1 text-small font-bold text-muted-foreground">Practice · 4 of 9</span>
          <button type="button" className="text-small font-bold text-muted-foreground" onClick={() => setRun((r) => r + 1)} data-testid="fill">
            Fill sample answers
          </button>
        </div>
      </div>
      <div className="px-4 pb-28 pt-4 sm:px-10 sm:pt-6">
        <div className="mx-auto w-full max-w-3xl">
          <WorksheetActivity
            key={run}
            activityId={`bank-design-ws-${run}`}
            content={CONTENT}
            draft={filled ? { answers: Object.fromEntries(ANSWERS.map((a, i) => [`0-${i}`, a])) } : undefined}
            estimatedMinutes={6}
            onComplete={() => {}}
            mark={fakeMark}
          />
        </div>
      </div>
    </div>
  );
}
