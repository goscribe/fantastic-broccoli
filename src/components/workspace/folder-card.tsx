"use client";

import { Folder } from "@/types";
import { countWorkspaces } from "@/lib/utils";
import { accentNameForColor, ACCENT_WASH } from "@/lib/accent-palette";
import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { ChevronRight } from "lucide-react";
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
  const accent = accentNameForColor(folder.color, folder.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(folder.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(folder.id);
      }}
      className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-3xl bg-card px-4 py-3.5 text-left shadow-[0_4px_0_0_var(--border)] transition-all hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(105,82,224,0.18)]"
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${ACCENT_WASH[accent]}`}
      >
        <Image
          src={`/illustrations/icons/folder-${accent}.png`}
          alt=""
          width={88}
          height={88}
          unoptimized
          className="sticker-3d pointer-events-none h-10 w-10 select-none object-contain"
        />
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
