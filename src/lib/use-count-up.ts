"use client";

import { useEffect, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts from 0 up to `value` (ease-out, ~0.8s) the first time it is shown; jumps straight there under reduced motion. */
export function useCountUp(value: number, ms = 800): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0 || reduced()) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}
