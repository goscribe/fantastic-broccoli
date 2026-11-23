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
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Flame } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { restoredDraft } from "@/lib/use-activity-draft";
import { bandCelebrates, questionTrail, resultBand, resultDots, type ResultBand } from "@/lib/session-result";
import type { SessionActivity } from "@/types";
import "@/lib/i18n/finish";
import "@/app/design/design.css";
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
import { SESSION_COMPLETED_EVENT, type SessionCompletedDetail } from "@/lib/api/account";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/session";
import "@/lib/i18n/rewards";
import { InviteCard } from "@/components/growth/invite-card";
import { HabitPrompt } from "@/components/reminders/habit-prompt";
import "@/lib/i18n/habits";
import "@/lib/i18n/mistakes";
import { catalogTopicForLabel, fixMinutes, masteryRow, practiceHref, sessionMistakesHref } from "@/lib/mistakes";
import { unfinishedSummary } from "@/lib/session-footer";
import { coursesApi } from "@/lib/api/courses";
import { loadCourse } from "@/components/courses/course-picker";
import { notesApi } from "@/lib/api/notes";
import { noteHref } from "@/lib/notes";
import { track, type DebriefNextKind } from "@/lib/funnel";
import "@/lib/i18n/purpose";
import type { ApiSessionDebrief, ApiSessionStats } from "@/lib/api/study-session";

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
  title,
  sub,
  href,
  onClick,
}: {
  title: string;
  sub: string;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-ui font-semibold leading-5 text-foreground">{title}</span>
        <span className="block text-caption leading-5 text-muted-foreground">{sub}</span>
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
      <span className="text-caption font-bold leading-none text-muted-foreground">{label}</span>
      <span className="text-[24px] font-extrabold tabular-nums leading-none text-foreground">{value}</span>
    </div>
  );
}

