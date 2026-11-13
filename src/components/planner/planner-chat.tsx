"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, SendHorizonal, Sparkles } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast";
import { fetchPlannerMessages, markPlannerRead, plannerChat, runPlannerAgent, type PlannerMessage } from "@/lib/api/planner";

const STARTERS = ["Move Thursday to the weekend", "I have a mock exam on the 20th", "Less on weekdays, more on Saturday"];

function when(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function PlannerChat({ weekStart, className }: { weekStart?: string; className?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["planner-messages"], queryFn: fetchPlannerMessages });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, pending]);
  useEffect(() => {
    if (data && data.unread > 0) void markPlannerRead().then(() => qc.invalidateQueries({ queryKey: ["planner-messages"] }));
  }, [data, qc]);

  const refreshAll = () => Promise.all([qc.invalidateQueries({ queryKey: ["planner-messages"] }), qc.invalidateQueries({ queryKey: ["planner"] })]);

  const send = async (msg: string) => {
    const m = msg.trim();
    if (!m || sending) return;
    setText("");
    setPending(m);
    setSending(true);
    try {
      await plannerChat({ message: m, weekStart });
      await refreshAll();
    } catch (e) {
      toastError(e, "Your planner didn't answer");
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      await runPlannerAgent();
      await refreshAll();
    } catch (e) {
      toastError(e, "Couldn't check your calendar");
    } finally {
      setChecking(false);
    }
  };

  const messages: PlannerMessage[] = data?.messages ?? [];

  return (
    <div className={cn("flex min-h-0 flex-col rounded-2xl border border-border", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Image src="/design/cat2-think.png" alt="" width={32} height={32} className="size-8 object-contain" />
          <div>
            <div className="text-[14px] font-semibold leading-tight">Your planner</div>
            <div className="text-[11.5px] text-faint">Checks your calendar daily and leaves notes here</div>
          </div>
        </div>
        <button type="button" onClick={() => void check()} disabled={checking} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-[12px] font-semibold hover:bg-accent-soft hover:text-accent disabled:opacity-60">
          {checking ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Check now
        </button>
      </div>

      <div className="flex max-h-[420px] min-h-[220px] flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : messages.length === 0 && !pending ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
            <p className="max-w-[260px] text-[13px] text-muted-foreground">Nothing yet. When a test or deadline shows up on your calendar I&apos;ll add prep sessions before it and tell you here. Or just tell me what to change.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-border px-3 py-1 text-[12px] font-medium hover:border-accent hover:bg-accent-soft hover:text-accent">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.role === "USER" ? "items-end" : "items-start")}>
              <div className={cn("max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug", m.role === "USER" ? "rounded-br-md bg-accent text-white" : m.role === "AGENT" ? "rounded-bl-md border border-[#f6d9a8] bg-[#fff8ec] text-[#5b3a12]" : "rounded-bl-md bg-muted")}>
                {m.role === "AGENT" && <div className="mb-0.5 text-[11px] font-semibold text-[#b4530a]">Note from your planner</div>}
                {m.content}
              </div>
              {Array.isArray(m.meta) && m.meta.length > 0 && (
                <div className="flex flex-wrap gap-1">{m.meta.map((a, i) => <span key={i} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{a.label}</span>)}</div>
              )}
              <span className="text-[10.5px] text-faint">{when(m.createdAt)}</span>
            </div>
          ))
        )}
        {pending && (
          <>
            <div className="flex flex-col items-end gap-1"><div className="max-w-[92%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13.5px] text-white">{pending}</div></div>
            <div className="flex items-center gap-2 text-[12.5px] text-faint"><Loader2 className="size-3.5 animate-spin" /> Thinking…</div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-center gap-2 border-t border-border p-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell your planner… e.g. “move Thursday to Saturday”"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-[13.5px] outline-none placeholder:text-faint focus:border-accent"
        />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-white hover:brightness-95 disabled:opacity-50">
          <SendHorizonal className="size-4" />
        </button>
      </form>
    </div>
  );
}
