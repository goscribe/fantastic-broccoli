"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionWithActivities, getWorkspace } from "@/lib/mock-data";
import { SessionActivity, ComprehensionContent, McqContent, ReadingContent, FlashcardContent } from "@/types";
import { ActivityItem } from "@/components/session/activity-item";
import { ComprehensionActivity } from "@/components/session/comprehension-activity";
import { McqActivity } from "@/components/session/mcq-activity";
import { ReadingActivity } from "@/components/session/reading-activity";
import { FlashcardActivity } from "@/components/session/flashcard-activity";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            type="button"
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {workspace.title}
          </button>

          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{session.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <Badge variant="accent" className="text-[11px]">
                  {session.depth}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(totalEstimated)}
                </span>
                <span>
                  {completedCount}/{session.activities.length} activities
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowComments(!showComments)}
                className="relative"
              >
                <MessageSquare className="h-4 w-4" />
                {session.comments.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-accent text-[10px] text-accent-foreground flex items-center justify-center">
                    {session.comments.length}
                  </span>
                )}
              </Button>
            </div>
          </div>

          <ProgressBar
            value={session.progress}
            className="mt-2"
            size="sm"
            showLabel
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Activity list sidebar on desktop */}
        <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col border-r border-border bg-card/30 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Activities
            </p>
            <div className="space-y-0.5">
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
          <div className="max-w-2xl mx-auto px-4 py-6">
            {activeActivity ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
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
              <Card className="text-center py-10">
                <p className="text-sm font-medium mb-1">All done!</p>
                <p className="text-xs text-muted-foreground mb-4">
                  You&apos;ve completed all activities in this session.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/workspace/${workspaceId}`)}
                >
                  Back to workspace
                </Button>
              </Card>
            )}

            {/* Mobile activity list */}
            <div className="lg:hidden mt-8 border-t border-border pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                All activities
              </p>
              <div className="space-y-0.5">
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

      {/* Comments panel */}
      {showComments && (
        <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-card border-l border-border shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Session notes</h3>
            <button
              type="button"
              onClick={() => setShowComments(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {session.comments.map((comment, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-muted text-sm"
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
                placeholder="Add a note..."
                className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!newComment.trim()}
                onClick={() => setNewComment("")}
                className="h-8"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
