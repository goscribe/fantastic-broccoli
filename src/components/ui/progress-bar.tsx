"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  className,
  barClassName,
  showLabel = false,
  size = "md",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const heightClass = size === "sm" ? "h-1" : size === "lg" ? "h-2.5" : "h-1.5";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex-1 rounded-full bg-muted overflow-hidden",
          heightClass,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            clamped === 100 ? "bg-success" : "bg-accent",
            barClassName,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium tabular-nums text-muted-foreground min-w-[2.5rem] text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}
