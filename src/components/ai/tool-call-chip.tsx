"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  CalendarClock,
  ListPlus,
  Check,
  Loader2,
  ChevronDown,
  FileText,
  Paperclip,
} from "lucide-react";
import { Surface } from "@/components/ui/card";
import { ToolCallPart, ToolName } from "@/components/ai/chat-types";

const toolMeta: Record<ToolName, { icon: React.ElementType; color: string }> = {
  search_materials: { icon: Search, color: "text-sky" },
  update_plan: { icon: CalendarClock, color: "text-violet" },
  add_activity: { icon: ListPlus, color: "text-accent" },
  generate_summary: { icon: FileText, color: "text-amber" },
  attach_study_aids: { icon: Paperclip, color: "text-accent" },
};

export function ToolCallChip({ part }: { part: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false);
  const meta = toolMeta[part.tool];
  const Icon = meta.icon;

  return (
    <Surface muted className="my-1.5 overflow-hidden animate-fade-up">
      <button
        type="button"
        onClick={() => part.status === "done" && setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className={cn("flex items-center justify-center shrink-0", meta.color)}>
          {part.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold">
            {part.status === "running" ? (
              <span className="animate-shimmer">{part.label}…</span>
            ) : (
              part.label
            )}
          </span>
          <span className="block text-[11px] text-muted-foreground font-mono truncate">
            {part.args}
          </span>
        </span>
        {part.status === "done" && (
          <>
            <Check className="h-3.5 w-3.5 text-success shrink-0" />
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-faint shrink-0 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </>
        )}
      </button>
      {expanded && part.status === "done" && (
        <div className="px-3 pb-2.5 pt-0.5 text-xs text-muted-foreground border-t border-border/60 mt-0.5">
          <p className="pt-2">{part.result}</p>
        </div>
      )}
    </Surface>
  );
}
