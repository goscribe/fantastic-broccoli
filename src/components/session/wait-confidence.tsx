"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "@/components/session/confidence-slider";
import { rpc } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";
import { track } from "@/lib/funnel";
import { CONFIDENCE_START, materialName } from "@/lib/start-check";
import { confidenceSkipKey, quick5Path } from "@/lib/quick5-confidence";
import { rememberSkip, startCheckSkipped } from "@/lib/start-check-client";
import "@/lib/i18n/start-check";
import "@/lib/i18n/quick5-confidence";
import { cn } from "@/lib/utils";
import type { StudySession } from "@/types";

interface SessionConfidenceCheck {
  ask: boolean;
  what: string;
}

export interface WaitConfidenceState {
  /** Show the question: on the wait screen while the session is written, or before question 1 of a ready Quick 5. */
  open: boolean;
  what: string;
  quickStart: boolean;
  answer: (confidence: number) => void;
  skip: () => void;
  pending: boolean;
}

/**
 * "How confident are you with <topic>?" on a Quick 5's wait screen, while its
 * questions are written. It is asked here only where the answer still
 * changes the session in front of the learner: a Quick 5 is written as a
 * pool, and the rating picks which five are shown (a saved, untouched quiz
 * is re-picked). A full session's plan is already being written by the time
 * its wait screen shows, so it is never asked there: that question (and the
 * paper to prepare for) belongs to the start step, before anything is
 * written (src/lib/start-step-client.ts). Most learners have answered there
 * and never see this; it remains for a Quick 5 started without the step
 * (onboarding, a public note's practice). Once per subject; the answer is
 * remembered for later sessions. Skip, an older server or being offline:
 * the quiz comes as usual.
 */
export function useWaitConfidence(session: StudySession | undefined): WaitConfidenceState {
  const queryClient = useQueryClient();
  const [closed, setClosed] = useState<string | null>(null);
  const sessionId = session?.id ?? "";
  const skipKey = session ? confidenceSkipKey(session) : "";
  const untouchedQuick5 = !!session?.quickStart && session.activities.length > 0 && session.activities.every((a) => a.status === "pending");
  const eligible =
    !!session &&
    // Only a Quick 5: its five questions are picked for the answer. Anything else is already being written.
    session.quickStart &&
    typeof session.confidenceBefore !== "number" &&
    session.status !== "failed" &&
    (session.generating || untouchedQuick5) &&
    closed !== sessionId &&
    !startCheckSkipped(skipKey);

  const { data } = useQuery({
    queryKey: ["session-confidence", sessionId],
    enabled: eligible,
    staleTime: Infinity,
    retry: false,
    queryFn: () => rpc<SessionConfidenceCheck>("studySession.sessionConfidence", "query", { sessionId }),
  });

  const save = useMutation({
    mutationFn: (answer: { confidence: number }) =>
      rpc<{ confidence: number; repicked: boolean }>("studySession.answerSessionConfidence", "mutation", { sessionId, ...answer }),
    // A Quick 5's five questions may have been re-picked: load them again before question 1.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] }),
  });

  return {
    open: (eligible && data?.ask === true) || save.isPending,
    what: data?.what || (session?.quickStart ? materialName(session.title) : ""),
    quickStart: !!session?.quickStart,
    pending: save.isPending,
    answer: (confidence) => {
      setClosed(sessionId);
      save.mutate({ confidence });
    },
    skip: () => {
      track("start_check.skipped");
      rememberSkip(skipKey);
      setClosed(sessionId);
    },
  };
}

/**
 * The question itself, on a Quick 5's wait screen (no sheet over it, nothing
 * waits on it): the cat slider, what the answer changes (which five
 * questions), Continue / Skip. A Quick 5 that is ready while it is open
 * keeps it until answered (`ready`), one tap.
 */
export function WaitConfidenceCard({ state, ready = false, className }: { state: WaitConfidenceState; ready?: boolean; className?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  const [confidence, setConfidence] = useState(CONFIDENCE_START);
  const title = state.what ? t("startCheck.title").replace("{what}", state.what) : t("startCheck.titleThis");
  return (
    <form
      aria-labelledby={titleId}
      data-wait-confidence
      onSubmit={(e) => {
        e.preventDefault();
        state.answer(confidence);
      }}
      className={cn("w-full rounded-[var(--r-panel,24px)] border border-border bg-card px-5 pb-4 pt-5 text-center sm:px-7 sm:pt-6", className)}
    >
      <p className="text-small font-extrabold text-muted-foreground">{t(ready ? "quick5Conf.ready" : "quick5Conf.whileWriting")}</p>
      <h2 id={titleId} className="mt-1 text-balance text-[21px] font-extrabold leading-[1.2] tracking-tight sm:text-[23px]">
        {title}
      </h2>
      <p className="mt-1 text-small font-semibold text-muted-foreground">{t("quick5Conf.picks")}</p>
      <div className="mt-2">
        <ConfidenceSlider value={confidence} onChange={setConfidence} labelledBy={titleId} />
      </div>
      <p className="mt-1.5 min-h-[22px] text-ui font-semibold text-muted-foreground" aria-live="polite">
        {t(`quick5Conf.next.${quick5Path(confidence)}`)}
      </p>

      <div className="mt-4 flex flex-col items-center gap-1">
        <Button type="submit" size="lg" className="w-full" disabled={state.pending}>
          {t("startCheck.continue")}
        </Button>
        <button type="button" onClick={state.skip} disabled={state.pending} className="min-h-11 px-4 text-ui font-bold text-muted-foreground hover:text-foreground">
          {t("startCheck.skip")}
        </button>
      </div>
    </form>
  );
}
