"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CitationsResult, GradeResult, ResultCriterion } from "@/lib/api/coursework";
import { citationHeadline, citationItems, criterionComment, criterionFor, criterionMark, criterionNext, hasMarks, quoteChanged, type CitationItem } from "@/lib/coursework";
import { cn } from "@/lib/utils";
import { BandNumber, BandTrack } from "./band-track";
import { useCw } from "./use-cw";

/** What the feedback needs from the place it is shown in (the editor beside it, or nothing for a read-only sample). */
export interface FeedbackHost {
  /** The document as it is now: a quote no longer in it is "edited since this review". Null when there is no live document. */
  text: string | null;
  /** Shows a quoted passage in the document; absent when quotes cannot be followed. */
  onShowQuote?: (anchorId: string) => void;
  /** The feedback item a tapped passage belongs to: it opens and scrolls into view. */
  open?: { kind: "criterion"; letter: string } | { kind: "citation"; id: string } | null;
  /** Opens the guide at a criterion's part. */
  onGuide?: (letter: string) => void;
  /** Where each quoted passage is, by anchor id, as it should read ("In Method" for text, "p. 4" for a PDF): a chip that jumps there. */
  places?: Map<string, string>;
}

/** Where a passage is, as a small chip that jumps to it. */
function Place({ label, onClick }: { label: string; onClick?: () => void }) {
  const cls = "cw-place inline-flex min-h-7 items-center rounded-full px-2.5 text-caption font-extrabold";
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} title={label}>
      {label}
    </button>
  ) : (
    <span className={cls}>{label}</span>
  );
}

/** A quotation from the student's own text: their words, set apart, in the subject's colour. */
function Quote({ quote, changed, onShow, small }: { quote: string; changed: boolean; onShow?: () => void; small?: boolean }) {
  const { t } = useCw();
  const body = (
    <span className={cn("cw-quote block text-left font-semibold text-foreground", small ? "text-small" : "text-ui", changed && "cw-quote--changed")}>
      “{quote.replace(/^["“”]+|["“”]+$/g, "")}”
    </span>
  );
  return (
    <span className="block">
      {onShow && !changed ? (
        <button type="button" onClick={onShow} title={t("cw.quote.show")} className="cw-quote-btn flex min-h-11 w-full items-center rounded-[6px] text-left">
          {body}
          <span className="sr-only">{t("cw.quote.show")}</span>
        </button>
      ) : (
        body
      )}
      {changed && <span className="mt-1 block pl-[15px] text-small font-bold text-muted-foreground">{t("cw.quote.changed")}</span>}
    </span>
  );
}

/* ---------- The three fixes: the page's main content, not a card ---------- */

