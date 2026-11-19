"use client";

import { useNewUi } from "@/lib/new-ui";
import { MathText } from "@/components/ui/markdown-text";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import {
  Sparkles,
  Loader2,
  Play,
  Flame,
  Check,
  ArrowRight,
  FileText,
  CalendarClock,
} from "lucide-react";
import { awardSessionCredits } from "@/lib/credits";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { studySessionApi } from "@/lib/api/study-session";
import { createStudySession, fetchStudySessions } from "@/lib/api/study";
import { pickStudyNowSession } from "@/components/session/study-now-card";
import { remainingMinutes } from "@/components/session/session-progress";
import { toastError } from "@/lib/toast";
import type { StudySession } from "@/types";
import { SESSION_COMPLETED_EVENT } from "@/lib/api/account";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/session";

/** Length of the full session a finished Quick 5 offers to start. */
const FOLLOW_UP_MINUTES = 15;

/** Today's full (non-Quick 5) session for the subject, if one is open. */
function pickFullSession(
  sessions: StudySession[],
  excludeId: string,
): StudySession | undefined {
  return pickStudyNowSession(
    sessions.filter(
      (s) =>
        !s.quickStart &&
        s.id !== excludeId &&
        (s.generating ||
          s.activities.some(
            (a) => a.status === "pending" || a.status === "in_progress",
          )),
    ),
  );
}

const stages = [
  "session.debriefReviewing",
  "session.debriefComparing",
  "session.debriefWriting",
];


