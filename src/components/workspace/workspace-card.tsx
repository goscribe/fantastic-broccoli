"use client";

import { Workspace } from "@/types";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatDuration } from "@/lib/utils";
import {
  FlaskConical,
  Dna,
  Sigma,
  BookOpen,
  Clock,
  ArrowRight,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  flask: FlaskConical,
  dna: Dna,
  sigma: Sigma,
  default: BookOpen,
};

interface WorkspaceCardProps {
  workspace: Workspace;
  onClick: (id: string) => void;
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  const Icon = iconMap[workspace.icon] || iconMap.default;
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
      className="group relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
        style={{ backgroundColor: workspace.color }}
      />

      <div className="pl-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: workspace.color + "15" }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: workspace.color }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">
                {workspace.title}
              </h3>
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
            <Badge variant="accent">
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
      </div>
    </Card>
  );
}
