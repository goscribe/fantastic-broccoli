import { MAX_TRACK_CELLS, bandCells, bandSpan, bandSpoken, formatBand, predictionSpan, predictionSpoken, type Prediction } from "@/lib/coursework";
import { cn } from "@/lib/utils";

/**
 * A criterion's band drawn on a small scale: one cell per mark (a single bar
 * above 12 marks). The band's cells are raised and lightly filled in the
 * subject's colour; with `mark`, the best-estimate mark's cell is solid, so
 * the estimate reads as a point inside its band. The numbers are always
 * written beside the track by the caller, so nothing is told by colour
 * alone. With `scale`, the marks are numbered under the track.
 */
export function BandTrack({ low, high, max, mark, faint, scale, className }: { low: number; high: number; max: number; /** The best-estimate mark inside the band. */ mark?: number; /** An earlier draft's band: outlined, not filled. */ faint?: boolean; /** Number the marks under the track. */ scale?: boolean; className?: string }) {
  const label = mark === undefined ? bandSpoken(low, high, max) : `${mark} out of ${max}, band ${low === high ? low : `${low} to ${high}`}`;
  if (max > MAX_TRACK_CELLS) {
    const { start, end } = bandSpan(low, high, max);
    const at = mark === undefined ? null : Math.min(100, Math.max(0, (mark / max) * 100));
    const marks = [0, Math.round(max / 2), max];
    return (
      <span role="img" aria-label={label} className={cn("block", className)}>
        <span className="cw-track relative block h-3">
          <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--muted)]" />
          <span className={cn("absolute top-0 h-3 rounded-full", faint ? "cw-fill--faint" : at === null ? "cw-fill" : "cw-fill--soft")} style={{ left: `${start}%`, width: `${Math.max(2, end - start)}%` }} />
          {at !== null && !faint && <span className="cw-fill absolute top-[-2px] h-4 w-1.5 -translate-x-1/2 rounded-full" style={{ left: `${at}%` }} />}
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
  const cell = (i: number, on: boolean) => {
    if (!on) return "h-1.5 bg-[var(--muted)]";
    if (faint) return "cw-fill--faint h-3";
    if (mark === undefined || i + 1 === mark) return "cw-fill h-3";
    return "cw-fill--soft h-3";
  };
  return (
    <span role="img" aria-label={label} className={cn("block", className)}>
      <span className="cw-track flex h-3 items-center gap-[3px]">
        {cells.map((on, i) => (
          <span key={i} className={cn("min-w-0 flex-1 rounded-[3px]", cell(i, on))} />
        ))}
      </span>
      {scale && (
        // Each number sits under the right edge of its mark's cell; 0 is the track's left end.
        <span className="relative mt-1 flex gap-[3px] text-caption font-bold tabular-nums text-muted-foreground" aria-hidden>
          <span className="absolute left-0 top-0">0</span>
          {cells.map((on, i) => (
            <span key={i} className={cn("min-w-0 flex-1 text-right", on && "text-foreground", mark === i + 1 && "font-extrabold")}>
              {i + 1}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** "4 of 6" with "band 3–4" beside it when there is a best-estimate mark; "4–5 of 6" for a band alone. */
export function BandNumber({ low, high, max, mark, className }: { low: number; high: number; max: number; mark?: number; className?: string }) {
  if (mark !== undefined) {
    return (
      <span className={cn("whitespace-nowrap tabular-nums", className)}>
        <span className="font-extrabold text-foreground">{mark}</span>
        <span className="font-semibold text-muted-foreground"> of {max}</span>
        {low !== high && <span className="text-small font-semibold text-muted-foreground"> · band {formatBand(low, high)}</span>}
      </span>
    );
  }
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className="font-extrabold text-foreground">{formatBand(low, high)}</span>
      <span className="font-semibold text-muted-foreground"> of {max}</span>
    </span>
  );
}

/**
 * The predicted total on one bar: filled to the estimate, with the narrow
 * likely range drawn faintly around it. Never the sum of the bands.
 */
export function PredictionTrack({ prediction, className }: { prediction: Prediction; className?: string }) {
  const { fill, low, high } = predictionSpan(prediction);
  return (
    <span role="img" aria-label={predictionSpoken(prediction)} className={cn("block", className)}>
      <span className="cw-track relative block h-3">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--muted)]" />
        {high > low && <span className="cw-fill--range absolute top-0 h-3 rounded-full" style={{ left: `${low}%`, width: `${high - low}%` }} />}
        <span className="cw-fill absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ width: `${fill}%` }} />
        <span className="cw-fill cw-point absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${fill}%` }} />
      </span>
    </span>
  );
}

/** "16 of 20" with "likely 15–17" after it: the predicted total as written beside a track. */
export function PredictionNumber({ prediction, className }: { prediction: Prediction; className?: string }) {
  const { estimate, low, high, max } = prediction;
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      <span className="font-extrabold text-foreground">{estimate}</span>
      <span className="font-semibold text-muted-foreground"> of {max}</span>
      {low !== high && (
        <span className="font-semibold text-muted-foreground">
          {" "}
          · likely {low}–{high}
        </span>
      )}
    </span>
  );
}