export function SessionDebrief({
  onBack,
  sessionId,
  workspaceId,
  subjectTitle,
  quickStart = false,
}: {
  onBack: () => void;
  sessionId: string;
  /** Lets a finished Quick 5 hand off to today's full session. */
  workspaceId?: string;
  subjectTitle?: string;
  /** Quick 5 sessions promise "5 more tomorrow" instead of a recall session. */
  quickStart?: boolean;
}) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const handOff = quickStart && !!workspaceId;
  // Same cache key as the subject's Study page, so this is usually warm.
  const { data: subjectSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["study-sessions", workspaceId],
    queryFn: () => fetchStudySessions(workspaceId!),
    enabled: handOff,
  });
  const fullSession = subjectSessions
    ? pickFullSession(subjectSessions, sessionId)
    : undefined;
  const fullMinutes = fullSession
    ? fullSession.generating
      ? fullSession.durationMinutes
      : remainingMinutes(fullSession.activities) || fullSession.durationMinutes
    : FOLLOW_UP_MINUTES;
  const openSession = (id: string) =>
    router.push(`/workspace/${workspaceId}/session/${id}`);
  const startFull = useMutation({
    mutationFn: () =>
      createStudySession({
        workspaceId: workspaceId!,
        title: subjectTitle || t("session.defaultTitle"),
        depth: "moderate",
        durationMinutes: FOLLOW_UP_MINUTES,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ["study-sessions", workspaceId],
      });
      if (created) openSession(created.id);
    },
    onError: (error) => toastError(error, t("session.quick5StartFailed")),
  });
  const [stage, setStage] = useState(0);
  const [creditsEarned] = useState(() => awardSessionCredits(sessionId));

  const { data: debrief, isError } = useQuery({
    queryKey: ["session-debrief", sessionId],
    queryFn: () => studySessionApi.getDebrief(sessionId),
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (stage >= stages.length) return;
    const timer = setTimeout(() => setStage((s) => s + 1), 1100);
    return () => clearTimeout(timer);
  }, [stage]);

  const debriefShown = (isError || !!debrief) && stage >= stages.length;
  useEffect(() => {
    if (!debriefShown) return;
    window.dispatchEvent(
      new CustomEvent(SESSION_COMPLETED_EVENT, { detail: { sessionId } }),
    );
  }, [debriefShown, sessionId]);

  if (!isError && (stage < stages.length || !debrief)) {
    return (
      <div className="py-14 text-center space-y-4 animate-fade-up">
        <FileText className="h-7 w-7 text-accent mx-auto" />
        <p className="text-sm font-semibold">{t("session.debriefPreparing")}</p>
        <div className="inline-block text-left space-y-1.5">
          {stages.slice(0, Math.min(stage, stages.length - 1) + 1).map((label, i) => (
            <p
              key={label}
              className="flex items-center gap-2 text-xs font-medium animate-fade-up"
            >
              {i < stage && !(i === stages.length - 1 && !debrief) ? (
                <Check className="h-3.5 w-3.5 text-accent" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
              <span className={i >= stage || (i === stages.length - 1 && !debrief) ? "text-muted-foreground" : ""}>
                {t(label)}
              </span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  const shown = debrief ?? {
    headline: t("session.debriefFallbackHeadline"),
    summary: t("session.debriefFallbackSummary"),
    sections: [],
  };

  return (
    <div className="animate-fade-up pb-10">
      {handOff && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-accent/30 bg-accent-soft p-4 sm:p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-dim">
            <Check className="h-3.5 w-3.5" />
            {t("session.quick5DoneTitle")}
          </p>
          <h3 className="mt-1.5 flex items-center gap-1.5 text-base font-bold tracking-tight sm:text-lg">
            <Flame className="h-5 w-5 shrink-0 text-accent" fill="currentColor" />
            {t("session.quick5StreakTitle")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t(fullSession ? "session.quick5FinishBody" : "session.quick5StartBody")
              .replace("{subject}", subjectTitle || t("session.defaultTitle"))
              .replace("{n}", String(fullMinutes))}
          </p>
          <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="lg"
              className="w-full px-6 text-[15px] sm:w-auto"
              disabled={sessionsLoading || startFull.isPending}
              onClick={() =>
                fullSession ? openSession(fullSession.id) : startFull.mutate()
              }
            >
              {startFull.isPending || sessionsLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4 fill-current" />
              )}
              {t(fullSession ? "session.quick5FinishCta" : "session.quick5StartCta").replace(
                "{n}",
                String(fullMinutes),
              )}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={onBack}
            >
              {t("session.backToWorkspace")}
            </Button>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-faint">
            <CalendarClock className="h-3.5 w-3.5" />
            {t("session.quick5Tomorrow")}
          </p>
        </div>
      )}

      <div className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-card px-6 py-6">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-48 select-none sm:block"
          aria-hidden
        >
          <Image
            src={newUi ? "/design/props/trophy.png" : "/illustrations/props/trophy.png"}
            alt=""
            width={160}
            height={160}
            className="absolute -bottom-3 right-6 w-24"
          />
          <ConfettiDots />
        </div>
        <div className="relative sm:max-w-[calc(100%-11rem)]">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent-dim mb-2">
            <Sparkles className="h-3 w-3" />
            {t("session.debriefGenerated")}
          </p>
          <h2 className="text-lg font-bold tracking-tight">
            <MathText text={shown.headline} />
          </h2>
      {creditsEarned > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          <Sparkles className="h-3.5 w-3.5" />+{creditsEarned}{" "}
          {t("session.creditsEarned")}
        </p>
      )}
          <p className="text-sm text-muted-foreground leading-6 mt-1.5">
            <MathText text={shown.summary} />
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {shown.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="text-sm font-semibold mb-2 pb-1.5 border-b border-border">
              {section.heading}
            </h3>
            {section.body && (
              <p className="text-sm leading-6 text-foreground">
                <MathText text={section.body} />
              </p>
            )}
            {section.bullets && (
              <ul className="space-y-2.5">
                {section.bullets.map((b) => (
                  <li key={b.text} className="flex gap-2.5">
                    <span
                      className={cn(
                        "mt-2 h-1.5 w-1.5 rounded-full shrink-0",
                        section.tone === "good"
                          ? "bg-success"
                          : section.tone === "improve"
                            ? "bg-red-500"
                            : "bg-accent",
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium leading-6">
                        <MathText text={b.text} />
                      </p>
                      {b.detail && (
                        <p className="text-sm text-muted-foreground leading-6">
                          <MathText text={b.detail} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {!handOff && (
      <div className="mt-8 rounded-xl border border-accent/25 bg-accent-soft p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-accent" />
          {t(quickStart ? "session.quick5DoneTitle" : "session.nextStepTitle")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground leading-6">
          {t(quickStart ? "session.quick5DoneBody" : "session.nextStepBody")}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {quickStart ? (
            <Button size="sm" onClick={onBack}>
              {t("session.backToWorkspace")}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          ) : (
            <>
              <Link href="/flashcards/review">
                <Button size="sm">
                  {t("session.reviewDueCards")}
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={onBack}>
                {t("session.backToWorkspace")}
              </Button>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
