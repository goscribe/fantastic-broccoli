"use client";

import { useState } from "react";
import { BuildStage, type BuildStageProps } from "@/components/session/build-stage";
import { SessionPrecheck, type QuizApi } from "@/components/session/precheck";
import { WaitConfidenceCard, type WaitConfidenceState } from "@/components/session/wait-confidence";

/**
 * The session's wait screen while its plan is written, as one screen:
 *
 * - Something to do (the confidence question, the quick check, its results,
 *   the warm-up after a Skip): that is the main content. The build shrinks to
 *   a header over it (small cat, title, thin bar, one status line, the steps
 *   folded behind "7 steps"), so the question and its options fit a laptop or
 *   a phone without scrolling.
 * - Nothing to do (skipped with no warm-up questions, no question bank yet):
 *   the full wait screen with the cat and the steps.
 *
 * Presentational: the page owns the progress events and passes them in.
 */
export function SessionBuildWait({
  build,
  workspaceId,
  focus,
  confidence,
  extras,
  api,
}: {
  build: BuildStageProps;
  workspaceId: string;
  /** What the quick check is about (the session title). */
  focus: string;
  /** The confidence question, asked here while the session is written (once per subject). */
  confidence?: WaitConfidenceState;
  /** Shown between the progress and the quick check (the change-course link, the syllabus-match card). */
  extras?: React.ReactNode;
  /** Fixtures for /design previews; the live API otherwise. */
  api?: QuizApi;
}) {
  const [quizShown, setQuizShown] = useState(false);
  const asking = !!confidence?.open;
  const compact = asking || quizShown;
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 pb-12 pt-2 animate-fade-up">
      <BuildStage {...build} compact={compact} />
      {extras}
      {asking ? (
        <WaitConfidenceCard state={confidence} />
      ) : (
        // Flat under the header, like the session player: a hairline between them, no second card.
        <div className={compact ? "w-full border-t border-border pt-5" : "contents"}>
          <SessionPrecheck workspaceId={workspaceId} focus={focus} hero api={api} onShown={setQuizShown} />
        </div>
      )}
    </div>
  );
}
