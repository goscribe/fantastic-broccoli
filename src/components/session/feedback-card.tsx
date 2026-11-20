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
  const btn = ok ? "bg-emerald-600 shadow-[0_4px_0_0_#047857] hover:bg-emerald-700" : "";
  return (
    <div className="relative pb-2 pt-3">
      {/* Tinted result panel (Duolingo/Brilliant): green and a cheering cat when right, rose and a thinking cat when not. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[22px] border-2 px-4 py-4 shadow-[0_10px_30px_-16px_rgba(17,17,20,.22)] sm:px-5",
          ok
            ? "design-bounce border-emerald-300 bg-[linear-gradient(150deg,#dff8ea_0%,#f2fcf6_60%,#ffffff_100%)]"
            : "border-rose-300 bg-[linear-gradient(150deg,#ffe4ea_0%,#fff4f6_60%,#ffffff_100%)]",
        )}
      >
        <Mascot
          pose={ok ? "cheer" : "think"}
          className={cn("pointer-events-none absolute right-2 top-1.5 h-[58px] sm:right-4 sm:h-[68px]", ok && "cat-cheer")}
        />
        <div className="relative flex items-center gap-3 pr-16 sm:pr-20">
          <span
            className={cn(
              "relative grid size-10 shrink-0 place-items-center rounded-full text-white shadow-[0_3px_0_rgba(0,0,0,.12)]",
              ok ? "design-pop bg-emerald-500" : "bg-rose-500",
            )}
          >
            {ok && <SparkleBurst burst={1} />}
            {ok ? <Check className="size-6" strokeWidth={3.5} /> : <X className="size-6" strokeWidth={3.5} />}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-[20px] font-extrabold", ok ? "text-emerald-700" : "text-rose-700")}>{title}</span>
            {ok && (
              <span className="design-pop inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-white">
                +{xpShown} XP
              </span>
            )}
          </div>
        </div>
        {message && <div className="relative mt-3 pr-14 text-[14.5px] leading-6 text-foreground/75 sm:pr-20">{message}</div>}
        {note && <p className="relative mt-2 pr-14 text-[12.5px] font-bold text-rose-700/80 sm:pr-20">{note}</p>}
        <div className="relative mt-3.5 flex gap-2.5">
          {secondary && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary} className="h-11 flex-1 bg-white/70 sm:flex-none">
              {secondary}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onPrimary}
            className={cn("btn-chunky h-12 flex-1 rounded-2xl text-[16px] font-extrabold sm:flex-none sm:min-w-[200px]", btn)}
          >
            {primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
