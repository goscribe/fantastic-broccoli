"use client";

import Image from "next/image";
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
}: {
  ok: boolean;
  title: string;
  message?: React.ReactNode;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  xp?: number;
}) {
  return (
    <div className="relative pb-2 pt-3">
      {ok && (
        <Image
          src="/design/cat2-cheer.png"
          alt=""
          width={110}
          height={110}
          unoptimized
          className="cat-cheer pointer-events-none absolute -top-[58px] right-5 h-[88px] w-auto drop-shadow-[0_10px_18px_rgba(22,163,74,.22)]"
        />
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 shadow-[0_12px_40px_-12px_rgba(17,17,20,.18)]",
          ok
            ? "design-bounce border-emerald-300 bg-gradient-to-r from-emerald-50 to-lime-50"
            : "border-rose-200 bg-rose-50",
        )}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full text-white",
            ok ? "design-pop bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.2)]" : "bg-rose-500",
          )}
        >
          {ok ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1 basis-[200px]">
          <div className="flex items-center gap-2.5">
            <span className={cn("text-[18px] font-extrabold", ok ? "text-emerald-800" : "text-rose-800")}>{title}</span>
            {ok && (
              <span className="design-pop inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                +{xp} XP
              </span>
            )}
          </div>
          {message && <div className="mt-0.5 text-[13.5px] leading-5 text-muted-foreground">{message}</div>}
        </div>
        <div className="flex shrink-0 gap-2.5">
          {secondary && onSecondary && (
            <Button variant="ghost" size="sm" onClick={onSecondary} className="bg-white/80">
              {secondary}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onPrimary} className={cn(ok && "bg-emerald-600 hover:bg-emerald-700")}>
            {primary}
          </Button>
        </div>
      </div>
    </div>
  );
}
