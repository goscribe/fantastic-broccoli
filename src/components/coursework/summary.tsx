"use client";

import Image from "next/image";
import { SparkleBurst } from "@/components/graphics/sparkle-burst";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import type { GradeResult, MarkedResult } from "@/lib/api/coursework";
import { gradeRange, hasMarks, resultMood, ringSegments, type ResultMood } from "@/lib/coursework";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";
import { useCw } from "./use-cw";

/** The cat reacts to the result: a trophy for top-band work, a pencil for a solid draft, a thoughtful (never mocking) look for a weak one. */
const MOOD_POSE: Record<ResultMood, MascotPose> = { strong: "trophy", okay: "pencil", rough: "think" };

const R = 40;
const C = 2 * Math.PI * R;

/** An arc of the ring from `from` to `to` (fractions of the circle, clockwise from the top). */
function Arc({ from, to, className, width }: { from: number; to: number; className: string; width: number }) {
  const len = Math.max(0, to - from) * C;
  if (len <= 0) return null;
  return <circle cx={50} cy={50} r={R} fill="none" strokeWidth={width} strokeLinecap="butt" className={className} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-from * C} transform="rotate(-90 50 50)" />;
}

function Range({ low, high, animate }: { low: number; high: number; animate: boolean }) {
  const a = useCountUp(low, 900);
  const b = useCountUp(high, 900);
  const from = animate ? a : low;
  const to = animate ? b : high;
  return (
    <>
      {from}
      {low !== high && <>–{to}</>}
    </>
  );
}

/**
 * The predicted range in a small ring: one arc per criterion (sized by its
 * marks), each filled as far as its band reaches, solid to the band's low
 * mark and lighter up to its high one. The range itself is written in the
 * middle, so the ring never has to be read to know the result.
 */
export function ScoreRing({ result, fresh, className }: { result: MarkedResult; fresh: boolean; className?: string }) {
  const segments = ringSegments(result.criteria);
  const o = result.overall;
  return (
    <span className={cn("relative block size-[104px] shrink-0", className)} aria-hidden>
      <svg viewBox="0 0 100 100" className="size-full">
        {segments.map((s) => {
          const span = s.end - s.start;
          return (
            <g key={s.letter}>
              <Arc from={s.start} to={s.end} width={9} className="stroke-[var(--muted)]" />
              <Arc from={s.start} to={s.start + span * s.high} width={9} className="cw-ring-soft" />
              <Arc from={s.start} to={s.start + span * s.low} width={9} className="cw-ring" />
            </g>
          );
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-foreground">
        <span className={cn("text-[21px] font-extrabold leading-none tracking-tight tabular-nums", fresh && "finish-score !origin-center")}>
          <Range low={o.marksLow} high={o.marksHigh} animate={fresh} />
        </span>
        <span className="mt-1 text-caption font-bold text-muted-foreground">of {o.totalMarks}</span>
      </span>
    </span>
  );
}

/**
 * The overall result, compact, at the top of the feedback: the ring with the
 * predicted range, a line saying how it went, and a small cat reacting. A
 * feedback-only review (or marks the student has hidden) shows no ring and no
 * number at all. Part of the page, not a card.
 */
export function ResultSummary({ result, hideMarks, fresh, reading, example }: { result: GradeResult | null; hideMarks: boolean; fresh: boolean; /** A review is running: the cat reads. */ reading?: boolean; /** Marks the block as a made-up sample. */ example?: string }) {
  const { t } = useCw();
  const marked = hasMarks(result) && !hideMarks ? result : null;
  const mood = marked ? resultMood(marked.overall) : null;
  const grade = marked ? gradeRange(marked.overall) : null;
  const pose: MascotPose = mood ? MOOD_POSE[mood] : "pencil";
  const celebrate = fresh && mood === "strong";
  return (
    <section className="flex items-center gap-4" data-cw-summary data-mood={mood ?? undefined} aria-label={t("cw.sum.label")}>
      {marked && <ScoreRing result={marked} fresh={fresh} />}
      <div className="min-w-0 flex-1" role="status">
        {example && <p className="mb-1"><span className="inline-block rounded-full bg-[var(--tile-a)] px-2 py-px text-caption font-extrabold text-white">{example}</span></p>}
        {marked ? (
          <>
            <p className="text-small font-bold text-muted-foreground">
              {t("cw.band.predicted")}
              <span className="sr-only">: {t("cw.band.spoken", { a: marked.overall.marksLow, b: marked.overall.marksHigh, n: marked.overall.totalMarks })}</span>
            </p>
            <p className="text-read font-extrabold leading-snug text-foreground">{t(`cw.band.${mood}`)}</p>
            {grade && <p className="text-small font-bold text-muted-foreground">{t("cw.band.grade", { g: grade })}</p>}
          </>
        ) : reading ? (
          <>
            <p className="text-read font-extrabold leading-snug text-foreground">{t("cw.wait.title")}</p>
            <p className="text-small font-bold text-muted-foreground">{t("cw.wait.sub")}</p>
          </>
        ) : (
          <>
            <p className="text-read font-extrabold leading-snug text-foreground">{t("cw.band.feedbackTitle")}</p>
            <p className="text-small font-bold text-muted-foreground">{hasMarks(result) ? t("cw.band.hidden") : t("cw.band.feedbackSub")}</p>
          </>
        )}
      </div>
      <span className="relative flex h-[68px] shrink-0 items-end" aria-hidden>
        {celebrate && <SparkleBurst burst={1} count={12} distance={52} />}
        {reading ? (
          <Image src="/design/cat3-read.webp" alt="" width={608} height={400} unoptimized draggable={false} className="cat-bob h-[52px] w-auto" />
        ) : (
          <Mascot pose={pose} key={pose} className={cn("h-full", fresh ? (celebrate ? "cat-cheer" : "cat-peek") : undefined)} />
        )}
      </span>
    </section>
  );
}
