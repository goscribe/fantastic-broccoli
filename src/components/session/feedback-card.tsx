"use client";

import { Mascot } from "@/components/rewards/mascot";
import { useCountUp } from "@/lib/use-count-up";
import { MarkBadge } from "@/components/session/play-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";

/** Floating result card shown under an answered question (redesign): cheering cat + points on a correct answer. */
export function FeedbackCard({
  ok,
  title,
  message,
  primary,
  onPrimary,
  secondary,
  onSecondary,
  xp = 10,
  note,
}: {
  ok: boolean;
  title: string;
  message?: React.ReactNode;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  xp?: number;
  /** One quiet line under the explanation (e.g. "Saved to Mistakes"). */
  note?: React.ReactNode;
}) {
  const xpShown = useCountUp(ok ? xp : 0, 600);
  return (
    <div className="relative pb-2 pt-3">
      {/* No panel: the result sits on the page under the answers. The badge and title say right/wrong, the cat reacts, and the one button stays purple. */}
      <div className={cn("relative pt-1", ok ? "design-bounce" : "life-rise")}>
        <Mascot
          pose={ok ? "cheer" : "think"}
          className={cn("pointer-events-none absolute right-0 top-0 h-[58px] sm:h-[76px]", ok && "cat-cheer")}
        />
        <div className="relative flex items-center gap-3 pr-16 sm:pr-20">
          <MarkBadge ok={ok} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[20px] font-extrabold", ok ? "text-emerald-800" : "text-rose-800")}>{title}</span>
            {ok && (
              <span className="text-[13.5px] font-extrabold tabular-nums text-emerald-800/80">+{xpShown} pts</span>
            )}
          </div>
        </div>
        {message && <div className="relative mt-3.5 text-[15px] leading-6 text-foreground/80 sm:pr-24">{message}</div>}
        {note && <p className="relative mt-2 text-[12.5px] font-bold text-rose-800">{note}</p>}
        <div className="relative mt-4 flex gap-2.5">
          {secondary && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary} className="h-12 flex-1 rounded-[var(--r-button)] bg-muted sm:flex-none">
              {secondary}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onPrimary}
            className="btn-chunky rounded-[var(--r-button)] h-12 flex-1 text-[16px] font-extrabold sm:min-w-[200px] sm:flex-none"
          >
            {primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
