"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MarkdownText } from "@/components/ui/markdown-text";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, X } from "lucide-react";

interface TestQuestion {
  front: string;
  back: string;
  type: "mcq" | "fill";
  options?: string[];
}

interface DeckTestViewProps {
  entries: { front: string; back: string }[];
  frontLabel: string;
  backLabel: string;
}

function buildTest(entries: { front: string; back: string }[]): TestQuestion[] {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  return shuffled.map((card) => {
    const type: TestQuestion["type"] =
      entries.length >= 4 && Math.random() < 0.5 ? "mcq" : "fill";
    let options: string[] | undefined;
    if (type === "mcq") {
      const wrong = entries
        .map((c) => c.back)
        .filter((b) => b !== card.back)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      options = [...wrong, card.back].sort(() => Math.random() - 0.5);
    }
    return { ...card, type, options };
  });
}

/** Test mode: every question on one page, graded on submit. */
export function DeckTestView({
  entries,
  frontLabel,
  backLabel,
}: DeckTestViewProps) {
  const [round, setRound] = useState(0);
  const questions = useMemo(
    () => buildTest(entries),
    // Rebuild on retake and when the deck changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, round],
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = (i: number) =>
    (answers[i] ?? "").trim().toLowerCase() ===
    questions[i].back.trim().toLowerCase();

  const correctCount = submitted
    ? questions.reduce((s, _, i) => s + (isCorrect(i) ? 1 : 0), 0)
    : 0;
  const accuracy =
    questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

  const retake = () => {
    setRound((r) => r + 1);
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      {!submitted && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{questions.length} questions</span>
          <button
            type="button"
            onClick={retake}
            className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors"
            title="Start a new test with a fresh shuffle"
          >
            <RotateCcw className="h-3 w-3" />
            New session
          </button>
        </div>
      )}
      {submitted && (
        <div className="rounded-3xl border border-border bg-card px-6 py-8 text-center space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {accuracy >= 80
              ? "Excellent work 🎉"
              : accuracy >= 60
                ? "Good job 👏"
                : "Keep practicing 💪"}
          </h2>
          <p className="text-5xl font-semibold tabular-nums tracking-tight">
            {correctCount}
            <span className="text-muted-foreground">
              {" "}
              / {questions.length}
            </span>
          </p>
          <ProgressBar value={accuracy} className="max-w-xs mx-auto" showLabel />
          <Button variant="outline" size="sm" onClick={retake}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            New session
          </Button>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 space-y-8">
        {questions.map((q, i) => {
          const answered = answers[i] ?? "";
          const correct = submitted && isCorrect(i);
          const wrong = submitted && !isCorrect(i);
          return (
            <div key={`${round}-${i}`} className="space-y-3">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold mt-0.5",
                    correct && "bg-energy/15 text-energy",
                    wrong && "bg-rose/15 text-rose",
                    !submitted && "bg-muted text-muted-foreground",
                  )}
                >
                  {submitted ? (
                    correct ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                      {frontLabel}
                    </p>
                    <p className="mt-1 text-base font-medium leading-relaxed">
                      <MarkdownText text={q.front} />
                    </p>
                  </div>

                  {q.type === "mcq" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options!.map((option, j) => {
                        const isSelected = answered === option;
                        const isCorrectOption = submitted && option === q.back;
                        const isWrongSelection =
                          submitted && isSelected && option !== q.back;
                        return (
                          <button
                            key={j}
                            type="button"
                            disabled={submitted}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [i]: option }))
                            }
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors",
                              !submitted &&
                                (isSelected
                                  ? "border-accent bg-accent-soft"
                                  : "border-border hover:bg-muted/50"),
                              isCorrectOption && "border-energy/50 bg-energy-soft",
                              isWrongSelection && "border-rose/50 bg-rose/10",
                              submitted &&
                                !isCorrectOption &&
                                !isWrongSelection &&
                                "border-border opacity-60",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                                isCorrectOption
                                  ? "bg-energy/15 text-energy"
                                  : isWrongSelection
                                    ? "bg-rose/15 text-rose"
                                    : isSelected
                                      ? "bg-accent/15 text-accent"
                                      : "bg-muted text-muted-foreground",
                              )}
                            >
                              {String.fromCharCode(65 + j)}
                            </span>
                            <span className="flex-1 min-w-0 leading-relaxed">
                              <MarkdownText text={option} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answered}
                      disabled={submitted}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      placeholder={`Type the ${backLabel.toLowerCase()}…`}
                      className={cn(
                        "w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring/30",
                        correct && "border-energy/50 bg-energy-soft",
                        wrong && "border-rose/50 bg-rose/5",
                        !submitted && "border-border focus:border-border-strong",
                      )}
                    />
                  )}

                  {wrong && (
                    <p className="rounded-xl bg-energy-soft px-3.5 py-2.5 text-sm">
                      <span className="font-semibold text-energy">
                        Correct {backLabel.toLowerCase()}:{" "}
                      </span>
                      <MarkdownText text={q.back} />
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!submitted && (
        <div className="flex justify-center">
          <Button onClick={() => setSubmitted(true)}>Submit test</Button>
        </div>
      )}
    </div>
  );
}
