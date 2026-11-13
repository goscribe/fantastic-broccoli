"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, Loader2, Upload } from "lucide-react";
import {
  fetchPlannerWeek,
  overrideBlock,
  setAvailability,
  type AvailabilitySlot,
  type PlannerSlot,
} from "@/lib/api/planner";
import { analyzeFiles, uploadFiles } from "@/lib/api/materials";
import { createStudySession } from "@/lib/api/study";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [availOpen, setAvailOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<PlannerSlot | null>(null);
  const today = new Date().toISOString().slice(0, 10);

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
          <button type="button" onClick={() => setAvailOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-muted px-2.5 text-[12.5px] font-semibold hover:bg-accent-soft">
            <Clock className="size-3.5" /> When I&apos;m free
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
        <div className="mt-3 grid grid-cols-7 gap-1.5 rounded-2xl border border-border bg-card p-2">
          {data.days.map((d, i) => {
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
                className={cn("flex min-h-[132px] flex-col rounded-xl p-1.5 transition-colors", dragId && "ring-1 ring-dashed ring-accent/40", on && "bg-accent-soft/40")}
              >
                <div className={cn("mb-1.5 px-1 text-[11px] font-semibold", on ? "text-accent" : past ? "text-faint/60" : "text-faint")}>
                  {DAY[i]} <span className="font-medium">{Number(d.date.slice(8))}</span>
                </div>
                {d.slots.length === 0 && <div className="flex-1 rounded-lg border border-dashed border-border/70" />}
                {d.slots.map((s) => {
                  const busy = busyId === s.id;
                  return (
                    <div
                      key={s.id}
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
                        "group mb-1 cursor-grab rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-tight active:cursor-grabbing",
                        s.kind === "review" ? "bg-emerald-50 text-emerald-800" : "bg-accent-soft text-accent-dim",
                        dragId === s.id && "opacity-50",
                      )}
                      title={s.sessionId ? "Open session" : "Click or drop notes to build this session"}
                    >
                      <div className="font-semibold">{hhmm(s.start)}–{hhmm(s.end)}</div>
                      <div className="truncate">{s.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] opacity-70">
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
      )}

      {data && data.days.every((d) => d.slots.length === 0) && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-faint">
          <CalendarDays className="size-3.5" /> Tell me when you&apos;re free and add a subject — the week fills itself in.
        </p>
      )}

      {availOpen && (
        <AvailabilityDialog
          initial={data?.plan.availability ?? null}
          fallback={{ start: data?.plan.windowStart ?? "15:00", end: data?.plan.windowEnd ?? "19:00", weekdays: data?.plan.weekdays ?? [1, 2, 3, 4, 5, 6, 0] }}
          onClose={() => setAvailOpen(false)}
          onSaved={() => {
            setAvailOpen(false);
            void refresh();
          }}
        />
      )}
    </section>
  );
}

/** One row per weekday: tick the days you can study and set the free window for each. */
function AvailabilityDialog({
  initial,
  fallback,
  onClose,
  onSaved,
}: {
  initial: AvailabilitySlot[] | null;
  fallback: { start: string; end: string; weekdays: number[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const [rows, setRows] = useState<Record<number, { on: boolean; start: string; end: string }>>(() => {
    const out: Record<number, { on: boolean; start: string; end: string }> = {};
    for (const wd of weekdayOrder) {
      const slot = initial?.find((s) => s.weekday === wd);
      out[wd] = slot
        ? { on: true, start: slot.start, end: slot.end }
        : { on: initial ? false : fallback.weekdays.includes(wd), start: fallback.start, end: fallback.end };
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await setAvailability(weekdayOrder.filter((wd) => rows[wd].on).map((wd) => ({ weekday: wd, start: rows[wd].start, end: rows[wd].end })));
      onSaved();
    } catch (e) {
      toastError(e, "Couldn't save");
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[17px] font-bold">When are you free to study?</div>
        <p className="mt-1 text-[13px] text-muted-foreground">Sessions only get planned inside these times.</p>
        <div className="mt-4 space-y-2">
          {weekdayOrder.map((wd, i) => {
            const r = rows[wd];
            return (
              <div key={wd} className="flex items-center gap-3">
                <label className="flex w-[72px] items-center gap-2 text-[13.5px] font-semibold">
                  <input type="checkbox" checked={r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, on: e.target.checked } })} className="size-4 accent-[var(--accent)]" />
                  {DAY[i]}
                </label>
                <Input type="time" value={r.start} disabled={!r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, start: e.target.value } })} className="h-9 flex-1" />
                <span className="text-faint">–</span>
                <Input type="time" value={r.end} disabled={!r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, end: e.target.value } })} className="h-9 flex-1" />
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60">
            {saving && <Loader2 className="size-3.5 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
