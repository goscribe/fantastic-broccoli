"use client";

import { useMemo } from "react";
import katex from "katex";
import { FileText, ExternalLink } from "lucide-react";
import { DataSeriesGraph, SeriesPoint } from "@/components/interactive";

/* ---------- Equation (LaTeX via KaTeX) ---------- */

export function EquationEmbed({ latex, caption }: { latex: string; caption?: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      }),
    [latex],
  );

  return (
    <div className="my-2 rounded-xl border border-border bg-card p-4 animate-fade-up">
      <div
        className="text-[15px] overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption && (
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          {caption}
        </p>
      )}
    </div>
  );
}

/* ---------- Graph (Desmos data series) ---------- */

export interface GraphData {
  title: string;
  xLabel: string;
  yLabel: string;
  points: SeriesPoint[];
}

export function GraphEmbed({ data }: { data: GraphData }) {
  return (
    <DataSeriesGraph
      title={data.title}
      xLabel={data.xLabel}
      yLabel={data.yLabel}
      points={data.points}
    />
  );
}

/* ---------- PDF citation ---------- */

export interface CitationData {
  source: string;
  page: number;
  quote: string;
}

export function CitationEmbed({ data }: { data: CitationData }) {
  return (
    <div className="my-2 rounded-xl border border-border bg-card overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/60 border-b border-border">
        <FileText className="h-3.5 w-3.5 text-rose shrink-0" />
        <span className="text-[11px] font-semibold truncate">{data.source}</span>
        <span className="text-[11px] text-faint shrink-0">p. {data.page}</span>
        <ExternalLink className="h-3 w-3 text-faint ml-auto shrink-0" />
      </div>
      <blockquote className="px-3.5 py-2.5 text-xs text-muted-foreground border-l-2 border-accent/40 m-2 bg-accent-soft/40 rounded-r-lg">
        “{data.quote}”
      </blockquote>
    </div>
  );
}
