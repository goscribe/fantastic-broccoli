"use client";

import { cn } from "@/lib/utils";

/** Custom gradient flame graphic (no icon library). */
export function StreakFlame({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label="Streak flame"
    >
      <defs>
        <linearGradient id="flame-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb020" />
          <stop offset="55%" stopColor="#ff7a1a" />
          <stop offset="100%" stopColor="#f4442e" />
        </linearGradient>
        <linearGradient id="flame-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="100%" stopColor="#ffc53d" />
        </linearGradient>
      </defs>
      <path
        d="M24 2c1 8-3.5 11.5-7.5 15.5C12.3 21.7 8 26.4 8 34c0 11 7.6 19 16 19s16-8 16-19c0-6-2.8-10.4-5.6-13.8-1.6-2-3.1 4.3-4.9 2.3C26 18.5 30 9 24 2z"
        fill="url(#flame-outer)"
      />
      <path
        d="M24 27c.6 4.4-2 6-4 8.2-1.9 2.1-3.5 4-3.5 7.3 0 5.5 3.9 9.5 7.5 9.5s7.5-4 7.5-9.5c0-4.8-2.7-7.2-4.6-9.4-1.5-1.8-2.5-3.6-2.9-6.1z"
        fill="url(#flame-inner)"
      />
    </svg>
  );
}

const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export function StreakCard({
  days,
  doneThisWeek,
}: {
  days: number;
  doneThisWeek: boolean[];
}) {
  return (
    <div className="inline-flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3.5">
      <StreakFlame className="h-10 w-10" />
      <div>
        <p className="text-lg font-bold leading-tight tabular-nums">
          {days}-day streak
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {dayLabels.map((label, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  doneThisWeek[i]
                    ? "bg-gradient-to-b from-[#ffb020] to-[#f4442e]"
                    : "bg-border-strong",
                )}
              />
              <span className="text-[9px] leading-none text-faint">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
