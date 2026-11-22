import { MAX_TRACK_CELLS, bandCells, bandLabel, bandSpan, bandSpoken } from "@/lib/coursework";
import { cn } from "@/lib/utils";

/**
 * A mark band drawn as a range on a small scale: one cell per mark with the
 * band's cells filled in the subject's colour (a single bar above 12 marks).
 * Filled cells are also taller, and the range is always written beside the
 * track by the caller, so nothing is told by colour alone.
 */
export function BandTrack({ low, high, max, faint, className }: { low: number; high: number; max: number; /** An earlier draft's band: outlined, not filled. */ faint?: boolean; className?: string }) {
  const label = bandSpoken(low, high, max);
  if (max > MAX_TRACK_CELLS) {
    const { start, end } = bandSpan(low, high, max);
    return (
      <span role="img" aria-label={label} className={cn("cw-track relative block h-3", className)}>
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--muted)]" />
        <span className={cn("absolute top-0 h-3 rounded-full", faint ? "cw-fill--faint" : "cw-fill")} style={{ left: `${start}%`, width: `${Math.max(2, end - start)}%` }} />
      </span>
    );
  }
  const cells = bandCells(low, high, max);
  return (
    <span role="img" aria-label={label} className={cn("cw-track flex h-3 items-center gap-[3px]", className)}>
      {cells.map((on, i) => (
        <span key={i} className={cn("min-w-0 flex-1 rounded-[3px]", on ? (faint ? "cw-fill--faint h-3" : "cw-fill h-3") : "h-1.5 bg-[var(--muted)]")} />
      ))}
    </span>
  );
}

/** "4–5 of 6" as the number beside a track. */
export function BandNumber({ low, high, max, className }: { low: number; high: number; max: number; className?: string }) {
  const [range, rest] = bandLabel(low, high, max).split(" of ");
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className="font-extrabold text-foreground">{range}</span>
      <span className="font-semibold text-muted-foreground"> of {rest}</span>
    </span>
  );
}
