"use client";

import Image from "next/image";
import { Check, Sparkles, X } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ConfettiBurst } from "@/components/graphics/confetti-burst";
import { cn } from "@/lib/utils";

const btn = "inline-flex h-11 items-center justify-center rounded-xl px-5 text-[15px] font-semibold whitespace-nowrap";
export const btnPrimary = cn(btn, "bg-accent text-white hover:bg-accent-dim px-7");
export const btnOutline = cn(btn, "border border-border bg-white hover:bg-muted");

/** Floating result card above the action row; fires confetti when the answer is right. */
export function FeedbackCard({ ok, title, message, secondary, primary, confetti = true, xp = 40 }: { ok: boolean; title: string; message: string; secondary: string; primary: string; confetti?: boolean; xp?: number }) {
  return (
    <div className="relative pb-6 pt-3">
      {ok && confetti && <><ConfettiBurst burst={1} /><ConfettiBurst burst={2} /></>}
      {ok && <Image src="/design/cat-trophy.png" alt="" width={120} height={120} priority className="design-pop pointer-events-none absolute -top-[88px] left-1/2 h-[120px] w-auto -translate-x-1/2 drop-shadow-[0_10px_20px_rgba(22,163,74,.25)]" />}
      <div className={cn("flex items-center gap-4 rounded-2xl border px-5 py-4 shadow-[0_12px_40px_-12px_rgba(17,17,20,.18)]", ok ? "design-bounce border-emerald-300 bg-gradient-to-r from-emerald-50 to-lime-50" : "border-rose-200 bg-rose-50")}>
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-white", ok ? "design-pop bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.2)]" : "bg-red-600")}>{ok ? <Check className="size-6" strokeWidth={3} /> : <X className="size-6" strokeWidth={2.5} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5"><span className={cn("text-[19px] font-extrabold", ok ? "text-emerald-800" : "text-rose-800")}>{title}</span>{ok && <span className="design-pop inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-white [animation-delay:.15s]"><Sparkles className="size-3.5" fill="currentColor" />+{xp} XP</span>}</div>
          <div className="mt-0.5 text-[14px] text-muted-foreground">{message}</div>
        </div>
        <div className="flex shrink-0 gap-2.5"><button className={cn(btnOutline, "bg-white/80")}>{secondary}</button><button className={cn(btnPrimary, ok && "bg-emerald-600 hover:bg-emerald-700")}>{primary}</button></div>
      </div>
    </div>
  );
}

export function MarkTip({ label, detail, children, defaultOpen = false }: { label: string; detail: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <TooltipPrimitive.Provider delayDuration={100}>
      <TooltipPrimitive.Root defaultOpen={defaultOpen}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-[260px] rounded-xl border border-border bg-white px-3 py-2 text-[12.5px] shadow-lg">
            <span className="mr-1.5 inline-grid h-5 w-[30px] place-items-center rounded-md bg-emerald-600 align-middle text-[11px] font-bold text-white">{label}</span>
            <span className="font-medium">{detail}</span> <span className="font-semibold text-faint">[1]</span>
            <TooltipPrimitive.Arrow className="fill-white" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
