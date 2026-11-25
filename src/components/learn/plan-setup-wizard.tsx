"use client";
import { buttonClass } from "@/components/ui/button";
import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { setAvailability, type AvailabilitySlot, type StudyPlan } from "@/lib/api/planner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast";

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
// Only the free times: minutes per day come from the exam planner, the exam
// date lives only in the exam planner, and the study time from the habit prompt.
const STEPS = ["free", "done"] as const;
type Step = (typeof STEPS)[number];

/** The week setup: when you are free, then a summary; saved at the end. Opens in Planner › Timetable after the calendar connects (and with ?setup=1), and from home's week banner (/?setup=1). */
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
  const [saving, setSaving] = useState(false);
  const idx = STEPS.indexOf(step);

  const save = async () => {
    setSaving(true);
    try {
      await setAvailability(ORDER.filter((wd) => rows[wd].on).map((wd) => ({ weekday: wd, start: rows[wd].start, end: rows[wd].end })));
      onSaved();
    } catch (e) {
      toastError(e, "Couldn't save your plan");
      setSaving(false);
    }
  };

  // Portalled: home opens this from inside its banner, whose stacking context would let later cards paint over it.
  // Only ever opened on the client (a tap or a query param read in the browser).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] grid grid-cols-[minmax(0,440px)] place-content-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => setStep(s)} aria-label={`Step ${i + 1}`} className={cn("h-1.5 rounded-full transition-all", s === step ? "w-8 bg-accent" : i < idx ? "w-4 bg-accent/50" : "w-4 bg-muted")} />
          ))}
        </div>

        {step === "free" && (
          <>
            <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="cat-bob mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">When are you free to study?</h2>
            <p className="mt-1 text-center text-[13px] text-muted-foreground">Sessions only land inside these times, around what&apos;s on your calendar.</p>
            <div className="mt-4 space-y-2">
              {ORDER.map((wd, i) => {
                const r = rows[wd];
                return (
                  <div key={wd} className="flex items-center gap-2 sm:gap-3">
                    <label className="flex w-[64px] shrink-0 items-center gap-2 text-[13.5px] font-semibold">
                      <input type="checkbox" checked={r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, on: e.target.checked } })} className="size-4 accent-[var(--accent)]" />
                      {DAY[i]}
                    </label>
                    <Input type="time" value={r.start} disabled={!r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, start: e.target.value } })} className="h-9 min-w-0 flex-1 px-2 text-[13px] max-sm:[&::-webkit-calendar-picker-indicator]:hidden sm:text-[14px]" />
                    <span className="shrink-0 text-faint">–</span>
                    <Input type="time" value={r.end} disabled={!r.on} onChange={(e) => setRows({ ...rows, [wd]: { ...r, end: e.target.value } })} className="h-9 min-w-0 flex-1 px-2 text-[13px] max-sm:[&::-webkit-calendar-picker-indicator]:hidden sm:text-[14px]" />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <Image src="/design/cat3-cheer.webp" alt="" width={363} height={400} unoptimized className="cat-wiggle mx-auto h-16 w-auto" />
            <h2 className="mt-2 text-center text-[20px] font-bold">Here&apos;s your plan</h2>
            <ul className="mt-4 space-y-2 text-[13.5px]">
              <li className="flex justify-between rounded-xl bg-muted px-3 py-2"><span className="text-muted-foreground">Free to study</span><button type="button" onClick={() => setStep("free")} className="font-semibold text-accent">{ORDER.filter((wd) => rows[wd].on).length} days · {rows[ORDER.find((wd) => rows[wd].on) ?? 1].start}–{rows[ORDER.find((wd) => rows[wd].on) ?? 1].end}</button></li>
            </ul>
            <p className="mt-3 text-center text-[12.5px] text-muted-foreground">How long you study each day and your exam dates are set in the Plan and Exams tabs.</p>
          </>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => (idx === 0 ? onClose() : setStep(STEPS[idx - 1]))} className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground hover:bg-muted">
            <ArrowLeft className="size-4" /> {idx === 0 ? "Later" : "Back"}
          </button>
          {step === "done" ? (
            <button type="button" disabled={saving} onClick={() => void save()} className={buttonClass({ size: "sm", className: "gap-1.5" })}>
              {saving && <Loader2 className="size-3.5 animate-spin" />} Save plan
            </button>
          ) : (
            <button type="button" onClick={() => setStep(STEPS[idx + 1])} className={buttonClass({ size: "sm", className: "gap-1.5" })}>
              Next <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
