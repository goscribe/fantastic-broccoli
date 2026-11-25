"use client";

import { useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { CopilotTrigger } from "@/components/ai/copilot";
import { VoiceAnswerContext, VoiceScribe, VoiceScribeTrigger, type VoiceScribeHandle } from "@/components/session/voice-scribe";
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import { McqActivity } from "@/components/session/mcq-activity";
import type { McqContent, WorksheetContent } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Design preview of talk to write: the session player's shell with the real
 * worksheet activity and the real voice scribe, on sample content and no
 * signed-in session. /design is a dev-only route.
 */
const CONTENT: WorksheetContent = {
  type: "worksheet",
  steps: [
    {
      title: "Counting fruit",
      intro: "Sam has 2 oranges and 2 bananas. He buys 3 more apples.",
      // A question that needs its figure: "See the whole question" lowers the overlay to read it.
      figures: [
        {
          id: "fruit",
          type: "html",
          title: "Sam's fruit",
          html: '<table style="border-collapse:collapse;font:15px system-ui;margin:auto"><tr><th style="padding:6px 14px;border-bottom:1px solid #ccc">Fruit</th><th style="padding:6px 14px;border-bottom:1px solid #ccc">Count</th></tr><tr><td style="padding:6px 14px">Oranges</td><td style="padding:6px 14px">2</td></tr><tr><td style="padding:6px 14px">Bananas</td><td style="padding:6px 14px">2</td></tr><tr><td style="padding:6px 14px">Apples</td><td style="padding:6px 14px">3</td></tr></table>',
        },
      ],
      parts: [
        { label: "a", prompt: "How many oranges and bananas does Sam have?", type: "numeric", marks: 1 },
        { label: "b", prompt: "How many pieces of fruit does he have in total? Show your working.", type: "text", marks: 2 },
        { label: "c", prompt: "What fraction of his fruit are apples?", type: "text", marks: 1 },
      ],
    },
  ],
};

/** A several-part question whose givens live in the main stem, not in the part (the founder's counters question). */
const COUNTERS: WorksheetContent = {
  type: "worksheet",
  steps: [
    {
      title: "Counters",
      intro: "A bag contains 4 green counters and 6 red counters. Two counters are drawn at random, one after the other, without replacement.",
      parts: [
        { label: "a", prompt: "Calculate the probability that the first counter is green. [1]", type: "numeric", marks: 1 },
        { label: "b", prompt: "Calculate the probability that both counters are the same colour. [3]", type: "text", marks: 3 },
      ],
    },
  ],
};

/** The multiple-choice question from the founder's screenshot (question 4 of 4). */
const SOUND: McqContent = {
  type: "mcq",
  questions: [
    {
      question: "A coin lands heads 36 times in 60 tosses. A report uses only the first 20 tosses that landed heads to estimate its probability of heads. Identify the sound conclusion. [1]",
      options: [
        "The reported estimate of 1 equals the relative frequency across all 60 tosses.",
        "The reported estimate of 1 is biased by selecting only heads.",
        "The reported estimate of 1 proves that heads is certain on the next toss.",
        "The reported estimate of 1 is more reliable because it uses fewer tosses.",
      ],
      correctIndex: 1,
      explanation: "Using only tosses that landed heads gives 20/20 = 1, a biased estimate.",
    },
  ],
};

const SAMPLES = { fruit: "Fruit (3 parts)", counters: "Counters (stem + parts)", mcq: "Multiple choice" } as const;

export default function VoicePreview() {
  const [sample, setSample] = useState<keyof typeof SAMPLES>("fruit");
  const content = useRef<HTMLDivElement>(null);
  const voice = useRef<VoiceScribeHandle>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <VoiceAnswerContext.Provider value={{ toggle: (a) => voice.current?.toggle(a), active: voiceOpen }}>
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
            <button type="button" aria-label="Close" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
              <X className="size-[22px]" />
            </button>
            <span className="flex flex-1 flex-wrap gap-1.5">
              {(Object.keys(SAMPLES) as Array<keyof typeof SAMPLES>).map((k) => (
                <button key={k} type="button" onClick={() => setSample(k)} className={cn("rounded-full px-3 py-1 text-small font-bold", sample === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                  {SAMPLES[k]}
                </button>
              ))}
            </span>
            <VoiceScribeTrigger active={voiceOpen} onClick={() => voice.current?.toggle()} intro />
            <CopilotTrigger compact onClick={() => {}} />
            <button type="button" aria-label="Session notes" className="relative -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <MessageSquare className="size-4" />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-10 sm:pt-6",
          )}
        >
          <div ref={content} className="mx-auto w-full max-w-3xl">
            {sample === "mcq" ? (
              <McqActivity key="mcq" activityId="design-voice-mcq" content={SOUND} onAnswer={() => {}} onComplete={() => {}} onHint={() => {}} />
            ) : (
              <WorksheetActivity key={sample} activityId={`design-voice-${sample}`} content={sample === "fruit" ? CONTENT : COUNTERS} onComplete={() => {}} />
            )}
          </div>
        </div>
      </div>
      <VoiceScribe ref={voice} scope={content} onOpenChange={setVoiceOpen} />
    </div>
    </VoiceAnswerContext.Provider>
  );
}
