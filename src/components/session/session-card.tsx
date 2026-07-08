"use client";

import { StudySession } from "@/types";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import { Clock, ArrowRight, AlertTriangle, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { SessionArt } from "@/components/graphics/material-art";

const depthLabels = {
  light: "Light review",
  moderate: "Moderate",
  deep: "Deep study",
};

const activityLabels: Record<string, string> = {
  reading: "Reading",
  comprehension_check: "Comprehension",
  mcq: "Quiz",
  worksheet: "Worksheet",
  interactive: "Interactive",
  cloze: "Fill the gaps",
  flashcard_review: "Flashcards",
  vocab_recall: "Active recall",
  explain_aloud: "Explain aloud",
};

const depthVariants = {
  light: "muted" as const,
  moderate: "accent" as const,
  deep: "warning" as const,
};

interface SessionCardProps {
  session: StudySession;
  onClick: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  retrying?: boolean;
  deleting?: boolean;
}

export function SessionCard({
  session,
  onClick,
  onRetry,
  onDelete,
  retrying,
  deleting,
}: SessionCardProps) {
  if (session.status === "failed") {
    return (
      <Card className="border-rose/30">
        <div className="flex items-start gap-3.5">
          <SessionArt className="h-10 w-10 shrink-0 opacity-60" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate">{session.title}</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose/10 text-rose px-2 py-0.5 text-[10px] font-semibold shrink-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                Generation failed
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Scribe couldn&apos;t generate this study plan. You can retry with
              the same settings, or delete the session.
            </p>
            <div className="flex items-center gap-2 mt-3">
              {onRetry && (
                <button
                  type="button"
                  disabled={retrying || deleting}
                  onClick={() => onRetry(session.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {retrying ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Retry
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  disabled={retrying || deleting}
                  onClick={() => onDelete(session.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-rose hover:border-rose/40 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const completedActivities = session.activities.filter(
    (a) => a.status === "completed",
  ).length;
  const totalActivities = session.activities.length;
  const activityTypes = Array.from(
    new Set(session.activities.map((a) => a.type)),
  );

  return (
    <Card
      interactive
      onClick={() => onClick(session.id)}
      className="group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <SessionArt className="h-10 w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{session.title}</h4>
            {session.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {session.description}
              </p>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge variant={depthVariants[session.depth]}>
          {depthLabels[session.depth]}
        </Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDuration(session.durationMinutes)}
        </span>
        {session.examBoard && (
          <Badge variant="muted">{session.examBoard}</Badge>
        )}
        {session.generating && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-accent border-t-transparent animate-spin" />
            Generating plan…
          </span>
        )}
        {totalActivities > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {completedActivities}/{totalActivities} activities
          </span>
        )}
      </div>

      {activityTypes.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {activityTypes.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
            >
              {activityLabels[t] ?? t}
            </span>
          ))}
        </div>
      )}

      {session.comments.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1">
          &ldquo;{session.comments[0].content}&rdquo;
        </p>
      )}

      <ProgressBar
        value={session.progress}
        className="mt-3"
        size="sm"
        showLabel
      />

      {session.endDate && (
        <div className="flex justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">
            Started {formatRelativeDate(session.startDate)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Due {formatRelativeDate(session.endDate)}
          </span>
        </div>
      )}
    </Card>
  );
}
