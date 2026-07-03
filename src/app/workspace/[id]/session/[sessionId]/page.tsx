"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionWithActivities, getWorkspace } from "@/lib/mock-data";
import {
  SessionActivity,
  ComprehensionContent,
  McqContent,
  ReadingContent,
  FlashcardContent,
} from "@/types";
import { ActivityItem } from "@/components/session/activity-item";
import { ComprehensionActivity } from "@/components/session/comprehension-activity";
import { McqActivity } from "@/components/session/mcq-activity";
import { ReadingActivity } from "@/components/session/reading-activity";
import { FlashcardActivity } from "@/components/session/flashcard-activity";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copilot, CopilotTrigger } from "@/components/ai/copilot";
import { formatDuration } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  SkipForward,
  MessageSquare,
  X,
} from "lucide-react";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const sessionId = params.sessionId as string;

  const workspace = getWorkspace(workspaceId);
  const session = getSessionWithActivities(sessionId);

  const [activeActivityId, setActiveActivityId] = useState<string | null>(
    () => {
      if (!session) return null;
      const inProgress = session.activities.find(
        (a) => a.status === "in_progress",
      );
      if (inProgress) return inProgress.id;
      const firstPending = session.activities.find(
        (a) => a.status === "pending",
      );
      return firstPending?.id ?? null;
    },
  );

  const [showComments, setShowComments] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  const activeActivity = useMemo(
    () => session?.activities.find((a) => a.id === activeActivityId),
    [session, activeActivityId],
  );

  if (!session || !workspace) {
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

  const completedCount = session.activities.filter(
    (a) => a.status === "completed",
  ).length;
  const totalEstimated = session.activities.reduce(
    (sum, a) => sum + a.estimatedMinutes,
    0,
  );

  const goToNext = () => {
    if (!activeActivity) return;
    const idx = session.activities.findIndex(
      (a) => a.id === activeActivity.id,
    );
    const next = session.activities[idx + 1];
    setActiveActivityId(next?.id ?? null);
  };

  const renderActivity = (activity: SessionActivity) => {
    switch (activity.type) {
      case "reading":
        return (
          <ReadingActivity
            content={activity.content as ReadingContent}
            onComplete={goToNext}
          />
        );
      case "comprehension_check":
        return (
          <ComprehensionActivity
            content={activity.content as ComprehensionContent}
            onSubmitRewrite={() => {}}
            onComplete={goToNext}
          />
        );
      case "mcq":
        return (
          <McqActivity
            content={activity.content as McqContent}
            onAnswer={() => {}}
            onComplete={goToNext}
          />
        );
      case "flashcard_review":
        return (
          <FlashcardActivity
            content={activity.content as FlashcardContent}
            onCardResult={() => {}}
            onComplete={goToNext}
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
    <div className="flex-1 flex min-h-0 h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Study column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/85 backdrop-blur-md z-10">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => router.push(`/workspace/${workspaceId}`)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1.5"
              >
                <ArrowLeft className="h-3 w-3" />
                {workspace.title}
              </button>
              <h1 className="text-lg font-bold tracking-tight truncate">
                {session.title}
              </h1>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <Badge variant="accent" className="capitalize">
                  {session.depth}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(totalEstimated)}
                </span>
                <span>
                  {completedCount}/{session.activities.length} done
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              className="relative p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              {session.comments.length > 0 && (
                <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-accent text-[10px] font-bold text-accent-foreground flex items-center justify-center">
                  {session.comments.length}
                </span>
              )}
            </button>
          </div>

          <ProgressBar value={session.progress} className="mt-3" showLabel />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden w-full">
        {/* Activity list sidebar on desktop */}
        <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col border-r border-border overflow-y-auto">
          <div className="py-6 pr-4 pl-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-3">
              Your plan
            </p>
            <div className="space-y-1">
              {session.activities.map((activity, i) => (
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
        </aside>

        {/* Main study area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl px-8 py-8">
            {activeActivity ? (
              <div className="space-y-5 animate-fade-up" key={activeActivity.id}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight">
                    {activeActivity.title}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNext}
                    className="text-xs"
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skip
                  </Button>
                </div>

                {renderActivity(activeActivity)}
              </div>
            ) : (
              <div className="rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-card text-center py-14 px-6">
                <p className="text-lg font-bold tracking-tight mb-1">
                  All done — nice work.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  You&apos;ve completed every activity in this session.
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push(`/workspace/${workspaceId}`)}
                >
                  Back to workspace
                </Button>
              </div>
            )}

            {/* Mobile activity list */}
            <div className="lg:hidden mt-10 border-t border-border pt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-3">
                Your plan
              </p>
              <div className="space-y-1">
                {session.activities.map((activity, i) => (
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
          </div>
        </main>
      </div>
      </div>

      {/* Copilot split pane */}
      <Copilot
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={`Session: ${session.title}`}
      />

      {/* Comments panel */}
      {showComments && (
        <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-fade-up">
          <div className="flex items-center justify-between p-4 border-b border-border">
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
            {session.comments.map((comment, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-muted text-sm border border-border"
              >
                {comment}
              </div>
            ))}
            {session.comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No notes yet
              </p>
            )}
          </div>
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 h-9 rounded-full border border-border bg-background px-4 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
              />
              <Button
                size="sm"
                disabled={!newComment.trim()}
                onClick={() => setNewComment("")}
                className="h-9"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {!copilotOpen && <CopilotTrigger onClick={() => setCopilotOpen(true)} />}
    </div>
  );
}
