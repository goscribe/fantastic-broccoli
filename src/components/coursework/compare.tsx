"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { Sheet } from "@/components/notes-app/sheet";
import { courseworkApi, type GradeResult, type Review } from "@/lib/api/coursework";
import { compareDrafts, comparisonHeadline, formatBand, type Movement } from "@/lib/coursework";
import { cn } from "@/lib/utils";
import { BandNumber, BandTrack } from "./band-track";
import { useCw } from "./use-cw";

/** Up, down or the same, as a word with an arrow: never by colour alone. */
function Move({ move }: { move: Movement | "new" }) {
  const { t } = useCw();
  const Icon = move === "up" ? ArrowUp : move === "down" ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-small font-extrabold", move === "up" ? "text-emerald-700" : move === "down" ? "text-rose-700" : "text-muted-foreground")}>
      {move !== "new" && <Icon className="size-3.5" strokeWidth={3} aria-hidden />}
      {t(move === "up" ? "cw.cmp.up" : move === "down" ? "cw.cmp.down" : move === "new" ? "cw.cmp.new" : "cw.cmp.same")}
    </span>
  );
}

/** Which criteria moved between two drafts, at a glance: the earlier band outlined above the new one. */
export function DraftComparisonView({ before, after, fromDraft, toDraft }: { before: GradeResult; after: GradeResult; fromDraft: number; toDraft: number }) {
  const { t } = useCw();
  const cmp = compareDrafts(before, after);
  if (!cmp) return <p className="text-ui text-muted-foreground">{t("cw.cmp.none")}</p>;
  const o = cmp.overall;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="flex items-baseline gap-2.5 text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
          <span className="text-muted-foreground">{formatBand(o.from.marksLow, o.from.marksHigh)}</span>
          <ArrowRight className="size-6 shrink-0 self-center text-muted-foreground" strokeWidth={2.6} aria-label="to" />
          <span>{formatBand(o.to.marksLow, o.to.marksHigh)}</span>
          <span className="text-ui font-bold tracking-normal text-muted-foreground">{t("cw.ofMarks", { n: o.to.totalMarks })}</span>
        </p>
        <Move move={o.move} />
      </div>
      <p className="mt-2 text-ui font-bold text-foreground">{comparisonHeadline(cmp)}</p>
      <ul className="mt-5 divide-y divide-border border-t border-border">
        {cmp.rows.map((r) => (
          <li key={r.letter} className="py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-ui font-extrabold text-foreground">
                <span className="text-muted-foreground">{r.letter}</span> {r.name}
              </p>
              <Move move={r.move} />
            </div>
            <div className="mt-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              {r.from && (
                <>
                  <span className="text-small font-bold text-muted-foreground">{t("cw.cmp.was", { n: fromDraft })}</span>
                  <BandTrack low={r.from.low} high={r.from.high} max={r.maxMarks} faint />
                  <span className="text-right text-small font-bold tabular-nums text-muted-foreground">{formatBand(r.from.low, r.from.high)}</span>
                </>
              )}
              <span className="text-small font-extrabold text-foreground">{t("cw.cmp.was", { n: toDraft })}</span>
              <BandTrack low={r.to.low} high={r.to.high} max={r.maxMarks} />
              <BandNumber low={r.to.low} high={r.to.high} max={r.maxMarks} className="text-right text-small" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompareSheet({ current, previousId, fromDraft, toDraft, onClose }: { current: Review; previousId: string; /** The two drafts' places in the student's history ("Draft 1 → Draft 2"). */ fromDraft: number; toDraft: number; onClose: () => void }) {
  const { t } = useCw();
  const [prev, setPrev] = useState<Review | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    courseworkApi
      .review(previousId)
      .then((r) => !cancelled && setPrev(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [previousId]);
  return (
    <Sheet title={t("cw.cmp.title", { a: fromDraft, b: toDraft })} onClose={onClose} labelId="cw-compare-title">
      <div className="cw-scope">
        {failed ? (
          <p className="text-ui text-muted-foreground" role="alert">{t("cw.loadFailed")}</p>
        ) : !prev || !prev.result || !current.result ? (
          <p className="text-ui text-muted-foreground" aria-busy="true">{t("cw.cmp.loading")}</p>
        ) : (
          <DraftComparisonView before={prev.result} after={current.result} fromDraft={fromDraft} toDraft={toDraft} />
        )}
      </div>
    </Sheet>
  );
}
