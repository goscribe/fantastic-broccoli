"use client";

import { Mascot } from "@/components/rewards/mascot";
import { SparkleBurst } from "@/components/graphics/sparkle-burst";
import { useCountUp } from "@/lib/use-count-up";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";

/** Floating result card shown under an answered question (redesign): cheering cat + XP on a correct answer. */
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
      {/* Soft result panel: a pale green or rose surface says right/wrong, the cat reacts, and the one button stays purple. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[28px] px-5 py-5 sm:px-6",
          ok ? "design-bounce bg-emerald-50" : "life-rise bg-rose-50",
        )}
      >
        <Mascot
          pose={ok ? "cheer" : "think"}
          className={cn("pointer-events-none absolute right-3 top-2.5 h-[68px] sm:right-5 sm:h-[76px]", ok && "cat-cheer")}
        />
        <div className="relative flex items-center gap-3 pr-16 sm:pr-20">
          <span
            className={cn(
              "relative grid size-10 shrink-0 place-items-center rounded-full text-white",
              ok ? "design-pop bg-emerald-600" : "bg-rose-600",
            )}
          >
            {ok && <SparkleBurst burst={1} />}
            {ok ? <Check className="size-6" strokeWidth={3.5} /> : <X className="size-6" strokeWidth={3.5} />}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[20px] font-extrabold", ok ? "text-emerald-800" : "text-rose-800")}>{title}</span>
            {ok && (
              <span className="design-pop inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-emerald-800">
                +{xpShown} XP
              </span>
            )}
          </div>
        </div>
        {message && <div className="relative mt-3.5 text-[15px] leading-6 text-foreground/80 sm:pr-24">{message}</div>}
        {note && <p className="relative mt-2 text-[12.5px] font-bold text-rose-800">{note}</p>}
        <div className="relative mt-4 flex gap-2.5">
          {secondary && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary} className="h-12 flex-1 bg-white/70 sm:flex-none">
              {secondary}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onPrimary}
            className="btn-chunky h-12 flex-1 rounded-full text-[16px] font-extrabold sm:min-w-[200px] sm:flex-none"
          >
            {primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
