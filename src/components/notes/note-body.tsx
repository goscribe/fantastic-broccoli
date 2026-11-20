"use client";

import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { NoteBlock, NoteFigure, TopicNoteContent } from "@/lib/api/notes";
import { editNote, figureNumbers, tidyMath, type BlockFlags } from "@/lib/notes";
import { InlineMarkdown } from "@/components/ui/markdown-text";
import { HtmlWidget } from "@/components/interactive/html-widget";
import { ExpressionGraph } from "@/components/interactive/desmos";
import { NoteGraph, graphSupported } from "@/components/notes/note-graph";
import { InteractiveWidget, widgetRegistry, type WidgetId } from "@/components/interactive";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/notes";

/**
 * Renders a Scribe topic note: calm and flat, one neutral callout style,
 * definition cards per section, worked examples, figures, tables that stack
 * on phones, and recall questions with a mark scheme behind a toggle.
 *
 * With `onChange`, every text becomes an editable field (the review page);
 * structure stays fixed. `flags` marks blocks the fact-check or lint flagged.
 */
export function NoteBody({
  note,
  onChange,
  flags,
  figureExtra,
}: {
  note: TopicNoteContent;
  onChange?: (next: TopicNoteContent) => void;
  flags?: Map<string, BlockFlags>;
  /** Extra content under a figure (review: QA thumbnails). */
  figureExtra?: (figure: NoteFigure) => ReactNode;
}) {
  const { t } = useI18n();
  const figures = new Map(note.figures.map((f) => [f.id, f]));
  const numbers = figureNumbers(note);
  const edit = (mutate: (d: TopicNoteContent) => void) => onChange?.(editNote(note, mutate));
  const field = (value: string, set: (d: TopicNoteContent, v: string) => void, className?: string) =>
    onChange ? (
      <EditField value={value} onChange={(v) => edit((d) => set(d, v))} className={className} />
    ) : (
      <InlineMarkdown text={tidyMath(value)} />
    );

  return (
    <div className="text-[16px] leading-[1.65] text-foreground sm:text-[17px]">
      <div className="rounded-xl bg-muted/50 px-4 py-3">
        <p className="text-[12.5px] font-semibold text-muted-foreground">{t("notes.objective")}</p>
        <p className="mt-0.5 text-[15px] leading-snug sm:text-[16px]">
          {field(note.objectiveLine, (d, v) => (d.objectiveLine = v))}
        </p>
      </div>

      {note.sections.map((s, si) => {
        const terms = note.keyTerms.map((k, ki) => ({ k, ki })).filter(({ k }) => k.sectionId === s.id);
        return (
          <section key={s.id} className="mt-9 scroll-mt-20 first-of-type:mt-7" aria-labelledby={`h-${s.id}`} id={`sec-${s.id}`}>
            <Flagged id={`${s.id}.heading`} flags={flags}>
              <h2 id={`h-${s.id}`} className="text-[19px] font-semibold leading-snug tracking-[-0.01em] sm:text-[21px]">
                {field(s.heading, (d, v) => (d.sections[si].heading = v))}
              </h2>
            </Flagged>
            <div className="mt-3 flex flex-col gap-4">
              {s.blocks.map((b, bi) => (
                <Flagged key={bi} id={`${s.id}.b${bi + 1}`} flags={flags}>
                  <Block
                    block={b}
                    figure={b.type === "figure" ? figures.get(b.figureId) : undefined}
                    number={b.type === "figure" ? numbers.get(b.figureId) : undefined}
                    field={(value, set, className) =>
                      field(value, (d, v) => set(d.sections[si].blocks[bi] as never, v), className)
                    }
                    figureExtra={figureExtra}
                  />
                </Flagged>
              ))}
            </div>
            {terms.length > 0 && (
              <Flagged id="terms" flags={si === 0 ? flags : undefined}>
                {/* Phones: a swipeable row so cards don't stack into a long column. */}
                <div
                  className={cn(
                    "mt-4 gap-2",
                    onChange
                      ? "grid sm:grid-cols-2"
                      : "-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0",
                  )}
                >
                  {terms.map(({ k, ki }) => (
                    <div
                      key={ki}
                      className={cn(
                        "rounded-xl border border-border bg-card px-4 py-3",
                        !onChange && (terms.length > 1 ? "w-[80%] shrink-0 snap-start sm:w-auto" : "w-full shrink-0 sm:w-auto"),
                      )}
                    >
                      <p className="text-[15px] font-semibold leading-snug">
                        {field(k.term, (d, v) => (d.keyTerms[ki].term = v))}
                      </p>
                      <p className="mt-0.5 text-[14.5px] leading-snug text-muted-foreground">
                        {field(k.definition, (d, v) => (d.keyTerms[ki].definition = v))}
                      </p>
                    </div>
                  ))}
                </div>
              </Flagged>
            )}
          </section>
        );
      })}

      {note.recall.length > 0 && <Recall note={note} field={field} flags={flags} edit={!!onChange} />}
    </div>
  );
}


