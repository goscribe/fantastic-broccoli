"use client";

import { Workspace } from "@/types";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate, formatDuration } from "@/lib/utils";
import { accentForId } from "@/lib/accent-palette";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { Clock, ArrowRight, FileText, BookOpen, UserPlus } from "lucide-react";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { AvatarStack } from "@/components/ui/avatar-stack";
import {
  ResourceActionsMenu,
  type ResourceActions,
} from "@/components/workspace/resource-actions";

interface WorkspaceCardProps {
  workspace: Workspace;
  onClick: (id: string) => void;
  actions?: ResourceActions;
}

export function WorkspaceCard({ workspace, onClick, actions }: WorkspaceCardProps) {
  const { t } = useI18n();
  const activeSessions = workspace.sessions.filter(
    (s) => s.status === "active",
  );
  const totalMinutes = activeSessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );
  const materialCount = workspace.materials?.length ?? 0;
  const materialsSummary =
    materialCount > 0
      ? t(
          materialCount === 1 ? "ws.materialUploaded" : "ws.materialsUploaded",
        ).replace("{n}", String(materialCount))
      : t("ws.noMaterialsYet");
  const sessionsSummary =
    activeSessions.length > 0
      ? t(
          activeSessions.length === 1
            ? "ws.sessionInProgress"
            : "ws.sessionsInProgress",
        ).replace("{n}", String(activeSessions.length))
      : t("ws.noActiveSessions");
  const color = accentForId(workspace.id);

  return (
    <div
      onClick={() => onClick(workspace.id)}
      className="group relative cursor-pointer rounded-2xl border border-border bg-card p-5 pt-6 transition-all duration-150 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }}
      />
      {actions ? (
        <ResourceActionsMenu
          actions={actions}
          className="absolute top-3.5 right-3.5"
        />
      ) : (
        <ArrowRight className="absolute top-5 right-5 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <WorkspaceIcon icon={workspace.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1 pr-5">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {workspace.title}
            </h3>
            {workspace.course && (
              <Badge variant="accent">{workspace.course}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {workspace.description ||
              `${materialsSummary} · ${sessionsSummary}`}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {materialCount} {materialCount === 1 ? t("ws.file") : t("ws.files")}
        </span>
        {activeSessions.length > 0 && (
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {activeSessions.length} {t("ws.active")}
          </span>
        )}
        {totalMinutes > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(totalMinutes)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {actions?.onMembers ? (
            <button
              type="button"
              aria-label={t("ws.manageMembers")}
              title={t("ws.manageMembers")}
              onClick={(e) => {
                e.stopPropagation();
                actions.onMembers?.();
              }}
              className="flex items-center gap-1 rounded-full px-1 py-0.5 hover:bg-muted"
            >
              {workspace.members && workspace.members.length > 0 ? (
                <AvatarStack members={workspace.members} />
              ) : null}
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                <UserPlus className="h-3 w-3" />
              </span>
            </button>
          ) : (
            workspace.members &&
            workspace.members.length > 1 && (
              <AvatarStack members={workspace.members} />
            )
          )}
          {workspace.lastStudied && (
            <span className="text-[10px] text-faint">
              {formatRelativeDate(workspace.lastStudied)}
            </span>
          )}
        </span>
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
  );
}
