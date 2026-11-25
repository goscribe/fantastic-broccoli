"use client";

import Image from "next/image";
import { useEffect, useRef, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/start-check";
import { cn } from "@/lib/utils";
import { CONFIDENCE_FACES, CONFIDENCE_MAX, clampConfidence, confidenceCat, confidenceFace, sliderKeyValue, valueFromPointer } from "@/lib/start-check";

/** How far the track is inset from the slider's edges, so the cat stays inside the sheet at 0 and at 10. */
const INSET = 44;
/** The most the cat tips into a drag, in degrees. */
const LEAN_MAX = 8;
/** How long after the last movement the cat stands back up. */
const SETTLE_MS = 130;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "How confident are you?" as one drag. The cat is the handle: it rides the
 * track from 0 to 10 and its whole body goes from crouched and worried to a
 * delighted hop on the way. It leans into a drag (or an arrow key) and
 * settles when it stops, and does a small squash-and-hop when it changes
 * pose; none of that with reduced motion. A real slider for assistive tech
 * (role, value, a spoken "3 out of 10, unsure"), arrow / Page / Home / End /
 * digit keys, and a touch or a drag anywhere on the track.
 */
export function ConfidenceSlider({ value, onChange, labelledBy, className }: { value: number; onChange: (value: number) => void; labelledBy?: string; className?: string }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const leanRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const lastX = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const v = clampConfidence(value);
  const face = confidenceFace(v);
  const word = t(`startCheck.face.${face}`);
  const pct = (v / CONFIDENCE_MAX) * 100;

  /** Tip the cat `deg` degrees about its feet; it stands back up once nothing has moved for a moment. */
  const lean = (deg: number) => {
    const el = leanRef.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = null;
    const to = reducedMotion() ? 0 : Math.max(-LEAN_MAX, Math.min(LEAN_MAX, deg));
    el.style.transform = to ? `rotate(${to.toFixed(1)}deg)` : "";
    el.dataset.lean = to > 0 ? "right" : to < 0 ? "left" : "none";
    if (to)
      settle.current = setTimeout(() => {
        el.style.transform = "";
        el.dataset.lean = "none";
      }, SETTLE_MS);
  };

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  // A new pose lands with a small squash and hop, so the swap reads as the cat moving, not a picture changing.
  const shownFace = useRef(face);
  useEffect(() => {
    if (shownFace.current === face) return;
    shownFace.current = face;
    if (reducedMotion()) return;
    hopRef.current?.animate(
      [
        { transform: "translateY(0) scale(1, 1)" },
        { transform: "translateY(0) scale(1.08, 0.9)", offset: 0.22 },
        { transform: "translateY(-9px) scale(0.96, 1.05)", offset: 0.55 },
        { transform: "translateY(0) scale(1.04, 0.96)", offset: 0.82 },
        { transform: "translateY(0) scale(1, 1)" },
      ],
      { duration: 360, easing: "ease-out" },
    );
  }, [face]);

  const fromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) onChange(valueFromPointer(clientX, rect.left, rect.width));
    // Into the drag: a few degrees for any movement, a little more for a fast one.
    const dx = lastX.current === null ? 0 : clientX - lastX.current;
    if (dx) lean(Math.sign(dx) * (3 + Math.abs(dx) * 0.5));
    lastX.current = clientX;
  };
  const release = (e: PointerEvent<HTMLDivElement>) => {
    delete e.currentTarget.dataset.dragging;
    lastX.current = null;
    lean(0);
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
          if (next !== v) lean(next > v ? 5 : -5);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus({ preventScroll: true });
          e.currentTarget.dataset.dragging = "true";
          lastX.current = null;
          fromPointer(e.clientX);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX);
        }}
        className="group relative h-[164px] w-full cursor-grab touch-none rounded-2xl outline-none active:cursor-grabbing"
        style={{ paddingInline: INSET }}
      >
        <div ref={trackRef} className="relative h-full w-full">
          {/* The track: a quiet rail, filled in the cat's orange up to the cat. */}
          <div className="absolute inset-x-0 bottom-[10px] h-3 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-[#f6a53b] transition-[width] duration-150 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
          {/* One notch a number, so a tap lands where it looks like it will. */}
          <div className="absolute inset-x-0 bottom-[14px] flex justify-between" aria-hidden>
            {Array.from({ length: CONFIDENCE_MAX + 1 }, (_, i) => (
              <span key={i} className={cn("size-1 -translate-x-1/2 rounded-full first:translate-x-0 last:translate-x-0", i <= v ? "bg-white/80" : "bg-border-strong")} />
            ))}
          </div>
          {/*
            The cat, standing on the rail: every pose shares one base line (396 of 400), which lands a
            few pixels into the rail. All five poses are mounted so a drag never waits on a download;
            one shows, and they cross-fade.
          */}
          <div
            className="absolute bottom-[17px] h-[132px] w-[111px] -translate-x-1/2 transition-[left] duration-150 ease-out motion-reduce:transition-none"
            style={{ left: `${pct}%` }}
            data-confidence-cat
            aria-hidden
          >
            {/* The keyboard focus ring; never while a finger or the mouse is dragging. */}
            <span className="pointer-events-none absolute -inset-x-1 -bottom-[14px] -top-1.5 rounded-[28px] border-[3px] border-foreground opacity-0 group-focus-visible:opacity-100 group-data-[dragging=true]:opacity-0" />
            <div ref={leanRef} data-lean="none" className="absolute inset-0 origin-[50%_97%] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform motion-reduce:transition-none">
              <div ref={hopRef} className="absolute inset-0 origin-[50%_99%]">
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
                    className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ease-out motion-reduce:transition-none", f === face ? "opacity-100" : "opacity-0")}
                  />
                ))}
              </div>
            </div>
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
