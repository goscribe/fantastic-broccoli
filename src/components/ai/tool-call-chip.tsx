"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  Paperclip,
  BookOpen,
  Layers,
  Pencil,
  FolderCog,
  Sparkles,
  Link2,
  Target,
  ListVideo,
  FileText,
} from "lucide-react";
import { ToolCallPart, ToolName } from "@/components/ai/chat-types";

/**
 * One quiet line per thing Copilot did, in plain words — no boxes, no
 * monospace queries. A notes search shows the passage it found and which
 * file it came from.
 */
const toolMeta: Record<ToolName, { icon: React.ElementType; done: string; running: string; showDetail?: boolean }> = {
  attach_study_aids: { icon: Paperclip, done: "Added study aids", running: "Adding study aids", showDetail: true },
  search_workspace_knowledge: { icon: Search, done: "Looked through your notes", running: "Looking through your notes", showDetail: true },
  search_study_session: { icon: BookOpen, done: "Checked this session", running: "Checking this session" },
  search_all_study_sessions: { icon: Layers, done: "Checked your past sessions", running: "Checking your past sessions" },
  modify_study_session: { icon: Pencil, done: "Updated your session", running: "Updating your session" },
  manage_workspace: { icon: FolderCog, done: "Updated your subject", running: "Updating your subject" },
  create_study_session: { icon: Sparkles, done: "Made a study session", running: "Making a study session", showDetail: true },
  attach_study_session: { icon: Link2, done: "Linked a study session", running: "Linking a study session", showDetail: true },
  attach_artifact: { icon: Paperclip, done: "Shared study material", running: "Sharing study material", showDetail: true },
  record_mastery: { icon: Target, done: "Noted your progress", running: "Noting your progress" },
  import_youtube_video: { icon: ListVideo, done: "Added a YouTube video", running: "Adding a YouTube video", showDetail: true },
};

/** Searches send regex-ish patterns ("a|b|c"); only show plain-language details. */
const readable = (s: string) => s && !/[|\\^$()[\]{}]/.test(s);

export function ToolCallChip({ part }: { part: ToolCallPart }) {
  const [showAll, setShowAll] = useState(false);
  const meta = toolMeta[part.tool as ToolName];
  const Icon = meta?.icon ?? Sparkles;
  const running = part.status === "running";
  const label = meta ? (running ? meta.running : meta.done) : part.label;
  const detail = meta?.showDetail && readable(part.args) ? part.args : "";
  const sources = part.sources ?? [];
  const shown = showAll ? sources : sources.slice(0, 1);

  return (
    <div className="my-1 animate-fade-up">
      <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        {running ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <Icon className="size-3.5 shrink-0 text-faint" />
        )}
        <span className={cn("truncate", running && "animate-shimmer")}>
          {label}
          {detail && <span className="text-faint"> for &ldquo;{detail}&rdquo;</span>}
          {running && "…"}
        </span>
      </p>
      {part.result && !running && (
        <p className="ml-5 mt-0.5 text-[12px] text-faint">{part.result}</p>
      )}
      {shown.length > 0 && (
        <div className="ml-5 mt-1.5 space-y-1.5">
          {shown.map((s, i) => (
            <figure key={i} className="border-l-2 border-accent/40 pl-3">
              <blockquote className="text-[13px] leading-5 text-foreground/80">&ldquo;{s.snippet}&rdquo;</blockquote>
              <figcaption className="mt-0.5 flex items-center gap-1 text-[11.5px] text-faint">
                <FileText className="size-3 shrink-0" />
                <span className="truncate">{s.document}</span>
              </figcaption>
            </figure>
          ))}
          {sources.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[12px] font-medium text-accent-dim hover:underline"
            >
              {showAll ? "Show less" : `+${sources.length - 1} more from your notes`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
