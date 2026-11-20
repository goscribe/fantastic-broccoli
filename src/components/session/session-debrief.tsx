"use client";

import { useNewUi } from "@/lib/new-ui";
import { MathText } from "@/components/ui/markdown-text";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import { SparkleBurst } from "@/components/graphics/sparkle-burst";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/lib/use-count-up";
import {
  Loader2,
  Play,
  Flame,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Layers,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { useStreak } from "@/lib/rewards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { studySessionApi } from "@/lib/api/study-session";
import { createStudySession, fetchStudySessions } from "@/lib/api/study";
import { pickStudyNowSession } from "@/components/session/study-now-card";
import { deckEntries } from "@/components/bank/bank-content";
import { remainingMinutes } from "@/components/session/session-progress";
import { toastError } from "@/lib/toast";
import type { StudySession } from "@/types";
import { SESSION_COMPLETED_EVENT } from "@/lib/api/account";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/session";
import "@/lib/i18n/rewards";
import { InviteCard } from "@/components/growth/invite-card";
import { HabitPrompt } from "@/components/reminders/habit-prompt";
import "@/lib/i18n/habits";
import "@/lib/i18n/mistakes";
import { fixMinutes, masteryRow, practiceHref } from "@/lib/mistakes";
import type { ApiSessionStats } from "@/lib/api/study-session";

/** How long the mastery rows get on screen before the study-time sheet opens over them. */
const MASTERY_READ_MS = 4000;

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

/**
 * One row in the "one more small step" list: what returners did on day 0
 * (flashcards from the same notes, a question to Copilot), one tap each.
 */
function NextStep({
  icon,
  title,
  sub,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="grid w-6 shrink-0 place-items-center text-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-5 text-foreground">{title}</span>
        <span className="block text-[12.5px] leading-5 text-muted-foreground">{sub}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** Old cached debriefs were headed "Session debrief — <title>"; that's filler. */
const usefulHeadline = (h: string | undefined) =>
  h && !/^session debrief\b/i.test(h.trim()) ? h : undefined;

/** One figure on the results slip: the label, then the number. No icon, no card of its own. */
function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3.5 text-left first:pl-5 last:pr-5">
      <span className="text-[12.5px] font-bold leading-none text-muted-foreground">{label}</span>
      <span className="text-[24px] font-extrabold tabular-nums leading-none text-foreground">{value}</span>
    </div>
  );
}

/** The three figures in one row, split by hairlines (one card, not three). */
const slipRow = "grid grid-cols-3 divide-x divide-border";

function CountUp({ value, prefix = "" }: { value: number; prefix?: string }) {
  const n = useCountUp(value);
  return <>{`${prefix}${n}`}</>;
}

type MasteryChange = NonNullable<ApiSessionStats["mastery"]>[number];

/**
 * The stats tiles and this session's per-topic mastery change in one card
 * ("Osmosis 48% → 61% +13%"), so the screen gains a few rows rather than
 * another card. The bar shows where the topic was (muted) and what this
 * session added (accent).
 */
function StatsWithMastery({ tiles, mastery }: { tiles: ReactNode; mastery: MasteryChange[] }) {
  const { t } = useI18n();
  return (
    <div className="life-card w-full overflow-hidden" role="status">
      <div className={slipRow}>{tiles}</div>
      <ul className="space-y-3.5 border-t border-border px-5 py-4 text-left" aria-label={t("debrief.masteryTitle")}>
        {mastery.map((m, i) => {
          const { before, after, delta, base, gain } = masteryRow(m);
          return (
            // Phones: two rows keep the next step above the fold.
            <li key={m.topic} className={cn(i >= 2 && "max-sm:hidden")}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="min-w-0 truncate font-semibold">{m.label}</span>
                <span
                  className="shrink-0 tabular-nums text-muted-foreground"
                  aria-label={(before === null ? t("debrief.masteryAriaNew") : t("debrief.masteryAria"))
                    .replace("{topic}", m.label)
                    .replace("{a}", String(before))
                    .replace("{b}", String(after))}
                >
                  {before === null ? (
                    <span className="mr-1.5 text-[12px] font-semibold">{t("debrief.masteryNew")} ·</span>
                  ) : (
                    <>{before}% → </>
                  )}
                  <span className="font-semibold text-foreground">{after}%</span>
                  {delta !== null && delta !== 0 && (
                    <span className={cn("ml-1.5 font-bold", delta > 0 ? "text-accent-dim" : "text-muted-foreground")}>
                      {delta > 0 ? `+${delta}` : `−${-delta}`}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="h-full bg-border-strong" style={{ width: `${base}%` }} />
                <span
                  className="fill-grow h-full rounded-r-full bg-accent"
                  style={{ width: `${gain}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
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
  onAskCopilot,
}: {
  onBack: () => void;
  /** Opens Copilot with this text in the input (the learner sends it). */
  onAskCopilot?: (prompt: string) => void;
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

  // "Next: <weakest topic>": a session on the subject's weakest topic.
  const startWeakest = useMutation({
    mutationFn: (topic: string) =>
      createStudySession({
        workspaceId: workspaceId!,
        title: topic,
        topics: topic,
        depth: "moderate",
        durationMinutes: FOLLOW_UP_MINUTES,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["study-sessions", workspaceId] });
      if (created) openSession(created.id);
    },
    onError: (error) => toastError(error, t("debrief.nextTopicFailed")),
  });

  // After a Quick 5: flashcards from the same notes, one tap away.
  const { data: deck } = useQuery({
    queryKey: ["bank", workspaceId, "FLASHCARD_DECK"],
    queryFn: () => studySessionApi.listBank({ workspaceId: workspaceId!, kind: "FLASHCARD_DECK" }),
    enabled: quickStart && !!workspaceId,
    select: (items) =>
      items
        .map((item) => ({ id: item.id, cards: deckEntries(item)?.entries.length ?? 0 }))
        .sort((a, b) => b.cards - a.cards)
        .find((d) => d.cards > 0),
  });

  const { data: streak } = useStreak();
  const { data: stats, isError: statsError } = useQuery({
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
  const wrong = stats ? Math.max(0, stats.answered - stats.correct) : 0;
  const ask = !stats
    ? null
    : wrong > 0
      ? {
          title: t("habit.askWrongTitle"),
          sub: (wrong === 1 ? t("habit.askWrongSubOne") : t("habit.askWrongSub")).replace("{n}", String(wrong)),
          prompt: t("habit.askWrongPrompt"),
        }
      : stats.answered > 0
        ? { title: t("habit.askDeeperTitle"), sub: t("habit.askDeeperSub"), prompt: t("habit.askDeeperPrompt") }
        : { title: t("habit.askRecapTitle"), sub: t("habit.askRecapSub"), prompt: t("habit.askRecapPrompt") };
  const mistakes = stats?.mistakes ?? 0;
  // A Quick 5 touches a topic or two; its debrief also asks for a study time, so keep it to two rows.
  const mastery = (stats?.mastery ?? []).slice(0, quickStart ? 2 : 3);
  const weakest = !quickStart && workspaceId ? stats?.weakest : null;
  // Fixing mistakes is the practice returners did; it takes the Copilot row's place.
  const askRow = mistakes > 0 && ask && wrong > 0 ? null : ask;
  // "Fix N mistakes" sits right under the main button; the rest are optional extras further down.
  const showSteps = (!!deck && !!workspaceId) || (!!askRow && !!onAskCopilot);

  const primary = handOff ? (
    <Button
      size="lg"
      className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold"
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
    <Button size="lg" className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold" onClick={onBack}>
      {t("debrief.continue")}
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  ) : weakest ? (
    <Button
      size="lg"
      className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold"
      disabled={startWeakest.isPending}
      onClick={() => startWeakest.mutate(weakest.label)}
    >
      {startWeakest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
      <span className="min-w-0 truncate">{t("debrief.nextTopic").replace("{topic}", weakest.label)}</span>
    </Button>
  ) : (
    <Link href="/flashcards/review" className="block w-full">
      <Button size="lg" className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold">
        {t("session.reviewDueCards")}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </Link>
  );

  const statTiles = (stats: ApiSessionStats) => (
    <>
      <StatTile
        value={<CountUp value={points} prefix="+" />}
        label={t("debrief.points")}
      />
      {stats.accuracy !== null ? (
        <StatTile
          value={`${Math.round(stats.accuracy * 100)}%`}
          label={t("debrief.accuracy")}
        />
      ) : (
        <StatTile
          value={`${stats.activitiesDone}/${stats.activitiesTotal}`}
          label={t("debrief.done")}
        />
      )}
      <StatTile
        value={t("debrief.minutes").replace("{n}", String(stats.minutes))}
        label={t("debrief.time")}
      />
    </>);

  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center pb-10 pt-0 animate-fade-up sm:pt-2", !newUi && "text-center")}>
      {newUi ? (
        // The cat holds the trophy beside the result, on the page's one warm panel.
        <div className="life-panel relative flex w-full items-center gap-3 overflow-hidden py-4 pl-4 pr-5 text-left sm:gap-5 sm:py-6 sm:pl-6">
          <div className="relative shrink-0" aria-hidden>
            <SparkleBurst burst={1} count={10} distance={46} />
            <Mascot pose="trophy" className="cat-cheer relative h-[92px] sm:h-[120px]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-balance text-[26px] font-extrabold leading-[1.1] tracking-tight sm:text-[32px]">
              {t(quickStart ? "debrief.quick5Complete" : "debrief.complete")}
            </h2>
            <div className="mt-1.5 text-[14.5px] leading-snug text-foreground/75 line-clamp-2 sm:text-[15.5px]">
              {verdict ? (
                <MathText text={verdict} />
              ) : debriefLoading ? (
                <span className="inline-block h-4 w-40 rounded-full bg-[var(--cream-edge)] align-middle" />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative" aria-hidden>
            <Image src="/illustrations/props/trophy.png" alt="" width={160} height={160} className="w-24" />
            <ConfettiDots />
          </div>
          <h2 className="mt-3 text-[30px] font-extrabold tracking-tight sm:mt-5 sm:text-[36px]">
            {t(quickStart ? "debrief.quick5Complete" : "debrief.complete")}
          </h2>
          <div className="mt-1 min-h-6 text-[14.5px] leading-6 text-muted-foreground line-clamp-2 sm:mt-1.5 sm:text-[15px]">
            {verdict ? (
              <MathText text={verdict} />
            ) : debriefLoading ? (
              <span className="inline-block h-4 w-56 animate-pulse rounded-full bg-muted align-middle" />
            ) : null}
          </div>
        </>
      )}

      {stats && mastery.length > 0 ? (
        <div className="mt-4 w-full sm:mt-6">
          <StatsWithMastery tiles={statTiles(stats)} mastery={mastery} />
        </div>
      ) : statsError ? null : (
      <div className={cn("life-card mt-4 w-full overflow-hidden sm:mt-6", slipRow)} role="status">
        {stats ? (
          statTiles(stats)
        ) : (
          [0, 1, 2].map((i) => (
            <div key={i} className="px-4 py-3.5">
              <Skeleton className="h-[42px] w-full" />
            </div>
          ))
        )}
      </div>
      )}

      {streakDays !== null && streakDays > 0 && (
        <p className="mt-3 flex w-full items-center gap-1.5 px-1 text-left text-[13.5px] font-bold text-foreground">
          <Flame className={cn("size-4 text-[var(--flame,#f0a645)]", streakLitDays !== null && "animate-streak-pop")} fill="currentColor" strokeWidth={1.6} />
          {t("rewards.streakDays").replace("{n}", String(streakDays))}
        </p>
      )}

      <div className="mt-4 w-full space-y-3 sm:mt-7">
        {primary}
        {/* The second step sits right under the first, so both are visible without scrolling. */}
        {mistakes > 0 && (
          <div className="life-card life-press overflow-hidden text-left">
            <NextStep
              icon={<RotateCcw className="size-[18px]" />}
              title={(mistakes === 1 ? t("habit.fixTitleOne") : t("habit.fixTitle")).replace("{n}", String(mistakes))}
              sub={t("habit.fixSub").replace("{m}", String(fixMinutes(mistakes)))}
              href={practiceHref({ sessionId })}
            />
          </div>
        )}
        {(handOff || !quickStart) && (
          <Button size="md" variant="ghost" className="h-11 w-full text-muted-foreground" onClick={onBack}>
            {t("session.backToWorkspace")}
          </Button>
        )}
      </div>

      {showSteps && (
        <section className="mt-6 w-full text-left animate-fade-up" aria-labelledby="debrief-next-steps">
          <h3 id="debrief-next-steps" className="mb-2 px-1 text-[12.5px] font-semibold text-muted-foreground">
            {t("habit.nextSmallStep")}
          </h3>
          <div className="life-card divide-y divide-border overflow-hidden">
            {deck && workspaceId && (
              <NextStep
                icon={<Layers className="size-[18px]" />}
                title={t("habit.flashcardsTitle")}
                sub={t("habit.flashcardsSub")
                  .replace("{n}", String(deck.cards))
                  .replace("{m}", String(Math.max(1, Math.min(10, Math.ceil(deck.cards / 6)))))}
                href={`/flashcards/${deck.id}?ws=${workspaceId}&mode=learn`}
              />
            )}
            {askRow && onAskCopilot && (
              <NextStep
                icon={<MessageCircle className="size-[18px]" />}
                title={askRow.title}
                sub={askRow.sub}
                onClick={() => onAskCopilot(askRow.prompt)}
              />
            )}
          </div>
        </section>
      )}
      <InviteCard variant="compact" className="mt-4" />
      {/* After a Quick 5: "When do you usually study?", push soft-ask / install hints (each once). */}
      {quickStart && stats && (
        <HabitPrompt
          accuracy={stats.accuracy}
          activitiesDone={stats.activitiesDone}
          subjectTitle={subjectTitle}
          // Let the mastery gains fill and be read before the sheet slides over them.
          showAfterMs={mastery.length > 0 ? MASTERY_READ_MS : undefined}
        />
      )}

      {hasReport && (
        <div className="mt-4 w-full text-left">
          <button
            type="button"
            onClick={() => setShowReport((v) => !v)}
            aria-expanded={showReport}
            className="mx-auto flex min-h-11 items-center gap-1 text-[13px] font-semibold text-foreground underline decoration-border-strong underline-offset-4"
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
