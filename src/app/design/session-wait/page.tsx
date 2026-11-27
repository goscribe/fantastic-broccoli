"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { SessionBuildWait } from "@/components/session/build-wait";
import type { BuildStageProps } from "@/components/session/build-stage";
import type { QuizApi } from "@/components/session/precheck";
import type { WaitConfidenceState } from "@/components/session/wait-confidence";
import type { PrecheckItem, PrecheckTopic } from "@/lib/api/proficiency";
import type { ApiWarmupQuestion } from "@/lib/api/study-session";

/**
 * Design preview of a session's wait screen inside the session page's chrome
 * (the X / notes top bar and the scrolling column), with fixtures and no network:
 *   ?state=quiz        mid-build, the quick check on question 1 (default)
 *   ?state=skipped     mid-build, no quick check (as after Skip, with no warm-up questions yet)
 *   ?state=nomatch     the server returned no topics (nothing matches the session) and no warm-up yet
 *   ?state=warmup      mid-build, the warm-up questions that follow a Skip
 *   ?state=done        everything written ("Finishing up"); answer the check to see its results
 *   ?state=confidence  mid-build, the "How confident are you" question instead
 * Answers: option 1 is right in every fixture.
 */
const PLANNED = [
  "Choose the sound conclusion",
  "IB Paper 2-style: Survey data and spread",
  "IB Paper 2-style: Two regression directions",
  "IB Paper 2-style: Counters and new information",
  "IB Paper 2-style: Two discrete models",
  "IB Paper 2-style: Normal probabilities and boundaries",
  "IB Paper 2-style: Area beneath a density",
].map((title) => ({ title, type: "mcq" }));

const TITLE = "14 topics · Statistics and probability";
const HINT = "A study plan grounded in your materials — usually under a minute. You can leave and come back.";

const BUILD: Record<"mid" | "done", BuildStageProps> = {
  mid: {
    title: TITLE,
    pct: 0.56,
    label: `Writing 3 of 7 — ${PLANNED[2].title}`,
    stageIndex: 2,
    stageCount: 5,
    planned: PLANNED,
    finished: PLANNED.slice(0, 2).map((a) => a.title),
    writing: true,
    hint: HINT,
  },
  done: {
    title: TITLE,
    pct: 0.98,
    label: "Finishing up",
    stageIndex: 4,
    stageCount: 5,
    planned: PLANNED,
    finished: PLANNED.map((a) => a.title),
    writing: true,
    hint: HINT,
  },
};

const item = (topic: number, n: number, question: string, options: string[]): PrecheckItem => ({
  artifactId: `fixture-${topic}`,
  index: n,
  question,
  options,
  difficulty: n,
});

const TOPICS: PrecheckTopic[] = [
  {
    topic: "standard deviation",
    label: "Standard deviation and spread",
    level: "unknown",
    ladder: [
      item(0, 0, "Which measure of spread is not affected by an outlier?", ["Interquartile range", "Range", "Standard deviation", "Variance"]),
      item(0, 1, "A data set has $\\bar{x} = 12$ and $\\sigma = 3$. Each value is multiplied by $2$. What is the new standard deviation?", ["$6$", "$3$", "$9$", "$12$"]),
      item(0, 2, "For $n = 5$ values, $\\sum x = 40$ and $\\sum x^2 = 340$. Find $\\sigma$.", ["$\\sqrt{4}=2$", "$\\sqrt{8}$", "$4$", "$\\sqrt{68}$"]),
    ],
  },
  {
    topic: "normal distribution",
    label: "Normal distribution",
    level: "unknown",
    ladder: [
      item(1, 0, "Roughly what fraction of a normal distribution lies within one standard deviation of the mean?", ["68%", "50%", "95%", "99.7%"]),
      item(1, 1, "$X \\sim N(50, 4^2)$. Find $P(X > 58)$ to 3 significant figures.", ["$0.0228$", "$0.0456$", "$0.977$", "$0.159$"]),
      item(1, 2, "$X \\sim N(\\mu, 2^2)$ and $P(X < 10) = 0.8$. Find $\\mu$ to 3 significant figures.", ["$8.32$", "$11.7$", "$9.16$", "$10.8$"]),
    ],
  },
  {
    topic: "regression",
    label: "Linear regression",
    level: "developing",
    ladder: [
      item(2, 0, "The regression line of $y$ on $x$ should be used to…", ["predict $y$ from a given $x$", "predict $x$ from a given $y$", "measure correlation", "find outliers"]),
      item(2, 1, "$r = -0.94$. Which best describes the correlation?", ["Strong negative", "Weak negative", "Strong positive", "No correlation"]),
    ],
  },
  {
    topic: "discrete random variables",
    label: "Discrete random variables",
    level: "unknown",
    ladder: [
      item(3, 0, "$P(X = x) = kx$ for $x = 1, 2, 3, 4$. Find $k$.", ["$\\tfrac{1}{10}$", "$\\tfrac{1}{4}$", "$\\tfrac{1}{24}$", "$10$"]),
      item(3, 1, "$X \\sim B(10, 0.3)$. Find $E(X)$.", ["$3$", "$0.3$", "$7$", "$2.1$"]),
    ],
  },
];

const WARMUP: ApiWarmupQuestion[] = [
  {
    question: "The median of $3, 7, 8, 12, 20$ is…",
    options: ["$8$", "$10$", "$7$", "$12$"],
    correctIndex: 0,
    explanation: "The middle value of five ordered values is the third: $8$.",
    topic: null,
    unseen: true,
  },
];

const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const answer: QuizApi["answer"] = ({ selectedIndex }) =>
  wait({ correct: selectedIndex === 0, correctIndex: 0, explanation: selectedIndex === 0 ? "" : "Option 1 is right in every preview fixture.", topic: null });

const API: Record<string, QuizApi> = {
  check: { precheck: () => wait(TOPICS), answer, warmup: () => wait([]) },
  none: { precheck: () => wait([]), answer, warmup: () => wait([]) },
  warmup: { precheck: () => wait([]), answer, warmup: () => wait(WARMUP) },
};

const noop = () => {};
const CONFIDENCE: WaitConfidenceState = {
  open: true,
  what: "Statistics and probability",
  quickStart: true,
  answer: noop,
  skip: noop,
  pending: false,
};

function Inner() {
  const state = useSearchParams().get("state") ?? "quiz";
  const build = BUILD[state === "done" ? "done" : "mid"];
  const api = state === "skipped" || state === "nomatch" ? API.none : state === "warmup" ? API.warmup : API.check;
  return (
    // The session page's own frame (page.tsx, new UI): top bar, then the scrolling column.
    <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5">
            <button type="button" aria-label="Back" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground">
              <X className="size-[22px]" />
            </button>
            <span className="flex-1" />
            <button type="button" aria-label="Session notes" className="relative -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
              <MessageSquare className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-10 sm:pt-6" data-scroll-column>
          <div className="mx-auto w-full max-w-2xl">
            <SessionBuildWait key={state} build={build} workspaceId="fixture-workspace" focus={TITLE} api={api} confidence={state === "confidence" ? CONFIDENCE : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessionWaitPreview() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