/** The three figures in one row, split by hairlines; they sit on the page, with no box around them. */
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
function MasteryRows({
  mastery,
  className,
  phoneMax = 2,
  hrefFor,
}: {
  mastery: MasteryChange[];
  className?: string;
  phoneMax?: number;
  /** Where each topic row leads (its note, or the topic in its subject). */
  hrefFor?: (m: MasteryChange) => string | null;
}) {
  const { t } = useI18n();
  return (
      <ul className={className} aria-label={t("debrief.masteryTitle")}>
        {mastery.map((m, i) => {
          const { before, after, delta, base, gain } = masteryRow(m);
          const href = hrefFor?.(m) ?? null;
          return (
            // Phones: two rows keep the next step above the fold.
            <li key={m.topic} className={cn(i >= phoneMax && "max-sm:hidden")}>
              <MaybeLink href={href} className={cn("group block", href && "-mx-1 rounded-lg px-1 py-0.5 hover:bg-muted/60 focus-visible:bg-muted/60")}>
              <div className="flex items-baseline justify-between gap-3 text-small">
                <span className={cn("min-w-0 truncate font-semibold", href && "underline decoration-border-strong underline-offset-4 group-hover:decoration-foreground")}>{m.label}</span>
                <span
                  className="shrink-0 tabular-nums text-muted-foreground"
                  aria-label={(before === null ? t("debrief.masteryAriaNew") : t("debrief.masteryAria"))
                    .replace("{topic}", m.label)
                    .replace("{a}", String(before))
                    .replace("{b}", String(after))}
                >
                  {before === null ? (
                    <span className="mr-1.5 text-caption font-semibold">{t("debrief.masteryNew")} ·</span>
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
              </MaybeLink>
            </li>
          );
        })}
      </ul>
  );
}

function StatsWithMastery({ tiles, mastery }: { tiles: ReactNode; mastery: MasteryChange[] }) {
  return (
    <div className="w-full" role="status">
      <div className={slipRow}>{tiles}</div>
      <MasteryRows mastery={mastery} className="mt-1 space-y-3.5 border-t border-border px-1 pb-1 pt-4 text-left" />
    </div>
  );
}

/** The cat's reaction to the result: proud when it went well, at work when it was fine, thoughtful (never sad) when it was hard. */
const BAND_POSE: Record<ResultBand, MascotPose> = { perfect: "trophy", strong: "cheer", okay: "pencil", rough: "think", done: "book" };

/** Confetti in the tile colours and the cat's orange; no purple. */
const CONFETTI_COLORS = ["#f6a53b", "#ffd166", "#34b27b", "#4f8df7", "#ef5d7a", "#ffffff"];

/** Thrown from the cat, once, on a strong result. Positions are fixed, so server and client agree. */
function FinishConfetti({ count = 38 }: { count?: number }) {
  return (
    <span aria-hidden className="finish-confetti">
      {Array.from({ length: count }, (_, i) => {
        // A fan over the top half, biased up and to the left where the words are; lengths vary so it reads as thrown.
        const angle = (-200 + (220 * i) / (count - 1) + ((i * 37) % 17) - 8) * (Math.PI / 180);
        const reach = 110 + ((i * 53) % 150);
        const long = i % 3 !== 0;
        return (
          <span
            key={i}
            style={{
              width: long ? 6 : 8,
              height: long ? 12 : 8,
              borderRadius: long ? 2 : 999,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              ["--x" as string]: `${Math.round(Math.cos(angle) * reach)}px`,
              ["--y" as string]: `${Math.round(Math.sin(angle) * reach)}px`,
              ["--r" as string]: `${((i * 71) % 300) - 150}deg`,
              ["--i" as string]: i,
            }}
          />
        );
      })}
    </span>
  );
}

/** A link when there is somewhere to go, else a plain block with the same layout. */
function MaybeLink({ href, className, children }: { href?: string | null; className?: string; children: ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** One dot per answer: a filled green dot for a right one, an open ring for one to fix (shape as well as colour). */
function AnswerDots({ dots, correct, wrong, href }: { dots: boolean[]; correct: number; wrong: number; href?: string }) {
  const { t } = useI18n();
  return (
    <MaybeLink href={wrong > 0 ? href : undefined} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", href && wrong > 0 && "group -mx-1 w-fit rounded-lg px-1 py-1 hover:bg-muted/60")}>
      <ol
        className="flex flex-wrap items-center gap-[7px]"
        aria-label={t("finish.answersAria").replace("{c}", String(correct)).replace("{n}", String(wrong))}
      >
        {dots.map((ok, i) => (
          <li
            key={i}
            aria-hidden
            style={{ ["--i" as string]: i }}
            className={cn("finish-dot size-3.5 rounded-full", ok ? "bg-emerald-500" : "border-[2.5px] border-rose-400")}
          />
        ))}
      </ol>
      {wrong > 0 && (
        <span className={cn("text-small font-bold text-muted-foreground", href && "underline decoration-border-strong underline-offset-4 group-hover:text-foreground group-hover:decoration-foreground")}>
          {t("finish.toFix").replace("{n}", String(wrong))}
        </span>
      )}
    </MaybeLink>
  );
}

/** A secondary action at the end of a session: words on the page, underlined, with a quiet note after them. */
function TextAction({
  title,
  sub,
  href,
  onClick,
  disabled,
  i,
}: {
  title: ReactNode;
  sub?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  i: number;
}) {
  const body = (
    <>
      <span className="font-bold text-foreground underline decoration-border-strong underline-offset-4 group-hover:decoration-foreground">{title}</span>
      {sub && <span className="text-small text-muted-foreground">{sub}</span>}
    </>
  );
  const cls = "group flex min-h-11 w-full flex-wrap items-center gap-x-2.5 gap-y-0 py-1.5 text-left text-[14.5px] leading-5 focus-visible:outline-none focus-visible:[&>span:first-child]:decoration-foreground disabled:opacity-60";
  return (
    <li className="life-rise" style={{ ["--i" as string]: i }}>
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={cls}>
          {body}
        </button>
      )}
    </li>
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
  activities,
}: {
  /** The session's activities: their saved answers draw the row of answer dots. */
  activities?: SessionActivity[];
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
    // `quickStart` lets the subscribe wall stay off a Quick 5's end screen (its one ask is the habit prompt).
    const detail: SessionCompletedDetail = { sessionId, quickStart };
    window.dispatchEvent(new CustomEvent(SESSION_COMPLETED_EVENT, { detail }));
  }, [sessionId, quickStart]);

  // Mastery rows link to their topic: the catalog course (if the subject has one) and which topics have a note.
  const { data: topicLinks } = useQuery({
    queryKey: ["debrief-topic-links", workspaceId],
    enabled: !!workspaceId && (stats?.mastery?.length ?? 0) > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      // Only the course's id is needed, and most subjects follow no course: the student's course subjects say which do.
      const courseId = (await coursesApi.mine().catch(() => [])).find((c) => c.workspaceId === workspaceId)?.courseId;
      if (!courseId) return null;
      const [course, notes] = await Promise.all([
        loadCourse(courseId).catch(() => null),
        notesApi.listForCourse(courseId).catch(() => []),
      ]);
      return course ? { course, withNotes: new Set(notes.map((n) => n.topicId)) } : null;
    },
  });
  const topicHref = (m: MasteryChange): string | null => {
    if (!workspaceId) return null;
    const topic = topicLinks ? catalogTopicForLabel(topicLinks.course.units, m.label) : null;
    if (topic && topicLinks) {
      return topicLinks.withNotes.has(topic.id)
        ? noteHref(topicLinks.course.id, topic.id)
        : `/workspace/${encodeURIComponent(workspaceId)}?topic=${encodeURIComponent(topic.id)}`;
    }
    // Not a catalog topic: the subject, where its topics are listed.
    return `/workspace/${encodeURIComponent(workspaceId)}`;
  };
  /** The one next step was tapped (funnel: which kind gets taken). */
  const nextTapped = (kind: DebriefNextKind) => track("debrief.next_tapped", { kind }, workspaceId);

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
      onClick={() => {
        nextTapped("session");
        if (fullSession) openSession(fullSession.id);
        else startFull.mutate();
      }}
    >
      {startFull.isPending || sessionsLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4 fill-current" />
      )}
      {t(fullSession ? "session.quick5FinishCta" : "session.quick5StartCta").replace("{n}", String(fullMinutes))}
    </Button>
  ) : quickStart ? (
    <Button
      size="lg"
      className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold"
      onClick={() => {
        nextTapped("home");
        onBack();
      }}
    >
      {t("debrief.continue")}
      <ArrowRight className="ml-1.5 h-4 w-4" />
    </Button>
  ) : weakest ? (
    <Button
      size="lg"
      className="btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold"
      disabled={startWeakest.isPending}
      onClick={() => {
        nextTapped("topic");
        startWeakest.mutate(weakest.label);
      }}
    >
      {startWeakest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
      <span className="min-w-0 truncate">{t("debrief.nextTopic").replace("{topic}", weakest.label)}</span>
    </Button>
  ) : (
    <Link href="/flashcards/review" className="block w-full" onClick={() => nextTapped("review")}>
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

  if (newUi) {
    const band = resultBand(stats?.accuracy);
    const celebrate = !!stats && bandCelebrates(band);
    // Today's streak day beats the pencil: the flame is the reward the student just earned.
    const pose: MascotPose = band === "okay" && streakLitDays ? "flame" : BAND_POSE[band];
    const pct = stats && stats.accuracy !== null ? Math.round(stats.accuracy * 100) : null;
    const dots = stats ? resultDots(stats.answered, stats.correct, activities ? questionTrail(activities, restoredDraft) : []) : null;
    // Mistakes to fix come first; a Quick 5 keeps its hand-off to the full session as the main step.
    const fixFirst = mistakes > 0 && !handOff;
    const fixTitle = (mistakes === 1 ? t("habit.fixTitleOne") : t("habit.fixTitle")).replace("{n}", String(mistakes));
    const fixSub = t("habit.fixSub").replace("{m}", String(fixMinutes(mistakes)));
    const mainButton = "btn-chunky rounded-[var(--r-button)] h-[52px] w-full text-[16px] font-extrabold sm:w-auto sm:min-w-[300px]";
    // What the main button would have been, as a text link under "Fix N mistakes".
    const demoted = !fixFirst ? null : quickStart ? (
      <TextAction i={8} title={t("debrief.continue")} onClick={onBack} />
    ) : weakest ? (
      <TextAction
        i={0}
        title={t("debrief.nextTopic").replace("{topic}", weakest.label)}
        onClick={() => startWeakest.mutate(weakest.label)}
        disabled={startWeakest.isPending}
      />
    ) : (
      <TextAction i={8} title={t("session.reviewDueCards")} href="/flashcards/review" />
    );
    return (
      <div className="@container mx-auto flex w-full max-w-2xl flex-col pb-10 text-left" data-debrief data-band={stats ? band : undefined}>
        {/*
          One moment, in the home banner's own language: the scene for the student's time of day, the cat reacting to the result, the score.
          The hero lays itself out from ITS OWN width (@container above), not the viewport's: with Copilot docked beside it the column can be
          ~330px on a 768px screen, where the side-by-side layout put the cat over the score.
        */}
        <section
          className="hero-card finish-hero life-rise relative isolate w-full overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-5 pt-[176px] @[520px]:min-h-[292px] @[520px]:px-9 @[520px]:pb-8 @[520px]:pt-8"
          aria-labelledby="finish-title"
        >
          <div aria-hidden className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[160px] @[520px]:inset-0 @[520px]:h-auto">
            {/* The side wash the words sit on, only in the side-by-side layout (tokens.css ties its own wash to the viewport). */}
            <span className="finish-hero__wash absolute inset-0 hidden @[520px]:block" />
            <div className="absolute bottom-[20px] left-1/2 h-[118px] -translate-x-1/2 @[520px]:bottom-[7%] @[520px]:left-auto @[520px]:right-[9%] @[520px]:h-[196px] @[520px]:translate-x-0">
              <span className="hero-field__ground" />
              {celebrate && <FinishConfetti />}
              {stats && band === "okay" && <SparkleBurst burst={1} count={10} distance={64} />}
              <Mascot pose={stats ? pose : "book"} key={stats ? pose : "wait"} className={cn("relative h-full", celebrate ? "cat-cheer" : "cat-peek")} priority />
            </div>
          </div>
          <p className="hero-eyebrow relative line-clamp-2 break-words text-small font-extrabold @[520px]:max-w-[58%]">
            {[subjectTitle, t(quickStart ? "debrief.quick5Complete" : "debrief.complete")].filter(Boolean).join(" · ")}
          </p>
          <h2 id="finish-title" className="relative mt-1.5 text-balance text-[30px] font-extrabold leading-[1.08] tracking-tight @[520px]:max-w-[58%] @[520px]:text-[38px]">
            {stats ? t(band === "done" ? (quickStart ? "debrief.quick5Complete" : "debrief.complete") : `finish.${band}`) : statsError ? t(quickStart ? "debrief.quick5Complete" : "debrief.complete") : <span className="skeleton inline-block h-9 w-52 rounded-full align-middle" />}
          </h2>
          <div className="relative mt-1.5 min-h-[22px] text-ui font-semibold text-foreground/75 line-clamp-2 @[520px]:max-w-[52%]">
            {verdict ? (
              <MathText text={verdict} />
            ) : debriefLoading ? (
              <span className="skeleton inline-block h-4 w-44 rounded-full align-middle" />
            ) : stats ? (
              t(`finish.${band}Sub`)
            ) : null}
          </div>
          {stats ? (
            <p className="relative mt-4 flex items-baseline gap-3 @[520px]:mt-6" role="status">
              <span className="finish-score text-[60px] font-extrabold leading-[0.9] tracking-tight tabular-nums @[520px]:text-[76px]">
                {pct !== null ? (
                  <>
                    <CountUp value={pct} />
                    <span className="text-[0.55em]">%</span>
                  </>
                ) : (
                  `${stats.activitiesDone}/${stats.activitiesTotal}`
                )}
              </span>
              <span className="text-ui font-bold leading-tight text-foreground/75">
                {pct !== null
                  ? t("finish.rightOf").replace("{c}", String(stats.correct)).replace("{n}", String(stats.answered))
                  : t("debrief.done")}
              </span>
            </p>
          ) : statsError ? null : (
            <div className="relative mt-4 @[520px]:mt-6" role="status">
              <span className="skeleton block h-[60px] w-40 rounded-2xl @[520px]:h-[72px]" />
            </div>
          )}
        </section>

        {/* What was earned: numbers on the page, ticking up; no tiles. */}
        {stats && (
          <ul className="mt-5 flex flex-wrap items-baseline gap-x-7 gap-y-2 px-1 sm:mt-6" aria-label={t("debrief.points")}>
            <li className="life-rise flex items-baseline gap-1.5" style={{ ["--i" as string]: 2 }}>
              <span className="text-[24px] font-extrabold leading-none tabular-nums"><CountUp value={points} prefix="+" /></span>
              <span className="text-small font-bold text-muted-foreground">{t("debrief.points").toLowerCase()}</span>
            </li>
            {streakDays !== null && streakDays > 0 && (
              <li className="life-rise flex items-baseline gap-1.5" style={{ ["--i" as string]: 3 }}>
                <Flame aria-hidden className={cn("size-[22px] shrink-0 self-center text-[var(--flame)]", streakLitDays !== null && "finish-flame")} fill="currentColor" strokeWidth={1.5} />
                <span className="text-small font-bold text-foreground">
                  {streakLitDays !== null ? (
                    <span className="finish-bump" style={{ animationDelay: "0.85s" }}>{t("rewards.streakDays").replace("{n}", String(streakDays))}</span>
                  ) : (
                    t("rewards.streakDays").replace("{n}", String(streakDays))
                  )}
                </span>
              </li>
            )}
            <li className="life-rise flex items-baseline gap-1.5" style={{ ["--i" as string]: 11 }}>
              <span className="text-[24px] font-extrabold leading-none tabular-nums">{stats.minutes}</span>
              <span className="text-small font-bold text-muted-foreground">{t("debrief.minutes").replace("{n}", "").trim()}</span>
            </li>
            {pct !== null && <li className="sr-only">{`${t("debrief.accuracy")} ${pct}%`}</li>}
          </ul>
        )}

        {dots && stats && (
          <div className="life-rise mt-4 px-1" style={{ ["--i" as string]: 12 }}>
            <AnswerDots dots={dots.dots} correct={stats.correct} wrong={wrong} href={sessionMistakesHref(workspaceId, sessionId)} />
          </div>
        )}

        {stats && mastery.length > 0 && (
          <div className="life-rise mt-6 w-full px-1" style={{ ["--i" as string]: 6 }}>
            <h3 className="mb-3 text-[12.5px] font-bold text-muted-foreground">{t("debrief.masteryTitle")}</h3>
            <MasteryRows mastery={mastery} className="space-y-3" hrefFor={topicHref} />
          </div>
        )}

        {/* One next step, then everything else as plain links. */}
        <div className="life-rise mt-7 w-full px-1" style={{ ["--i" as string]: 7 }}>
          {fixFirst ? (
            <>
              <Link href={practiceHref({ sessionId })} className="block w-full sm:w-fit" onClick={() => nextTapped("mistakes")}>
                <Button size="lg" className={mainButton}>
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  {fixTitle}
                </Button>
              </Link>
              <p className="mt-2.5 text-small text-muted-foreground">{fixSub}</p>
            </>
          ) : (
            <div className="[&_button]:sm:w-auto [&_button]:sm:min-w-[300px] [&>a]:sm:w-fit">{primary}</div>
          )}
        </div>
        <ul className="mt-3 w-full px-1">
          {demoted}
          {mistakes > 0 && !fixFirst && (
            <TextAction i={8} title={fixTitle} sub={fixSub} href={practiceHref({ sessionId })} />
          )}
          {deck && workspaceId && (
            <TextAction
              i={1}
              title={t("habit.flashcardsTitle")}
              sub={t("habit.flashcardsSub")
                .replace("{n}", String(deck.cards))
                .replace("{m}", String(Math.max(1, Math.min(10, Math.ceil(deck.cards / 6)))))}
              href={`/flashcards/${deck.id}?ws=${workspaceId}&mode=learn`}
            />
          )}
          {askRow && onAskCopilot && (
            <TextAction i={10} title={askRow.title} sub={askRow.sub} onClick={() => onAskCopilot(askRow.prompt)} />
          )}
          <InviteCard variant="link" className="life-rise" />
          {hasReport && (
            <li className="life-rise" style={{ ["--i" as string]: 11 }}>
              <button
                type="button"
                onClick={() => setShowReport((v) => !v)}
                aria-expanded={showReport}
                className="group flex min-h-11 items-center gap-1 py-1.5 text-[14.5px] font-bold text-foreground"
              >
                <span className="underline decoration-border-strong underline-offset-4 group-hover:decoration-foreground">{t(showReport ? "debrief.hideReport" : "debrief.seeReport")}</span>
                <ChevronDown className={cn("size-4 transition-transform", showReport && "rotate-180")} />
              </button>
            </li>
          )}
          {(handOff || !quickStart) && (
            <li className="life-rise" style={{ ["--i" as string]: 12 }}>
              <button type="button" onClick={onBack} className="flex min-h-11 items-center py-1.5 text-[14.5px] font-bold text-muted-foreground hover:text-foreground">
                {t("session.backToWorkspace")}
              </button>
            </li>
          )}
        </ul>
        {/* After a Quick 5: "When do you usually study?", push soft-ask / install hints (each once). */}
        {quickStart && stats && (
          <HabitPrompt
            sessionId={sessionId}
            accuracy={stats.accuracy}
            activitiesDone={stats.activitiesDone}
            subjectTitle={subjectTitle}
            // Let the mastery gains fill and be read before the sheet slides over them.
            showAfterMs={mastery.length > 0 ? MASTERY_READ_MS : undefined}
          />
        )}
        {showReport && debrief && <DebriefReport debrief={debrief} />}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center pb-10 pt-0 text-center animate-fade-up sm:pt-2">
      <>
        <div className="relative" aria-hidden>
          <Image src="/illustrations/props/trophy.png" alt="" width={160} height={160} className="w-24" />
          <ConfettiDots />
        </div>
        <h2 className="mt-3 text-[30px] font-extrabold tracking-tight sm:mt-5 sm:text-[36px]">
          {t(quickStart ? "debrief.quick5Complete" : "debrief.complete")}
        </h2>
        <div className="mt-1 min-h-6 text-ui text-muted-foreground line-clamp-2 sm:mt-1.5">
          {verdict ? (
            <MathText text={verdict} />
          ) : debriefLoading ? (
            <span className="inline-block h-4 w-56 animate-pulse rounded-full bg-muted align-middle" />
          ) : null}
        </div>
      </>

      {stats && mastery.length > 0 ? (
        <div className="mt-4 w-full sm:mt-6">
          <StatsWithMastery tiles={statTiles(stats)} mastery={mastery} />
        </div>
      ) : statsError ? null : (
      <div className={cn("mt-4 w-full sm:mt-6", slipRow)} role="status">
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
        <p className="mt-3 w-full px-1 text-left text-small font-bold text-foreground">
          {t("rewards.streakDays").replace("{n}", String(streakDays))}
        </p>
      )}

      <div className="mt-4 w-full space-y-3 sm:mt-7">
        {primary}
        {/* The second step sits right under the first, so both are visible without scrolling. */}
        {mistakes > 0 && (
          <div className="life-press overflow-hidden rounded-[22px] bg-muted text-left">
            <NextStep
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
          <div className="divide-y divide-border border-y border-border">
            {deck && workspaceId && (
              <NextStep
                title={t("habit.flashcardsTitle")}
                sub={t("habit.flashcardsSub")
                  .replace("{n}", String(deck.cards))
                  .replace("{m}", String(Math.max(1, Math.min(10, Math.ceil(deck.cards / 6)))))}
                href={`/flashcards/${deck.id}?ws=${workspaceId}&mode=learn`}
              />
            )}
            {askRow && onAskCopilot && (
              <NextStep
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
          sessionId={sessionId}
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
          {showReport && debrief && <DebriefReport debrief={debrief} />}
        </div>
      )}
    </div>
  );
}

/** The model-written report, opened from "See your full report". */
function DebriefReport({ debrief }: { debrief: ApiSessionDebrief }) {
  return (
            <div className="mt-2 space-y-5 border-t border-border px-1 pt-5 animate-fade-up">
              {usefulHeadline(debrief.headline) && debrief.summary && (
                <p className="text-ui text-foreground">
                  <MathText text={debrief.summary} />
                </p>
              )}
              {debrief.sections.map((section) => (
                <section key={section.heading}>
                  <h3 className="mb-1.5 text-sm font-semibold">{section.heading}</h3>
                  {section.body && (
                    <p className="text-ui text-muted-foreground">
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
                            <p className="text-ui font-medium">
                              <MathText text={b.text} />
                            </p>
                            {b.detail && (
                              <p className="text-ui text-muted-foreground">
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
  );
}

/**
 * The summary for a session left before the end (purpose audit, finding 3):
 * no cheer, no points, no streak day — what is left and one way back in.
 */
export function SessionUnfinished({
  activities,
  onResume,
  onLeave,
}: {
  activities: SessionActivity[];
  onResume: (activityId: string) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const { left, minutes, resumeId } = unfinishedSummary(activities);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center pb-10 pt-6 text-center sm:pt-12" data-debrief="unfinished">
      <Mascot pose="book" className="h-[104px]" />
      <h2 className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight">{t("purpose.unfinishedTitle")}</h2>
      <p className="mt-2 text-ui text-muted-foreground">
        {(left === 1 ? t("purpose.unfinishedSubOne") : t("purpose.unfinishedSub")).replace("{n}", String(left)).replace("{m}", String(minutes))}
      </p>
      {resumeId && (
        <Button size="lg" className="mt-6 w-full sm:w-auto sm:min-w-[260px]" onClick={() => onResume(resumeId)}>
          {t("purpose.keepGoing")}
        </Button>
      )}
      <button type="button" onClick={onLeave} className="mt-3 flex min-h-11 items-center text-[14.5px] font-bold text-muted-foreground hover:text-foreground">
        {t("purpose.leaveForNow")}
      </button>
    </div>
  );
}
