"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { setAvailability, updateStudyPlan, type AvailabilitySlot, type StudyPlan } from "@/lib/api/planner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const STEPS = ["free", "goal", "exam", "done"] as const;
type Step = (typeof STEPS)[number];

/** Runs right after the calendar connects, and again from the gear: one question per screen, flip back and forth, save at the end. */
export function PlanSetupWizard({ plan, start = "free", onClose, onSaved }: { plan: StudyPlan; start?: Step; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<Step>(start);
  const initial = (plan.availability ?? null) as AvailabilitySlot[] | null;
  const [rows, setRows] = useState<Record<number, { on: boolean; start: string; end: string }>>(() => {
    const out: Record<number, { on: boolean; start: string; end: string }> = {};
    for (const wd of ORDER) {
      const slot = initial?.find((s) => s.weekday === wd);
      out[wd] = slot ? { on: true, start: slot.start, end: slot.end } : { on: initial ? false : plan.weekdays.includes(wd), start: plan.windowStart, end: plan.windowEnd };
    }
    return out;
  });
  const [goal, setGoal] = useState(plan.dailyGoalMin);
  const [examTitle, setExamTitle] = useState(plan.examTitle ?? "");
  const [examDate, setExamDate] = useState(plan.examDate ? new Date(plan.examDate).toISOString().slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const idx = STEPS.indexOf(step);

  const save = async () => {
    setSaving(true);
    try {
      await setAvailability(ORDER.filter((wd) => rows[wd].on).map((wd) => ({ weekday: wd, start: rows[wd].start, end: rows[wd].end })));
      await updateStudyPlan({ dailyGoalMin: goal, examTitle: examTitle.trim() || null, examDate: examDate || null });
      onSaved();
    } catch (e) {
      toastError(e, "Couldn't save your plan");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => setStep(s)} aria-label={`Step ${i + 1}`} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-accent" : i < idx ? "w-4 bg-accent/50" : "w-4 bg-muted")} />
          ))}
        </div>

        {step === "free" && (
          <>
            <Image src="/design/cat2-think.png" alt="" width={72} height={72} unoptimized className="cat-bob mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">When are you free to study?</h2>
            <p className="mt-1 text-center text-[13px] text-muted-foreground">Sessions only land inside these times, around what&apos;s on your calendar.</p>
            <div className="mt-4 space-y-2">
              {ORDER.map((wd, i) => {
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
          </>
        )}

        {step === "goal" && (
          <>
            <Image src="/design/cat2-flame.png" alt="" width={72} height={72} unoptimized className="cat-bob mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">How much per day?</h2>
            <p className="mt-1 text-center text-[13px] text-muted-foreground">A realistic daily goal keeps the streak alive.</p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[15, 25, 45, 60].map((m) => (
                <button key={m} type="button" onClick={() => setGoal(m)} className={cn("rounded-xl border py-3 text-[15px] font-bold", goal === m ? "border-accent bg-accent-soft text-accent" : "border-border hover:border-border-strong")}>
                  {m} <span className="text-[11px] font-semibold text-faint">min</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "exam" && (
          <>
            <Image src="/design/cat2-trophy.png" alt="" width={72} height={72} unoptimized className="cat-bob mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">Working towards an exam?</h2>
            <p className="mt-1 text-center text-[13px] text-muted-foreground">The plan ramps up as the date gets closer. Skip if not.</p>
            <div className="mt-5 space-y-2">
              <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g. IB May 2027" />
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <Image src="/design/cat2-cheer.png" alt="" width={72} height={72} unoptimized className="cat-wiggle mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">Here&apos;s your plan</h2>
            <ul className="mt-4 space-y-2 text-[13.5px]">
              <li className="flex justify-between rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">Free</span><button type="button" onClick={() => setStep("free")} className="font-semibold text-accent">{ORDER.filter((wd) => rows[wd].on).length} days · {rows[ORDER.find((wd) => rows[wd].on) ?? 1].start}–{rows[ORDER.find((wd) => rows[wd].on) ?? 1].end}</button></li>
              <li className="flex justify-between rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">Daily goal</span><button type="button" onClick={() => setStep("goal")} className="font-semibold text-accent">{goal} min</button></li>
              <li className="flex justify-between rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">Exam</span><button type="button" onClick={() => setStep("exam")} className="font-semibold text-accent">{examTitle.trim() ? `${examTitle.trim()}${examDate ? ` · ${examDate}` : ""}` : "none"}</button></li>
            </ul>
          </>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => (idx === 0 ? onClose() : setStep(STEPS[idx - 1]))} className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            <ArrowLeft className="size-4" /> {idx === 0 ? "Later" : "Back"}
          </button>
          {step === "done" ? (
            <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent-dim disabled:opacity-60">
              {saving && <Loader2 className="size-3.5 animate-spin" />} Save plan
            </button>
          ) : (
            <button type="button" onClick={() => setStep(STEPS[idx + 1])} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent-dim">
              Next <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
