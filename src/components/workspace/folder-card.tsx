"use client";

import { Folder } from "@/types";
import { countWorkspaces } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface FolderCardProps {
  folder: Folder;
  onClick: (id: string) => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const wsCount = countWorkspaces(folder);
  const subCount = folder.folders?.length ?? 0;

  return (
    <button
      type="button"
      onClick={() => onClick(folder.id)}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left hover:border-border-strong transition-colors"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden>
        <path
          fill={folder.color}
          d="M2.25 6A2.25 2.25 0 0 1 4.5 3.75h4.8c.6 0 1.17.24 1.59.66l1.35 1.38c.28.29.67.46 1.08.46h6.18A2.25 2.25 0 0 1 21.75 8.5v9.5a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 18V6z"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {subCount > 0 &&
            `${subCount} folder${subCount !== 1 ? "s" : ""} · `}
          {wsCount} workspace{wsCount !== 1 ? "s" : ""}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-faint opacity-0 group-hover:opacity-100" />
    </button>
  );
}
