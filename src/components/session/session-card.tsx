"use client";

import { StudySession } from "@/types";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import { Clock, Play, Pause, CheckCircle2, ArrowRight } from "lucide-react";

const depthLabels = {
  light: "Light review",
  moderate: "Moderate",
  deep: "Deep study",
};

const depthVariants = {
  light: "muted" as const,
  moderate: "accent" as const,
  deep: "warning" as const,
};

const statusIcons = {
  active: Play,
  paused: Pause,
  completed: CheckCircle2,
};

interface SessionCardProps {
  session: StudySession;
  onClick: (id: string) => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const StatusIcon = statusIcons[session.status];
  const completedActivities = session.activities.filter(
    (a) => a.status === "completed",
  ).length;
  const totalActivities = session.activities.length;

  return (
    <Card
      interactive
      onClick={() => onClick(session.id)}
      className="group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={`h-4 w-4 flex-shrink-0 ${
                session.status === "active"
                  ? "text-accent"
                  : session.status === "completed"
                    ? "text-success"
                    : "text-muted-foreground"
              }`}
            />
            <h4 className="font-medium text-sm truncate">{session.title}</h4>
          </div>
          {session.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-6">
              {session.description}
            </p>
          )}
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
        {totalActivities > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {completedActivities}/{totalActivities} activities
          </span>
        )}
      </div>

      {session.comments.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1">
          &ldquo;{session.comments[0]}&rdquo;
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
