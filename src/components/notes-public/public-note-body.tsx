import { Fragment, type ReactNode } from "react";
import type { NoteBlock, NoteFigure, TopicNoteContent } from "@/lib/api/notes";
import { figureNumbers } from "@/lib/notes";
import { parseExpression } from "@/lib/latex-eval";
import { RichText } from "./rich-text";
import { PublicFigure } from "./public-figure";

/**
 * Server-rendered read view of a Scribe topic note for the public pages: the
 * same layout as the signed-in reader (components/notes/note-body.tsx), but
 * every word and formula is in the HTML with no client JavaScript except
 * live figures. "Check your recall" uses <details>, so its mark schemes open
 * without JavaScript too. `after` injects nodes after a section (by index),
 * used for the inline quick questions.
 */
export function PublicNoteBody({ note, after }: { note: TopicNoteContent; after?: Map<number, ReactNode> }) {
  const figures = new Map(note.figures.map((f) => [f.id, f]));
  const numbers = figureNumbers(note);
  return (
    <div className="text-[16px] leading-[1.65] text-foreground sm:text-[17px]">
      <div className="rounded-xl bg-muted/50 px-4 py-3">
        <p className="text-[12.5px] font-semibold text-muted-foreground">In this note</p>
        <p className="mt-0.5 text-[15px] leading-snug sm:text-[16px]">
          <RichText text={note.objectiveLine} />
        </p>
      </div>

      {note.sections.map((s, si) => {
        const terms = note.keyTerms.filter((k) => k.sectionId === s.id);
        return (
          <Fragment key={s.id}>
            <section className="mt-9 scroll-mt-20 first-of-type:mt-7" aria-labelledby={`h-${s.id}`} id={`sec-${s.id}`}>
              <h2 id={`h-${s.id}`} className="text-[19px] font-semibold leading-snug tracking-[-0.01em] sm:text-[21px]">
                <RichText text={s.heading} />
              </h2>
              <div className="mt-3 flex flex-col gap-4">
                {s.blocks.map((b, bi) => (
                  <Block key={bi} block={b} figure={b.type === "figure" ? figures.get(b.figureId) : undefined} number={b.type === "figure" ? numbers.get(b.figureId) : undefined} />
                ))}
              </div>
              {terms.length > 0 && (
                <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
                  {terms.map((k, ki) => (
                    <div
                      key={ki}
                      className={`rounded-xl border border-border bg-card px-4 py-3 ${terms.length > 1 ? "w-[80%] shrink-0 snap-start sm:w-auto" : "w-full shrink-0 sm:w-auto"}`}
                    >
                      <p className="text-[15px] font-semibold leading-snug">
                        <RichText text={k.term} />
                      </p>
                      <p className="mt-0.5 text-[14.5px] leading-snug text-muted-foreground">
                        <RichText text={k.definition} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {after?.get(si)}
          </Fragment>
        );
      })}

      {note.recall.length > 0 && <Recall note={note} />}
    </div>
  );
}

const staticGraphOk = (f: NoteFigure) =>
  !!f.graph && f.graph.expressions.length > 0 && f.graph.expressions.every((e) => parseExpression(e.latex) !== null);

function Block({ block, figure, number }: { block: NoteBlock; figure?: NoteFigure; number?: number }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "bullets":
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-faint">
          {block.items.map((it, i) => (
            <li key={i}>
              <RichText text={it.text} />
              {it.sub.length > 0 && (
                <ul className="mt-1.5 flex list-[circle] flex-col gap-1 pl-5 marker:text-faint">
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
      return (
        <aside className="rounded-xl bg-muted/60 px-4 py-3">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            {block.kind === "mistake" ? "Common mistake" : "Exam tip"}
          </p>
          <p className="mt-1 text-[15.5px] leading-snug sm:text-[16px]">
            <RichText text={block.text} />
          </p>
        </aside>
      );
    case "example":
      return (
        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Worked example</p>
          <p className="mt-1 font-semibold leading-snug">
            <RichText text={block.title} />
          </p>
          <p className="mt-2">
            <RichText text={block.problem} />
          </p>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 marker:font-semibold marker:text-faint">
            {block.steps.map((st, i) => (
              <li key={i}>
                <RichText text={st} />
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-border pt-3">
            <span className="font-semibold">Answer: </span>
            <RichText text={block.answer} />
          </p>
        </div>
      );
    case "table":
      return <NoteTable block={block} />;
    case "figure":
      if (!figure) return null;
      return (
        <figure className="flex flex-col gap-2">
          <PublicFigure figure={figure} staticGraph={staticGraphOk(figure)} />
          <figcaption className="text-[14px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">Figure {number ?? 1}.</span> <RichText text={figure.caption} />
          </figcaption>
        </figure>
      );
  }
}

function NoteTable({ block }: { block: Extract<NoteBlock, { type: "table" }> }) {
  return (
    <div>
      {block.caption && (
        <p className="mb-2 text-[14px] font-semibold text-muted-foreground">
          <RichText text={block.caption} />
        </p>
      )}
      <table className="hidden w-full border-collapse text-[15.5px] leading-snug sm:table">
        <thead>
          <tr>
            {block.headers.map((h, ci) => (
              <th key={ci} className="border-b border-border-strong px-3 py-2 text-left font-semibold first:pl-0">
                <RichText text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`border-b border-border px-3 py-2 align-top first:pl-0 ${ci === 0 ? "font-semibold" : ""}`}>
                  <RichText text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-2 sm:hidden">
        {block.rows.map((r, ri) => (
          <dl key={ri} className="rounded-xl border border-border px-4 py-3 text-[15px] leading-snug">
            <dt className="sr-only">{block.headers[0]}</dt>
            <dd className="font-semibold">
              <RichText text={r[0] ?? ""} />
            </dd>
            {r.slice(1).map((c, k) => (
              <Fragment key={k}>
                <dt className="mt-2 text-[12.5px] font-semibold text-muted-foreground">
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
  return (
    <section className="mt-12 scroll-mt-20 border-t border-border pt-8" aria-labelledby="h-recall" id="sec-recall">
      <h2 id="h-recall" className="text-[19px] font-semibold leading-snug sm:text-[21px]">
        Check your recall
      </h2>
      <p className="mt-1 text-[14.5px] text-muted-foreground">
        Written answers: answer each one in your head or on paper, then open the mark scheme.
      </p>
      <ol className="mt-5 flex flex-col gap-4">
        {note.recall.map((q, qi) => (
          <li key={q.id} className="flex gap-3">
            <span className="w-5 shrink-0 font-semibold tabular-nums text-faint">{qi + 1}.</span>
            <div className="min-w-0 flex-1">
              <p>
                <RichText text={q.question} />{" "}
                <span className="whitespace-nowrap font-semibold text-muted-foreground" aria-label={`${q.marks} marks`}>
                  [{q.marks}]
                </span>
              </p>
              <details className="group mt-1.5">
                <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[14px] font-semibold text-accent hover:text-accent-dim [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show mark scheme</span>
                  <span className="hidden group-open:inline">Hide mark scheme</span>
                  <svg viewBox="0 0 24 24" className="size-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="mt-2 rounded-xl bg-muted/50 px-4 py-3 text-[15px] leading-snug sm:text-[15.5px]">
                  <p className="text-[12.5px] font-semibold text-muted-foreground">Model answer</p>
                  <p className="mt-0.5">
                    <RichText text={q.modelAnswer} />
                  </p>
                  <ul className="mt-2.5 flex flex-col gap-1">
                    {q.markPoints.map((m, mi) => (
                      <li key={mi} className="flex gap-2">
                        <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent/60" />
                        <span className="min-w-0 flex-1">
                          1 mark for <RichText text={m} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
