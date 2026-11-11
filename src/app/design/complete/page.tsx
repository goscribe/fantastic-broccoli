import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { FlameIcon, Gauge, Ring } from "@/components/design/charts";
import { T } from "@/components/design/tokens";

export default function CompletePreview() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[390px] flex-col bg-white px-5 pt-14">
      <div className="pt-1.5 text-center">
        <Image src="/design/cat2-trophy.png" alt="" width={104} height={104} className="design-pop mx-auto h-[104px] w-auto" />
        <h1 className="mt-2 text-[24px] font-bold">Lesson step complete</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Worksheet · Osmosis calculations</p>
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border px-4 pb-3 pt-3.5">
        <Gauge pct={0.86} value="86%" label="Accuracy" size={210} />
        <div className="text-[13px] text-muted-foreground"><b className="text-emerald-600">+9%</b> vs your last worksheet · 6 of 7 correct</div>
      </div>
      <div className="mt-3 flex gap-2.5">
        <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-border p-3.5">
          <div className="flex items-center gap-2.5"><Ring pct={0.72} size={44} stroke={11} /><div><div className="text-[16px] font-bold leading-tight text-accent">+40 XP</div><div className="text-[11px] text-faint">1,240 total</div></div></div>
          <div><div className="flex justify-between text-[10px] font-semibold text-faint"><span>Level 8</span><span>160 to go</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[72%] rounded-full bg-accent" /></div></div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 rounded-2xl border border-border p-3.5">
          <div className="flex items-center gap-2.5"><Ring pct={13 / 14} size={44} stroke={11} color={T.orange}><FlameIcon size={18} /></Ring><div><div className="text-[16px] font-bold leading-tight">13 days</div><div className="text-[11px] text-faint">streak</div></div></div>
          <div><div className="flex justify-between text-[10px] font-semibold text-faint"><span>Best 14</span><span>1 to go</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-[93%] rounded-full" style={{ background: T.orange }} /></div></div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-border px-4 py-3">
        <div className="flex items-baseline justify-between"><b className="text-[13px] font-semibold">Time</b><span className="text-[11px] text-faint">6:12 · you usually take 8:40</span></div>
        <div className="mt-2 flex flex-col gap-1.5">{[["today", "52%", T.blue], ["usual", "73%", T.grey]].map(([l, w, c]) => <div key={l} className="flex items-center gap-2"><span className="w-10 text-[10px] text-faint">{l}</span><div className="h-2.5 rounded-full" style={{ width: w, background: c }} /></div>)}</div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-border px-4 py-3"><div><div className="text-[11px] font-semibold text-faint">Up next</div><div className="text-[13.5px] font-semibold">Flashcards · Organelles · 5 min</div></div><ChevronRight className="size-4 text-faint" /></div>
      <div className="mt-auto flex gap-2.5 pb-8"><button className="h-[50px] flex-1 rounded-xl border border-border text-[15px] font-semibold">Back to lesson</button><button className="h-[50px] flex-1 rounded-xl bg-accent text-[15px] font-semibold text-white">Continue</button></div>
    </div>
  );
}
