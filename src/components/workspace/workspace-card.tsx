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

const colorGradients: Record<string, string> = {
  green:
    "from-emerald-50 via-emerald-50/40 to-transparent dark:from-emerald-950/30 dark:via-emerald-950/10",
  blue: "from-sky-50 via-sky-50/40 to-transparent dark:from-sky-950/30 dark:via-sky-950/10",
  purple:
    "from-violet-50 via-violet-50/40 to-transparent dark:from-violet-950/30 dark:via-violet-950/10",
  red: "from-rose-50 via-rose-50/40 to-transparent dark:from-rose-950/30 dark:via-rose-950/10",
  amber:
    "from-amber-50 via-amber-50/40 to-transparent dark:from-amber-950/30 dark:via-amber-950/10",
};

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  const activeSessions = workspace.sessions.filter(
    (s) => s.status === "active",
  );
  const totalMinutes = activeSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const materialCount = workspace.materials?.length ?? 0;
  const gradient =
    colorGradients[workspace.color] ?? colorGradients.green;

  return (
    <div
      onClick={() => onClick(workspace.id)}
      className="group relative cursor-pointer rounded-2xl border border-border bg-card overflow-hidden transition-all duration-150 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
    >
      {/* Gradient header */}
      <div
        className={`h-20 bg-gradient-to-b ${gradient} flex items-end px-5 pb-3`}
      >
        <WorkspaceIcon icon={workspace.icon} className="h-10 w-10 drop-shadow-sm" />
        <ArrowRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Content */}
      <div className="px-5 pt-3 pb-5">
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
