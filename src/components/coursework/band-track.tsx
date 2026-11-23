import { MAX_TRACK_CELLS, bandCells, bandLabel, bandSpan, bandSpoken } from "@/lib/coursework";
import { cn } from "@/lib/utils";

/**
 * A mark band drawn as a range on a small scale: one cell per mark with the
 * band's cells filled in the subject's colour (a single bar above 12 marks).
 * Filled cells are also taller, and the range is always written beside the
 * track by the caller, so nothing is told by colour alone. With `scale`, the
 * marks are numbered under the track.
 */
export function BandTrack({ low, high, max, faint, scale, className }: { low: number; high: number; max: number; /** An earlier draft's band: outlined, not filled. */ faint?: boolean; /** Number the marks under the track. */ scale?: boolean; className?: string }) {
  const label = bandSpoken(low, high, max);
  if (max > MAX_TRACK_CELLS) {
    const { start, end } = bandSpan(low, high, max);
    const marks = [0, Math.round(max / 2), max];
    return (
      <span role="img" aria-label={label} className={cn("block", className)}>
        <span className="cw-track relative block h-3">
          <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--muted)]" />
          <span className={cn("absolute top-0 h-3 rounded-full", faint ? "cw-fill--faint" : "cw-fill")} style={{ left: `${start}%`, width: `${Math.max(2, end - start)}%` }} />
        </span>
        {scale && (
          <span className="mt-1 flex justify-between text-caption font-bold tabular-nums text-muted-foreground" aria-hidden>
            {marks.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </span>
        )}
      </span>
    );
  }
  const cells = bandCells(low, high, max);
  return (
    <span role="img" aria-label={label} className={cn("block", className)}>
      <span className="cw-track flex h-3 items-center gap-[3px]">
        {cells.map((on, i) => (
          <span key={i} className={cn("min-w-0 flex-1 rounded-[3px]", on ? (faint ? "cw-fill--faint h-3" : "cw-fill h-3") : "h-1.5 bg-[var(--muted)]")} />
        ))}
      </span>
      {scale && (
        // Each number sits under the right edge of its mark's cell; 0 is the track's left end.
        <span className="relative mt-1 flex gap-[3px] text-caption font-bold tabular-nums text-muted-foreground" aria-hidden>
          <span className="absolute left-0 top-0">0</span>
          {cells.map((on, i) => (
            <span key={i} className={cn("min-w-0 flex-1 text-right", on && "text-foreground")}>
              {i + 1}
            </span>
          ))}
        </span>
      )}
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
