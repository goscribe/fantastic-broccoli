"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studySessionApi, type ApiWarmupQuestion } from "@/lib/api/study-session";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

/**
 * Warm-up quiz shown while a session generates: unseen questions from the
 * workspace's artifact bank (free — no LLM call). The bank fills up partway
 * through analysis, so we poll until questions appear; brand-new workspaces
 * simply render nothing until then.
 */
export function WarmupQuiz({ workspaceId }: { workspaceId: string }) {
  const [questions, setQuestions] = useState<ApiWarmupQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const rows = await studySessionApi.getWarmupQuiz(workspaceId);
        if (stopRef.current) return;
        if (rows.length > 0) {
          setQuestions(rows);
          return;
        }
      } catch {
        /* bank not ready yet */
      }
      if (!stopRef.current) timer = setTimeout(poll, 8000);
    };
    void poll();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceId]);

  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  if (questions.length === 0) return null;

  if (index >= questions.length) {
    return (
      <div className="mt-6 rounded-xl border border-accent/25 bg-accent-soft/40 px-4 py-3 text-left">
        <p className="text-sm font-semibold">
          Warm-up done — {score}/{questions.length} correct
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your full session will be ready in a moment.
        </p>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="mt-6 rounded-xl border border-border bg-card px-4 py-4 text-left">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          Warm-up while you wait
        </p>
        <p className="text-[11px] text-muted-foreground">
          {index + 1}/{questions.length}
        </p>
      </div>
      <p className="mt-2 text-sm font-medium">{q.question}</p>
      <div className="mt-3 space-y-2">
        {q.options.map((option, i) => {
          const answered = picked !== null;
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => {
                setPicked(i);
                if (isCorrect) setScore((s) => s + 1);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                !answered && "border-border hover:border-accent hover:bg-accent-soft/40",
                answered && isCorrect && "border-accent bg-accent-soft/50",
                answered && isPicked && !isCorrect && "border-rose/50 bg-rose/10",
                answered && !isPicked && !isCorrect && "border-border/60 opacity-60",
              )}
            >
              {answered && isCorrect && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
              {answered && isPicked && !isCorrect && (
                <X className="h-3.5 w-3.5 shrink-0 text-rose" />
              )}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-3">
          {q.explanation && (
            <p className="text-xs text-muted-foreground">{q.explanation}</p>
          )}
          <button
            type="button"
            onClick={next}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            {index + 1 < questions.length ? "Next question" : "Finish"}
          </button>
        </div>
      )}
    </div>
  );
}
