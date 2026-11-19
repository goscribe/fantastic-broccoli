"use client";

import { MarkdownText } from "@/components/ui/markdown-text";
import { FigureView } from "@/components/session/reading-activity";
import type { ReadingFigure } from "@/types";

/**
 * Multiple-choice text with figures: the question (or an option) may place a
 * figure with a `[[figure:ID]]` token; figures nobody references are shown
 * under the question. Option figures are pictures to choose between, so they
 * are drawn small and don't take clicks away from the option button.
 */
const TOKEN = /\[\[figure:([^\]]+)\]\]/g;

const idsIn = (text: string) => [...text.matchAll(TOKEN)].map((m) => m[1]);
const strip = (text: string) => text.replace(TOKEN, "").trim();

export const optionsHaveFigures = (options: string[]) => options.some((o) => idsIn(o).length > 0);

export function McqQuestionBody({
  text,
  figures,
  options,
}: {
  text: string;
  figures?: ReadingFigure[];
  options: string[];
}) {
  if (!figures?.length) return <MarkdownText text={text} />;
  const byId = new Map(figures.map((f) => [f.id, f]));
  const usedByOptions = new Set(options.flatMap(idsIn));
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const placed = new Set<string>();
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    const before = text.slice(last, idx).trim();
    if (before) parts.push(<MarkdownText key={key++} text={before} />);
    const fig = byId.get(m[1]);
    if (fig) {
      placed.add(fig.id);
      parts.push(
        <div key={key++} className="my-3 text-base font-normal">
          <FigureView figure={fig} />
        </div>,
      );
    }
    last = idx + m[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) parts.push(<MarkdownText key={key++} text={rest} />);
  const loose = figures.filter((f) => !placed.has(f.id) && !usedByOptions.has(f.id));
  return (
    <>
      {parts}
      {loose.map((f) => (
        <div key={f.id} className="mt-3 text-base font-normal">
          <FigureView figure={f} />
        </div>
      ))}
    </>
  );
}

export function McqOptionBody({ text, figures }: { text: string; figures?: ReadingFigure[] }) {
  const ids = idsIn(text);
  if (!ids.length || !figures?.length) return <MarkdownText text={strip(text) || text} />;
  const byId = new Map(figures.map((f) => [f.id, f]));
  const label = strip(text);
  return (
    <span className="flex w-full flex-col gap-1.5">
      {ids.map((id) => {
        const fig = byId.get(id);
        return fig ? (
          <span key={id} className="pointer-events-none block w-full max-w-[340px] overflow-hidden rounded-lg text-sm font-normal">
            <FigureView figure={fig} bare />
          </span>
        ) : null;
      })}
      {label && <MarkdownText text={label} />}
    </span>
  );
}
