"use client";

import { useEffect, useRef, useState } from "react";
import { ExplainAloudContent } from "@/types";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, Square } from "lucide-react";

interface ExplainAloudActivityProps {
  content: ExplainAloudContent;
  onComplete: () => void;
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function ExplainAloudActivity({
  content,
  onComplete,
}: ExplainAloudActivityProps) {
  const [phase, setPhase] = useState<"idle" | "recording" | "review">("idle");
  const [seconds, setSeconds] = useState(0);
  const [covered, setCovered] = useState<boolean[]>(
    content.keyPoints.map(() => false),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  return (
    <div>
      <p className="text-sm font-semibold mb-1.5">
        Teach it back — out loud
      </p>
      <p className="text-xs text-muted-foreground mb-5">
        Explaining a concept aloud in simple words (the Feynman technique)
        exposes gaps that silent review hides.
      </p>

      <Surface muted className="p-4 mb-5">
        <p className="text-sm text-foreground font-medium">{content.prompt}</p>
      </Surface>

      {phase === "idle" && (
        <Button size="sm" onClick={() => setPhase("recording")}>
          <span className="h-2 w-2 rounded-full bg-rose mr-2" />
          Start explaining
        </Button>
      )}

      {phase === "recording" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose animate-pulse-dot" />
              <span className="text-sm font-semibold">Listening</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatTime(seconds)}
              </span>
            </div>
            <Button size="sm" variant="danger" onClick={() => setPhase("review")}>
              <Square className="h-3 w-3 mr-1.5 fill-current" />
              Done
            </Button>
          </div>
          <div className="flex items-end gap-[3px] h-8" aria-hidden>
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-accent/60 animate-wave"
                style={{
                  height: `${30 + ((i * 41) % 70)}%`,
                  animationDelay: `${(i % 8) * 0.12}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === "review" && (
        <div>
          <p className="text-sm font-semibold mb-3">
            Did you cover these key points?
          </p>
          <div className="space-y-2 mb-5">
            {content.keyPoints.map((point, i) => (
              <button
                key={point}
                type="button"
                onClick={() => {
                  const next = [...covered];
                  next[i] = !next[i];
                  setCovered(next);
                }}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border p-3 text-left text-sm",
                  covered[i]
                    ? "border-accent/40 bg-accent-soft text-foreground"
                    : "border-border hover:border-border-strong text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    covered[i]
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border-strong",
                  )}
                >
                  {covered[i] && <Check className="h-3 w-3" />}
                </span>
                {point}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setPhase("recording");
                setSeconds(0);
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Explain again
            </button>
            <Button size="sm" onClick={onComplete}>
              Continue
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
