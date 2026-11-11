"use client";

import Image from "next/image";
import { Ring } from "@/components/design/charts";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";

/** Slim generation status (redesign): the warm-up question is the main content, this sits above it. */
export function BuildBar({
  title,
  pct,
  label,
  steps,
  index,
  done = false,
  doneLabel,
  action,
}: {
  title: string;
  pct: number;
  label: string;
  steps: number;
  index: number;
  done?: boolean;
  doneLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <Ring pct={Math.max(pct, 0.04)} size={44} stroke={4} color={done ? "#10b981" : "var(--accent)"}>
        <Image
          src={done ? "/design/cat2-cheer.png" : "/design/cat2-pencil.png"}
          alt=""
          width={30}
          height={30}
          unoptimized
          className={cn("size-[30px] object-contain", !done && "cat-float")}
        />
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{done ? (doneLabel ?? title) : `Building “${title}”`}</div>
        <div className="truncate text-[12px] text-muted-foreground" aria-live="polite">
          {label}
        </div>
      </div>
      {done && action ? (
        action
      ) : (
        <div className="flex items-center gap-1">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full",
                i < index ? "w-4 bg-accent" : i === index ? "w-4 bg-accent/40" : "w-1.5 bg-muted",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
