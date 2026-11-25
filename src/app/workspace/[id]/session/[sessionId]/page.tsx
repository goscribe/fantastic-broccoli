"use client";

import { SyllabusMatchCard } from "@/components/courses/syllabus-match-card";
import { SessionBuildWait } from "@/components/session/build-wait";
import { WaitConfidenceCard, useWaitConfidence, type WaitConfidenceState } from "@/components/session/wait-confidence";
import { useNewUi } from "@/lib/new-ui";
import { initialCopilotOpen, rememberCopilotOpen } from "@/lib/copilot-pref";
import {
  BUBBLE_AFTER_WRONG_MS,
  BUBBLE_IDLE_MS,
  BUBBLE_VISIBLE_MS,
  bubbleAllowed,
  countCopilotOpen,
  dismissBubble,
} from "@/lib/copilot-bubble";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  addSessionNote,
  appendActivities,
  deleteStudySession,
  fetchExtensionActivities,
  fetchStudySession,
  removeSessionNote,
  retryStudySession,
  setActivityStatus,
  subscribePlanGeneration,
  subscribePlanProgress,
  type PlanGenerationStage,
} from "@/lib/api/study";
import { recordFlashcardAttempt } from "@/lib/api/study-session";
import {
  StudySession,
  SessionActivity,
  SessionNote,
  ComprehensionContent,
  McqContent,
  ReadingContent,
  FlashcardContent,
  VocabRecallContent,
  ClozeContent,
  ExplainAloudContent,
  InteractiveContent,
  WorksheetContent,
  PlanGenerationSnapshot,
} from "@/types";
import { ComprehensionActivity } from "@/components/session/comprehension-activity";
import { McqActivity } from "@/components/session/mcq-activity";
import {
  ReadingActivity,
  ReadingHighlight,
  highlightDotClasses,
} from "@/components/session/reading-activity";
import { FlashcardActivity } from "@/components/session/flashcard-activity";
import { VocabRecallActivity } from "@/components/session/vocab-recall-activity";
import { ClozeActivity } from "@/components/session/cloze-activity";
import { ExplainAloudActivity } from "@/components/session/explain-aloud-activity";
import { InteractiveActivity } from "@/components/session/interactive-activity";
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import { SessionDebrief, SessionUnfinished } from "@/components/session/session-debrief";
import { localizePracticeSession, mistakesApi } from "@/lib/api/mistakes";
import "@/lib/i18n/uploads";
import "@/lib/i18n/mistakes";
import {
  ActivityRewardCard,
  REWARD_MS,
  SessionStepBar,
  SessionStepLabel,
  remainingMinutes,
  type ActivityReward,
} from "@/components/session/session-progress";
import { POINTS_PER_ACTIVITY, POINTS_PER_SESSION } from "@/lib/api/rewards";
import { refreshProgress, STREAK_KEY, useStreak, type StreakSummary } from "@/lib/rewards";
import { MathText } from "@/components/ui/markdown-text";
import { ContentRepairProvider } from "@/components/content/content-repair";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/rewards/mascot";
import { Card, Surface } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copilot, CopilotTrigger } from "@/components/ai/copilot";
import { VoiceAnswerContext, VoiceScribe, VoiceScribeTrigger, type VoiceScribeHandle } from "@/components/session/voice-scribe";
import { SessionPrecheck } from "@/components/session/precheck";
import { FirstReadingLead, SessionPrimer, useSessionPrimer } from "@/components/session/session-primer";
import { proficiencyApi } from "@/lib/api/proficiency";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import "@/lib/i18n/first-run";
import "@/lib/i18n/today";
import { ChangeCourseLink } from "@/components/onboarding/change-course";
import { track } from "@/lib/funnel";
import { CalculatorTool } from "@/components/calculator/calculator-tool";
import { isNonCalculator, sessionCalculatorContext } from "@/lib/calculator/access";
import { resolveSubjectFamily } from "@/lib/subject-family";
import { ACTIVITY_TYPE_LABELS } from "@/components/session/activity-item";
import { cn, formatDuration, formatRelativeDate } from "@/lib/utils";
import { getItemNav, useCurrentItemIndex } from "@/lib/current-item";
import { footerBackStep, footerNextStep, sessionFinished, showSessionFooter } from "@/lib/session-footer";
import { flushActivityDraft } from "@/lib/use-activity-draft";
import "@/lib/i18n/purpose";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";

const ACTIVITY_ICON: Record<SessionActivity["type"], string> = {
  reading: "/illustrations/icons/act-reading.png",
  comprehension_check: "/illustrations/icons/act-comprehension.png",
  mcq: "/illustrations/icons/act-mcq.png",
  flashcard_review: "/illustrations/icons/act-flashcards.png",
  worksheet: "/illustrations/icons/act-worksheet.png",
  interactive: "/illustrations/icons/act-interactive.png",
  vocab_recall: "/illustrations/icons/act-vocab.png",
  cloze: "/illustrations/icons/act-cloze.png",
  explain_aloud: "/illustrations/icons/act-explain.png",
};

const NEW_ACTIVITY_ICON: Record<SessionActivity["type"], string> = {
  reading: "/design/props/books.png",
  comprehension_check: "/design/props/bulb.png",
  mcq: "/design/props/notes.png",
  flashcard_review: "/design/props/cards.png",
  worksheet: "/design/props/pencil.png",
  interactive: "/design/props/bulb.png",
  vocab_recall: "/design/props/cards.png",
  cloze: "/design/props/notes.png",
  explain_aloud: "/design/props/flag.png",
};

const phaseOf = (t: SessionActivity["type"]) =>
  t === "reading" || t === "comprehension_check" || t === "interactive"
    ? "Learn"
    : t === "mcq" || t === "worksheet" || t === "cloze"
      ? "Practice"
      : "Recall";

