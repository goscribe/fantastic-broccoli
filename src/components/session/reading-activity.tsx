"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadingContent, ReadingFigure, SessionHighlight } from "@/types";
import {
  addReadingHighlight,
  removeReadingHighlight,
  updateReadingHighlight,
} from "@/lib/api/study";
import { Button } from "@/components/ui/button";
import { InteractiveWidget, WidgetId, widgetRegistry } from "@/components/interactive";
import { ExpressionGraph } from "@/components/interactive/desmos";
import { cn } from "@/lib/utils";
import { BookOpen, ArrowRight, Highlighter, Trash2 } from "lucide-react";

const WIDGET_TOKEN = /^\[\[widget:([a-z-]+)\]\]$/;
const FIGURE_TOKEN = /^\[\[figure:([^\]]+)\]\]$/;

/** Strips inline markdown markers so highlight offsets match displayed text. */
function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

type ReadingBlock =
  | { kind: "widget"; widget: string }
  | { kind: "figure"; figureId: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlock(raw: string): ReadingBlock {
  const trimmed = raw.trim();
  const widgetMatch = trimmed.match(WIDGET_TOKEN);
  if (widgetMatch) return { kind: "widget", widget: widgetMatch[1] };

  const figureMatch = trimmed.match(FIGURE_TOKEN);
  if (figureMatch) return { kind: "figure", figureId: figureMatch[1] };

  const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
  if (headingMatch && !headingMatch[2].includes("\n")) {
    return {
      kind: "heading",
      level: headingMatch[1].length,
      text: stripInlineMarkdown(headingMatch[2]),
    };
  }

  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l))) {
    return {
      kind: "list",
      items: lines.map((l) => stripInlineMarkdown(l.replace(/^[-*]\s+/, ""))),
    };
  }

  return { kind: "paragraph", text: stripInlineMarkdown(trimmed) };
}

export type HighlightColor = "amber" | "green" | "purple";

export interface ReadingHighlight {
  id: string;
  text: string;
  color: HighlightColor;
  note?: string;
}

const colorClasses: Record<HighlightColor, string> = {
  amber: "bg-amber/25",
  green: "bg-energy/20",
  purple: "bg-accent/15",
};

export const highlightDotClasses: Record<HighlightColor, string> = {
  amber: "bg-amber",
  green: "bg-energy",
  purple: "bg-accent",
};

interface Highlight {
  id: string;
  para: number;
  start: number;
  end: number;
  color: HighlightColor;
  note?: string;
}

const isColor = (c: string): c is HighlightColor =>
  c === "amber" || c === "green" || c === "purple";

function fromPersisted(h: SessionHighlight): Highlight {
  return {
    id: h.id,
    para: h.paragraph,
    start: h.startChar,
    end: h.endChar,
    color: isColor(h.color) ? h.color : "green",
    note: h.note,
  };
}

let tempId = 0;

function FigureView({ figure }: { figure: ReadingFigure }) {
  if (figure.type === "graph") {
    return (
      <ExpressionGraph
        title={figure.title}
        xLabel={figure.xLabel}
        yLabel={figure.yLabel}
        expressions={figure.expressions}
      />
    );
  }
  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={figure.url}
        alt={figure.caption}
        className="w-full max-h-96 object-contain bg-muted/40"
      />
      {figure.caption && (
        <figcaption className="px-3.5 py-2 text-[11px] text-muted-foreground border-t border-border">
          {figure.caption}
        </figcaption>
      )}
    </figure>
  );
}

