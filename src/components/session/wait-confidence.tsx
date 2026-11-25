"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfidenceSlider } from "@/components/session/confidence-slider";
import { rpc, type PaperChoice } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";
import { track } from "@/lib/funnel";
import { CONFIDENCE_START, materialName } from "@/lib/start-check";
import { confidenceSkipKey, waitConfidenceNext } from "@/lib/quick5-confidence";
import { rememberSkip, startCheckSkipped } from "@/lib/start-check-client";
import "@/lib/i18n/start-check";
import "@/lib/i18n/quick5-confidence";
import { cn } from "@/lib/utils";
import type { StudySession } from "@/types";

interface SessionConfidenceCheck {
  ask: boolean;
  what: string;
  /** Offered with the first rating of a course with several papers. */
  papers: PaperChoice[];
}

export interface WaitConfidenceState {
  /** Show the question: on the wait screen while the session is written, or before question 1 of a ready Quick 5. */
  open: boolean;
  what: string;
  papers: PaperChoice[];
  quickStart: boolean;
  answer: (confidence: number, paperId?: string | null) => void;
  skip: () => void;
  pending: boolean;
}

/**
 * "How confident are you with <topic>?", asked once per subject in its first
 * session (normally the first Quick 5) on the wait screen while the session
 * is written, never as a sheet before a start; asked again only when the
 * server says the rating is stale or practice since went badly. The answer
 * is remembered for the subject, so later sessions (the 15-minute session,
 * "Next: <topic>") start straight away and are planned with it; in a Quick 5
 * it also picks which five of the written questions are shown (a saved,
 * untouched quiz is re-picked). Skip, an older server or being offline: the
 * session comes as usual.
 */
export function useWaitConfidence(session: StudySession | undefined): WaitConfidenceState {
  const queryClient = useQueryClient();
  const [closed, setClosed] = useState<string | null>(null);
  const sessionId = session?.id ?? "";
  const skipKey = session ? confidenceSkipKey(session) : "";
  const untouchedQuick5 = !!session?.quickStart && session.activities.length > 0 && session.activities.every((a) => a.status === "pending");
  const eligible =
    !!session &&
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
    mutationFn: (answer: { confidence: number; paperId?: string | null }) =>
      rpc<{ confidence: number; repicked: boolean }>("studySession.answerSessionConfidence", "mutation", { sessionId, ...answer }),
    // A Quick 5's five questions may have been re-picked: load them again before question 1.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] }),
  });

  return {
    open: (eligible && data?.ask === true) || save.isPending,
    what: data?.what || (session?.quickStart ? materialName(session.title) : ""),
    papers: data?.papers ?? [],
    quickStart: !!session?.quickStart,
    pending: save.isPending,
    answer: (confidence, paperId) => {
      setClosed(sessionId);
      save.mutate({ confidence, ...(paperId !== undefined ? { paperId } : {}) });
    },
    skip: () => {
      track("start_check.skipped");
      rememberSkip(skipKey);
      setClosed(sessionId);
    },
  };
}

/**
 * The question itself, on the wait screen (no sheet over it, nothing waits
 * on it): the cat slider, what the answer changes, the paper choice the first
 * time a course with several papers is rated, Continue / Skip. A Quick 5 that
 * is ready while it is open keeps it until answered (`ready`), one tap.
 */
export function WaitConfidenceCard({ state, ready = false, className }: { state: WaitConfidenceState; ready?: boolean; className?: string }) {
  const { t } = useI18n();
  const titleId = useId();
  const [confidence, setConfidence] = useState(CONFIDENCE_START);
  const [paperId, setPaperId] = useState<string | null>(null);
  const hasPapers = state.papers.length > 1;
  const title = state.what ? t("startCheck.title").replace("{what}", state.what) : t("startCheck.titleThis");
  return (
    <form
      aria-labelledby={titleId}
      data-wait-confidence
      onSubmit={(e) => {
        e.preventDefault();
        state.answer(confidence, hasPapers ? paperId : undefined);
      }}
      className={cn("w-full rounded-[var(--r-panel,24px)] border border-border bg-card px-5 pb-4 pt-5 text-center sm:px-7 sm:pt-6", className)}
    >
      <p className="text-small font-extrabold text-muted-foreground">
        {t(ready ? "quick5Conf.ready" : state.quickStart ? "quick5Conf.whileWriting" : "quick5Conf.whileWritingSession")}
      </p>
      <h2 id={titleId} className="mt-1 text-balance text-[21px] font-extrabold leading-[1.2] tracking-tight sm:text-[23px]">
        {title}
      </h2>
      <div className="mt-2">
        <ConfidenceSlider value={confidence} onChange={setConfidence} labelledBy={titleId} />
      </div>
      <p className="mt-1.5 min-h-[22px] text-ui font-semibold text-muted-foreground" aria-live="polite">
        {t(waitConfidenceNext(confidence, state.quickStart))}
      </p>

      {hasPapers && (
        <fieldset className="mt-4 border-t border-border pt-3 text-left">
          <legend className="sr-only">{t("startCheck.paperTitle")}</legend>
          <p className="text-ui font-extrabold text-foreground" aria-hidden>
            {t("startCheck.paperTitle")}
          </p>
          <div className="mt-1 flex flex-col">
            {[{ id: null as string | null, name: t("startCheck.paperMix"), blurb: t("startCheck.paperMixSub") }, ...state.papers].map((p) => {
              const on = paperId === p.id;
              return (
                <label key={p.id ?? "mix"} className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
                  <input type="radio" name="wait-confidence-paper" className="peer sr-only" checked={on} onChange={() => setPaperId(p.id)} />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground",
                      on ? "border-foreground" : "border-border-strong",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full bg-foreground transition-transform", on ? "scale-100" : "scale-0")} />
                  </span>
                  <span className="min-w-0 text-ui leading-5">
                    <span className="font-extrabold text-foreground">{p.name}</span>
                    <span className="text-muted-foreground"> · {p.blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

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
