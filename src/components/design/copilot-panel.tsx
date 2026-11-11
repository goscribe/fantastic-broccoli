"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, ChevronLeft, ChevronRight, Link2, MessageCircle, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type CopilotMsg = { who: "u" | "a"; text: React.ReactNode };

/** Docked side panel: open by default, drag its left edge to resize, chevron collapses it to a slim tab. */
export function CopilotPanel({ attached, messages = [], defaultWidth = 380, defaultOpen = true }: { attached: string; messages?: CopilotMsg[]; defaultWidth?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [width, setWidth] = useState(defaultWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { x: e.clientX, w: width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [width]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    setWidth(Math.min(560, Math.max(300, drag.current.w + (drag.current.x - e.clientX))));
  }, []);
  const onPointerUp = useCallback(() => { drag.current = null; }, []);

  if (!open) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center gap-3.5 border-l border-border pt-5">
        <button onClick={() => setOpen(true)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Open Copilot"><ChevronLeft className="size-4" /></button>
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-accent-soft"><Image src="/design/cat-pencil.png" alt="" width={28} height={28} /></span>
        <span className="text-[12px] font-semibold text-muted-foreground [writing-mode:vertical-rl]">Copilot</span>
        <span className="size-2 rounded-full bg-accent" />
      </aside>
    );
  }

  return (
    <aside className="relative flex shrink-0 flex-col border-l border-border bg-white" style={{ width }}>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="absolute inset-y-0 -left-[7px] flex w-[14px] cursor-col-resize items-center justify-center" aria-label="Resize Copilot"><span className="h-11 w-1 rounded-sm bg-border" /></div>
      <div className="flex items-center gap-2.5 border-b border-border py-3.5 pl-[22px] pr-[18px]">
        <span className="grid size-[30px] place-items-center rounded-[9px] bg-accent-soft text-accent"><MessageCircle className="size-4" /></span>
        <div><div className="text-[14px] font-bold">Copilot</div><div className="text-[11.5px] text-faint">Sees this question + your notes</div></div>
        <span className="ml-auto flex items-center gap-1.5 rounded-[7px] bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-dim"><Link2 className="size-3" />{attached}</span>
        <button onClick={() => setOpen(false)} className="ml-1.5 grid size-7 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Collapse Copilot"><ChevronRight className="size-3.5" /></button>
      </div>
      {messages.length ? (
        <div className="flex flex-1 flex-col gap-2.5 overflow-hidden py-4 pl-[22px] pr-[18px]">
          {messages.map((m, i) => m.who === "u" ? (
            <div key={i} className="max-w-[88%] self-end rounded-[14px] rounded-br-[4px] bg-accent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">{m.text}</div>
          ) : (
            <div key={i} className="flex max-w-[94%] gap-2"><Image src="/design/cat-pencil.png" alt="" width={26} height={26} className="mt-0.5 h-[26px] w-auto shrink-0" /><div className="rounded-[14px] rounded-bl-[4px] bg-muted px-3.5 py-2.5 text-[13.5px] leading-relaxed">{m.text}</div></div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-[22px] text-center">
          <Image src="/design/cat-pencil.png" alt="" width={72} height={72} className="h-[72px] w-auto" />
          <div className="text-[14px] font-semibold">Stuck? Ask me anything.</div>
          <p className="text-[12.5px] leading-relaxed text-faint">I can see this question, your notes and your past answers. I won&apos;t give the answer away before you try.</p>
        </div>
      )}
      <div className="flex gap-1.5 overflow-hidden pb-2 pl-[22px] pr-[18px]">
        {["Give me a hint", "Explain the concept", "Show a worked example"].map((c) => <button key={c} className="whitespace-nowrap rounded-full border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted">{c}</button>)}
      </div>
      <div className="pb-4 pl-[22px] pr-[18px]">
        <div className={cn("flex items-center gap-2.5 rounded-[14px] border border-border py-2 pl-3.5 pr-2 text-[13.5px] text-faint")}>Ask about this question…
          <span className="ml-auto flex items-center gap-1"><Mic className="size-4" /><span className="grid size-8 place-items-center rounded-[9px] bg-accent text-white"><ArrowUp className="size-[15px]" /></span></span>
        </div>
      </div>
    </aside>
  );
}
