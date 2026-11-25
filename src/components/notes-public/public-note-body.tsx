import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import type { NoteBlock, NoteFigure, TopicNoteContent } from "@/lib/api/notes";
import { figureNumbers, recallMarks } from "@/lib/notes";
import { parseExpression } from "@/lib/latex-eval";
import { RichText } from "./rich-text";
import { PublicFigure } from "./public-figure";
import { WorkedExample } from "./worked-example";

/**
 * Server-rendered read view of a Scribe topic note for the public pages.
 * Every word and formula is in the HTML; the page reads in full with
 * JavaScript off. On top of that: key terms are chips that swap a definition
 * card (radio inputs, no script), worked examples reveal a step at a time,
 * figures sit on a tinted stage, and each section ends in a marker that
 * ticks when reached (see reading-progress.tsx). `after` injects nodes after
 * a section (by index), used for the inline quick checks.
 */
export function PublicNoteBody({ note, after }: { note: TopicNoteContent; after?: Map<number, ReactNode> }) {
  const figures = new Map(note.figures.map((f) => [f.id, f]));
  const numbers = figureNumbers(note);
  const total = note.sections.length;
  return (
    <div className="nl-prose">
      {note.sections.map((s, si) => {
        const terms = note.keyTerms.filter((k) => k.sectionId === s.id);
        return (
          <Fragment key={s.id}>
            <section className="mt-14 scroll-mt-20 first:mt-0 lg:scroll-mt-8" aria-labelledby={`h-${s.id}`} id={`sec-${s.id}`} data-nl-section={s.id}>
              <header data-nl-reveal="">
                {/* Numbered like a question on a paper; the box ticks once the part is read. */}
                <div className="flex items-start gap-3">
                  <span className="nl-secnum mt-[1px] sm:mt-1" aria-hidden="true">
                    <span>{si + 1}</span>
                    <Check strokeWidth={3.5} />
                  </span>
                  <h2 id={`h-${s.id}`} className="min-w-0 flex-1 text-[26px] font-extrabold leading-[1.14] text-foreground sm:text-[32px]">
                    <span className="sr-only">
                      Part {si + 1} of {total}:{" "}
                    </span>
                    <RichText text={s.heading} />
                  </h2>
                </div>
              </header>
              <div className="mt-4 flex flex-col gap-5">
                {s.blocks.map((b, bi) => (
                  <Block
                    key={bi}
                    block={b}
                    lead={si === 0 && bi === 0}
                    figure={b.type === "figure" ? figures.get(b.figureId) : undefined}
                    number={b.type === "figure" ? numbers.get(b.figureId) : undefined}
                  />
                ))}
              </div>
              {terms.length > 0 && <KeyTerms sectionId={s.id} terms={terms} />}
              <p className="nl-secend" aria-hidden="true">
                <i>
                  <Check strokeWidth={3.5} />
                </i>
                <b>{si + 1 === total ? "Note read" : `Part ${si + 1} done`}</b>
              </p>
            </section>
            {after?.get(si)}
          </Fragment>
        );
      })}

      {note.recall.length > 0 && <Recall note={note} />}
    </div>
  );
}

/**
 * Key terms as tappable chips with one definition card (the tallest sets the
 * height, so swapping never moves the page). Radio inputs and CSS only; every
 * definition is in the HTML. One term is simply a card.
 */
function KeyTerms({ sectionId, terms }: { sectionId: string; terms: TopicNoteContent["keyTerms"] }) {
  const card = (k: (typeof terms)[number], i: number) => (
    <div key={i} data-i={i} className="nl-card px-4 py-3.5 sm:px-5">
      <p className="text-read font-extrabold text-foreground">
        <span className="hl-mark">
          <RichText text={k.term} />
        </span>
      </p>
      <p className="mt-1.5 text-read text-foreground/80">
        <RichText text={k.definition} />
      </p>
    </div>
  );
  const many = terms.length > 1 && terms.length <= 8;
  return (
    <div className="mt-6" data-nl-reveal="">
      <p className="text-small font-extrabold text-foreground">
        {terms.length > 1 ? "Key terms" : "Key term"}
        {many && <span className="font-bold text-muted-foreground"> · tap one for its definition</span>}
      </p>
      {many ? (
        <div className="nl-terms mt-2.5" role="radiogroup" aria-label="Key terms">
          <div className="flex flex-wrap gap-2 pb-1">
            {terms.map((k, i) => (
              <Fragment key={i}>
                <input type="radio" name={`kt-${sectionId}`} id={`kt-${sectionId}-${i}`} data-i={i} defaultChecked={i === 0} />
                <label htmlFor={`kt-${sectionId}-${i}`}>
                  <span>
                    <RichText text={k.term} />
                  </span>
                </label>
              </Fragment>
            ))}
          </div>
          <div className="nl-defs mt-2.5">{terms.map(card)}</div>
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">{terms.map(card)}</div>
      )}
    </div>
  );
}