function offsetWithin(paraEl: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

function ParagraphView({
  text,
  para,
  highlights,
  onHighlightClick,
}: {
  text: string;
  para: number;
  highlights: Highlight[];
  onHighlightClick: (h: Highlight, rect: DOMRect) => void;
}) {
  const own = highlights
    .filter((h) => h.para === para)
    .sort((a, b) => a.start - b.start);

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of own) {
    if (h.start > cursor) segments.push(text.slice(cursor, h.start));
    segments.push(
      <mark
        key={h.id}
        className={cn(
          "rounded-sm px-0.5 cursor-pointer transition-colors",
          colorClasses[h.color],
          h.note && "underline decoration-dotted underline-offset-2",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onHighlightClick(h, (e.target as HTMLElement).getBoundingClientRect());
        }}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < text.length) segments.push(text.slice(cursor));

  return (
    <p data-para={para} className="text-[15px] leading-7">
      {segments}
    </p>
  );
}

interface ReadingActivityProps {
  content: ReadingContent;
  activityId: string;
  initialHighlights?: SessionHighlight[];
  onComplete: () => void;
  onHighlightsChange?: (highlights: ReadingHighlight[]) => void;
}

export function ReadingActivity({
  content,
  activityId,
  initialHighlights,
  onComplete,
  onHighlightsChange,
}: ReadingActivityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>(() =>
    (initialHighlights ?? []).map(fromPersisted),
  );
  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    para: number;
    start: number;
    end: number;
  } | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: Highlight;
    x: number;
    y: number;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const parsedBlocks = content.text.split("\n\n").map(parseBlock);
  const figuresById = new Map(
    (content.figures ?? []).map((figure) => [figure.id, figure]),
  );
  const paraText = (i: number) => {
    const block = parsedBlocks[i];
    return block?.kind === "paragraph" ? block.text : "";
  };

  useEffect(() => {
    onHighlightsChange?.(
      highlights.map((h) => ({
        id: h.id,
        text: paraText(h.para).slice(h.start, h.end),
        color: h.color,
        note: h.note,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelectionMenu(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const startPara = (range.startContainer.parentElement?.closest("[data-para]") ??
      null) as HTMLElement | null;
    const endPara = (range.endContainer.parentElement?.closest("[data-para]") ??
      null) as HTMLElement | null;
    if (!startPara || startPara !== endPara) {
      setSelectionMenu(null);
      return;
    }
    const para = Number(startPara.dataset.para);
    const start = offsetWithin(startPara, range.startContainer, range.startOffset);
    const end = offsetWithin(startPara, range.endContainer, range.endOffset);
    if (end <= start) {
      setSelectionMenu(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setActiveHighlight(null);
    setSelectionMenu({
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top,
      para,
      start,
      end,
    });
  }, []);

  const addHighlight = (color: HighlightColor) => {
    if (!selectionMenu) return;
    const { para, start, end } = selectionMenu;
    const localId = `local-${++tempId}`;
    setHighlights((prev) => [
      ...prev,
      { id: localId, para, start, end, color },
    ]);
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();

    addReadingHighlight({
      activityId,
      text: paraText(para).slice(start, end),
      color,
      paragraph: para,
      startChar: start,
      endChar: end,
    })
      .then((saved) => {
        setHighlights((prev) =>
          prev.map((h) => (h.id === localId ? { ...h, id: saved.id } : h)),
        );
      })
      .catch(() => {
        setHighlights((prev) => prev.filter((h) => h.id !== localId));
      });
  };

  const openHighlight = (h: Highlight, rect: DOMRect) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    setSelectionMenu(null);
    setNoteDraft(h.note ?? "");
    setActiveHighlight({
      highlight: h,
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="text-xs font-medium">
            Reading Material
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px]">
          <Highlighter className="h-3.5 w-3.5" />
          Select text to highlight
        </span>
      </div>

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="relative space-y-4 select-text"
      >
        {parsedBlocks.map((block, i) => {
          if (block.kind === "widget") {
            return block.widget in widgetRegistry ? (
              <InteractiveWidget key={i} id={block.widget as WidgetId} />
            ) : null;
          }
          if (block.kind === "figure") {
            const figure = figuresById.get(block.figureId);
            return figure ? <FigureView key={i} figure={figure} /> : null;
          }
          if (block.kind === "heading") {
            return (
              <h3
                key={i}
                className={cn(
                  "font-semibold tracking-tight",
                  block.level <= 2 ? "text-lg pt-2" : "text-base pt-1",
                )}
              >
                {block.text}
              </h3>
            );
          }
          if (block.kind === "list") {
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 text-[15px] leading-7">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <ParagraphView
              key={i}
              text={block.text}
              para={i}
              highlights={highlights}
              onHighlightClick={openHighlight}
            />
          );
        })}

        {selectionMenu && (
          <div
            className="absolute z-20 flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 -translate-x-1/2 -translate-y-full -mt-2"
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
          >
            {(Object.keys(highlightDotClasses) as HighlightColor[]).map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Highlight ${color}`}
                onClick={() => addHighlight(color)}
                className={cn(
                  "h-5 w-5 rounded-full hover:scale-110 transition-transform",
                  highlightDotClasses[color],
                )}
              />
            ))}
          </div>
        )}

        {activeHighlight && (
          <div
            className="absolute z-20 w-56 rounded-xl border border-border bg-card p-2.5 -translate-x-1/2 -translate-y-full -mt-2"
            style={{ left: activeHighlight.x, top: activeHighlight.y }}
          >
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs outline-none focus:border-accent/50"
            />
            <div className="flex items-center justify-between mt-1.5">
              <button
                type="button"
                onClick={() => {
                  const { id } = activeHighlight.highlight;
                  setHighlights((prev) => prev.filter((h) => h.id !== id));
                  setActiveHighlight(null);
                  if (!id.startsWith("local-")) {
                    removeReadingHighlight(id).catch(() => {});
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-rose hover:opacity-80"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  const { id } = activeHighlight.highlight;
                  setHighlights((prev) =>
                    prev.map((h) =>
                      h.id === id ? { ...h, note: noteDraft || undefined } : h,
                    ),
                  );
                  setActiveHighlight(null);
                  if (!id.startsWith("local-")) {
                    updateReadingHighlight(id, {
                      note: noteDraft || null,
                    }).catch(() => {});
                  }
                }}
                className="text-[11px] font-semibold text-accent hover:opacity-80"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="primary" size="sm" onClick={onComplete}>
          Done reading <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
