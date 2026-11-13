"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { disconnectCalendar, fetchPlannerWeek,
  replanWeek, updateStudyPlan, type StudyPlan } from "@/lib/api/planner";
import { apiUrl } from "@/lib/api/config";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { toastError } from "@/lib/toast";
import { CalendarSync } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlannerChat } from "@/components/planner/planner-chat";
import "@/app/design/design.css";
import { inputClass } from "@/components/ui/input";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (iso: string | Date) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const PX = 76;

/** Study planner: week grid with Scribe sessions slotted into the study window, plan settings, nudge. */
export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <Planner />
    </Suspense>
  );
}

function Planner() {
  const router = useRouter();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string | undefined>();
  const [editing, setEditing] = useState(false);
  const [replanning, setReplanning] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["planner", weekStart], queryFn: () => fetchPlannerWeek(weekStart) });
  const params = useSearchParams();
  useEffect(() => {
    const r = params.get("calendar");
    if (!r) return;
    if (r === "connected") {
      toast.success("Google Calendar connected — let's set up your plan.");
      router.replace("/?setup=1");
      return;
    }
    else if (r === "unconfigured") toast.error("Google Calendar isn't set up on the server yet.");
    else if (r !== "cancelled") toast.error("Couldn't connect Google Calendar. Try again.");
    router.replace("/planner");
  }, [params, router]);
  const today = new Date().toISOString().slice(0, 10);

  const plan = data?.plan;
  const winStart = plan ? toMin(plan.windowStart) : 15 * 60;
  const winEnd = plan ? Math.max(winStart + 60, toMin(plan.windowEnd)) : 19 * 60;
  const gridStart = Math.floor(winStart / 60) * 60;
  const gridEnd = Math.ceil(winEnd / 60) * 60 + 60;
  const hours = Array.from({ length: (gridEnd - gridStart) / 60 }, (_, i) => gridStart + i * 60);
  const y = (m: number) => ((m - gridStart) / 60) * PX;
  const days = data?.days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i), slots: [], busy: [] }));

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-6 pb-12 pt-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[12px] font-semibold text-faint">Study planner</div>
            <h1 className="text-[22px] font-bold leading-tight sm:text-[26px]">
              {!data ? <Skeleton className="h-8 w-80" /> : data.plannedMinutes > 0 ? `${fmtMin(data.plannedMinutes)} planned this week` : "Nothing planned yet this week"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={replanning || !data}
            onClick={() => {
              setReplanning(true);
              replanWeek(data?.weekStart)
                .then(() => qc.invalidateQueries({ queryKey: ["planner"] }))
                .catch((err) => toastError(err, "Couldn't replan"))
                .finally(() => setReplanning(false));
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13.5px] font-semibold text-white hover:brightness-95 disabled:opacity-60"
          >
            <Sparkles className={cn("size-4", replanning && "animate-pulse")} /> {replanning ? "Planning…" : "Replan"}
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-border p-1">
            <button type="button" aria-label="Previous week" onClick={() => setWeekStart(addDays(data?.weekStart ?? today, -7))} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={() => setWeekStart(undefined)} className="h-8 rounded-lg px-3 text-[13px] font-semibold hover:bg-muted">This week</button>
            <button type="button" aria-label="Next week" onClick={() => setWeekStart(addDays(data?.weekStart ?? today, 7))} className="grid size-8 place-items-center rounded-lg hover:bg-muted"><ChevronRight className="size-4" /></button>
          </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid border-b border-border" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div />
            {days.map((d, i) => {
              const on = d.date === today;
              return (
                <div key={d.date} className="flex flex-col items-center py-3">
                  <span className={cn("text-[12px] font-semibold", on ? "text-accent" : "text-faint")}>{DAY[i]}</span>
                  <span className={cn("mt-0.5 grid size-7 place-items-center rounded-full text-[15px] font-bold", on && "bg-accent text-white")}>{Number(d.date.slice(8, 10))}</span>
                </div>
              );
            })}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", height: hours.length * PX }}>
            <div className="relative">
              {hours.map((h) => (
                <span key={h} className="absolute -translate-y-1/2 pl-3 text-[11px] text-faint" style={{ top: y(h) }}>{hhmm(h)}</span>
              ))}
            </div>
            {days.map((d, i) => (
              <div key={d.date} className="relative border-l border-border">
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: y(h) }} />
                ))}
                {plan && <div className="absolute inset-x-0 bg-accent-soft/25" style={{ top: y(winStart), height: y(winEnd) - y(winStart) }} />}
                {isLoading && i < 5 && <Skeleton className="absolute inset-x-1.5 rounded-lg" style={{ top: y(winStart) + 4, height: PX * 0.8 }} />}
                {d.busy.map((b, j) => (
                  <div key={j} className="absolute inset-x-1.5 overflow-hidden rounded-lg bg-muted px-2 py-1 text-[11.5px] text-faint" style={{ top: y(b.start) + 1, height: Math.max(22, y(b.end) - y(b.start) - 2) }}>{b.title}</div>
                ))}
                {d.slots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => router.push(s.kind === "review" ? "/flashcards/review" : `/workspace/${s.workspaceId}/session/${s.sessionId}`)}
                    className="absolute inset-x-1.5 overflow-hidden rounded-lg border-l-[3px] border-accent bg-accent-soft px-2 py-1 text-left text-[11.5px] font-semibold leading-tight text-accent-dim hover:brightness-95"
                    style={{ top: y(s.start) + 1, height: Math.max(40, y(s.end) - y(s.start) - 2) }}
                    title={s.why ? `${s.title} — ${s.why}` : s.title}
                  >
                    <span className="line-clamp-2">{s.title}</span>
                    <span className="block truncate font-medium opacity-70">{hhmm(s.start)}–{hhmm(s.end)}{s.why ? ` · ${s.why}` : ""}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-faint">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-accent" /> Scribe sessions</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-muted" /> Busy, from your calendar</span>
          <span>{data?.summary || "Blocks are planned around your calendar, exam date and what's left in each session."}</span>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-3.5 lg:w-[300px]">
        <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><CalendarSync className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Google Calendar</div>
            <div className="truncate text-[12px] text-faint">
              {!data ? "…" : data.calendar.connected ? (data.calendar.error ? "Connected · sync failed, reconnect" : `Connected${data.calendar.email ? ` · ${data.calendar.email}` : ""}`) : "Keep sessions out of your busy times"}
            </div>
          </div>
          {data && (data.calendar.connected ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await disconnectCalendar();
                  void qc.invalidateQueries({ queryKey: ["planner"] });
                } catch (err) {
                  toastError(err, "Couldn't disconnect");
                }
              }}
              className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-semibold text-faint hover:bg-muted"
            >
              Disconnect
            </button>
          ) : (
            <a href={`${apiUrl}/calendar/google/connect`} className="h-8 shrink-0 rounded-lg bg-accent px-3 text-[12.5px] font-semibold leading-8 text-white">Connect</a>
          ))}
        </div>

        <PlannerChat weekStart={data?.weekStart} />

        <div className="rounded-2xl border border-border p-[18px]">
          <div className="text-[16px] font-semibold">Plan</div>
          {!plan ? (
            <div className="mt-3 flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4" />)}</div>
          ) : (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
              <dt className="text-faint">Daily goal</dt><dd className="text-right font-semibold">{plan.dailyGoalMin} min</dd>
              <dt className="text-faint">Exam</dt>
              <dd className="truncate text-right font-semibold">{plan.examTitle ? `${plan.examTitle}${plan.examDate ? ` · ${daysUntil(plan.examDate)} days` : ""}` : "—"}</dd>
              <dt className="text-faint">Lessons left</dt><dd className="text-right font-semibold">{data ? `${data.lessonsLeft} of ${data.lessonsTotal}` : "—"}</dd>
              <dt className="text-faint">Study window</dt><dd className="text-right font-semibold">{plan.windowStart} – {plan.windowEnd}</dd>
            </dl>
          )}
          <button type="button" onClick={() => setEditing(true)} className="mt-3.5 h-10 w-full rounded-xl bg-muted text-[14px] font-semibold hover:brightness-95">Edit plan</button>
        </div>

        {data?.nudge && (
          <div className="rounded-2xl border p-[18px]" style={{ borderColor: "#f6d9a8", background: "#fff8ec" }}>
            <div className="text-[15px] font-bold" style={{ color: "#b4530a" }}>{DAY[(new Date(data.nudge.date + "T00:00:00Z").getUTCDay() + 6) % 7]} has no slot</div>
            <div className="mt-1 text-[13px]" style={{ color: "#8a4a12" }}>
              {data.dueCards > 0 ? `A ${data.nudge.minutes}-min review keeps your streak.` : `Nothing fits your ${plan?.windowStart}–${plan?.windowEnd} window that day — widen it or make it a rest day.`}
            </div>
            <button type="button" onClick={() => (data.dueCards > 0 ? router.push("/flashcards/review") : setEditing(true))} className="mt-3 h-10 w-full rounded-xl bg-accent text-[14px] font-semibold text-white">
              {data.dueCards > 0 ? "Review now" : "Edit plan"}
            </button>
          </div>
        )}

        {data && data.unscheduled > 0 && (
          <div className="text-[12.5px] text-faint">{data.unscheduled} more activities than fit this week — raise the daily goal or widen the window. <Link href="/" className="font-semibold text-accent">Back to Learn</Link></div>
        )}
      </div>

      {editing && plan && (
        <EditPlanDialog plan={plan} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void qc.invalidateQueries({ queryKey: ["planner"] }); }} />
      )}
    </div>
  );
}