export function TopFixes({ result, onOpenCriterion, host }: { result: GradeResult; onOpenCriterion?: (letter: string) => void; host?: FeedbackHost }) {
  const { t } = useCw();
  return (
    <section aria-labelledby="cw-fixes">
      <h2 id="cw-fixes" className="page-h2">
        {t("cw.fixes")}
      </h2>
      <ol className="mt-4 flex flex-col gap-5">
        {result.topFixes.slice(0, 3).map((fix, i) => {
          const c = criterionFor(result, fix.criterion);
          const where = c ? t("cw.fixes.criterion", { a: c.letter, name: c.name }) : null;
          // The places this fix is about: where its criterion's quoted passages are (each place once).
          const places = c && host?.places ? c.evidence.map((_, k) => ({ id: `${c.letter}-${k}`, label: host.places!.get(`${c.letter}-${k}`) })).filter((x, k, all) => x.label && all.findIndex((y) => y.label === x.label) === k) : [];
          return (
            <li key={i} className="life-rise flex gap-3.5" style={{ ["--i" as string]: i + 1 }}>
              <span className="cw-num mt-[1px] shrink-0" aria-hidden>
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-read font-extrabold leading-snug text-foreground">{fix.title}</h3>
                <p className="mt-1 text-ui text-foreground/80">{fix.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  {where &&
                    (onOpenCriterion ? (
                      <button type="button" onClick={() => onOpenCriterion(c!.letter)} className="-my-2 inline-flex min-h-11 items-center text-small font-bold text-muted-foreground underline decoration-border-strong decoration-2 underline-offset-4 hover:text-foreground">
                        {where}
                      </button>
                    ) : (
                      <span className="text-small font-bold text-muted-foreground">{where}</span>
                    ))}
                  {places.map((pl) => (
                    <Place key={pl.id} label={pl.label!} onClick={host?.onShowQuote ? () => host.onShowQuote!(pl.id) : undefined} />
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- One criterion: a separate item, so a card ---------- */

export function CriterionCard({
  criterion: c,
  marked,
  host,
  defaultOpen,
  collapsible,
}: {
  criterion: ResultCriterion;
  /** Show the band (a marked review whose marks are not hidden). */
  marked: boolean;
  host: FeedbackHost;
  defaultOpen: boolean;
  /** Phones: the evidence folds away so every band is visible in one scroll. */
  collapsible: boolean;
}) {
  const { t } = useCw();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const targeted = host.open?.kind === "criterion" && host.open.letter === c.letter;
  // A passage tapped in the document opens its criterion (state adjusted while rendering, not in an effect) and brings it into view.
  const [seen, setSeen] = useState<FeedbackHost["open"]>(null);
  if (targeted && seen !== host.open) {
    setSeen(host.open);
    setOpen(true);
  }
  useEffect(() => {
    if (!targeted) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [targeted, host.open]);

  const band = marked && "bandLow" in c ? { low: c.bandLow, high: c.bandHigh, mark: criterionMark(c) } : null;
  const changed = host.text === null ? [] : c.evidence.map((e) => quoteChanged(host.text!, e.quote));
  const anyChanged = changed.some(Boolean);
  const atTop = band ? band.high >= c.maxMarks : false;
  const shown = open || !collapsible;
  const id = `cw-crit-${c.letter}`;

  return (
    <article ref={ref} id={id} className={cn("life-card scroll-mt-24 px-4 py-4 sm:px-5", targeted && "cw-targeted")} aria-labelledby={`${id}-h`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`${id}-h`} className="min-w-0 text-ui font-extrabold leading-snug text-foreground">
          <span className="text-muted-foreground">{c.letter}</span> {c.name}
        </h3>
        {band && <BandNumber low={band.low} high={band.high} mark={band.mark} max={c.maxMarks} className="text-ui" />}
      </div>
      {band && <BandTrack low={band.low} high={band.high} mark={band.mark} max={c.maxMarks} scale className="mt-2" />}
      {anyChanged && <p className="mt-2.5 text-small font-bold text-muted-foreground">{t("cw.changed")}</p>}
      <p className={cn("mt-3 text-ui text-foreground/80", !shown && "line-clamp-2")}>{criterionComment(c)}</p>

      {shown && (
        <>
          {c.evidence.length > 0 && (
            <div className="mt-4">
              <p className="text-small font-extrabold text-foreground">{t("cw.crit.evidence")}</p>
              <ul className="mt-2 flex flex-col gap-3">
                {c.evidence.map((e, i) => (
                  <li key={i}>
                    <Quote quote={e.quote} changed={changed[i] ?? false} onShow={host.onShowQuote ? () => host.onShowQuote!(`${c.letter}-${i}`) : undefined} />
                    <p className="mt-1 pl-[15px] text-small text-muted-foreground">
                      {e.comment}
                      {!changed[i] && host.places?.get(`${c.letter}-${i}`) && (
                        <>
                          {" "}
                          <Place label={host.places.get(`${c.letter}-${i}`)!} onClick={host.onShowQuote ? () => host.onShowQuote!(`${c.letter}-${i}`) : undefined} />
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <p className="text-small font-extrabold text-foreground">{band ? (atTop ? t("cw.crit.top") : t("cw.crit.moveUp")) : t("cw.crit.improve")}</p>
            <p className="mt-1 text-ui text-foreground/80">{criterionNext(c)}</p>
          </div>
          {host.onGuide && (
            <button type="button" onClick={() => host.onGuide!(c.letter)} className="-mb-2 mt-1 inline-flex min-h-11 items-center text-small font-bold text-muted-foreground underline decoration-border-strong decoration-2 underline-offset-4 hover:text-foreground">
              {t("cw.crit.guide")}
            </button>
          )}
        </>
      )}
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="-mx-2 -mb-2 mt-2 flex min-h-11 w-[calc(100%+16px)] items-center justify-between rounded-[12px] px-2 text-small font-extrabold text-foreground hover:bg-muted"
        >
          {open ? t("cw.crit.hide") : t("cw.crit.show")}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    </article>
  );
}

/* ---------- Citations ---------- */

function CitationRow({ item, host }: { item: CitationItem; host: FeedbackHost }) {
  const { t } = useCw();
  const ref = useRef<HTMLLIElement>(null);
  const targeted = host.open?.kind === "citation" && host.open.id === item.id;
  useEffect(() => {
    if (!targeted) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [targeted, host.open]);
  const followable = item.kind === "uncited" || item.kind === "cited_not_listed";
  const changed = followable && host.text !== null && !!item.quote && quoteChanged(host.text, item.quote);
  return (
    <li ref={ref} className={cn("scroll-mt-24 py-4 first:pt-0 last:pb-0", targeted && "cw-targeted-row")}>
      <p className="text-small font-extrabold text-foreground">{item.label}</p>
      {item.quote && (
        <div className="mt-1.5">
          <Quote quote={item.quote} small changed={changed} onShow={followable && host.onShowQuote ? () => host.onShowQuote!(`cite-${item.id}`) : undefined} />
        </div>
      )}
      <p className="mt-1.5 text-ui text-foreground/80">
        {!item.quote && <>{item.problem} </>}
        <span className="font-bold text-foreground">{t("cw.cite.fix")}:</span> {item.fix}
      </p>
      {item.format && (
        <p className="mt-2 border-l-[3px] border-border-strong pl-3 text-small text-foreground">
          <span className="block font-extrabold">{t("cw.cite.format")}</span>
          <span className="mt-0.5 block">{item.format}</span>
        </p>
      )}
    </li>
  );
}

export function CitationsCard({ citations, host }: { citations: CitationsResult; host: FeedbackHost }) {
  const { t } = useCw();
  const items = useMemo(() => citationItems(citations), [citations]);
  const [all, setAll] = useState(false);
  const targetId = host.open?.kind === "citation" ? host.open.id : null;
  const targetHidden = !!targetId && items.findIndex((i) => i.id === targetId) >= 3;
  const shown = all || targetHidden ? items : items.slice(0, 3);
  const style = citations.style === "None" || citations.style === "Unknown" ? t("cw.cite.styleNone") : t("cw.cite.style", { style: citations.style === "Other" ? "Mixed" : citations.style });
  const hasFormat = items.some((i) => i.format);
  return (
    <section className="life-card p-5" aria-labelledby="cw-cite-h">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="cw-cite-h" className="text-ui font-extrabold text-foreground">
          {t("cw.cite.title")}
        </h3>
        <span className="text-ui font-extrabold text-foreground">{citationHeadline(items.length)}</span>
      </div>
      <p className="mt-1 text-small text-muted-foreground">
        {style} · {t("cw.cite.counts", { a: citations.counts.inText, b: citations.counts.entries })}
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-ui text-foreground/80">{citations.modelChecked ? t("cw.cite.clean") : t("cw.cite.partial")}</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border">
            {shown.map((item) => (
              <CitationRow key={item.id} item={item} host={host} />
            ))}
          </ul>
          {items.length > 3 && !targetHidden && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
              className="-mx-2 -mb-2 mt-2 flex min-h-11 w-[calc(100%+16px)] items-center justify-between rounded-[12px] px-2 text-small font-extrabold text-foreground hover:bg-muted"
            >
              {all ? t("cw.cite.less") : t("cw.cite.all", { n: items.length })}
              <ChevronDown className={cn("size-4 transition-transform", all && "rotate-180")} aria-hidden />
            </button>
          )}
          {hasFormat && (all || targetHidden) && <p className="mt-3 text-small text-muted-foreground">{t("cw.cite.formatNote")}</p>}
          {!citations.modelChecked && <p className="mt-3 text-small text-muted-foreground">{t("cw.cite.partial")}</p>}
        </>
      )}
    </section>
  );
}

/* ---------- The whole of one review's feedback ---------- */

export function Feedback({
  result,
  citations,
  hideMarks,
  host,
  phone,
  footer,
  summary,
  onNextSteps,
}: {
  /** The compact overall result that opens the feedback. */
  summary?: React.ReactNode;
  /** Opens the Next steps tab. */
  onNextSteps?: () => void;
  result: GradeResult;
  citations: CitationsResult | null;
  /** The student chose not to see marks on a marked review. */
  hideMarks: boolean;
  host: FeedbackHost;
  /** Phones fold each criterion's evidence away. */
  phone: boolean;
  footer?: React.ReactNode;
}) {
  const { t } = useCw();
  const marked = hasMarks(result) && !hideMarks;
  const [openLetter, setOpenLetter] = useState<{ letter: string; n: number } | null>(null);
  // A fix's "Criterion C" link opens that card, as a tapped passage does.
  const merged: FeedbackHost = openLetter && !host.open ? { ...host, open: { kind: "criterion", letter: openLetter.letter } } : host;
  return (
    <div className="flex flex-col gap-7">
      {summary}
      {result.overall.summary && <p className="-mt-2 text-ui text-foreground">{result.overall.summary}</p>}
      {/* What the review could not see (images): said with the result, not left for the student to guess. */}
      {result.seen?.note && <p className="-mt-4 text-small text-muted-foreground" data-cw-unseen>{result.seen.note}</p>}
      {onNextSteps && (
        <button type="button" onClick={onNextSteps} className="-mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--r-control)] bg-muted px-4 text-left text-ui font-extrabold text-foreground hover:bg-border">
          {t(marked ? "cw.next.cta" : "cw.next.ctaFeedback")}
          <ChevronDown className="size-4 shrink-0 -rotate-90" aria-hidden />
        </button>
      )}
      <TopFixes result={result} host={host} onOpenCriterion={(letter) => setOpenLetter((p) => ({ letter, n: (p?.n ?? 0) + 1 }))} />
      <section aria-labelledby="cw-criteria">
        <h2 id="cw-criteria" className="page-h2">
          {t("cw.criteria")}
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {result.criteria.map((c, i) => (
            <CriterionCard key={`${c.letter}-${openLetter?.letter === c.letter ? openLetter.n : 0}`} criterion={c} marked={marked} host={merged} defaultOpen={!phone || i === 0 || openLetter?.letter === c.letter} collapsible={phone} />
          ))}
          {citations && <CitationsCard citations={citations} host={host} />}
        </div>
      </section>
      {footer}
    </div>
  );
}
