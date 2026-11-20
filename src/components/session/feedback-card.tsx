"use client";

import { Mascot } from "@/components/rewards/mascot";
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
  return (
    <div className="relative pb-2 pt-3">
      {ok && (
        <Mascot
          pose="cheer"
          className="cat-cheer pointer-events-none absolute -top-[58px] right-5 h-[88px] max-sm:hidden drop-shadow-[0_10px_18px_rgba(22,163,74,.22)]"
        />
      )}
      {/* Calm result panel: a coloured edge and icon say right/wrong; the explanation reads like notes; one accent button. */}
      <div
        className={cn(
          "rounded-2xl border bg-card px-4 py-3.5 shadow-[0_8px_28px_-14px_rgba(17,17,20,.16)] sm:px-5 sm:py-4",
          ok ? "design-bounce border-emerald-300" : "border-rose-300",
        )}
      >
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-white",
              ok ? "design-pop bg-emerald-500" : "bg-rose-500",
            )}
          >
            {ok ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cn("text-[17px] font-extrabold", ok ? "text-emerald-700" : "text-rose-700")}>{title}</span>
            {ok && (
              <span className="design-pop inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">
                +{xp} XP
              </span>
            )}
          </div>
          <div className="hidden shrink-0 gap-2.5 sm:flex">
            {secondary && onSecondary && (
              <Button variant="ghost" size="sm" onClick={onSecondary}>
                {secondary}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onPrimary}>
              {primary}
            </Button>
          </div>
        </div>
        {message && <div className="mt-2.5 border-t border-border pt-2.5 text-[14px] leading-6 text-muted-foreground">{message}</div>}
        {note && <p className="mt-2 text-[12.5px] font-semibold text-muted-foreground">{note}</p>}
        {/* Phones: one full-width, thumb-sized button under the explanation. */}
        <div className="mt-3 flex gap-2.5 sm:hidden">
          {secondary && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary} className="h-11 flex-1">
              {secondary}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onPrimary} className="h-11 flex-1 rounded-xl text-[15px]">
            {primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
