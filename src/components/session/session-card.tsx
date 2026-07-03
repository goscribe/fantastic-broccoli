"use client";

import { StudySession } from "@/types";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import { Clock, ArrowRight } from "lucide-react";
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
}

export function SessionCard({ session, onClick }: SessionCardProps) {
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
