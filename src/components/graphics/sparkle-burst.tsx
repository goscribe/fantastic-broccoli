"use client";

import "@/app/design/design.css";

/** Brand purple and the mascot's orange only. */
const COLORS = ["#6952e0", "#f0a645", "#a79af0"];

/**
 * A small, local burst of sparkles around its parent's centre (the parent
 * must be `relative`). Re-plays when `burst` changes; ~0.7s; hidden under
 * reduced motion. Unlike full-screen confetti it never covers the question.
 */
export function SparkleBurst({ burst, count = 10, distance = 34 }: { burst: number; count?: number; distance?: number }) {
  if (burst <= 0) return null;
  return (
    <span key={burst} aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="life-sparkle block rounded-full"
          style={{
            width: i % 3 === 0 ? 7 : 5,
            height: i % 3 === 0 ? 7 : 5,
            background: COLORS[i % COLORS.length],
            ["--a" as string]: `${(360 / count) * i}deg`,
            ["--d" as string]: `${distance + (i % 2) * 10}px`,
            animationDelay: `${(i % 3) * 30}ms`,
          }}
        />
      ))}
    </span>
  );
}
