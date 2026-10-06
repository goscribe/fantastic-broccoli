import type { LucideIcon } from "lucide-react";
import { IconTile, type Tone } from "@/components/graphics/icon-tile";
import { cn } from "@/lib/utils";

/** Quiet empty state: icon tile + left-aligned copy on a plain card. */
export function EmptyScene({
  icon,
  tone = "neutral",
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card px-6 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="lg" className="mb-4" />
      <div className="max-w-md">{children}</div>
    </div>
  );
}
