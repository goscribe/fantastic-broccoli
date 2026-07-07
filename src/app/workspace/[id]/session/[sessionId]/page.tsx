"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  addSessionNote,
  appendActivities,
  fetchExtensionActivities,
  fetchStudySession,
  removeSessionNote,
  setActivityStatus,
  subscribePlanGeneration,
} from "@/lib/api/study";
import { recordFlashcardAttempt } from "@/lib/api/study-session";
import {
  SessionActivity,
  SessionNote,
  ComprehensionContent,
  McqContent,
  ReadingContent,
  FlashcardContent,
  VocabRecallContent,
  ClozeContent,
  ExplainAloudContent,
  WorksheetContent,
} from "@/types";
import { ActivityItem } from "@/components/session/activity-item";
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
import { WorksheetActivity } from "@/components/session/worksheet-activity";
import { SessionDebrief } from "@/components/session/session-debrief";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copilot, CopilotTrigger } from "@/components/ai/copilot";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Clock,
  SkipForward,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";

const phaseOf = (t: SessionActivity["type"]) =>
  t === "reading" || t === "comprehension_check" || t === "interactive"
    ? "Learn"
    : t === "mcq" || t === "worksheet" || t === "cloze"
      ? "Practice"
      : "Recall";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const sessionId = params.sessionId as string;

  const queryClient = useQueryClient();
  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const { data: session, isLoading } = useQuery({
    queryKey: ["study-session", sessionId],
    queryFn: () => fetchStudySession(sessionId),
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
    (!!session && !generating && session.activities.length === 0);
  // No study features until the plan actually exists.
  const planReady = !!session && !generating && !planFailed;

  // undefined = not chosen yet (default to first unfinished); null = plan done (debrief)
  const [chosenActivityId, setChosenActivityId] = useState<
    string | null | undefined
  >(undefined);
  const activeActivityId =
    chosenActivityId !== undefined
      ? chosenActivityId
      : (session?.activities.find((a) => a.status === "in_progress")?.id ??
        session?.activities.find((a) => a.status === "pending")?.id ??
        null);
  const setActiveActivityId = setChosenActivityId;

  const [showComments, setShowComments] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
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

  const completeActivity = useMutation({
    mutationFn: (input: { activityId: string; skipped?: boolean }) =>
      setActivityStatus(
        input.activityId,
        input.skipped ? "skipped" : "completed",
      ),
    onSuccess: () =>
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Session not found</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="mt-2"
          >
            Go back
          </Button>
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

  const goToNext = (skipped = false) => {
    if (!activeActivity) return;
    completeActivity.mutate({ activityId: activeActivity.id, skipped });
    const idx = activities.findIndex((a) => a.id === activeActivity.id);
    const next = activities[idx + 1];
    setActiveActivityId(next?.id ?? null);
  };

  const activeIndex = activeActivity
    ? activities.findIndex((a) => a.id === activeActivity.id)
    : activities.length;
  const nearEnd = activeIndex >= activities.length - 2;
  const showExtendPrompt =
    planReady && nearEnd && !extended && !extendDismissed && extensions.length > 0;
  const extensionMinutes = extensions.reduce(
    (s, a) => s + a.estimatedMinutes,
    0,
  );

  const renderActivity = (activity: SessionActivity) => {
    switch (activity.type) {
      case "reading":
        return (
          <ReadingActivity
            content={activity.content as ReadingContent}
            activityId={activity.id}
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
            activityId={activity.id}
            content={activity.content as ComprehensionContent}
            onComplete={() => goToNext()}
          />
        );
      case "mcq":
        return (
          <McqActivity
            content={activity.content as McqContent}
            onAnswer={() => {}}
            onComplete={() => goToNext()}
          />
        );
      case "flashcard_review":
        return (
          <FlashcardActivity
            content={activity.content as FlashcardContent}
            onCardResult={(index, known) => {
              const card = (activity.content as FlashcardContent).cards[index];
              if (card?.flashcardId) {
                recordFlashcardAttempt({
                  flashcardId: card.flashcardId,
                  isCorrect: known,
                }).catch(() => {});
              }
            }}
            onComplete={() => goToNext()}
          />
        );
      case "vocab_recall":
        return (
          <VocabRecallActivity
            content={activity.content as VocabRecallContent}
            onTermResult={(index, correct) => {
              const term = (activity.content as VocabRecallContent).terms[
                index
              ];
              if (term?.flashcardId) {
                recordFlashcardAttempt({
                  flashcardId: term.flashcardId,
                  isCorrect: correct,
                }).catch(() => {});
              }
            }}
            onComplete={() => goToNext()}
          />
        );
      case "cloze":
        return (
          <ClozeActivity
            activityId={activity.id}
            content={activity.content as ClozeContent}
            onComplete={() => goToNext()}
          />
        );
      case "worksheet":
        return (
          <WorksheetActivity
            activityId={activity.id}
            content={activity.content as WorksheetContent}
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
      default:
        return (
          <Card className="text-center py-6 text-sm text-muted-foreground">
            Activity type &ldquo;{activity.type}&rdquo; coming soon
          </Card>
        );
    }
  };

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Study column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card z-10">
        <div className="px-6 h-12 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-3 w-3" />
            {workspace.title}
          </button>
          <span className="text-border-strong">/</span>
          <h1 className="text-sm font-bold tracking-tight truncate">
            {session.title}
          </h1>
          <Badge variant="accent" className="capitalize shrink-0">
            {session.depth}
          </Badge>
          {planReady && (
            <div className="ml-auto flex items-center gap-4 shrink-0">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(totalEstimated)}
              </span>
              <span className="text-xs text-muted-foreground">
                {completedCount}/{activities.length} done
              </span>
              <div className="w-32">
                <ProgressBar value={session.progress} size="sm" />
              </div>
              <span className="text-xs font-semibold tabular-nums">
                {session.progress}%
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
        {/* Activity list sidebar on desktop */}
        {planReady && (
        <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col border-r border-border overflow-y-auto">
          <div className="py-6 pr-4 pl-5">
            <p className="text-xs font-semibold text-muted-foreground mb-3">
              Your plan
            </p>
            <div className="space-y-1">
              {activities.map((activity, i) => {
                const phase = phaseOf(activity.type);
                const prevPhase =
                  i > 0 ? phaseOf(activities[i - 1].type) : null;
                return (
                  <div key={activity.id}>
                    {phase !== prevPhase && (
                      <p className="text-[11px] font-semibold text-faint px-3 pt-3 pb-1 first:pt-0">
                        {phase}
                      </p>
                    )}
                    <ActivityItem
                      activity={activity}
                      index={i}
                      isActive={activity.id === activeActivityId}
                      onClick={setActiveActivityId}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        )}

        {/* Main study area */}
        <main className="flex-1 overflow-y-auto bg-card">
          <div className="px-8 py-2">
            {showExtendPrompt && (
              <div className="mb-5 rounded-2xl border border-accent/30 bg-accent-soft/60 px-5 py-4 flex flex-wrap items-center gap-3 animate-fade-up">
                <div className="flex-1 min-w-56">
                  <p className="text-sm font-semibold">
                    You&apos;re almost done — keep the momentum?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your quiz scores on periodic trends were shaky, so Scribe
                    precomputed {extensions.length} more activities from your
                    worksheet bank (+{extensionMinutes} min).
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
                    Continue plan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExtendDismissed(true)}
                  >
                    Finish as planned
                  </Button>
                </div>
              </div>
            )}

            {planFailed ? (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-up">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose/10">
                  <X className="h-5 w-5 text-rose" />
                </div>
                <p className="mt-4 text-sm font-semibold">
                  Plan generation failed
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {planError ??
                    "Scribe couldn't build a study plan for this session. Delete it and create a new one to retry."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-5"
                  onClick={() => router.push(`/workspace/${workspaceId}`)}
                >
                  Back to workspace
                </Button>
              </div>
            ) : generating ? (
              <GeneratingPlanCard title={session.title} />
            ) : activeActivity ? (
              <div className="space-y-5 animate-fade-up" key={activeActivity.id}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight">
                    {activeActivity.title}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToNext(true)}
                    className="text-xs"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skip
                  </Button>
                </div>

                {renderActivity(activeActivity)}
              </div>
            ) : (
              <SessionDebrief
                sessionId={sessionId}
                onBack={() => router.push(`/workspace/${workspaceId}`)}
              />
            )}

            {/* Mobile activity list */}
            {planReady && (
            <div className="lg:hidden mt-10 border-t border-border pt-6">
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                Your plan
              </p>
              <div className="space-y-1">
                {activities.map((activity, i) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    index={i}
                    isActive={activity.id === activeActivityId}
                    onClick={setActiveActivityId}
                  />
                ))}
              </div>
            </div>
            )}
          </div>
        </main>
      </div>
      </div>

      {/* Copilot split pane */}
      <Copilot
        open={planReady && copilotOpen}
        onClose={() => setCopilotOpen(false)}
        workspaceId={workspaceId}
        context={`Session: ${session.title}`}
      />

      {/* Comments panel */}
      {planReady && showComments && (
        <div className="fixed inset-y-0 right-0 w-[26rem] max-w-full bg-card border-l border-border z-50 flex flex-col animate-fade-up">
          <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold">Session notes</h3>
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
                  Highlights
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
                  Notes
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
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Surface>
            ))}
            {panelCount === 0 && (
              <div className="text-center py-8">
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Jot down reminders or highlight the reading — both show up
                  here.
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
                placeholder="Add a note… (Enter to save)"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
              />
              <Button
                size="sm"
                disabled={!newComment.trim()}
                onClick={submitNote}
                className="h-9"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {planReady && !copilotOpen && (
        <CopilotTrigger onClick={() => setCopilotOpen(true)} />
      )}
    </div>
  );
}

const GENERATION_STAGES = [
  { label: "Gathering your materials", after: 0 },
  { label: "Outlining the session", after: 6 },
  { label: "Writing activities", after: 18 },
  { label: "Finishing up", after: 45 },
];

/**
 * Shown while the plan is generated in the background. Progress stages are
 * time-based estimates (the server only reports done/failed via Pusher).
 */
function GeneratingPlanCard({ title }: { title: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const currentStage = GENERATION_STAGES.reduce(
    (acc, stage, i) => (elapsed >= stage.after ? i : acc),
    0,
  );

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-up">
      <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <p className="mt-4 text-sm font-semibold">
        Building &ldquo;{title}&rdquo;…
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Scribe is generating a study plan grounded in your materials. This
        usually takes under a minute — you can leave and come back.
      </p>
      <div className="mt-6 w-full max-w-xs space-y-2 text-left">
        {GENERATION_STAGES.map((stage, i) => (
          <p
            key={stage.label}
            className="flex items-center gap-2 text-xs font-medium"
          >
            {i < currentStage ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : i === currentStage ? (
              <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-accent border-t-transparent animate-spin" />
            ) : (
              <span className="h-1.5 w-1.5 mx-1 rounded-full bg-border-strong" />
            )}
            <span
              className={
                i <= currentStage ? "text-foreground" : "text-faint"
              }
            >
              {stage.label}
            </span>
          </p>
        ))}
      </div>
      <p className="mt-5 text-[11px] text-faint tabular-nums">
        {elapsed}s elapsed
      </p>
    </div>
  );
}