function EditPlanDialog({ plan, onClose, onSaved }: { plan: StudyPlan; onClose: () => void; onSaved: () => void }) {
  const [goal, setGoal] = useState(plan.dailyGoalMin);
  const [examTitle, setExamTitle] = useState(plan.examTitle ?? "");
  const [examDate, setExamDate] = useState(plan.examDate ? new Date(plan.examDate).toISOString().slice(0, 10) : "");
  const [start, setStart] = useState(plan.windowStart);
  const [end, setEnd] = useState(plan.windowEnd);
  const [weekdays, setWeekdays] = useState<number[]>(plan.weekdays);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const field = inputClass;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await updateStudyPlan({
              dailyGoalMin: goal,
              examTitle: examTitle.trim() || null,
              examDate: examDate ? new Date(examDate + "T12:00:00Z").toISOString() : null,
              windowStart: start,
              windowEnd: end,
              weekdays,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            onSaved();
          } catch (err) {
            toastError(err, "Couldn't save plan");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="text-[18px] font-bold">Edit plan</div>
        <label className="mt-4 block text-[12.5px] font-semibold text-faint">Daily goal · {goal} min</label>
        <input type="range" min={5} max={120} step={5} value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12.5px] font-semibold text-faint">Study from</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, "mt-1")} />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-faint">until</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={cn(field, "mt-1")} />
          </div>
        </div>
        <label className="mt-4 block text-[12.5px] font-semibold text-faint">Study days</label>
        <div className="mt-1.5 flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d, i) => {
            const on = weekdays.includes(d);
            return (
              <button key={d} type="button" onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== d) : [...weekdays, d])} className={cn("h-9 flex-1 rounded-lg text-[12.5px] font-semibold", on ? "bg-accent text-white" : "bg-muted text-faint")}>{DAY[i].slice(0, 1)}</button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_150px] gap-3">
          <div>
            <label className="block text-[12.5px] font-semibold text-faint">Exam (optional)</label>
            <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="Bio Paper 1" className={cn(field, "mt-1")} />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-faint">Date</label>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className={cn(field, "mt-1")} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-[14px] font-semibold hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving} className="h-10 rounded-xl bg-accent px-5 text-[14px] font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save plan"}</button>
        </div>
      </form>
    </div>
  );
}
