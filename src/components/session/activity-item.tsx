"use client";

import { SessionActivity } from "@/types";
import { MathText } from "@/components/ui/markdown-text";
import { cn, formatDuration } from "@/lib/utils";
import { Check } from "lucide-react";

const typeLabels: Record<string, string> = {
  reading: "Reading",
  comprehension_check: "Comprehension",
  mcq: "Quiz",
  flashcard_review: "Flashcards",
  worksheet: "Worksheet",
  interactive: "Interactive",
  vocab_recall: "Recall",
  cloze: "Fill the gaps",
  explain_aloud: "Explain aloud",
};

interface ActivityItemProps {
  activity: SessionActivity;
  index?: number;
  isActive?: boolean;
  onClick?: (id: string) => void;
}

export function ActivityItem({
  activity,
  index = 0,
  isActive,
  onClick,
}: ActivityItemProps) {
  const completed = activity.status === "completed";

  return (
    <button
      type="button"
      onClick={() => onClick?.(activity.id)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
        isActive ? "bg-accent-soft" : "hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
          completed
            ? "bg-accent text-accent-foreground"
            : isActive
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground border border-border-strong",
        )}
      >
        {completed ? <Check className="h-3 w-3" /> : index + 1}
      </span>

      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block text-[13px] font-medium truncate",
            completed ? "text-faint line-through" : "text-foreground",
          )}
        >
          <MathText text={activity.title} />
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {typeLabels[activity.type] ?? "Activity"} ·{" "}
          {formatDuration(activity.estimatedMinutes)}
        </span>
      </span>
    </button>
  );
}
