import Image from "next/image";
import { ArrowRight, Camera, FileText, Link2, Upload } from "lucide-react";
import { BuildBar, WarmupCard } from "@/components/design/generating";
import { cn } from "@/lib/utils";

const STEPS = ["Goal", "Subjects", "First material", "Building"] as const;
const EXAMS = ["IB", "A-level", "GCSE", "AP", "SAT", "University", "Just learning"];
const MINUTES = [10, 20, 30, 45];
const SUBJECTS: [string, string][] = [["Biology", "bg-emerald-500"], ["Chemistry", "bg-accent"], ["Physics", "bg-sky-500"], ["Maths AA", "bg-amber-500"], ["Economics", "bg-rose-500"], ["English", "bg-pink-500"], ["History", "bg-orange-500"], ["Psychology", "bg-teal-500"]];

/** First-run onboarding: /design/onboarding?step=1..4 */
export default async function OnboardingPreview({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step = "1" } = await searchParams;
  const n = Math.max(1, Math.min(4, Number(step) || 1));
  return (
    <div className="flex min-h-dvh w-full flex-col items-center bg-white px-5 pb-10 pt-8">
      <div className="flex w-full max-w-[560px] items-center justify-between">
        <span className="text-[15px] font-bold">Scribe</span>
        {n < 4 && <span className="text-[13px] font-semibold text-faint">Skip for now</span>}
      </div>
      <ol className="mt-6 flex w-full max-w-[560px] items-center gap-2">{STEPS.map((s, i) => <li key={s} className="flex flex-1 flex-col gap-1.5"><span className={cn("h-1.5 rounded-full", i < n ? "bg-accent" : "bg-muted")} /><span className={cn("text-[11px] font-semibold", i < n ? "text-accent" : "text-faint")}>{s}</span></li>)}</ol>

      <div className="mt-8 w-full max-w-[560px] rounded-3xl border border-border px-8 py-8">
        {n === 1 && (
          <>
            <Image src="/design/cat2-wave.png" alt="" width={96} height={96} unoptimized className="design-wiggle mx-auto size-24 object-contain" />
            <h1 className="mt-3 text-center text-[24px] font-bold">Hi Alan — what are you studying for?</h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">So the first session fits your exam, not a generic one.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">{EXAMS.map((e) => <span key={e} className={cn("inline-flex h-10 items-center rounded-xl border px-4 text-[14px] font-semibold", e === "IB" ? "border-accent bg-accent-soft text-accent" : "border-border")}>{e}</span>)}</div>
            <div className="mt-7 text-center text-[14px] font-semibold">How long can you study a day?</div>
            <div className="mt-3 flex justify-center gap-2">{MINUTES.map((m) => <span key={m} className={cn("inline-flex h-10 w-[72px] items-center justify-center rounded-xl border text-[14px] font-semibold", m === 20 ? "border-accent bg-accent-soft text-accent" : "border-border")}>{m} min</span>)}</div>
            <p className="mt-3 text-center text-[13px] text-muted-foreground">Most students pick 20 minutes and finish their first session today.</p>
          </>
        )}
        {n === 2 && (
          <>
            <Image src="/design/cat2-think.png" alt="" width={96} height={96} unoptimized className="design-float mx-auto size-24 object-contain" />
            <h1 className="mt-3 text-center text-[24px] font-bold">Pick your subjects</h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">Two or three is plenty — you can add more any time.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">{SUBJECTS.map(([s, c], i) => <span key={s} className={cn("flex h-12 items-center gap-3 rounded-xl border px-4 text-[14px] font-semibold", i < 2 ? "border-accent bg-accent-soft/40" : "border-border")}><span className={cn("size-2.5 rounded-full", c)} />{s}{i < 2 && <span className="ml-auto text-[11px] font-semibold text-accent">HL</span>}</span>)}</div>
            <p className="mt-4 text-center text-[13px] text-muted-foreground">Nice — Biology HL is the most-studied subject on Scribe this month.</p>
          </>
        )}
        {n === 3 && (
          <>
            <Image src="/design/cat2-book.png" alt="" width={96} height={96} unoptimized className="design-float mx-auto size-24 object-contain" />
            <h1 className="mt-3 text-center text-[24px] font-bold">Add your first material</h1>
            <p className="mt-1 text-center text-[14px] text-muted-foreground">One file is enough. Scribe turns it into a 20-minute session with questions from <i>your</i> notes.</p>
            <div className="mt-5 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/30 px-6 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-xl bg-accent text-white"><Upload className="size-5" /></span>
              <div className="text-[15px] font-semibold">Drop a file or click to browse</div>
              <div className="text-[12.5px] text-muted-foreground">PDF · slides · photos of notes · YouTube link</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">{[["Upload PDF", FileText], ["Photo of notes", Camera], ["Paste a link", Link2]].map(([l, I]) => { const Icon = I as typeof FileText; return <span key={l as string} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-[13px] font-semibold"><Icon className="size-4 text-muted-foreground" />{l as string}</span>; })}</div>
            <p className="mt-4 text-center text-[13px] text-muted-foreground">No notes handy? <span className="font-semibold text-accent">Try our Biology sample</span> — it takes 2 minutes.</p>
          </>
        )}
        {n === 4 && <><BuildBar index={2} title="Bio notes · Topic 3" /><div className="mt-4"><WarmupCard hero /></div></>}
      </div>

      {n === 4 ? <p className="mt-4 text-[13px] text-faint">We’ll tell you the moment it’s ready.</p> : (
        <div className="mt-5 flex w-full max-w-[560px] items-center justify-between">
          <span className="text-[13px] font-semibold text-faint">{n > 1 ? "Back" : ""}</span>
          <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[14px] font-semibold text-white">{n === 3 ? "Build my first session" : "Continue"}<ArrowRight className="size-4" /></span>
        </div>
      )}
    </div>
  );
}
