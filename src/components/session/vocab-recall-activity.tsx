"use client";

import { useState } from "react";
import { VocabRecallContent } from "@/types";
import { useActivityDraft } from "@/lib/use-activity-draft";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, X, ArrowRight, RotateCcw } from "lucide-react";

interface VocabRecallActivityProps {
  activityId: string;
  content: VocabRecallContent;
  draft?: Record<string, unknown>;
  onTermResult?: (index: number, correct: boolean) => void;
  onComplete: () => void;
}

interface VocabDraft {
  queue: number[];
  position: number;
  missed: number[];
  learned: number[];
  round: number;
  attempts: number;
}

/**
 * Loops through the vocabulary until every term is recalled: terms marked
 * "missed" are re-queued into another round, and the activity only
 * completes once all terms have been recalled correctly at least once.
 */
export function VocabRecallActivity({
  activityId,
  content,
  draft,
  onTermResult,
  onComplete,
}: VocabRecallActivityProps) {
  const restored = draft as Partial<VocabDraft> | undefined;
  const allIndices = content.terms.map((_, i) => i);
  const [queue, setQueue] = useState<number[]>(
    restored?.queue?.length ? restored.queue : allIndices,
  );
  const [position, setPosition] = useState(restored?.position ?? 0);
  const [missed, setMissed] = useState<number[]>(restored?.missed ?? []);
  const [learned, setLearned] = useState<Set<number>>(
    new Set(restored?.learned ?? []),
  );
  const [round, setRound] = useState(restored?.round ?? 1);
  const [attempts, setAttempts] = useState(restored?.attempts ?? 0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  useActivityDraft(activityId, {
    queue,
    position,
    missed,
    learned: [...learned],
    round,
    attempts,
  });

  const total = content.terms.length;
  const done = learned.size === total;
  const termIndex = queue[position];
  const term = content.terms[termIndex];

  const mark = (correct: boolean) => {
    onTermResult?.(termIndex, correct);
    setAttempts((n) => n + 1);

    const nextMissed = correct ? missed : [...missed, termIndex];
    if (correct) {
      setLearned((prev) => new Set(prev).add(termIndex));
    } else {
      setMissed(nextMissed);
    }

    setAnswer("");
    setRevealed(false);

    if (position < queue.length - 1) {
      setPosition(position + 1);
    } else if (nextMissed.length > 0) {
      setQueue(nextMissed);
      setMissed([]);
      setPosition(0);
      setRound((r) => r + 1);
    }
  };

  if (done) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg font-bold tracking-tight">
          All {total} terms recalled
        </p>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          {attempts === total
            ? "Perfect recall — every term on the first try."
            : `Took ${attempts} attempts across ${round} round${round > 1 ? "s" : ""} — the tricky ones will resurface in future sessions.`}
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
        <div className="flex items-center gap-3">
          {round > 1 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <RotateCcw className="h-3 w-3" />
              Round {round}
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {learned.size} / {total} learnt
          </span>
        </div>
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
