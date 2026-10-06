import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleHelp,
  Layers,
  ListChecks,
  Mic,
  MousePointerClick,
  PenLine,
  SpellCheck,
  TextCursorInput,
} from "lucide-react";
import type { AccentName } from "@/lib/accent-palette";
import type { SessionActivity } from "@/types";
import { cn } from "@/lib/utils";

export type Tone = AccentName | "neutral";

/** Soft tinted square + deep-tone icon: the one icon construction used for
 *  activities, workspaces, folders, stats and feature lists. */
const TONE: Record<Tone, string> = {
  purple: "bg-[#eeebfc] text-[#5a43d1]",
  sky: "bg-[#e3f3fc] text-[#0b7fb8]",
  pink: "bg-[#fde7f1] text-[#c4286f]",
  amber: "bg-[#fdf1dc] text-[#b86e07]",
  emerald: "bg-[#def7ec] text-[#0d8a62]",
  neutral: "bg-muted text-muted-foreground",
};

const SIZE = {
  xs: { box: "h-6 w-6 rounded-md", icon: "h-3.5 w-3.5" },
  sm: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4" },
  md: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5" },
  lg: { box: "h-12 w-12 rounded-2xl", icon: "h-6 w-6" },
  xl: { box: "h-14 w-14 rounded-2xl", icon: "h-7 w-7" },
} as const;

export type TileSize = keyof typeof SIZE;

export function IconTile({
  icon: Icon,
  tone = "purple",
  size = "md",
  className,
  strokeWidth = 2,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: TileSize;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZE[size].box,
        TONE[tone],
        className,
      )}
    >
      <Icon className={SIZE[size].icon} strokeWidth={strokeWidth} />
    </span>
  );
}

export const ACTIVITY_META: Record<
  SessionActivity["type"],
  { icon: LucideIcon; tone: Tone }
> = {
  reading: { icon: BookOpen, tone: "sky" },
  comprehension_check: { icon: CircleHelp, tone: "amber" },
  mcq: { icon: ListChecks, tone: "purple" },
  flashcard_review: { icon: Layers, tone: "pink" },
  worksheet: { icon: PenLine, tone: "emerald" },
  interactive: { icon: MousePointerClick, tone: "sky" },
  vocab_recall: { icon: SpellCheck, tone: "amber" },
  cloze: { icon: TextCursorInput, tone: "pink" },
  explain_aloud: { icon: Mic, tone: "purple" },
};

export function ActivityIcon({
  type,
  size = "md",
  className,
}: {
  type: SessionActivity["type"];
  size?: TileSize;
  className?: string;
}) {
  const meta = ACTIVITY_META[type] ?? ACTIVITY_META.reading;
  return (
    <IconTile icon={meta.icon} tone={meta.tone} size={size} className={className} />
  );
}
