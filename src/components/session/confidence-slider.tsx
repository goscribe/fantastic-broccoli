"use client";

import Image from "next/image";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/start-check";
import { cn } from "@/lib/utils";
import { CONFIDENCE_FACES, CONFIDENCE_MAX, clampConfidence, confidenceCat, confidenceFace, sliderKeyValue, valueFromPointer } from "@/lib/start-check";

/** Half the cat's width: the track is inset by this much so the cat never leaves the sheet. */
const INSET = 40;

/**
 * "How confident are you?" as one drag. The cat is the handle: it rides the
 * track from 0 to 10 and its face goes from worried to delighted on the way.
 * A real slider for assistive tech (role, value, a spoken "3 out of 10,
 * unsure"), arrow / Page / Home / End / digit keys, and a touch or a drag
 * anywhere on the track.
 */
export function ConfidenceSlider({ value, onChange, labelledBy, className }: { value: number; onChange: (value: number) => void; labelledBy?: string; className?: string }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const v = clampConfidence(value);
  const face = confidenceFace(v);
  const word = t(`startCheck.face.${face}`);
  const pct = (v / CONFIDENCE_MAX) * 100;

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) onChange(valueFromPointer(clientX, rect.left, rect.width));
  };

  return (
    <div className={cn("w-full select-none", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={CONFIDENCE_MAX}
        aria-valuenow={v}
        aria-valuetext={t("startCheck.valueText").replace("{n}", String(v)).replace("{word}", word.toLowerCase())}
        aria-orientation="horizontal"
        {...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": t("startCheck.aria") })}
        data-confidence-slider
        data-face={face}
        onKeyDown={(e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          const next = sliderKeyValue(v, e.key);
          if (next === null) return;
          e.preventDefault();
          onChange(next);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus({ preventScroll: true });
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
        }}
        className="group relative h-[136px] w-full cursor-grab touch-none rounded-2xl outline-none active:cursor-grabbing"
        style={{ paddingInline: INSET }}
      >
        <div ref={trackRef} className="relative h-full w-full">
          {/* The track: a quiet rail, filled in the cat's orange up to the cat. */}
          <div className="absolute inset-x-0 bottom-[14px] h-3 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-[#f6a53b] transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
          </div>
          {/* One notch a number, so a tap lands where it looks like it will. */}
          <div className="absolute inset-x-0 bottom-[18px] flex justify-between" aria-hidden>
            {Array.from({ length: CONFIDENCE_MAX + 1 }, (_, i) => (
              <span key={i} className={cn("size-1 -translate-x-1/2 rounded-full first:translate-x-0 last:translate-x-0", i <= v ? "bg-white/80" : "bg-border-strong")} />
            ))}
          </div>
          {/* The cat. All five faces are mounted so a drag never waits on a download; one shows. */}
          <div
            className="absolute bottom-[6px] h-[112px] w-[94px] -translate-x-1/2 transition-[left] duration-150 ease-out group-focus-visible:[&>span]:opacity-100"
            style={{ left: `${pct}%` }}
            aria-hidden
          >
            <span className="pointer-events-none absolute -inset-x-1 -bottom-1 top-0 rounded-[28px] border-[3px] border-foreground opacity-0" />
            {CONFIDENCE_FACES.map((f) => (
              <Image
                key={f}
                src={confidenceCat(f)}
                alt=""
                width={336}
                height={400}
                unoptimized
                priority={f === face}
                draggable={false}
                className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-150", f === face ? "opacity-100" : "opacity-0")}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-caption font-bold tabular-nums text-faint" style={{ paddingInline: INSET - 4 }} aria-hidden>
        <span>0</span>
        <span>10</span>
      </div>
      <p className="mt-1 text-center" aria-hidden>
        <span className="text-[34px] font-extrabold leading-none tabular-nums text-foreground">{v}</span>
        <span className="text-[17px] font-extrabold text-muted-foreground">{t("startCheck.outOf")}</span>
        <span className="ml-2.5 text-[17px] font-extrabold text-foreground">{word}</span>
      </p>
    </div>
  );
}
