"use client";

import { Workspace } from "@/types";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatDuration } from "@/lib/utils";
import { Clock, ArrowRight, FileText, BookOpen } from "lucide-react";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { AvatarStack } from "@/components/ui/avatar-stack";

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
  const materialCount = workspace.materials?.length ?? 0;

  return (
    <div
      onClick={() => onClick(workspace.id)}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-5 transition-all duration-150 hover:border-border-strong hover:shadow-sm"
    >
      <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start gap-3">
        <WorkspaceIcon icon={workspace.icon} className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {workspace.title}
            </h3>
            {workspace.course && (
              <Badge variant="accent">{workspace.course}</Badge>
            )}
          </div>
          {workspace.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {workspace.description}
            </p>
          )}
        </div>
      </div>

      <div>
        {/* Stats row */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          {materialCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {materialCount} file{materialCount !== 1 ? "s" : ""}
            </span>
          )}
          {activeSessions.length > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {activeSessions.length} active
            </span>
          )}
          {totalMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(totalMinutes)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {workspace.members && workspace.members.length > 1 && (
              <AvatarStack members={workspace.members} />
            )}
          </div>
          {workspace.lastStudied && (
            <span className="text-[10px] text-faint">
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
    </div>
  );
}