function Block({
  block,
  figure,
  number,
  field,
  figureExtra,
}: {
  block: NoteBlock;
  figure?: NoteFigure;
  number?: number;
  field: (value: string, set: (b: Record<string, unknown>, v: string) => void, className?: string) => ReactNode;
  figureExtra?: (figure: NoteFigure) => ReactNode;
}) {
  const { t } = useI18n();
  switch (block.type) {
    case "paragraph":
      return <p>{field(block.text, (b, v) => (b.text = v))}</p>;
    case "bullets":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-faint">
          {block.items.map((it, i) => (
            <li key={i}>
              {field(it.text, (b, v) => ((b.items as typeof block.items)[i].text = v))}
              {it.sub.length > 0 && (
                <ul className="mt-1.5 flex list-[circle] flex-col gap-1 pl-5 marker:text-faint">
                  {it.sub.map((sub, j) => (
                    <li key={j}>{field(sub, (b, v) => ((b.items as typeof block.items)[i].sub[j] = v))}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <aside className="rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {t(block.kind === "mistake" ? "notes.mistake" : "notes.tip")}
          </p>
          <p className="mt-1 text-[15.5px] leading-snug sm:text-[16px]">{field(block.text, (b, v) => (b.text = v))}</p>
        </aside>
      );
    case "example":
      return (
        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {t("notes.workedExample")}
          </p>
          <p className="mt-1 font-semibold leading-snug">{field(block.title, (b, v) => (b.title = v))}</p>
          <p className="mt-2">{field(block.problem, (b, v) => (b.problem = v))}</p>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 marker:font-semibold marker:text-faint">
            {block.steps.map((st, i) => (
              <li key={i}>{field(st, (b, v) => ((b.steps as string[])[i] = v))}</li>
            ))}
          </ol>
          <p className="mt-3 border-t border-border pt-3">
            <span className="font-semibold">{t("notes.answer")}: </span>
            {field(block.answer, (b, v) => (b.answer = v))}
          </p>
        </div>
      );
    case "table":
      return <NoteTable block={block} field={field} />;
    case "deeper":
      return (
        <details className="group rounded-xl border border-border px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-semibold">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t("notes.goDeeper")}</span>
            <span className="min-w-0 flex-1">{field(block.title, (b, v) => (b.title = v))}</span>
            <ChevronDown className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {block.paragraphs.map((p, i) => (
              <p key={i}>{field(p, (b, v) => ((b.paragraphs as string[])[i] = v))}</p>
            ))}
          </div>
        </details>
      );
    case "figure":
      if (!figure) return null;
      return (
        <figure className="flex flex-col gap-2">
          <FigureView figure={figure} />
          <figcaption className="text-[14px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{t("notes.figure").replace("{n}", String(number ?? 1))}.</span>{" "}
            <InlineMarkdown text={tidyMath(figure.caption)} />
          </figcaption>
          {figureExtra?.(figure)}
        </figure>
      );
  }
}

function NoteTable({
  block,
  field,
}: {
  block: Extract<NoteBlock, { type: "table" }>;
  field: (value: string, set: (b: Record<string, unknown>, v: string) => void) => ReactNode;
}) {
  const cell = (ri: number, ci: number) =>
    field(block.rows[ri][ci], (b, v) => ((b.rows as string[][])[ri][ci] = v));
  const head = (ci: number) => field(block.headers[ci], (b, v) => ((b.headers as string[])[ci] = v));
  return (
    <div>
      {block.caption && <p className="mb-2 text-[14px] font-semibold text-muted-foreground">{field(block.caption, (b, v) => (b.caption = v))}</p>}
      <table className="hidden w-full border-collapse text-[15.5px] leading-snug sm:table">
        <thead>
          <tr>
            {block.headers.map((_, ci) => (
              <th key={ci} className="border-b border-border-strong px-3 py-2 text-left font-semibold first:pl-0">
                {head(ci)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((_, ci) => (
                <td key={ci} className={cn("border-b border-border px-3 py-2 align-top first:pl-0", ci === 0 && "font-semibold")}>
                  {cell(ri, ci)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: each row becomes a small card of header: value pairs. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {block.rows.map((r, ri) => (
          <dl key={ri} className="rounded-xl border border-border px-4 py-3 text-[15px] leading-snug">
            <dt className="sr-only">{block.headers[0]}</dt>
            <dd className="font-semibold">{cell(ri, 0)}</dd>
            {r.slice(1).map((_, k) => (
              <Fragment key={k}>
                <dt className="mt-2 text-[12.5px] font-semibold text-muted-foreground">{head(k + 1)}</dt>
                <dd>{cell(ri, k + 1)}</dd>
              </Fragment>
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}

export function FigureView({ figure }: { figure: NoteFigure }) {
  if (figure.kind === "widget" && figure.widgetId && figure.widgetId in widgetRegistry)
    return <InteractiveWidget id={figure.widgetId as WidgetId} />;
  if (figure.kind === "graph" && figure.graph && graphSupported(figure.graph))
    return <NoteGraph graph={figure.graph} title={figure.title} />;
  if (figure.kind === "graph" && figure.graph)
    return (
      <ExpressionGraph
        title={figure.title}
        xLabel={figure.graph.xLabel}
        yLabel={figure.graph.yLabel}
        expressions={figure.graph.expressions}
        bounds={figure.graph.bounds}
      />
    );
  if (figure.kind === "html" && figure.html)
    return (
      <div role="img" aria-label={figure.alt}>
        <HtmlWidget html={figure.html} title={figure.title} surface="reading_figure" />
      </div>
    );
  return null;
}

function Recall({
  note,
  field,
  flags,
  edit,
}: {
  note: TopicNoteContent;
  field: (value: string, set: (d: TopicNoteContent, v: string) => void) => ReactNode;
  flags?: Map<string, BlockFlags>;
  edit: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Set<string>>(new Set());
  return (
    <section className="mt-12 scroll-mt-20 border-t border-border pt-8" aria-labelledby="h-recall" id="sec-recall">
      <h2 id="h-recall" className="text-[19px] font-semibold leading-snug sm:text-[21px]">
        {t("notes.recallHeading")}
      </h2>
      <p className="mt-1 text-[14.5px] text-muted-foreground">{t("notes.recallHint")}</p>
      <ol className="mt-5 flex flex-col gap-4">
        {note.recall.map((q, qi) => {
          const shown = edit || open.has(q.id);
          return (
            <li key={q.id}>
              <Flagged id={q.id} flags={flags}>
                <div className="flex gap-3">
                  <span className="w-5 shrink-0 font-semibold tabular-nums text-faint">{qi + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p>
                      {field(q.question, (d, v) => (d.recall[qi].question = v))}{" "}
                      <span className="whitespace-nowrap font-semibold text-muted-foreground" aria-label={t("notes.marks").replace("{marks}", String(q.marks))}>
                        [{q.marks}]
                      </span>
                    </p>
                    {!edit && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpen((s) => {
                            const n = new Set(s);
                            if (n.has(q.id)) n.delete(q.id);
                            else n.add(q.id);
                            return n;
                          })
                        }
                        aria-expanded={shown}
                        className="mt-1.5 inline-flex min-h-9 items-center gap-1 text-[14px] font-semibold text-accent hover:text-accent-dim"
                      >
                        {t(shown ? "notes.hideAnswer" : "notes.showAnswer")}
                        <ChevronDown className={cn("size-4 transition-transform", shown && "rotate-180")} />
                      </button>
                    )}
                    {shown && (
                      <div className="mt-2 rounded-xl bg-muted/50 px-4 py-3 text-[15px] leading-snug sm:text-[15.5px]">
                        <p className="text-[12.5px] font-semibold text-muted-foreground">{t("notes.modelAnswer")}</p>
                        <p className="mt-0.5">{field(q.modelAnswer, (d, v) => (d.recall[qi].modelAnswer = v))}</p>
                        <ul className="mt-2.5 flex flex-col gap-1">
                          {q.markPoints.map((m, mi) => (
                            <li key={mi} className="flex gap-2">
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent/60" />
                              <span className="min-w-0 flex-1">
                                1 mark for {field(m, (d, v) => (d.recall[qi].markPoints[mi] = v))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Flagged>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Anchor for a block; in review, an amber edge and a count where checks flagged it. */
function Flagged({ id, flags, children }: { id: string; flags?: Map<string, BlockFlags>; children: ReactNode }) {
  const f = flags?.get(id);
  if (!flags) return <>{children}</>;
  const open = f ? f.flagged + f.lint : 0;
  return (
    <div id={`loc-${id}`} className={cn("relative scroll-mt-24", f && "-ml-3 border-l-2 pl-[10px]", open ? "border-amber" : f ? "border-sky" : "")}>
      {f && (
        <span
          className={cn(
            "float-right ml-2 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            open ? "bg-amber/15 text-[#92400e]" : "bg-sky/15 text-[#075985]",
          )}
        >
          {[f.flagged ? `${f.flagged} to check` : "", f.fixed ? `${f.fixed} auto-fixed` : "", f.lint ? `${f.lint} style` : ""]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      {children}
    </div>
  );
}

function EditField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full resize-none rounded-md border border-dashed border-border-strong bg-transparent px-1.5 py-0.5 font-[inherit] text-[inherit] leading-[inherit] focus:border-accent focus:outline-none",
        className,
      )}
    />
  );
}
