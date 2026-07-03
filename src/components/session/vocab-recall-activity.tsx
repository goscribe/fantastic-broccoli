"use client";

import { useState } from "react";
import { VocabRecallContent } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, ArrowRight } from "lucide-react";

interface VocabRecallActivityProps {
  content: VocabRecallContent;
  onComplete: () => void;
}

export function VocabRecallActivity({
  content,
  onComplete,
}: VocabRecallActivityProps) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<(boolean | null)[]>(
    content.terms.map(() => null),
  );

  const term = content.terms[index];
  const done = results.every((r) => r !== null);
  const correctCount = results.filter((r) => r === true).length;

  const mark = (correct: boolean) => {
    const next = [...results];
    next[index] = correct;
    setResults(next);
    if (index < content.terms.length - 1) {
      setIndex(index + 1);
      setAnswer("");
      setRevealed(false);
    }
  };

  if (done) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg font-bold tracking-tight">
          {correctCount}/{content.terms.length} recalled
        </p>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          {correctCount === content.terms.length
            ? "Perfect recall — these are locked in."
            : "The ones you missed will come back in your next session."}
        </p>
        <Button size="sm" onClick={onComplete}>
          Continue
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold">
          Define this term from memory
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {index + 1} / {content.terms.length}
        </span>
      </div>

      <p className="text-xl font-bold tracking-tight mb-4">{term.term}</p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write the definition in your own words…"
        rows={3}
        disabled={revealed}
        className="w-full rounded-xl border border-border bg-background p-3.5 text-sm text-foreground focus:outline-none focus:border-accent/50 placeholder:text-faint resize-none"
      />

      {!revealed ? (
        <div className="flex justify-end mt-3">
          <Button
            size="sm"
            onClick={() => setRevealed(true)}
            disabled={!answer.trim()}
          >
            Check my answer
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-accent-soft border border-accent/20 p-4">
            <p className="text-xs font-semibold text-accent mb-1.5">
              Model definition
            </p>
            <p className="text-sm text-foreground">{term.definition}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Compare — did you capture the key idea?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => mark(false)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold",
                  "text-muted-foreground hover:border-rose hover:text-rose",
                )}
              >
                <X className="h-3.5 w-3.5" />
                Missed it
              </button>
              <button
                type="button"
                onClick={() => mark(true)}
                className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-dim"
              >
                <Check className="h-3.5 w-3.5" />
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
