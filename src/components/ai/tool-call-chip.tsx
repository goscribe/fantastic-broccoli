"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Check,
  Loader2,
  ChevronDown,
  Paperclip,
  BookOpen,
  Layers,
  Pencil,
  FolderCog,
  Sparkles,
  Link2,
  Target,
  ListVideo,
  Wrench,
} from "lucide-react";
import { Surface } from "@/components/ui/card";
import { ToolCallPart, ToolName } from "@/components/ai/chat-types";

const toolMeta: Record<ToolName, { icon: React.ElementType; color: string }> = {
  attach_study_aids: { icon: Paperclip, color: "text-accent" },
  search_workspace_knowledge: { icon: Search, color: "text-sky" },
  search_study_session: { icon: BookOpen, color: "text-sky" },
  search_all_study_sessions: { icon: Layers, color: "text-sky" },
  modify_study_session: { icon: Pencil, color: "text-violet" },
  manage_workspace: { icon: FolderCog, color: "text-violet" },
  create_study_session: { icon: Sparkles, color: "text-accent" },
  attach_study_session: { icon: Link2, color: "text-accent" },
  attach_artifact: { icon: Paperclip, color: "text-accent" },
  record_mastery: { icon: Target, color: "text-amber" },
  import_youtube_video: { icon: ListVideo, color: "text-rose" },
};

const fallbackMeta = { icon: Wrench, color: "text-muted-foreground" };

export function ToolCallChip({ part }: { part: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false);
  const meta = toolMeta[part.tool as ToolName] ?? fallbackMeta;
  const Icon = meta.icon;
  const expandable = part.status === "done" && part.result.length > 0;

  return (
    <Surface muted className="my-1.5 overflow-hidden animate-fade-up">
      <button
        type="button"
        onClick={() => expandable && setExpanded(!expanded)}
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
          {part.args ? (
            <span className="block text-[11px] text-muted-foreground font-mono truncate">
              {part.args}
            </span>
          ) : null}
        </span>
        {part.status === "done" && (
          <>
            <Check className="h-3.5 w-3.5 text-success shrink-0" />
            {expandable && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-faint shrink-0 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            )}
          </>
        )}
      </button>
      {expanded && expandable && (
        <div className="px-3 pb-2.5 pt-0.5 text-xs text-muted-foreground border-t border-border/60 mt-0.5">
          <p className="pt-2">{part.result}</p>
        </div>
      )}
    </Surface>
  );
}
