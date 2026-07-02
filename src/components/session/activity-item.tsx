"use client";

import { SessionActivity } from "@/types";
import { cn, formatDuration } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  LayoutGrid,
  FileText,
  CheckCircle2,
  Circle,
  Loader2,
  SkipForward,
  HelpCircle,
  Gamepad2,
} from "lucide-react";

const typeConfig: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  reading: { icon: BookOpen, label: "Reading", color: "text-blue-500" },
  comprehension_check: {
    icon: Brain,
    label: "Comprehension",
    color: "text-purple-500",
  },
  mcq: { icon: HelpCircle, label: "MCQ", color: "text-amber-500" },
  flashcard_review: {
    icon: LayoutGrid,
    label: "Flashcards",
    color: "text-emerald-500",
  },
  worksheet: { icon: FileText, label: "Worksheet", color: "text-rose-500" },
  interactive: {
    icon: Gamepad2,
    label: "Interactive",
    color: "text-cyan-500",
  },
};

const statusIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  in_progress: Loader2,
  pending: Circle,
  skipped: SkipForward,
};

interface ActivityItemProps {
  activity: SessionActivity;
  index?: number;
  isActive?: boolean;
  onClick?: (id: string) => void;
}

export function ActivityItem({
  activity,
  isActive,
  onClick,
}: ActivityItemProps) {
  const config = typeConfig[activity.type] || typeConfig.reading;
  const TypeIcon = config.icon;
  const StatusIcon = statusIcons[activity.status] || Circle;

  return (
    <button
      type="button"
      onClick={() => onClick?.(activity.id)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left group",
        isActive
          ? "bg-accent/5 border border-accent/20"
          : "hover:bg-muted/50",
        activity.status === "completed" && "opacity-70",
      )}
    >
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            isActive ? "bg-accent/10" : "bg-muted",
          )}
        >
          <TypeIcon className={cn("h-4 w-4", config.color)} />
        </div>
        <StatusIcon
          className={cn(
            "absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-card rounded-full",
            activity.status === "completed" && "text-success",
            activity.status === "in_progress" && "text-accent animate-spin",
            activity.status === "pending" && "text-muted-foreground",
            activity.status === "skipped" && "text-muted-foreground",
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              activity.status === "completed" && "line-through",
            )}
          >
            {activity.title}
          </span>
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {config.label}
          </span>
        </div>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {activity.description}
          </p>
        )}
      </div>

      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
        {formatDuration(activity.estimatedMinutes)}
      </span>
    </button>
  );
}
