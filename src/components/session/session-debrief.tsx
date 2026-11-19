"use client";

import { useNewUi } from "@/lib/new-ui";
import { MathText } from "@/components/ui/markdown-text";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import {
  Sparkles,
  Loader2,
  Play,
  Flame,
  ArrowRight,
  ChevronDown,
  Target,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { useStreak } from "@/lib/rewards";
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
import "@/lib/i18n/rewards";

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

/** Old cached debriefs were headed "Session debrief — <title>"; that's filler. */
const usefulHeadline = (h: string | undefined) =>
  h && !/^session debrief\b/i.test(h.trim()) ? h : undefined;

function StatTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-3.5">
      <span className={cn("flex items-center gap-1.5 text-[19px] font-bold tabular-nums leading-none", tone)}>
        {icon}
        {value}
      </span>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * End of session, in the shape learning apps converge on: one character,
 * one title, a few hard numbers, one next step. The model-written report is
 * a line under the title plus an optional "full report" below.
 */
export function SessionDebrief({
  onBack,
  sessionId,
  workspaceId,
  subjectTitle,
  quickStart = false,
  sessionBonus = 0,
  streakLitDays = null,
}: {
  onBack: () => void;
  sessionId: string;
  /** Lets a finished Quick 5 hand off to today's full session. */
  workspaceId?: string;
  subjectTitle?: string;
  quickStart?: boolean;
  /** Points for finishing the whole session (shown until the server's count arrives). */
  sessionBonus?: number;
  /** Streak length when a completion in this visit made today count; null otherwise. */
  streakLitDays?: number | null;
}) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showReport, setShowReport] = useState(false);
  const handOff = quickStart && !!workspaceId;

  const { data: subjectSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["study-sessions", workspaceId],
    queryFn: () => fetchStudySessions(workspaceId!),
    enabled: handOff,
  });
  const fullSession = subjectSessions ? pickFullSession(subjectSessions, sessionId) : undefined;
  const fullMinutes = fullSession
    ? fullSession.generating
      ? fullSession.durationMinutes
      : remainingMinutes(fullSession.activities) || fullSession.durationMinutes
    : FOLLOW_UP_MINUTES;
  const openSession = (id: string) => router.push(`/workspace/${workspaceId}/session/${id}`);
  const startFull = useMutation({
    mutationFn: () =>
      createStudySession({
        workspaceId: workspaceId!,
        title: subjectTitle || t("session.defaultTitle"),
        depth: "moderate",
        durationMinutes: FOLLOW_UP_MINUTES,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["study-sessions", workspaceId] });
      if (created) openSession(created.id);
    },
    onError: (error) => toastError(error, t("session.quick5StartFailed")),
  });

  const { data: streak } = useStreak();
  const { data: stats } = useQuery({
    queryKey: ["session-stats", sessionId],
    queryFn: () => studySessionApi.getStats(sessionId),
    retry: 1,
  });
  const { data: debrief, isLoading: debriefLoading } = useQuery({
    queryKey: ["session-debrief", sessionId],
    queryFn: () => studySessionApi.getDebrief(sessionId),
    staleTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SESSION_COMPLETED_EVENT, { detail: { sessionId } }));
  }, [sessionId]);

  const verdict = usefulHeadline(debrief?.headline) ?? debrief?.summary;
  const hasReport = !!debrief && (debrief.sections.length > 0 || !!usefulHeadline(debrief.headline));
  const streakDays = streakLitDays ?? (streak?.todayDone ? streak.current : null);
  const points = Math.max(stats?.points ?? 0, sessionBonus);

  const primary = handOff ? (
    <Button
      size="lg"
      className="w-full text-[15px]"
      disabled={sessionsLoading || startFull.isPending}
      onClick={() => (fullSession ? openSession(fullSession.id) : startFull.mutate())}
    >
      {startFull.isPending || sessionsLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4 fill-current" />
      )}
      {t(fullSession ? "session.quick5FinishCta" : "session.quick5StartCta").replace("{n}", String(fullMinutes))}
    </Button>
  ) : quickStart ? (
    <Button size="lg" className="w-full text-[15px]" onClick={onBack}>
      {t("debrief.continue")}
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  ) : (
    <Link href="/flashcards/review" className="block w-full">
      <Button size="lg" className="w-full text-[15px]">
        {t("session.reviewDueCards")}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-md flex-col items-center pb-10 pt-2 text-center animate-fade-up">
      <div className="relative" aria-hidden>
        {newUi ? (
          <Mascot pose="trophy" className="h-[112px] sm:h-[128px]" />
        ) : (
          <Image src="/illustrations/props/trophy.png" alt="" width={160} height={160} className="w-24" />
        )}
        <ConfettiDots />
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[28px]">
        {t(quickStart ? "debrief.quick5Complete" : "debrief.complete")}
      </h2>
      <div className="mt-1.5 min-h-6 text-[15px] leading-6 text-muted-foreground">
        {verdict ? (
          <MathText text={verdict} />
        ) : debriefLoading ? (
          <span className="inline-block h-4 w-56 animate-pulse rounded-full bg-muted align-middle" />
        ) : null}
      </div>

      <div className="mt-6 grid w-full grid-cols-3 gap-2.5" role="status">
        {stats ? (
          <>
            <StatTile
              tone="text-accent"
              icon={<Sparkles className="size-4" fill="currentColor" />}
              value={`+${points}`}
              label={t("debrief.points")}
            />
            {stats.accuracy !== null ? (
              <StatTile
                tone="text-success"
                icon={<Target className="size-4" />}
                value={`${Math.round(stats.accuracy * 100)}%`}
                label={t("debrief.accuracy")}
              />
            ) : (
              <StatTile
                tone="text-success"
                icon={<CheckCircle2 className="size-4" />}
                value={`${stats.activitiesDone}/${stats.activitiesTotal}`}
                label={t("debrief.done")}
              />
            )}
            <StatTile
              tone="text-[#0369a1]"
              icon={<Clock className="size-4" />}
              value={t("debrief.minutes").replace("{n}", String(stats.minutes))}
              label={t("debrief.time")}
            />
          </>
        ) : (
          [0, 1, 2].map((i) => <div key={i} className="h-[74px] animate-pulse rounded-2xl bg-muted" />)
        )}
      </div>

      {streakDays !== null && streakDays > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#fff1e6] px-3.5 py-1.5 text-[13px] font-semibold text-[#9a3412]">
          <Flame className={cn("size-4 text-[#f97316]", streakLitDays !== null && "animate-streak-pop")} fill="currentColor" strokeWidth={1.6} />
          {t("rewards.streakDays").replace("{n}", String(streakDays))}
        </p>
      )}

      <div className="mt-7 w-full space-y-1">
        {primary}
        {(handOff || !quickStart) && (
          <Button size="lg" variant="ghost" className="w-full text-muted-foreground" onClick={onBack}>
            {t("session.backToWorkspace")}
          </Button>
        )}
      </div>

      {hasReport && (
        <div className="mt-4 w-full text-left">
          <button
            type="button"
            onClick={() => setShowReport((v) => !v)}
            aria-expanded={showReport}
            className="mx-auto flex items-center gap-1 text-[13px] font-semibold text-accent-dim hover:underline"
          >
            {t(showReport ? "debrief.hideReport" : "debrief.seeReport")}
            <ChevronDown className={cn("size-4 transition-transform", showReport && "rotate-180")} />
          </button>
          {showReport && debrief && (
            <div className="mt-4 space-y-5 rounded-2xl border border-border p-5 animate-fade-up">
              {usefulHeadline(debrief.headline) && debrief.summary && (
                <p className="text-sm leading-6 text-foreground">
                  <MathText text={debrief.summary} />
                </p>
              )}
              {debrief.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="mb-1.5 text-sm font-semibold">{section.heading}</h3>
                  {section.body && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      <MathText text={section.body} />
                    </p>
                  )}
                  {section.bullets && (
                    <ul className="space-y-2">
                      {section.bullets.map((b) => (
                        <li key={b.text} className="flex gap-2.5">
                          <span
                            className={cn(
                              "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                              section.tone === "good" ? "bg-success" : section.tone === "improve" ? "bg-red-500" : "bg-accent",
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium leading-6">
                              <MathText text={b.text} />
                            </p>
                            {b.detail && (
                              <p className="text-sm leading-6 text-muted-foreground">
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
          )}
        </div>
      )}
    </div>
  );
}
