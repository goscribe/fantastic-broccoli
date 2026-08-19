"use client";

import { SessionActivity } from "@/types";
import { MathText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn, formatDuration } from "@/lib/utils";
import { Check } from "lucide-react";

const typeLabels: Record<string, string> = {
  reading: "session.typeReading",
  comprehension_check: "session.typeComprehension",
  mcq: "session.typeQuiz",
  flashcard_review: "session.typeFlashcards",
  worksheet: "session.typeWorksheet",
  interactive: "session.typeInteractive",
  vocab_recall: "session.typeRecall",
  cloze: "session.typeCloze",
  explain_aloud: "session.typeExplainAloud",
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
  const { t } = useI18n();
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
          {t(typeLabels[activity.type] ?? "session.typeActivity")} ·{" "}
          {formatDuration(activity.estimatedMinutes)}
        </span>
      </span>
    </button>
  );
}
