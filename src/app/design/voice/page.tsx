"use client";

import { useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { CopilotTrigger } from "@/components/ai/copilot";
import { VoiceScribe, VoiceScribeTrigger, type VoiceScribeHandle } from "@/components/session/voice-scribe";
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import type { WorksheetContent } from "@/types";
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

export default function VoicePreview() {
  const content = useRef<HTMLDivElement>(null);
  const voice = useRef<VoiceScribeHandle>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5">
            <button type="button" aria-label="Close" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
              <X className="size-[22px]" />
            </button>
            <span className="flex-1 text-small font-bold text-muted-foreground">Practice · 3 of 5</span>
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
            <WorksheetActivity activityId="design-voice" content={CONTENT} onComplete={() => {}} />
          </div>
        </div>
      </div>
      <VoiceScribe ref={voice} scope={content} onOpenChange={setVoiceOpen} />
    </div>
  );
}