const staticGraphOk = (f: NoteFigure) =>
  !!f.graph && f.graph.expressions.length > 0 && f.graph.expressions.every((e) => parseExpression(e.latex) !== null);

function Block({ block, figure, number, lead }: { block: NoteBlock; figure?: NoteFigure; number?: number; lead?: boolean }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className={lead ? "nl-lead" : undefined} data-nl-reveal="">
          <RichText text={block.text} />
        </p>
      );
    case "bullets":
      return (
        <ul className="nl-bullets flex flex-col gap-2.5" data-nl-reveal="">
          {block.items.map((it, i) => (
            <li key={i}>
              <RichText text={it.text} />
              {it.sub.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5 text-[0.96em]">
                  {it.sub.map((sub, j) => (
                    <li key={j}>
                      <RichText text={sub} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      );
    case "callout":
      // Two different shapes on purpose: a warm examiner's warning, and the cat's speech bubble.
      return block.kind === "mistake" ? (
        <aside className="rounded-[var(--r-button)] bg-[var(--flame-soft)] px-4 py-3.5 sm:px-5" data-nl-reveal="">
          <p className="text-small font-extrabold text-[var(--flame-ink)]">Common mistake</p>
          <p className="mt-1 text-read font-semibold text-foreground">
            <RichText text={block.text} />
          </p>
        </aside>
      ) : (
        <aside className="flex items-end gap-2.5" data-nl-reveal="">
          <Image src="/design/cat3-pencil.webp" alt="" width={360} height={400} unoptimized loading="lazy" className="h-[68px] w-auto shrink-0 sm:h-[84px]" />
          <div className="min-w-0 flex-1 rounded-[var(--r-card)] rounded-bl-[6px] border border-border bg-card px-4 py-3.5 sm:px-5">
            <p className="text-small font-extrabold text-foreground">Exam tip</p>
            <p className="mt-0.5 text-read font-semibold text-foreground">
              <RichText text={block.text} />
            </p>
          </div>
        </aside>
      );
    case "example":
      return (
        <WorkedExample
          title={<RichText text={block.title} />}
          problem={<RichText text={block.problem} />}
          steps={block.steps.map((st, i) => (
            <RichText key={i} text={st} />
          ))}
          answer={<RichText text={block.answer} />}
        />
      );
    case "table":
      return <NoteTable block={block} />;
    case "deeper":
      // Collapsed, but the text is in the HTML (and opens without JavaScript).
      return (
        <details className="nl-details group rounded-[var(--r-button)] border border-dashed border-border-strong px-4 py-1 open:pb-4 sm:px-5" data-nl-reveal="">
          <summary className="flex min-h-14 items-center gap-3">
            <span className="grid w-6 shrink-0 place-items-center text-foreground transition-transform group-open:rotate-45" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-small font-extrabold text-muted-foreground">Go deeper</span>
              <span className="block text-read font-extrabold text-foreground">
                <RichText text={block.title} />
              </span>
            </span>
          </summary>
          <div className="mt-1 flex flex-col gap-3 text-read">
            {block.paragraphs.map((p, i) => (
              <p key={i}>
                <RichText text={p} />
              </p>
            ))}
          </div>
        </details>
      );
    case "figure":
      if (!figure) return null;
      return (
        <figure className="nl-stage flex flex-col gap-2.5" data-nl-reveal="">
          <div className="nl-card -mx-2 overflow-hidden sm:mx-0 [&>div]:!rounded-none [&>div]:!border-0">
            <PublicFigure figure={figure} staticGraph={staticGraphOk(figure)} />
            {/* Figures are drawn by a script; without one, say what the figure shows. */}
            <noscript>
              <p className="px-4 py-4 text-ui font-semibold text-foreground/80">{figure.alt}</p>
            </noscript>
          </div>
          <figcaption className="px-1 text-ui text-muted-foreground">
            <b className="font-extrabold text-foreground">Figure {number ?? 1}.</b> <RichText text={figure.caption} />
          </figcaption>
        </figure>
      );
  }
}

function NoteTable({ block }: { block: Extract<NoteBlock, { type: "table" }> }) {
  return (
    <div data-nl-reveal="">
      {block.caption && (
        <p className="mb-2.5 text-small font-extrabold text-muted-foreground">
          <RichText text={block.caption} />
        </p>
      )}
      <div className="nl-card hidden overflow-hidden sm:block">
        <table className="w-full border-collapse text-read">
          <thead>
            <tr className="bg-muted">
              {block.headers.map((h, ci) => (
                <th key={ci} className="px-4 py-3 text-left text-ui font-extrabold text-foreground">
                  <RichText text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, ri) => (
              <tr key={ri} className="border-t border-[var(--edge)]">
                {r.map((c, ci) => (
                  <td key={ci} className={`px-4 py-3 align-top ${ci === 0 ? "font-extrabold text-foreground" : ""}`}>
                    <RichText text={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2.5 sm:hidden">
        {block.rows.map((r, ri) => (
          <dl key={ri} className="nl-card px-4 py-3.5 text-read">
            <dt className="sr-only">{block.headers[0]}</dt>
            <dd className="text-read font-extrabold text-foreground">
              <RichText text={r[0] ?? ""} />
            </dd>
            {r.slice(1).map((c, k) => (
              <Fragment key={k}>
                <dt className="mt-2.5 text-small font-extrabold text-muted-foreground">
                  <RichText text={block.headers[k + 1] ?? ""} />
                </dt>
                <dd>
                  <RichText text={c} />
                </dd>
              </Fragment>
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}

/** Written recall questions; the mark scheme opens with <details>, no JavaScript needed. */
function Recall({ note }: { note: TopicNoteContent }) {
  const marks = recallMarks(note);
  return (
    <section className="mt-16 scroll-mt-20 lg:scroll-mt-8" aria-labelledby="h-recall" id="sec-recall">
      <header data-nl-reveal="">
        <div className="paper-rule mb-5" aria-hidden="true" />
        <h2 id="h-recall" className="flex flex-wrap items-baseline gap-x-3 text-[26px] font-extrabold leading-[1.14] text-foreground sm:text-[32px]">
          Check your recall
          <span className="nl-marks !text-ui">[{marks} marks]</span>
        </h2>
        <p className="mt-2 text-read text-muted-foreground">
          {note.recall.length} written questions. Answer each one in your head or on paper, then open the mark scheme.
        </p>
      </header>
      <ol className="mt-5 flex flex-col">
        {note.recall.map((q, qi) => (
          <li key={q.id} className="nl-q" data-nl-reveal="">
            <div className="flex items-baseline gap-2 text-small font-extrabold text-muted-foreground">
              <span className="text-read tabular-nums text-foreground">{qi + 1}.</span>
              <span>{q.commandTerm}</span>
              <span className="nl-marks" aria-label={`${q.marks} marks`}>
                [{q.marks} {q.marks === 1 ? "mark" : "marks"}]
              </span>
            </div>
            <p className="mt-2.5 text-read font-bold text-foreground">
              <RichText text={q.question} />
            </p>
            <details className="nl-details group mt-3">
              <summary className="nl-btn-ghost nl-btn-sm !inline-flex">
                <span className="group-open:hidden">Show mark scheme</span>
                <span className="hidden group-open:inline">Hide mark scheme</span>
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="nl-well mt-3.5 px-4 py-3.5 text-read">
                <p className="text-small font-extrabold text-foreground">Model answer</p>
                <p className="mt-0.5 text-foreground">
                  <RichText text={q.modelAnswer} />
                </p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {q.markPoints.map((m, mi) => (
                    <li key={mi} className="flex gap-2.5">
                      <Check className="mt-[5px] size-4 shrink-0 text-foreground" strokeWidth={3.5} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        1 mark for <RichText text={m} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
