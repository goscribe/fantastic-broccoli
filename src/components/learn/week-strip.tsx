"use client";
import { useRef, useState } from "react";
import { useIsMobile } from "@/lib/use-mobile";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Settings2, Upload, X } from "lucide-react";
import { PlanSetupWizard } from "@/components/learn/plan-setup-wizard";
import {
  fetchPlannerMessages,
  fetchPlannerWeek,
  addBlock,
  overrideBlock,
  removeBlock,
  type PlannerSlot,
} from "@/lib/api/planner";
import { analyzeFiles, detectSections, uploadFiles } from "@/lib/api/materials";
import { createStudySession } from "@/lib/api/study";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { accentForId } from "@/lib/accent-palette";
import { toast } from "sonner";
import { toastError } from "@/lib/toast";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const UPLOAD_ACCEPT = ".pdf,.pptx,.docx,.txt,.md,.png,.jpg,.jpeg,.mp3,.m4a,.wav";

type Subject = { id: string; title: string };

/** Home: this week's study times above the subjects. Drag a block to another day; drop notes on a block to build that session. */
export function WeekStrip({ subjects }: { subjects: Subject[] }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["planner", undefined], queryFn: () => fetchPlannerWeek() });
  const { data: notes } = useQuery({ queryKey: ["planner-messages"], queryFn: fetchPlannerMessages, enabled: !!data?.calendar.connected });
  const lastNote = [...(notes?.messages ?? [])].reverse().find((m) => m.role === "AGENT");
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const params = useSearchParams();
  const [draw, setDraw] = useState<{ date: string; from: number; to: number } | null>(null);
  const [pick, setPick] = useState<{ date: string; start: number; end: number } | null>(null);
  const [setupOpen, setSetupOpen] = useState(params.get("setup") === "1");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<PlannerSlot | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const mobile = useIsMobile();
  const [mDay, setMDay] = useState<number | null>(null);
  const todayIdx = Math.max(0, data?.days.findIndex((d) => d.date === today) ?? 0);
  const shown = mDay ?? todayIdx;

  const refresh = () => qc.invalidateQueries({ queryKey: ["planner"] });

  const moveTo = async (date: string) => {
    if (!data || !dragId) return;
    const id = dragId;
    setDragId(null);
    try {
      await overrideBlock({ weekStart: data.weekStart, id, date });
      await refresh();
    } catch (e) {
      toastError(e, "Couldn't move that");
    }
  };

  /** Notes dropped on a block: upload into the block's subject (or the first subject), build the session, pin it to the block. */
  const filesToSlot = async (slot: PlannerSlot, files: File[]) => {
    if (!data || files.length === 0) return;
    const workspaceId = slot.workspaceId ?? subjects[0]?.id;
    if (!workspaceId) {
      router.push("/new-subject");
      return;
    }
    setBusyId(slot.id);
    try {
      const fileIds = await uploadFiles(workspaceId, files);
      await analyzeFiles(workspaceId, fileIds).catch(() => {});
      const title = slot.title.replace(/ — .*$/, "");
      const { sections } = await detectSections(workspaceId, fileIds).catch(() => ({ sections: [] }));
      if (sections.length >= 2) {
        for (const sec of sections) {
          await createStudySession({
            workspaceId,
            title: sec.title,
            depth: "moderate",
            durationMinutes: Math.max(10, slot.end - slot.start),
            topics: `${sec.title}${sec.excerpt ? `: ${sec.excerpt}` : ""}`.slice(0, 2000),
          });
        }
        await overrideBlock({ weekStart: data.weekStart, id: slot.id, workspaceId });
        await refresh();
        toast.success(`Found ${sections.length} sections (${sections.map((s) => s.title).join(", ")}) — built a session for each.`);
        router.push(`/workspace/${workspaceId}`);
        return;
      }
      const session = await createStudySession({
        workspaceId,
        title,
        depth: "moderate",
        durationMinutes: Math.max(10, slot.end - slot.start),
        topics: files.map((f) => f.name.replace(/\.[^.]+$/, "")).join(", "),
      });
      await overrideBlock({ weekStart: data.weekStart, id: slot.id, workspaceId });
      await refresh();
      if (session) router.push(`/workspace/${workspaceId}/session/${session.id}`);
    } catch (e) {
      toastError(e, "Couldn't build that session");
    } finally {
      setBusyId(null);
    }
  };

  const subjectName = (id?: string) => subjects.find((s) => s.id === id)?.title;

  const snap = (m: number) => Math.round(m / 15) * 15;
  const minuteAt = (el: HTMLElement, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const frac = (clientY - rect.top - 26) / H;
    return Math.max(lo, Math.min(hi, snap(lo + frac * span)));
  };
  const commitDraw = () => {
    if (!draw) return;
    const start = Math.min(draw.from, draw.to);
    const end = Math.max(draw.from, draw.to);
    setDraw(null);
    if (end - start >= 15) setPick({ date: draw.date, start, end });
    else if (mobile) setPick({ date: draw.date, start, end: start + 30 });
  };
  const create = async (workspaceId?: string) => {
    if (!data || !pick) return;
    const p = pick;
    setPick(null);
    try {
      await addBlock({ weekStart: data.weekStart, ...p, workspaceId });
      await refresh();
    } catch (e) {
      toastError(e, "Couldn't add that block");
    }
  };
  const remove = async (id: string) => {
    if (!data) return;
    try {
      await removeBlock({ weekStart: data.weekStart, id });
      await refresh();
    } catch (e) {
      toastError(e, "Couldn't remove that block");
    }
  };

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const all = (data?.days ?? []).flatMap((d) => d.slots.map((s) => [s.start, s.end])).flat();
  const lo = Math.floor(Math.min(toMin(data?.plan.windowStart ?? "15:00"), ...(all.length ? [Math.min(...all)] : [])) / 60) * 60;
  const hi = Math.ceil(Math.max(toMin(data?.plan.windowEnd ?? "19:00"), ...(all.length ? [Math.max(...all)] : [])) / 60) * 60;
  const span = Math.max(60, hi - lo);
  const H = 180;
  const y = (m: number) => ((m - lo) / span) * H;
  const hours = Array.from({ length: span / 60 + 1 }, (_, k) => lo + k * 60);

  return (
    <section>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const slot = pendingSlot.current;
          if (slot && e.target.files) void filesToSlot(slot, Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">
          This week{" "}
          {data && <span className="font-medium text-faint">· {data.plannedMinutes > 0 ? `${Math.round(data.plannedMinutes / 60 * 10) / 10} h planned` : "nothing planned"}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSetupOpen(true)} aria-label="Plan settings" title="Plan settings" className="grid size-8 place-items-center rounded-[9px] bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent">
            <Settings2 className="size-4" />
          </button>
          <Link href="/planner" className="text-[13px] font-semibold text-accent hover:underline">
            Open planner
          </Link>
        </div>
      </div>

      {isLoading && !data && <Skeleton className="mt-3 h-[150px] rounded-2xl" />}

      {data && !data.calendar.connected && (
        <div className="mt-3 flex items-center gap-4 rounded-2xl border border-dashed border-border px-5 py-4">
          <Image src="/design/gcal.svg" alt="" width={36} height={36} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Connect Google Calendar</div>
            <div className="text-[12.5px] text-muted-foreground">Study times get planned around your lessons, sport and everything else on your calendar.</div>
          </div>
          <Link href="/planner?connect=1" className="inline-flex h-9 shrink-0 items-center rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-white hover:bg-accent-dim">
            Connect
          </Link>
        </div>
      )}

      {data && (
        <>
        {lastNote && (notes?.unread ?? 0) > 0 && (
          <Link href="/planner" className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#f6d9a8] bg-[#fff8ec] px-3.5 py-2.5 text-[13px] text-[#5b3a12] hover:brightness-[0.98]">
            <Image src="/design/cat2-think.png" alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
            <span className="min-w-0"><b className="text-[#b4530a]">Note from your planner · </b>{lastNote.content}</span>
          </Link>
        )}
        {mobile && (
          <div className="mt-3 grid grid-cols-7 gap-1">
            {data.days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setMDay(i)}
                className={cn(
                  "flex flex-col items-center rounded-xl py-1.5 text-[11px] font-semibold",
                  i === shown ? "bg-accent text-white" : d.date === today ? "bg-accent-soft text-accent" : "bg-muted text-faint",
                )}
              >
                {DAY[i]}
                <span className="text-[14px] font-bold">{Number(d.date.slice(8))}</span>
                <span className={cn("mt-0.5 size-1 rounded-full", d.slots.length ? (i === shown ? "bg-white" : "bg-accent") : "bg-transparent")} />
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
        <div className={cn("grid gap-1.5 p-2", !mobile && "min-w-[560px]")} style={{ gridTemplateColumns: mobile ? "40px 1fr" : "40px repeat(7, 1fr)" }}>
          <div className="relative" style={{ height: H + 26, marginTop: 0 }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-faint" style={{ top: 26 + y(h) }}>{hhmm(h)}</span>
            ))}
          </div>
          {data.days.map((d, i) => {
            if (mobile && i !== shown) return null;
            const on = d.date === today;
            const past = d.date < today;
            return (
              <div
                key={d.date}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void moveTo(d.date);
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || (e.target as HTMLElement).closest("[data-block]")) return;
                  const m = minuteAt(e.currentTarget, e.clientY);
                  setDraw({ date: d.date, from: m, to: m });
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (draw && draw.date === d.date) setDraw({ ...draw, to: minuteAt(e.currentTarget, e.clientY) });
                }}
                onPointerUp={commitDraw}
                onPointerCancel={() => setDraw(null)}
                className={cn("relative select-none rounded-xl p-1.5 transition-colors", draw ? "cursor-row-resize" : "cursor-crosshair", dragId && "ring-1 ring-dashed ring-accent/40", on && "bg-accent-soft/40")}
                style={{ height: H + 26, touchAction: mobile ? "pan-y" : "none" }}
                title={mobile ? "Tap to add a study time" : "Click and drag to add a study time"}
              >
                {draw && draw.date === d.date && (
                  <span className="pointer-events-none absolute inset-x-1.5 rounded-lg border-2 border-dashed border-accent bg-accent-soft/70 px-1.5 py-1 text-[10.5px] font-semibold text-accent" style={{ top: 26 + y(Math.min(draw.from, draw.to)), height: Math.max(8, y(Math.max(draw.from, draw.to)) - y(Math.min(draw.from, draw.to))) }}>
                    {hhmm(Math.min(draw.from, draw.to))}–{hhmm(Math.max(draw.from, draw.to))}
                  </span>
                )}
                <div className={cn("px-1 text-[11px] font-semibold leading-[18px]", on ? "text-accent" : past ? "text-faint/60" : "text-faint")}>
                  {DAY[i]} <span className="font-medium">{Number(d.date.slice(8))}</span>
                </div>
                {hours.map((h) => <span key={h} className="pointer-events-none absolute inset-x-1 border-t border-dashed border-border/60" style={{ top: 26 + y(h) }} />)}
                {d.busy.map((b, k) => (
                  <span key={k} title={b.title} className="pointer-events-none absolute inset-x-1.5 rounded-md bg-muted/80" style={{ top: 26 + y(Math.max(lo, b.start)), height: Math.max(4, y(Math.min(hi, b.end)) - y(Math.max(lo, b.start))) }} />
                ))}
                {d.slots.map((s) => {
                  const overlapping = d.slots.filter((o) => o.start < s.end && o.end > s.start);
                  const lane = Math.max(0, overlapping.findIndex((o) => o.id === s.id));
                  const lanes = Math.max(1, overlapping.length);
                  const busy = busyId === s.id;
                  return (
                    <div
                      key={s.id}
                      data-block
                      style={{ position: "absolute", left: `calc(6px + ${(lane / lanes) * 100}% - ${(lane / lanes) * 12}px)`, width: `calc(${100 / lanes}% - ${12 / lanes}px)`, top: 26 + y(s.start), height: Math.max(30, y(s.end) - y(s.start)) }}
                      draggable
                      onDragStart={(e) => {
                        setDragId(s.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => {
                        if (e.dataTransfer.types.includes("Files")) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      onDrop={(e) => {
                        if (e.dataTransfer.files.length) {
                          e.preventDefault();
                          e.stopPropagation();
                          void filesToSlot(s, Array.from(e.dataTransfer.files));
                        }
                      }}
                      onClick={() => {
                        if (s.sessionId && s.workspaceId) router.push(`/workspace/${s.workspaceId}/session/${s.sessionId}`);
                        else if (s.kind === "review") router.push("/flashcards/review");
                        else {
                          pendingSlot.current = s;
                          fileRef.current?.click();
                        }
                      }}
                      className={cn(
                        "group cursor-grab overflow-hidden rounded-lg px-1.5 py-1 text-left text-[10.5px] leading-tight active:cursor-grabbing",
                        s.kind === "review" ? "bg-emerald-50 text-emerald-800" : "bg-accent-soft text-accent-dim",
                        dragId === s.id && "opacity-50",
                      )}
                      title={s.sessionId ? "Open session" : "Click or drop notes to build this session"}
                    >
                      <button type="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); void remove(s.id); }} className="absolute right-1 top-1 rounded p-0.5 hover:bg-white/60 sm:hidden sm:group-hover:block"><X className="size-3" /></button>
                      <div className="truncate font-semibold">{hhmm(s.start)} <span className="font-medium opacity-80">{s.title}</span></div>
                      <div className={cn("mt-0.5 flex items-center gap-1 text-[10.5px] opacity-70", y(s.end) - y(s.start) < 34 && "hidden")}>
                        {busy ? <Loader2 className="size-3 animate-spin" /> : s.sessionId ? null : <Upload className="size-3" />}
                        {busy ? "Building…" : subjectName(s.workspaceId) ?? (s.sessionId ? "" : "Drop notes here")}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
        </>
      )}

      {data && data.days.every((d) => d.slots.length === 0) && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-faint">
          <CalendarDays className="size-3.5" /> Tell me when you&apos;re free and add a subject — the week fills itself in.
        </p>
      )}

      {pick && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setPick(null)}>
          <div className="w-full max-w-[360px] rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-bold">Study {hhmm(pick.start)}–{hhmm(pick.end)}</div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{new Date(pick.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} · which subject?</p>
            <div className="mt-3 grid gap-1.5">
              {subjects.map((s) => (
                <button key={s.id} type="button" onClick={() => void create(s.id)} className="flex h-10 items-center gap-2.5 rounded-xl border border-border px-3 text-left text-[13.5px] font-semibold hover:border-accent hover:bg-accent-soft">
                  <span className="size-2.5 rounded-full" style={{ background: accentForId(s.id) }} /> {s.title}
                </button>
              ))}
              <button type="button" onClick={() => void create()} className="h-10 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">Decide later</button>
            </div>
          </div>
        </div>
      )}
      {setupOpen && data && (
        <PlanSetupWizard
          plan={data.plan}
          onClose={() => {
            setSetupOpen(false);
            if (params.get("setup")) router.replace("/");
          }}
          onSaved={() => {
            setSetupOpen(false);
            if (params.get("setup")) router.replace("/");
            void refresh();
          }}
        />
      )}
    </section>
  );
}
