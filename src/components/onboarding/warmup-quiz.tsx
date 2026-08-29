"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studySessionApi, type ApiWarmupQuestion } from "@/lib/api/study-session";
import { MarkdownText } from "@/components/ui/markdown-text";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

/**
 * Warm-up quiz shown while a session generates: unseen questions from the
 * workspace's artifact bank (free — no LLM call). The bank fills up partway
 * through analysis, so we poll until questions appear; brand-new workspaces
 * simply render nothing until then. When the current batch runs out, the
 * next one is fetched, so questions keep coming for as long as the wait
 * screen is mounted.
 */
export function WarmupQuiz({ workspaceId }: { workspaceId: string }) {
  const [questions, setQuestions] = useState<ApiWarmupQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const stopRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);

  const fetchBatch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const rows = await studySessionApi.getWarmupQuiz(workspaceId);
      if (stopRef.current) return;
      const fresh = rows.filter((r) => !seenRef.current.has(r.question));
      const batch = fresh.length > 0 ? fresh : rows;
      if (batch.length > 0) {
        for (const q of batch) seenRef.current.add(q.question);
        setQuestions((prev) => [...prev, ...batch]);
      }
    } catch {
      /* bank not ready yet */
    } finally {
      fetchingRef.current = false;
    }
  }, [workspaceId]);

  useEffect(() => {
    stopRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await fetchBatch();
      if (stopRef.current) return;
      // Keep polling until the first batch lands.
      setQuestions((prev) => {
        if (prev.length === 0) timer = setTimeout(poll, 8000);
        return prev;
      });
    };
    void poll();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchBatch]);

  // Refill before the user reaches the end of the loaded questions.
  useEffect(() => {
    if (questions.length > 0 && index >= questions.length - 1) {
      void fetchBatch();
    }
  }, [index, questions.length, fetchBatch]);

  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  if (questions.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-left">
        <p className="text-sm font-semibold">Warm-up quiz incoming…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Writing a few quick questions from your materials so you can practice
          while the session builds.
        </p>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="mt-6 rounded-xl border border-accent/25 bg-accent-soft/40 px-4 py-3 text-left">
        <p className="text-sm font-semibold">
          {score}/{answered} correct so far
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fetching more questions…
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
          {score}/{answered} correct
        </p>
      </div>
      <div className="mt-2 text-sm font-medium">
        <MarkdownText text={q.question} />
      </div>
      <div className="mt-3 space-y-2">
        {q.options.map((option, i) => {
          const hasPicked = picked !== null;
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              type="button"
              disabled={hasPicked}
              onClick={() => {
                setPicked(i);
                setAnswered((a) => a + 1);
                if (isCorrect) setScore((s) => s + 1);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                !hasPicked && "border-border hover:border-accent hover:bg-accent-soft/40",
                hasPicked && isCorrect && "border-accent bg-accent-soft/50",
                hasPicked && isPicked && !isCorrect && "border-rose/50 bg-rose/10",
                hasPicked && !isPicked && !isCorrect && "border-border/60 opacity-60",
              )}
            >
              {hasPicked && isCorrect && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
              {hasPicked && isPicked && !isCorrect && (
                <X className="h-3.5 w-3.5 shrink-0 text-rose" />
              )}
              <span className="min-w-0">
                <MarkdownText text={option} />
              </span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="mt-3">
          {q.explanation && (
            <div className="text-xs text-muted-foreground">
              <MarkdownText text={q.explanation} />
            </div>
          )}
          <button
            type="button"
            onClick={next}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
