"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { SparkleBurst } from "@/components/graphics/sparkle-burst";
import { SubjectArt } from "@/components/learn/subject-tile";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import type { MarkedOverall } from "@/lib/api/coursework";
import { gradeRange, resultMood, type ResultMood } from "@/lib/coursework";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";
import { useCw } from "./use-cw";

/** The cat reacts to the result: a trophy for top-band work, a pencil for a solid draft, a thoughtful (never mocking) look for a weak one. */
const MOOD_POSE: Record<ResultMood, MascotPose> = { strong: "trophy", okay: "pencil", rough: "think" };

export type BandState =
  | { kind: "new" }
  | { kind: "reading" }
  | { kind: "marked"; overall: MarkedOverall }
  | { kind: "feedback" }
  /** A marked review with its marks hidden by the student. */
  | { kind: "hidden" };

function Range({ low, high, animate }: { low: number; high: number; animate: boolean }) {
  const a = useCountUp(low, animate ? 900 : 0);
  const b = useCountUp(high, animate ? 900 : 0);
  // Without the reveal the numbers are simply there (useCountUp starts from 0 for a frame).
  const from = animate ? a : low;
  const to = animate ? b : high;
  return (
    <>
      {from}
      {low !== high && (
        <>
          <span className="mx-[0.04em]">–</span>
          {to}
        </>
      )}
    </>
  );
}

/**
 * The header of a piece of coursework: its subject's band (colour and art),
 * its name, and, once reviewed, the result. A fresh review is a small reward
 * moment: the predicted range counts up and the cat reacts. Text sits on the
 * band's solid colour, never on a wash.
 */
export function ResultBand({
  familyText,
  eyebrow,
  title,
  state,
  fresh,
  example,
  children,
  className,
}: {
  /** What picks the colour family ("Biology", "Theory of Knowledge"). */
  familyText: string;
  /** "Biology IA · Draft 2". */
  eyebrow: string;
  /** The piece's own title. */
  title: string;
  state: BandState;
  /** The review just finished: count up, cheer. */
  fresh: boolean;
  /** Marks the band as a made-up sample. */
  example?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useCw();
  const family = resolveSubjectFamily(null, familyText);
  const mood = state.kind === "marked" ? resultMood(state.overall) : null;
  const pose: MascotPose = state.kind === "marked" ? MOOD_POSE[mood!] : state.kind === "new" ? "wave" : state.kind === "reading" ? "book" : "pencil";
  const celebrate = fresh && mood === "strong";
  const grade = state.kind === "marked" ? gradeRange(state.overall) : null;
  const headline =
    state.kind === "marked"
      ? t(`cw.band.${mood}`)
      : state.kind === "feedback" || state.kind === "hidden"
        ? t("cw.band.feedbackTitle")
        : state.kind === "reading"
          ? t("cw.wait.title")
          : t("cw.band.new");

  return (
    <header
      className={cn("subject-band cw-band relative px-5 pb-5 pt-5 sm:px-8 sm:pb-7 sm:pt-7", className)}
      style={familyVars(family) as CSSProperties}
      data-state={state.kind}
      data-mood={mood ?? undefined}
    >
      <SubjectArt family={family} eager className="cw-band__art" />
      <div className="cw-band__cat" aria-hidden>
        {celebrate && <SparkleBurst burst={1} count={14} distance={92} />}
        {state.kind === "reading" ? (
          <Image src="/design/cat3-read.webp" alt="" width={608} height={400} unoptimized priority draggable={false} className="cat-bob h-full w-auto" />
        ) : (
          <Mascot pose={pose} key={pose} className={cn("h-full", fresh ? (celebrate ? "cat-cheer" : "cat-peek") : undefined)} priority />
        )}
      </div>

      <div className="cw-band__text relative">
        <p className="text-small font-extrabold text-white">
          {example && <span className="mr-2 inline-block rounded-full bg-white px-2 py-px align-[1px] text-caption font-extrabold text-[var(--tile-a)]">{example}</span>}
          {eyebrow}
        </p>
        <h1 className="mt-1 line-clamp-2 text-[20px] font-extrabold leading-[1.18] text-white [overflow-wrap:anywhere] sm:text-[24px]" title={title}>
          {title}
        </h1>

        {state.kind === "marked" ? (
          <div className="mt-4 sm:mt-5" role="status" aria-label={`${t("cw.band.spoken", { a: state.overall.marksLow, b: state.overall.marksHigh, n: state.overall.totalMarks })}${grade ? `. ${t("cw.band.grade", { g: grade })}` : ""}`}>
            <p className="text-small font-extrabold text-white" aria-hidden>
              {t("cw.band.predicted")}
            </p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1" aria-hidden>
              <span className={cn("text-[52px] font-extrabold leading-[0.95] tracking-tight text-white tabular-nums sm:text-[64px]", fresh && "finish-score")}>
                <Range low={state.overall.marksLow} high={state.overall.marksHigh} animate={fresh} />
              </span>
              <span className="text-ui font-bold text-white">{t("cw.band.outOf", { n: state.overall.totalMarks })}</span>
            </p>
            <p className="mt-2 text-ui font-bold text-white" aria-hidden>
              {headline}
              {grade && <span className="font-semibold text-white"> · {t("cw.band.grade", { g: grade })}</span>}
            </p>
          </div>
        ) : (
          <div className="mt-3 sm:mt-4" role="status">
            <p className="text-[22px] font-extrabold leading-tight text-white sm:text-[26px]">{headline}</p>
            <p className="mt-1 text-ui font-semibold text-white">
              {state.kind === "reading" ? t("cw.wait.sub") : state.kind === "new" ? t("cw.band.newSub") : state.kind === "hidden" ? t("cw.band.hidden") : t("cw.band.feedbackSub")}
            </p>
          </div>
        )}
        {children}
      </div>
    </header>
  );
}
