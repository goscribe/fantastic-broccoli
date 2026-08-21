"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCENT_PALETTE } from "@/lib/accent-palette";

const PIECE_COUNT = 42;

interface Piece {
  left: number;
  color: string;
  delay: number;
  duration: number;
  width: number;
  height: number;
  round: boolean;
}

function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    left: Math.random() * 100,
    color: ACCENT_PALETTE[i % ACCENT_PALETTE.length],
    delay: Math.random() * 0.35,
    duration: 1.3 + Math.random() * 0.9,
    width: 6 + Math.random() * 6,
    height: 4 + Math.random() * 8,
    round: Math.random() < 0.3,
  }));
}

/**
 * Full-screen falling-confetti overlay. Re-fires every time `burst`
 * increments past 0; unmounts itself when the pieces finish falling.
 */
export function ConfettiBurst({ burst }: { burst: number }) {
  const [dismissedBurst, setDismissedBurst] = useState(0);
  const visible = burst > dismissedBurst;
  const pieces = useMemo(() => (burst > 0 ? makePieces() : []), [burst]);

  useEffect(() => {
    if (burst <= 0) return;
    const timer = setTimeout(() => setDismissedBurst(burst), 2600);
    return () => clearTimeout(timer);
  }, [burst]);

  if (!visible) return null;

  return (
    <div
      key={burst}
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti-fall absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.round ? p.width : p.height,
            backgroundColor: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            ["--confetti-duration" as string]: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
