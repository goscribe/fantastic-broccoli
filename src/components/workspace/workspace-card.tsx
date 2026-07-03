"use client";

import { Workspace } from "@/types";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatDuration } from "@/lib/utils";
import { Clock, ArrowRight } from "lucide-react";

interface WorkspaceCardProps {
  workspace: Workspace;
  onClick: (id: string) => void;
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  const activeSessions = workspace.sessions.filter(
    (s) => s.status === "active",
  );
  const totalMinutes = activeSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );

  return (
    <Card
      interactive
      onClick={() => onClick(workspace.id)}
      className="group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {workspace.icon}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm leading-tight">
                {workspace.title}
              </h3>
              {workspace.course && (
                <Badge variant="accent">{workspace.course}</Badge>
              )}
            </div>
            {workspace.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {workspace.description}
              </p>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        {activeSessions.length > 0 && (
          <Badge variant="energy">
            {activeSessions.length} active{" "}
            {activeSessions.length === 1 ? "session" : "sessions"}
          </Badge>
        )}
        {totalMinutes > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(totalMinutes)}
          </span>
        )}
        {workspace.lastStudied && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatRelativeDate(workspace.lastStudied)}
          </span>
        )}
      </div>

      {workspace.totalProgress > 0 && (
        <ProgressBar
          value={workspace.totalProgress}
          className="mt-3"
          size="sm"
          showLabel
        />
      )}
    </Card>
  );
}
