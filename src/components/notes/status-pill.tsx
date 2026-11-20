"use client";

import type { NoteStatus } from "@/lib/api/notes";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<NoteStatus, string> = {
  DRAFT: "Draft",
  CHANGES_REQUESTED: "Changes requested",
  REVIEWED: "Reviewed",
  PUBLISHED: "Published",
};

export function StatusPill({ status }: { status: NoteStatus }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold",
        status === "REVIEWED" || status === "PUBLISHED"
          ? "bg-accent-soft text-accent-dim"
          : status === "CHANGES_REQUESTED"
            ? "bg-amber/15 text-[#92400e]"
            : "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