/** Activities where a student answers something: where "Stuck?" makes sense. */
const QUESTION_TYPES = new Set(["mcq", "vocab_recall", "cloze", "comprehension_check"]);

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function SessionDetailPage() {
  const { t } = useI18n();
  const newUi = useNewUi();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const sessionId = params.sessionId as string;

  const queryClient = useQueryClient();
  // Loaded up front so a completion can tell whether it just lit today's streak.
  useStreak();
  /** Set when a completion in this visit made today count toward the streak. */
  const [streakLitDays, setStreakLitDays] = useState<number | null>(null);
  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const { data: session, isLoading, isError: sessionError, refetch: refetchSession } = useQuery({
    queryKey: ["study-session", sessionId],
    queryFn: () => fetchStudySession(sessionId),
    // "Practice my mistakes" is built server-side with English titles.
    select: (s) => localizePracticeSession(s, t),
    // Plans are generated in the background — poll while generating as a
    // fallback for when Pusher isn't configured.
    refetchInterval: (query) =>
      query.state.data?.generating ? 4000 : false,
  });

  const generating = session?.generating ?? false;
  const [planError, setPlanError] = useState<string | null>(null);
  useEffect(() => {
    if (!generating) return;
    return subscribePlanGeneration(workspaceId, (event) => {
      if (event.sessionId !== sessionId) return;
      if (event.error) setPlanError(event.error);
      queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] });
    });
  }, [generating, workspaceId, sessionId, queryClient]);
  // Generation finished but produced nothing — the plan job failed.
  const planFailed =
    !!planError ||
    (!!session &&
      !generating &&
      (session.status === "failed" || session.activities.length === 0));

  const retryPlan = useMutation({
    mutationFn: () => retryStudySession(sessionId),
    onSuccess: () => {
      setPlanError(null);
      queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] });
    },
  });
  const deleteSession = useMutation({
    mutationFn: () => deleteStudySession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["study-sessions", workspaceId],
      });
      router.push(`/workspace/${workspaceId}/study`);
    },
  });
  // No study features until the plan actually exists.
  const planReady = !!session && !generating && !planFailed;
  // Rated their confidence low or middling at the start: the notes (or a recap) come before the questions.
  const primer = useSessionPrimer(planFailed ? undefined : session);
  // "How confident are you?" is asked on the wait screen (once per subject); in a Quick 5 it picks the five questions.
  const waitConfidence = useWaitConfidence(planFailed ? undefined : session);

  // Deep links (e.g. reminder emails) can point at a specific activity.
  const searchParams = useSearchParams();
  const linkedActivityId = searchParams.get("activity");
  // `?view=summary` (a mistake's "From: <session>") opens the end screen.
  const linkedSummary = searchParams.get("view") === "summary";
  // undefined = not chosen yet (default to first unfinished); null = plan done (debrief)
  const [chosenActivityId, setChosenActivityId] = useState<
    string | null | undefined
  >(undefined);
  const activeActivityId =
    chosenActivityId !== undefined
      ? chosenActivityId
      : linkedSummary
        ? null
        : ((linkedActivityId &&
          session?.activities.find((a) => a.id === linkedActivityId)?.id) ||
        (session?.activities.find((a) => a.status === "in_progress")?.id ??
          session?.activities.find((a) => a.status === "pending")?.id ??
          null));
  const setActiveActivityId = setChosenActivityId;

  const [showComments, setShowComments] = useState(false);
  // Copilot starts closed (the question keeps the full column); a student who
  // docks it open keeps it open next time. See copilot-pref.ts.
  const [copilotOpen, setCopilotOpenState] = useState(
    () =>
      typeof window !== "undefined" &&
      initialCopilotOpen(window.localStorage, window.matchMedia("(min-width: 640px)").matches),
  );
  /** The student's own open/close: remembered. */
  const setCopilotOpen = useCallback((open: boolean) => {
    setCopilotOpenState(open);
    rememberCopilotOpen(window.localStorage, open);
  }, []);
  // One-tap prompts (end-of-session "Ask Copilot about what you got wrong")
  // open the panel with the text already in the input.
  const [copilotDraft, setCopilotDraft] = useState<{ text: string; id: number }>();
  // The question card's Hint / Why?: Copilot about this question, as a half-sheet on phones.
  const [copilotAsk, setCopilotAsk] = useState<{ intent: "hint" | "why"; id: number; label: string; pinned?: string; prepare?: () => Promise<void> }>();
  const [footerMenu, setFooterMenu] = useState(false);
  const askSeq = useRef(0);
  const askCopilot = useCallback((text: string) => {
    setCopilotDraft({ text, id: Date.now() });
    setCopilotAsk(undefined);
    // A one-off prompt opens the panel without changing the remembered choice.
    setCopilotOpenState(true);
  }, []);
  const [newComment, setNewComment] = useState("");
  const [localNotes, setLocalNotes] = useState<SessionNote[]>([]);
  const [removedNoteIds, setRemovedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const [highlightsByActivity, setHighlightsByActivity] = useState<
    Record<string, ReadingHighlight[]>
  >({});
  const [extended, setExtended] = useState(false);
  const [extendDismissed, setExtendDismissed] = useState(false);
  // Horizontal feed navigation: which way the last slide change went, and a
  // short-lived reward card ("Nice — 3 to go" + "Next: …") after an activity
  // is completed. The card holds the finished activity on screen for
  // REWARD_MS, then the next one opens by itself (or on one tap).
  const [navDirection, setNavDirection] = useState<"forward" | "back">(
    "forward",
  );
  const [reward, setReward] = useState<ActivityReward | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    },
    [],
  );
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const { data: extensions = [] } = useQuery({
    queryKey: ["plan-extensions", sessionId],
    queryFn: () =>
      fetchExtensionActivities(
        workspaceId,
        sessionId,
        session?.activities.length ?? 0,
      ),
    enabled: planReady,
  });
  const activities = useMemo(
    () =>
      session
        ? extended
          ? [...session.activities, ...extensions]
          : session.activities
        : [],
    [session, extended, extensions],
  );

  const activeActivity = useMemo(
    () => activities.find((a) => a.id === activeActivityId),
    [activities, activeActivityId],
  );
  const activeItemIndex = useCurrentItemIndex(activeActivity?.id);
  // The calculator: in the top bar for subjects that use one, off on a non-calculator paper.
  const subjectFamily = resolveSubjectFamily(workspace?.subjectFamily, workspace?.title);
  const nonCalculator = useMemo(
    () => isNonCalculator(sessionCalculatorContext({ activities, active: activeActivity, itemIndex: activeItemIndex, paperFocus: session?.paperFocus })),
    [activities, activeActivity, activeItemIndex, session?.paperFocus],
  );

  // Mirror the active activity into the URL so a refresh or shared link
  // reopens the same section. history.replaceState avoids a navigation.
  useEffect(() => {
    if (!planReady || activeActivityId === undefined) return;
    const url = new URL(window.location.href);
    if (activeActivityId) url.searchParams.set("activity", activeActivityId);
    else url.searchParams.delete("activity");
    if (url.href !== window.location.href)
      window.history.replaceState(null, "", url);
  }, [planReady, activeActivityId]);

  // When each activity was opened, so completion can report time spent.
  const openedAt = useRef(new Map<string, number>());
  useEffect(() => {
    if (activeActivity && !openedAt.current.has(activeActivity.id)) {
      openedAt.current.set(activeActivity.id, Date.now());
    }
  }, [activeActivity]);
  // "Stuck? Tap me" on the collapsed Copilot tab: once per visit, on a question,
  // after a quiet spell or right after a wrong answer. See copilot-bubble.ts.
  const [bubble, setBubble] = useState<"idle" | "showing" | "done">("idle");
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onQuestion = !!activeActivity && QUESTION_TYPES.has(activeActivity.type);
  const bubbleCanWait = newUi && planReady && onQuestion && !copilotOpen && !showComments;
  const offerBubble = useCallback((delay: number) => {
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => {
      setBubble((b) => (b === "idle" && bubbleAllowed(safeLocalStorage()) ? "showing" : b));
    }, delay);
  }, []);
  useEffect(() => {
    if (bubble !== "idle" || !bubbleCanWait) return;
    offerBubble(BUBBLE_IDLE_MS);
    return () => clearTimeout(bubbleTimer.current);
  }, [bubble, bubbleCanWait, activeActivity?.id, offerBubble]);
  const bubbleOnWrong = () => {
    if (bubble === "idle" && bubbleCanWait) offerBubble(BUBBLE_AFTER_WRONG_MS);
  };
  // It has had its one showing: leaving the question or opening Copilot or the notes ends it (and so does time, below).
  if (bubble === "showing" && !bubbleCanWait) setBubble("done");
  useEffect(() => {
    if (bubble !== "showing") return;
    const id = setTimeout(() => setBubble("done"), BUBBLE_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [bubble]);
  /** The student's own tap on the tab, the top-bar button or the bubble. */
  const openCopilotByTap = () => {
    countCopilotOpen(safeLocalStorage());
    setBubble("done");
    setCopilotOpen(true);
  };
  const contentColumn = useRef<HTMLDivElement>(null);
  // Talk to write: one microphone for the whole player; tapping it again stops and writes.
  const voice = useRef<VoiceScribeHandle>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const tapVoice = (anchor?: HTMLElement | null) => voice.current?.toggle(anchor);
  // "Answer out loud" beside each answer uses the same microphone.
  const voiceAnswer = useMemo(() => ({ toggle: (anchor?: HTMLElement | null) => voice.current?.toggle(anchor), active: voiceOpen }), [voiceOpen]);
  const secondsOn = (activityId: string) => {
    const start = openedAt.current.get(activityId);
    if (!start) return undefined;
    // Cap so a tab left open overnight doesn't skew the numbers.
    return Math.min(2 * 60 * 60, Math.max(0, Math.round((Date.now() - start) / 1000)));
  };

  // Persist which activity the learner is on so a refresh resumes there.
  const markedInProgress = useRef(new Set<string>());
  useEffect(() => {
    if (!activeActivity || activeActivity.status !== "pending") return;
    if (activeActivity.id.startsWith("bank-")) return;
    if (markedInProgress.current.has(activeActivity.id)) return;
    markedInProgress.current.add(activeActivity.id);
    setActivityStatus(activeActivity.id, "in_progress").catch(() => {});
    if (session?.quickStart) track("quick5.started", {}, workspaceId);
  }, [activeActivity, session?.quickStart, workspaceId]);

  const completeActivity = useMutation({
    // A dropped request here costs the learner their streak day; retry it.
    retry: 2,
    mutationFn: (input: { activityId: string; skipped?: boolean }) =>
      // Bank-pulled activities only exist client-side; no server row to update.
      input.activityId.startsWith("bank-")
        ? Promise.resolve()
        : setActivityStatus(
            input.activityId,
            input.skipped ? "skipped" : "completed",
            secondsOn(input.activityId),
          ),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: ["study-session", sessionId],
      });
      const previous = queryClient.getQueryData<StudySession>([
        "study-session",
        sessionId,
      ]);
      if (previous) {
        queryClient.setQueryData<StudySession>(
          ["study-session", sessionId],
          {
            ...previous,
            activities: previous.activities.map((a) =>
              a.id === input.activityId
                ? { ...a, status: input.skipped ? "skipped" : "completed" }
                : a,
            ),
          },
        );
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["study-session", sessionId],
          context.previous,
        );
      }
    },
    onSuccess: async (_data, input) => {
      if (input.skipped) return;
      if (session?.quickStart) track("quick5.finished", {}, workspaceId);
      const before = queryClient.getQueryData<StreakSummary>(STREAK_KEY);
      // Points and streak are derived server-side from finished work.
      await refreshProgress(queryClient);
      const after = queryClient.getQueryData<StreakSummary>(STREAK_KEY);
      if (before && !before.todayDone && after?.todayDone) {
        setStreakLitDays(after.current);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] }),
  });
  const addNote = useMutation({
    mutationFn: (content: string) => addSessionNote(sessionId, content),
    onSuccess: (note) => setLocalNotes((n) => [...n, note]),
  });
  const removeNote = useMutation({
    mutationFn: (noteId: string) => removeSessionNote(noteId),
  });
  const extendPlan = useMutation({
    mutationFn: () => appendActivities(sessionId, extensions),
  });

  const notes = [...(session?.comments ?? []), ...localNotes].filter(
    (n) => !removedNoteIds.has(n.id),
  );
  const highlightEntries = activities.flatMap((a) => {
    const live = highlightsByActivity[a.id];
    const entries: ReadingHighlight[] =
      live ??
      (a.highlights ?? []).map((h) => ({
        id: h.id,
        text: h.text,
        color: (h.color in highlightDotClasses
          ? h.color
          : "green") as ReadingHighlight["color"],
        note: h.note,
      }));
    return entries.map((h) => ({ ...h, activityTitle: a.title }));
  });
  const panelCount = notes.length + highlightEntries.length;

  // Arrow-key navigation for the horizontal feed (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!planReady) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]"))
        return;
      const currentIdx = activeActivityId
        ? activities.findIndex((a) => a.id === activeActivityId)
        : activities.length;
      const nextIdx = e.key === "ArrowRight" ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx > activities.length) return;
      setNavDirection(nextIdx > currentIdx ? "forward" : "back");
      setChosenActivityId(
        nextIdx >= activities.length ? null : activities[nextIdx].id,
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planReady, activities, activeActivityId]);

  const submitNote = () => {
    const content = newComment.trim();
    if (!content) return;
    addNote.mutate(content);
    setNewComment("");
  };

  const deleteNote = (noteId: string) => {
    removeNote.mutate(noteId);
    setRemovedNoteIds((ids) => new Set(ids).add(noteId));
  };

  if (!session || !workspace) {
    if ((isLoading || workspaceLoading) && newUi) {
      return (
        <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background" aria-busy="true">
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-5 px-10 pt-5">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-2.5 flex-1 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="mx-auto mt-12 flex w-full max-w-[760px] flex-col gap-5 px-10">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <div className="mt-6 flex flex-col gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-border px-10 py-4">
              <Skeleton className="h-10 w-24 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
          <div className="hidden w-[380px] shrink-0 border-l border-border p-5 lg:block">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
          </div>
        </div>
      );
    }
    if (isLoading || workspaceLoading) {
      return (
        <div className="flex-1 flex flex-col">
          <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="hidden w-72 shrink-0 border-r border-border bg-card p-4 space-y-3 lg:block">
              <Skeleton className="h-3.5 w-24" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <div className="flex-1 p-6 sm:p-10">
              <div className="mx-auto max-w-2xl space-y-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <p className="text-[15px] text-muted-foreground">{t(sessionError ? "today.sessionLoadError" : "session.notFound")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {sessionError && (
              <Button size="lg" onClick={() => void refetchSession()}>
                {t("today.retry")}
              </Button>
            )}
            <Button
              variant={sessionError ? "ghost" : "primary"}
              size="lg"
              onClick={() => router.push(`/workspace/${workspaceId}`)}
            >
              {t("session.goBack")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = activities.filter(
    (a) => a.status === "completed",
  ).length;
  const totalEstimated = activities.reduce(
    (sum, a) => sum + a.estimatedMinutes,
    0,
  );
  const minutesLeft = remainingMinutes(activities);

  const clearReward = () => {
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = null;
    setReward(null);
  };

  /** Leave the reward card for the activity after it (if still on it). */
  const advanceFrom = (fromId: string, nextId: string | null) => {
    clearReward();
    setNavDirection("forward");
    setChosenActivityId((prev) => (prev === fromId ? nextId : prev));
  };

  const goToNext = (skipped = false) => {
    if (!activeActivity) return;
    const fromId = activeActivity.id;
    const idx = activities.findIndex((a) => a.id === fromId);
    const next = activities[idx + 1];
    const nextId = next?.id ?? null;
    // A second "done" tap while the reward is up just skips the wait.
    if (reward?.fromId === fromId) {
      advanceFrom(fromId, nextId);
      return;
    }
    // Already recorded (e.g. an MCQ finished on its last answer): don't send it twice.
    if (skipped || activeActivity.status !== "completed") {
      completeActivity.mutate({ activityId: fromId, skipped });
    }
    setNavDirection("forward");
    if (skipped) {
      clearReward();
      setActiveActivityId(nextId);
      return;
    }
    const remaining = activities.filter(
      (a) =>
        a.id !== fromId && a.status !== "completed" && a.status !== "skipped",
    ).length;
    // Pin the finished activity explicitly: the default "first unfinished"
    // pick would otherwise jump ahead as soon as the status flips.
    setActiveActivityId(fromId);
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    setReward({
      fromId,
      next,
      remaining,
      pts: POINTS_PER_ACTIVITY,
      // The session bonus needs every activity completed (skips don't count).
      bonusPts:
        remaining <= 1 && !activities.some((a) => a.status === "skipped")
          ? POINTS_PER_SESSION
          : 0,
    });
    rewardTimer.current = setTimeout(
      () => advanceFrom(fromId, nextId),
      REWARD_MS,
    );
  };
  const activeReward =
    reward && activeActivity?.id === reward.fromId ? reward : null;

  /**
   * Record an activity as completed without moving on. MCQs call this when
   * their last answer is in: learners often swipe or arrow to the debrief
   * instead of tapping "Finish quiz", which used to leave the activity (and
   * the Quick 5) IN_PROGRESS, with no streak day.
   */
  const markFinished = (activity: SessionActivity) => {
    if (activity.status === "completed" || activity.status === "skipped") return;
    // Stay on it (the learner is reading the last explanation): the default
    // "first unfinished" pick would jump ahead as soon as the status flips.
    setActiveActivityId((prev) => (prev === undefined ? activity.id : prev));
    completeActivity.mutate({ activityId: activity.id });
  };

  // Navigate the feed without completing anything (swipe/arrow/peek click).
  const goToIndex = (i: number) => {
    if (i < 0 || i > activities.length || !planReady) return;
    clearReward();
    const currentIdx = activeActivity
      ? activities.findIndex((a) => a.id === activeActivity.id)
      : activities.length;
    setNavDirection(i >= currentIdx ? "forward" : "back");
    setActiveActivityId(i >= activities.length ? null : activities[i].id);
  };

  const cheerKey =
    !planReady || completedCount === 0 || !activeActivity
      ? null
      : completedCount >= activities.length - 1
        ? "session.cheerAlmost"
        : completedCount === 1
          ? "session.cheerFirst"
          : completedCount >= activities.length / 2
            ? "session.cheerHalf"
            : "session.cheerKeepGoing";

  const activeIndex = activeActivity
    ? activities.findIndex((a) => a.id === activeActivity.id)
    : activities.length;
  const nearEnd = activeIndex >= activities.length - 2;
  // Quick 5 ends on purpose — its "more" is tomorrow's 5, not a longer plan.
  const showExtendPrompt =
    planReady &&
    !session.quickStart &&
    !session.mistakesPractice &&
    nearEnd &&
    !extended &&
    !extendDismissed &&
    extensions.length > 0;
  const extensionMinutes = extensions.reduce(
    (s, a) => s + a.estimatedMinutes,
    0,
  );

  /** Hint / Why? on a question: Copilot opens on it, with the question pinned at the top. */
  const askAbout = (activity: SessionActivity, index: number, intent: "hint" | "why") => {
    const q = activity.type === "mcq" ? (activity.content as McqContent).questions[index] : undefined;
    const n = String(index + 1);
    setCopilotDraft(undefined);
    askSeq.current += 1;
    setCopilotAsk({
      intent,
      id: askSeq.current,
      label: t(intent === "hint" ? "purpose.hintFor" : "purpose.whyFor").replace("{n}", n),
      pinned: q ? `${t("purpose.pinned").replace("{n}", n)} · ${q.question.replace(/\s+/g, " ").trim()}` : undefined,
      // "Why?" needs the server to see the answer just given (it withholds answers to unanswered questions).
      prepare: () => flushActivityDraft(activity.id),
    });
    setCopilotOpenState(true);
  };

  // The bottom bar: one-activity sessions have none; elsewhere Next/Back act on the question first.
  const footerVisible = showSessionFooter(activities.length);
  const footerNext = () => {
    if (!activeActivity) return;
    setFooterMenu(false);
    const nav = getItemNav(activeActivity.id);
    const step = footerNextStep({ canItemNext: !!nav?.canNext(), activeIndex, activityCount: activities.length });
    track("session.footer_next", {}, workspaceId);
    if (step === "item") nav!.next();
    else if (step !== "none") goToIndex(activeIndex + 1);
  };
  const footerBack = () => {
    if (!activeActivity) return;
    setFooterMenu(false);
    const nav = getItemNav(activeActivity.id);
    const step = footerBackStep({ canItemBack: !!nav?.canBack(), activeIndex });
    if (step === "item") nav!.back();
    else if (step === "activity") goToIndex(activeIndex - 1);
  };
  const finished = sessionFinished(activities);

  const renderActivity = (activity: SessionActivity) => {
    switch (activity.type) {
      case "reading":
        return (
          <ReadingActivity
            content={activity.content as ReadingContent}
            activityId={activity.id}
            // The first screen of a session is never bullet points only: its figure and explanation lead.
            visualFirst={activity.id === activities[0]?.id}
            lead={activity.id === activities[0]?.id ? <FirstReadingLead session={session} content={activity.content as ReadingContent} /> : undefined}
            initialHighlights={activity.highlights}
            onComplete={() => goToNext()}
            onHighlightsChange={(hs) =>
              setHighlightsByActivity((prev) => ({ ...prev, [activity.id]: hs }))
            }
          />
        );
      case "comprehension_check":
        return (
          <ComprehensionActivity
            key={activity.id}
            activityId={activity.id}
            content={activity.content as ComprehensionContent}
            draft={activity.draft}
            onComplete={() => goToNext()}
          />
        );
      case "mcq":
        return (
          <McqActivity
            key={activity.id}
            activityId={activity.id}
            draft={activity.draft}
            content={activity.content as McqContent}
            onAnswer={(questionIndex, selectedIndex) => {
              const question = (activity.content as McqContent).questions[
                questionIndex
              ];
              if (question && selectedIndex !== question.correctIndex) bubbleOnWrong();
              if (question?.sourceFlashcardId) {
                recordFlashcardAttempt({
                  flashcardId: question.sourceFlashcardId,
                  isCorrect: selectedIndex === question.correctIndex,
                  studySessionId: sessionId,
                  fromQuiz: true,
                }).catch(() => {});
              }
              // Marked server-side too, so a wrong answer lands in the
              // mistakes log (bank questions are logged by answerBankQuestion).
              mistakesApi
                .answerMcq({ activityId: activity.id, questionIndex, selectedIndex })
                .catch(() => {});
              // Spaced-review questions from the bank are re-marked
              // server-side, updating the topic level and their schedule.
              if (question?.bankRef) {
                proficiencyApi
                  .answerBankQuestion({ workspaceId, ...question.bankRef, selectedIndex })
                  .catch(() => {});
              }
            }}
            onComplete={() => goToNext()}
            onAllAnswered={() => markFinished(activity)}
            onHint={(i) => askAbout(activity, i, "hint")}
            onWhy={(i) => askAbout(activity, i, "why")}
            hideBack={footerVisible}
          />
        );
      case "flashcard_review":
        return (
          <FlashcardActivity
            key={activity.id}
            activityId={activity.id}
            draft={activity.draft}
            content={activity.content as FlashcardContent}
            onCardResult={(index, known) => {
              const card = (activity.content as FlashcardContent).cards[index];
              if (card?.flashcardId) {
                recordFlashcardAttempt({
                  flashcardId: card.flashcardId,
                  isCorrect: known,
                  studySessionId: sessionId,
                }).catch(() => {});
              }
            }}
            onComplete={() => goToNext()}
          />
        );
      case "vocab_recall":
        return (
          <VocabRecallActivity
            key={activity.id}
            activityId={activity.id}
            draft={activity.draft}
            content={activity.content as VocabRecallContent}
            onTermResult={(index, correct, answer) => {
              if (!correct) bubbleOnWrong();
              const term = (activity.content as VocabRecallContent).terms[
                index
              ];
              if (term?.flashcardId) {
                recordFlashcardAttempt({
                  flashcardId: term.flashcardId,
                  isCorrect: correct,
                  studySessionId: sessionId,
                  answer,
                }).catch(() => {});
              }
            }}
            onComplete={() => goToNext()}
          />
        );
      case "cloze":
        return (
          <ClozeActivity
            key={activity.id}
            activityId={activity.id}
            sessionId={sessionId}
            content={activity.content as ClozeContent}
            draft={activity.draft}
            onComplete={() => goToNext()}
          />
        );
      case "worksheet":
        return (
          <WorksheetActivity
            key={activity.id}
            activityId={activity.id}
            content={activity.content as WorksheetContent}
            draft={activity.draft}
            estimatedMinutes={activity.estimatedMinutes}
            onComplete={() => goToNext()}
          />
        );
      case "explain_aloud":
        return (
          <ExplainAloudActivity
            content={activity.content as ExplainAloudContent}
            onComplete={() => goToNext()}
          />
        );
      case "interactive":
        return (
          <InteractiveActivity
            key={activity.id}
            content={activity.content as InteractiveContent}
            onComplete={() => goToNext()}
          />
        );
      default:
        return (
          <Card className="text-center py-6 text-sm text-muted-foreground">
            <p className="mb-4">{t("session.activityUnavailable")}</p>
            <Button onClick={() => goToNext()}>{t("session.continue")}</Button>
          </Card>
        );
    }
  };

  const copilotPane = (
      <Copilot
        open={planReady && copilotOpen}
        onClose={() => {
          setCopilotOpen(false);
          setCopilotAsk(undefined);
        }}
        draft={copilotDraft}
        ask={copilotAsk}
        sheet={!!copilotAsk}
        workspaceId={workspaceId}
        studySessionId={sessionId}
        activity={
          activeActivity && !activeActivity.id.startsWith("bank-")
            ? { activityId: activeActivity.id, itemIndex: activeItemIndex }
            : undefined
        }
        page={`Study session player — "${session.title}"${
          activeActivity
            ? `, activity ${activities.findIndex((a) => a.id === activeActivity.id) + 1} of ${activities.length} "${activeActivity.title}" (${activeActivity.type})${
                activeItemIndex !== undefined ? `, item ${activeItemIndex + 1}` : ""
              }`
            : ", plan overview"
        } — /workspace/${workspaceId}/session/${sessionId}`}
        context={`Session: ${session.title}${
          activeActivity
            ? `\nThe learner is currently on activity "${activeActivity.title}" (${activeActivity.type}).`
            : ""
        }`}
      />
  );
  const commentsPanel = (
    <>
      {planReady && showComments && (
        <div className="fixed inset-y-0 right-0 w-[26rem] max-w-full bg-card border-l border-border z-50 flex flex-col animate-fade-up">
          <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold">{t("session.sessionNotes")}</h3>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {highlightEntries.length > 0 && (
              <div className="space-y-2 pb-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("session.highlights")}
                </p>
                {highlightEntries.map((h) => (
                  <Surface key={h.id} className="p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${highlightDotClasses[h.color]}`}
                      />
                      <p className="italic">&ldquo;{h.text}&rdquo;</p>
                    </div>
                    {h.note && (
                      <p className="mt-1.5 text-xs text-foreground/80 pl-4">
                        {h.note}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted-foreground pl-4">
                      {h.activityTitle}
                    </p>
                  </Surface>
                ))}
                <p className="text-xs font-semibold text-muted-foreground pt-2">
                  {t("session.notes")}
                </p>
              </div>
            )}
            {notes.map((note) => (
              <Surface key={note.id} muted className="group p-3 text-sm">
                <p className="whitespace-pre-wrap">{note.content}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeDate(note.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose transition-opacity"
                    aria-label={t("session.deleteNote")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Surface>
            ))}
            {panelCount === 0 && (
              <div className="text-center py-8">
                <p className="text-sm font-medium">{t("session.noNotesYet")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("session.noNotesHint")}
                </p>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitNote();
                  }
                }}
                placeholder={t("session.addNotePlaceholder")}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
              />
              <Button
                size="sm"
                disabled={!newComment.trim()}
                onClick={submitNote}
                className="h-9"
              >
                {t("session.add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // The new player shell also carries the two states before there is a plan
  // (still building, or the build failed): same X, same column, no legacy chrome.
  if (newUi) {
    return (
      // The calculator rises from the bottom on a phone; this padding is the room it takes, so the question and the bottom bar stay above it. (Docked on a desktop, <body> makes the room: globals.css.)
      <VoiceAnswerContext.Provider value={planReady ? voiceAnswer : null}>
      <div className="flex h-dvh min-h-0 flex-1 overflow-hidden bg-background pb-[var(--calc-sheet,0px)]">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* The top bar sits in the same column as the content under it (same gutters, same max width), so the step bar and the question share their edges. */}
          <div className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-4">
            <div className={cn("mx-auto w-full", activeActivity ? "max-w-3xl" : "max-w-2xl")}>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => router.push(`/workspace/${workspaceId}`)}
                  aria-label={t("session.backToWorkspace")}
                  className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
                >
                  <X className="size-[22px]" />
                </button>
                {planReady ? (
                  <SessionStepLabel activities={activities} activeIndex={activeIndex} className="flex-1" />
                ) : (
                  <span className="flex-1" />
                )}
                {/* Phones: Copilot lives in the top bar; the edge tab would sit over the content's right edge. */}
                {planReady && activeActivity && (
                  <VoiceScribeTrigger active={voiceOpen} onClick={() => tapVoice()} intro={activeActivity.type === "worksheet" && bubble !== "showing"} />
                )}
                {planReady && activeActivity && (
                  <CalculatorTool family={subjectFamily} blocked={nonCalculator} workspaceId={workspaceId} scope={contentColumn} />
                )}
                {planReady && !copilotOpen && (
                  <CopilotTrigger compact onClick={openCopilotByTap} />
                )}
                <button
                  type="button"
                  onClick={() => setShowComments(!showComments)}
                  aria-label={t("session.sessionNotes")}
                  className="relative -mr-3 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MessageSquare className="size-4" />
                  {panelCount > 0 && (
                    <span className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                      {panelCount}
                    </span>
                  )}
                </button>
              </div>
              {/* One activity (a Quick 5) has its own question bar; a one-segment step bar above it said the same thing twice. */}
              {planReady && activities.length > 1 && (
                <SessionStepBar activities={activities} activeIndex={activeIndex} onSelect={goToIndex} />
              )}
            </div>
          </div>

          <div
            key={!planReady ? "building" : (activeActivity?.id ?? "debrief")}
            className={cn(
              // Room for the bottom bar and the phone's home indicator, so the last answer is never under them.
              "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-10 sm:pt-6",
              // Phones: the Hint / Why? half-sheet covers the bottom half; the answers under it stay reachable.
              planReady && copilotOpen && copilotAsk && "max-sm:pb-[calc(52dvh+1.5rem)]",
              navDirection === "back" ? "animate-slide-in-left" : "animate-slide-in-right",
            )}
          >
            <div ref={contentColumn} className={cn("mx-auto w-full", activeActivity ? "max-w-3xl" : "max-w-2xl")}>
              {showExtendPrompt && (
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[22px] bg-muted px-5 py-4 animate-fade-up">
                  <div className="min-w-56 flex-1">
                    <p className="text-sm font-semibold">{t("session.extendTitle")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("session.extendBefore")} {extensions.length} {t("session.extendAfter")} (+{extensionMinutes} {t("session.min")}).
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setExtended(true);
                        extendPlan.mutate();
                        if (!activeActivity) setActiveActivityId(extensions[0].id);
                      }}
                    >
                      {t("session.continuePlan")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setExtendDismissed(true)}>
                      {t("session.finishAsPlanned")}
                    </Button>
                  </div>
                </div>
              )}
              {planFailed ? (
                <div className="mx-auto flex max-w-md flex-col items-center pb-10 pt-6 text-center animate-fade-up sm:pt-12" role="alert">
                  <Mascot pose="think" className="h-[112px]" />
                  <h1 className="mt-5 text-[24px] font-extrabold leading-tight">{t("session.planFailedTitle")}</h1>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{planError ?? t("session.planFailedBody")}</p>
                  <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                    <Button size="lg" disabled={retryPlan.isPending || deleteSession.isPending} onClick={() => retryPlan.mutate()}>
                      {t("session.retryGeneration")}
                    </Button>
                    <Button size="lg" variant="secondary" disabled={retryPlan.isPending || deleteSession.isPending} onClick={() => deleteSession.mutate()}>
                      {t("session.deleteSession")}
                    </Button>
                  </div>
                  <button type="button" onClick={() => router.push(`/workspace/${workspaceId}`)} className="mt-4 text-[14px] font-bold text-muted-foreground hover:text-foreground">
                    {t("session.backToWorkspace")}
                  </button>
                </div>
              ) : primer.state === "open" ? (
                // Shown while the questions are still being written too: the wait is spent on the notes.
                <SessionPrimer plan={primer.plan} notes={primer.notes} material={primer.material} confidence={primer.confidence} title={session.title} generating={generating} onStart={primer.dismiss} />
              ) : generating ? (
                <GeneratingPlanCard
                  title={session.title}
                  workspaceId={workspaceId}
                  sessionId={sessionId}
                  initial={session.generationProgress}
                  quickStart={session.quickStart}
                  confidence={waitConfidence}
                />
              ) : waitConfidence.open ? (
                // Ready while the question was still open: one tap, then question 1 (re-picked for the answer).
                <div className="mx-auto w-full max-w-[640px] pt-2 animate-fade-up">
                  <WaitConfidenceCard state={waitConfidence} ready />
                </div>
              ) : primer.state === "loading" ? (
                // Deciding whether the notes come first: hold the first question back for a moment rather than flash it.
                <div className="mx-auto w-full max-w-[720px]" aria-busy="true">
                  <div className="h-7 w-2/3 animate-pulse rounded-full bg-muted" />
                  <div className="mt-6 h-[220px] animate-pulse rounded-[var(--r-card,20px)] bg-muted" />
                </div>
              ) : activeActivity ? (
                <>
                  {/* One label: the activity's title (steps are in the bar above). A one-activity session's card says "Question 1 of 5" itself. */}
                  {activities.length > 1 ? (
                    <h1 className="mb-4 text-[20px] font-bold leading-[1.3] sm:mb-[18px] sm:text-[23px]">
                      <MathText text={activeActivity.title} />
                    </h1>
                  ) : session.mistakesPractice ? (
                    // A mistakes round says which subjects are in it ("Practice my mistakes · Biology, Chemistry").
                    <h1 className="mb-3 text-[13.5px] font-bold text-muted-foreground">{session.title}</h1>
                  ) : (
                    <h1 className="sr-only">{activeActivity.title}</h1>
                  )}
                  <ContentRepairProvider
                    scope={{
                      workspaceId,
                      target: { kind: "activity", id: activeActivity.id },
                      onRepaired: () => queryClient.invalidateQueries({ queryKey: ["study-session", sessionId] }),
                    }}
                  >
                    {renderActivity(activeActivity)}
                  </ContentRepairProvider>
                </>
              ) : !finished ? (
                <SessionUnfinished activities={activities} onResume={(id) => goToIndex(activities.findIndex((a) => a.id === id))} onLeave={() => router.push(`/workspace/${workspaceId}`)} />
              ) : (
                <SessionDebrief activities={activities} confidenceBefore={session.confidenceBefore} sessionId={sessionId} workspaceId={workspaceId} subjectTitle={workspace.title} quickStart={session.quickStart} sessionBonus={activities.length > 0 && activities.every((a) => a.status === "completed") ? POINTS_PER_SESSION : 0} streakLitDays={streakLitDays} onAskCopilot={askCopilot} onBack={() => router.push(`/workspace/${workspaceId}`)} />
              )}
            </div>
          </div>

          {activeActivity && footerVisible && primer.state === "closed" && (
            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:px-10 sm:py-2.5">
            {/* Quiet text buttons, in the content's own column. Back and Next move question by question; skipping a whole activity is in the menu. */}
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 sm:gap-3">
              <button
                type="button"
                disabled={footerBackStep({ canItemBack: !!getItemNav(activeActivity.id)?.canBack(), activeIndex }) === "none"}
                onClick={footerBack}
                aria-label={t("session.back")}
                className="-ml-3 inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-bold hover:bg-muted disabled:opacity-40 sm:-ml-4 sm:px-4"
              >
                <ArrowLeft className="size-4" />
                <span className="max-[380px]:sr-only">{t("session.back")}</span>
              </button>
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFooterMenu((v) => !v)}
                  aria-label={t("purpose.more")}
                  aria-expanded={footerMenu}
                  className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="size-5" />
                </button>
                {footerMenu && (
                  <div role="menu" className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.35)]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFooterMenu(false);
                        goToNext(true);
                      }}
                      className="flex h-11 w-full items-center rounded-xl px-3 text-left text-[14px] font-bold hover:bg-muted"
                    >
                      {t("purpose.skipActivity")}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={footerNext}
                  className="-mr-4 inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold hover:bg-muted"
                >
                  {t("session.next")}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
            </div>
          )}

          {activeReward && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
              <ActivityRewardCard
                reward={activeReward}
                onNext={() =>
                  advanceFrom(activeReward.fromId, activeReward.next?.id ?? null)
                }
              />
            </div>
          )}
        </div>
        {copilotPane}
        {commentsPanel}
        <VoiceScribe ref={voice} scope={contentColumn} onOpenChange={setVoiceOpen} />
        {planReady && !copilotOpen && (
          <CopilotTrigger
            onClick={openCopilotByTap}
            bubble={
              bubble === "showing"
                ? {
                    avoid: contentColumn,
                    onDismiss: () => {
                      dismissBubble(safeLocalStorage());
                      setBubble("done");
                    },
                  }
                : undefined
            }
          />
        )}
      </div>
      </VoiceAnswerContext.Provider>
    );
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Study column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Header */}
      <header className="border-b border-border bg-card z-10">
        <div className="px-4 sm:px-6 h-12 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline max-w-40 truncate">
              {workspace.title}
            </span>
          </button>
          <span className="hidden sm:inline text-border-strong">/</span>
          <h1 className="text-sm font-bold tracking-tight truncate">
            <MathText text={session.title} />
          </h1>
          {planReady && (
            <div className="ml-auto flex items-center gap-2.5 sm:gap-4 shrink-0">
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <Clock className="h-3 w-3" />
                {minutesLeft > 0
                  ? t("session.minLeft").replace("{n}", String(minutesLeft))
                  : formatDuration(totalEstimated)}
              </span>
              <button
                type="button"
                onClick={() => setShowComments(!showComments)}
                className="relative p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <MessageSquare className="h-4 w-4" />
                {panelCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                    {panelCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden w-full">
        {/* Main study area: a horizontal feed of full-screen slides */}
        <main className="relative flex-1 min-h-0 overflow-hidden bg-card">
          {planFailed || generating ? (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl px-5 sm:px-10 py-6">
                {planFailed ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose/10">
                      <X className="h-5 w-5 text-rose" />
                    </div>
                    <p className="mt-4 text-sm font-semibold">
                      {t("session.planFailedTitle")}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      {planError ?? t("session.planFailedBody")}
                    </p>
                    <div className="mt-5 flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={retryPlan.isPending || deleteSession.isPending}
                        onClick={() => retryPlan.mutate()}
                      >
                        <RefreshCw
                          className={`mr-1.5 h-3.5 w-3.5 ${retryPlan.isPending ? "animate-spin" : ""}`}
                        />
                        {t("session.retryGeneration")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryPlan.isPending || deleteSession.isPending}
                        onClick={() => deleteSession.mutate()}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {t("session.deleteSession")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/workspace/${workspaceId}`)}
                      >
                        {t("session.backToWorkspace")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <GeneratingPlanCard
                    title={session.title}
                    workspaceId={workspaceId}
                    sessionId={sessionId}
                    initial={session.generationProgress}
                    quickStart={session.quickStart}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0">
              {/* Previous-slide peek (desktop) */}
              {activeIndex > 0 ? (
                <FeedPeek
                  activity={activities[activeIndex - 1]}
                  side="left"
                  onClick={() => goToIndex(activeIndex - 1)}
                  typeLabel={t(
                    ACTIVITY_TYPE_LABELS[activities[activeIndex - 1].type] ??
                      "session.typeActivity",
                  )}
                />
              ) : (
                <div className="hidden md:block w-14 shrink-0 border-r border-border bg-background/40" />
              )}

              <div
                key={activeActivity?.id ?? "debrief"}
                className={cn(
                  "flex-1 min-w-0 overflow-y-auto",
                  navDirection === "back"
                    ? "animate-slide-in-left"
                    : "animate-slide-in-right",
                )}
                onTouchStart={(e) => {
                  touchStart.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }}
                onTouchEnd={(e) => {
                  const start = touchStart.current;
                  touchStart.current = null;
                  if (!start) return;
                  const dx = e.changedTouches[0].clientX - start.x;
                  const dy = e.changedTouches[0].clientY - start.y;
                  if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4)
                    return;
                  goToIndex(activeIndex + (dx < 0 ? 1 : -1));
                }}
              >
                <div className="mx-auto w-full max-w-3xl px-5 sm:px-10 py-6">
                  {showExtendPrompt && (
              <div className="mb-5 rounded-2xl border border-accent/30 bg-accent-soft/60 px-5 py-4 flex flex-wrap items-center gap-3 animate-fade-up">
                <div className="flex-1 min-w-56">
                  <p className="text-sm font-semibold">
                    {t("session.extendTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("session.extendBefore")} {extensions.length}{" "}
                    {t("session.extendAfter")} (+{extensionMinutes}{" "}
                    {t("session.min")}).
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => {
                      setExtended(true);
                      extendPlan.mutate();
                      if (!activeActivity) setActiveActivityId(extensions[0].id);
                    }}
                  >
                    {t("session.continuePlan")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExtendDismissed(true)}
                  >
                    {t("session.finishAsPlanned")}
                  </Button>
                </div>
              </div>
            )}

                  {activeActivity ? (
              <div className="space-y-5">
                {cheerKey && (
                  <div className="flex items-center gap-2">
                    <Image
                      src={newUi ? "/design/props/star.png" : "/illustrations/props/star-gold.png"}
                      alt=""
                      width={40}
                      height={40}
                      className="pointer-events-none h-5 w-5 shrink-0 select-none object-contain"
                    />
                    <p className="text-xs font-semibold text-accent">
                      {t(cheerKey)}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {t("session.activityWord")} {activeIndex + 1}{" "}
                      {t("session.of")} {activities.length} ·{" "}
                      {t(`session.phase${phaseOf(activeActivity.type)}`)}
                    </p>
                    <h2 className="mt-1 text-base font-bold tracking-tight">
                      <MathText text={activeActivity.title} />
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToNext(true)}
                    className="text-xs"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    {t("session.skip")}
                  </Button>
                </div>

                <ContentRepairProvider
                  scope={{
                    workspaceId,
                    target: { kind: "activity", id: activeActivity.id },
                    onRepaired: () =>
                      queryClient.invalidateQueries({
                        queryKey: ["study-session", sessionId],
                      }),
                  }}
                >
                  {renderActivity(activeActivity)}
                </ContentRepairProvider>
              </div>
            ) : !finished ? (
              <SessionUnfinished activities={activities} onResume={(id) => goToIndex(activities.findIndex((a) => a.id === id))} onLeave={() => router.push(`/workspace/${workspaceId}`)} />
            ) : (
              <SessionDebrief
                sessionId={sessionId}
                workspaceId={workspaceId}
                subjectTitle={workspace.title}
                quickStart={session.quickStart}
                sessionBonus={activities.length > 0 && activities.every((a) => a.status === "completed") ? POINTS_PER_SESSION : 0}
                streakLitDays={streakLitDays}
                onAskCopilot={askCopilot}
                onBack={() => router.push(`/workspace/${workspaceId}`)}
              />
            )}
                </div>
              </div>

              {/* Next-slide peek (desktop) */}
              {activeActivity && activeIndex < activities.length ? (
                <FeedPeek
                  activity={activities[activeIndex + 1]}
                  side="right"
                  onClick={() => goToIndex(activeIndex + 1)}
                  typeLabel={
                    activities[activeIndex + 1]
                      ? t(
                          ACTIVITY_TYPE_LABELS[
                            activities[activeIndex + 1].type
                          ] ?? "session.typeActivity",
                        )
                      : t("session.next")
                  }
                />
              ) : (
                <div className="hidden md:block w-14 shrink-0 border-l border-border bg-background/40" />
              )}
            </div>
          )}

          {/* Completion reward: "Nice — 3 to go" + one-tap next */}
          {activeReward && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
              <ActivityRewardCard
                reward={activeReward}
                onNext={() =>
                  advanceFrom(activeReward.fromId, activeReward.next?.id ?? null)
                }
              />
            </div>
          )}
        </main>
      </div>

      {/* Journey waypoints pinned to the bottom */}
      {planReady && (
        <footer className="relative z-20 shrink-0 border-t border-border bg-card px-4 pb-3 pt-3 sm:px-22">
          <div className="flex w-full items-center gap-4">
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {completedCount}/{activities.length} {t("session.doneCount")}
            </span>
            <div className="relative flex-1">
              <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
              <div
                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-700 ease-out"
                style={{ width: `${session.progress}%` }}
              />
              <div className="relative flex items-center justify-between">
                {activities.map((activity, i) => {
                  const done = activity.status === "completed";
                  const isActive = activity.id === activeActivityId;
                  const typeLabel = t(
                    ACTIVITY_TYPE_LABELS[activity.type] ??
                      "session.typeActivity",
                  );
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => goToIndex(i)}
                      className="group relative flex items-center justify-center"
                      aria-current={isActive ? "step" : undefined}
                      aria-label={`${typeLabel}: ${activity.title}`}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl border bg-card shadow-sm transition-all duration-200",
                          isActive
                            ? "scale-105 border-accent ring-2 ring-accent/25"
                            : done
                              ? "border-border"
                              : "border-border opacity-70 group-hover:opacity-100",
                        )}
                      >
                        <Image
                          src={(newUi ? NEW_ACTIVITY_ICON : ACTIVITY_ICON)[activity.type]}
                          alt=""
                          width={28}
                          height={28}
                          className="pointer-events-none h-6 w-6 select-none object-contain"
                        />
                      </span>
                      {done && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-lg group-hover:block group-focus-visible:block">
                        <p className="text-[11px] font-semibold text-accent">
                          {typeLabel}
                          <span className="font-medium text-muted-foreground">
                            {" "}
                            · {t(`session.phase${phaseOf(activity.type)}`)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs font-semibold">
                          <MathText text={activity.title} />
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("session.activityWord")} {i + 1} ·{" "}
                          {formatDuration(activity.estimatedMinutes)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums">
              {session.progress}%
            </span>
          </div>
        </footer>
      )}
      </div>

      {copilotPane}
      {commentsPanel}

      {planReady && !copilotOpen && (
        <CopilotTrigger onClick={() => setCopilotOpen(true)} />
      )}
    </div>
  );
}

/** Clickable edge strip hinting at the previous/next slide in the feed. */
function FeedPeek({
  activity,
  side,
  onClick,
  typeLabel,
}: {
  activity?: SessionActivity;
  side: "left" | "right";
  onClick: () => void;
  typeLabel: string;
}) {
  const newUi = useNewUi();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={activity ? `${typeLabel}: ${activity.title}` : typeLabel}
      className={cn(
        "group hidden md:flex w-14 shrink-0 flex-col items-center justify-center gap-3 bg-background/60 transition-colors hover:bg-muted",
        side === "left" ? "border-r border-border" : "border-l border-border",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
      )}
      {activity ? (
        <Image
          src={(newUi ? NEW_ACTIVITY_ICON : ACTIVITY_ICON)[activity.type]}
          alt=""
          width={28}
          height={28}
          className="pointer-events-none h-7 w-7 select-none object-contain opacity-60 transition-opacity group-hover:opacity-100"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15">
          <Check className="h-4 w-4 text-accent" />
        </span>
      )}
      <span className="max-h-36 truncate text-[10px] font-semibold text-muted-foreground [writing-mode:vertical-rl]">
        {activity ? activity.title : typeLabel}
      </span>
    </button>
  );
}

const GENERATION_STAGES: {
  label: string;
  stage: PlanGenerationStage;
  /** Cumulative share of the bar reached when this stage completes. */
  until: number;
}[] = [
  // Reading the uploads is most of a first session's wait; it reports real
  // "n of N files read" progress, so it gets a real share of the bar.
  { label: "session.stageGathering", stage: "gathering", until: 0.3 },
  { label: "session.stageOutlining", stage: "outlining", until: 0.35 },
  { label: "session.stageWriting", stage: "generating", until: 0.8 },
  { label: "session.stageVerifying", stage: "verifying", until: 0.92 },
  { label: "session.stageFinishing", stage: "finalizing", until: 1 },
];

/** Sessions whose wait screen was already reported in this page load. */
const waitTracked = new Set<string>();

/** No progress event for this long is reported as "taking longer than usual". */
const STALLED_AFTER_SECONDS = 45;

interface PlanProgressState {
  stageIndex: number;
  completed?: number;
  total?: number;
  label?: string;
  planned: { title: string; type: string }[];
  finished: string[];
  lastEventAt: number;
}

/** Rebuild the live state from the server's persisted snapshot (page reload). */
function progressFromSnapshot(
  snapshot: PlanGenerationSnapshot | undefined,
  fallbackStartedAt: number,
): { progress: PlanProgressState; startedAt: number } {
  const idx = snapshot
    ? GENERATION_STAGES.findIndex((s) => s.stage === snapshot.stage)
    : -1;
  if (!snapshot || idx < 0) {
    return {
      progress: {
        stageIndex: 0,
        planned: [],
        finished: [],
        lastEventAt: fallbackStartedAt,
      },
      startedAt: fallbackStartedAt,
    };
  }
  const parse = (iso: string) => {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : fallbackStartedAt;
  };
  return {
    progress: {
      stageIndex: idx,
      completed: snapshot.completed,
      total: snapshot.total,
      label: snapshot.label,
      planned: snapshot.activities,
      finished: snapshot.finished,
      lastEventAt: parse(snapshot.updatedAt),
    },
    startedAt: parse(snapshot.startedAt),
  };
}

function progressFraction(state: PlanProgressState): number {
  const stage = GENERATION_STAGES[state.stageIndex];
  const from = state.stageIndex > 0 ? GENERATION_STAGES[state.stageIndex - 1].until : 0;
  const within =
    state.total && state.completed !== undefined
      ? Math.min(1, state.completed / state.total)
      : 0;
  return from + (stage.until - from) * within;
}

/**
 * Shown while the plan is generated in the background. Every stage change,
 * the progress bar and the "n of N" detail come from `study_plan_progress`
 * server events — nothing advances on a timer, so the card only ever shows
 * what the backend has actually finished.
 */
function GeneratingPlanCard({
  title,
  workspaceId,
  sessionId,
  initial,
  quickStart = false,
  confidence,
}: {
  title: string;
  workspaceId: string;
  sessionId: string;
  /** Last persisted progress, so a reload resumes instead of restarting at 0. */
  initial?: PlanGenerationSnapshot;
  quickStart?: boolean;
  /** The confidence question, asked here while the session is written (once per subject). */
  confidence?: WaitConfidenceState;
}) {
  const newUi = useNewUi();
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const [hydrated] = useState(() => progressFromSnapshot(initial, Date.now()));
  const startedAt = hydrated.startedAt;
  const [progress, setProgress] = useState<PlanProgressState>(
    hydrated.progress,
  );

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    return subscribePlanProgress(workspaceId, (event) => {
      if (event.sessionId !== sessionId) return;
      const idx = GENERATION_STAGES.findIndex((s) => s.stage === event.stage);
      if (idx < 0) return;
      setProgress((prev) => {
        const finished =
          event.stage === "generating" && event.label
            ? prev.finished.includes(event.label)
              ? prev.finished
              : [...prev.finished, event.label]
            : idx > 2
              ? prev.planned.map((a) => a.title)
              : prev.finished;
        return {
          stageIndex: idx,
          completed: event.completed,
          total: event.total,
          label: event.label,
          planned: event.activities ?? prev.planned,
          finished,
          lastEventAt: Date.now(),
        };
      });
    });
  }, [workspaceId, sessionId]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const sinceLastEvent = Math.floor((now - progress.lastEventAt) / 1000);
  const stalled = sinceLastEvent >= STALLED_AFTER_SECONDS;
  const percent = Math.round(progressFraction(progress) * 100);
  const currentStage = GENERATION_STAGES[progress.stageIndex].stage;
  const hasCount =
    progress.total !== undefined && progress.completed !== undefined;

  // First-run funnel: the wait screen was seen, and whether the learner left
  // it before the session was ready (tab hidden or closed mid-wait).
  useEffect(() => {
    if (!quickStart) return;
    const shownAt = Date.now();
    if (!waitTracked.has(sessionId)) {
      waitTracked.add(sessionId);
      track("first_run.wait_viewed", {}, workspaceId);
    }
    let reported = false;
    const left = () => {
      if (reported || document.visibilityState === "visible") return;
      reported = true;
      track("first_run.left_while_waiting", { durationMs: Date.now() - shownAt }, workspaceId);
    };
    document.addEventListener("visibilitychange", left);
    window.addEventListener("pagehide", left);
    return () => {
      document.removeEventListener("visibilitychange", left);
      window.removeEventListener("pagehide", left);
    };
  }, [quickStart, workspaceId, sessionId]);

  let detail: string | null = null;
  if (currentStage === "gathering" && hasCount && (progress.total ?? 0) > 0) {
    detail = t("firstRun.readingFiles")
      .replace("{done}", String(progress.completed))
      .replace("{total}", String(progress.total));
  } else if (currentStage === "generating" && hasCount) {
    detail =
      progress.completed === 0
        ? `${progress.total} ${t("session.progressPlanned")}`
        : `${t("session.progressWriting")} ${progress.completed} ${t("session.progressOf")} ${progress.total}${progress.label ? ` — ${progress.label}` : ""}`;
  } else if (currentStage === "verifying" && hasCount) {
    detail = `${t("session.progressRevising")} ${progress.completed} ${t("session.progressOf")} ${progress.total}${progress.label ? ` — ${progress.label}` : ""}`;
  }

  // Waiting on uploaded notes to be read (no plan yet): say what happens next, and that leaving is fine.
  const readingUploads = currentStage === "gathering" && hasCount && (progress.total ?? 0) > 0 && progress.planned.length === 0;
  // Kept once seen: the syllabus-match card stays up after the uploads are read.
  const [fromUploads, setFromUploads] = useState(false);
  if (readingUploads && !fromUploads) setFromUploads(true);

  if (newUi) {
    return (
      <SessionBuildWait
        workspaceId={workspaceId}
        sessionId={sessionId}
        focus={title}
        confidence={confidence}
        build={{
          title,
          pct: percent / 100,
          label: detail ?? t(GENERATION_STAGES[progress.stageIndex].label),
          stageIndex: progress.stageIndex,
          stageCount: GENERATION_STAGES.length,
          planned: progress.planned,
          finished: progress.finished,
          writing: progress.stageIndex >= 2,
          hint: stalled
            ? t("session.takingLonger")
            : readingUploads
              ? // Uploaded notes can take a few minutes: leaving is fine, the session-ready notification (and email once away) follows.
                t("upload.readingHint")
              : quickStart
                ? // A Quick 5 is ready in about a minute: it opens here by itself.
                  t("firstRun.busyHint")
                : t("session.generatingHint"),
          nextLabel: readingUploads ? t("upload.nextLabel") : undefined,
          nextSteps: readingUploads
            ? [
                { label: detail ?? t("upload.nextRead"), state: "now" },
                { label: t("upload.nextWrite"), state: "todo" },
                { label: t("upload.nextOpen"), state: "todo" },
              ]
            : undefined,
        }}
        extras={
          <>
            {/* A Quick 5 the first screen started without asking: the way back to the choice. */}
            {quickStart && <ChangeCourseLink workspaceId={workspaceId} sessionId={sessionId} />}
            {/* Uploaded notes matched to a syllabus while the session is written: one tap to confirm the course (never blocks the session). */}
            {fromUploads && !confidence?.open && <SyllabusMatchCard workspaceId={workspaceId} from="upload" watch className="w-full" />}
          </>
        }
      />
    );
  }

  return (
    <div className="flex justify-center px-4 py-6 animate-fade-up">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {t("session.building")} &ldquo;{title}&rdquo;…
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {stalled
                  ? t("session.takingLonger")
                  : t("session.generatingHint")}
              </p>
            </div>
            <p className="shrink-0 self-start text-[11px] text-faint tabular-nums">
              {elapsed}s
            </p>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="min-w-0 truncate" aria-live="polite">
                {detail ?? t(GENERATION_STAGES[progress.stageIndex].label)}
              </span>
              <span className="ml-3 shrink-0 tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <ol className="mt-2 flex items-center gap-1.5" aria-label={t("session.building")}>
              {GENERATION_STAGES.map((stage, i) => (
                <li
                  key={stage.label}
                  title={t(stage.label)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-[10px] font-medium"
                >
                  {i < progress.stageIndex ? (
                    <Check className="h-3 w-3 shrink-0 text-accent" />
                  ) : i === progress.stageIndex ? (
                    <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-accent border-t-transparent animate-spin" />
                  ) : (
                    <span className="mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                  )}
                  <span
                    className={`hidden truncate sm:inline ${
                      i <= progress.stageIndex ? "text-foreground" : "text-faint"
                    }`}
                  >
                    {t(stage.label)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {progress.planned.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1">
              {progress.planned.map((activity, i) => {
                const done = progress.finished.includes(activity.title);
                return (
                  <li
                    key={`${activity.title}-${i}`}
                    title={activity.title}
                    className={`flex max-w-[12rem] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
                      done
                        ? "border-accent/30 bg-accent-soft/40 text-foreground"
                        : "border-border text-faint"
                    }`}
                  >
                    {done && <Check className="h-2.5 w-2.5 shrink-0 text-accent" />}
                    <span className="min-w-0 truncate">{activity.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <SessionPrecheck workspaceId={workspaceId} sessionId={sessionId} focus={title} />
        </div>
      </div>
    </div>
  );
}
