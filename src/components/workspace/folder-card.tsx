"use client";

import { Folder } from "@/types";
import { countWorkspaces } from "@/lib/utils";
import { accentForId } from "@/lib/accent-palette";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { ChevronRight, Folder as FolderIcon } from "lucide-react";
import {
  ResourceActionsMenu,
  type ResourceActions,
} from "@/components/workspace/resource-actions";

interface FolderCardProps {
  folder: Folder;
  onClick: (id: string) => void;
  actions?: ResourceActions;
}

export function FolderCard({ folder, onClick, actions }: FolderCardProps) {
  const { t } = useI18n();
  const wsCount = countWorkspaces(folder);
  const subCount = folder.folders?.length ?? 0;
  const accentHex = folder.color || accentForId(folder.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(folder.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(folder.id);
      }}
      className="group relative flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-card-hover"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `${accentHex}1f`, color: accentHex }}
      >
        <FolderIcon className="h-4 w-4" />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {subCount > 0 &&
            `${subCount} ${subCount === 1 ? t("ws.folderWord") : t("ws.foldersWord")} · `}
          {wsCount}{" "}
          {wsCount === 1 ? t("ws.workspaceWord") : t("ws.workspacesWord")}
        </p>
      </div>
      {actions ? (
        <ResourceActionsMenu actions={actions} className="relative shrink-0" />
      ) : (
        <ChevronRight className="relative h-4 w-4 text-faint opacity-0 group-hover:opacity-100" />
      )}
    </div>
  );
}
