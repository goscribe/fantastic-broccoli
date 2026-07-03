"use client";

import { useCallback, useRef, useState } from "react";
import { ReadingContent } from "@/types";
import { Button } from "@/components/ui/button";
import { InteractiveWidget, WidgetId, widgetRegistry } from "@/components/interactive";
import { cn } from "@/lib/utils";
import { BookOpen, ArrowRight, Highlighter, Trash2 } from "lucide-react";

const WIDGET_TOKEN = /^\[\[widget:([a-z-]+)\]\]$/;

type HighlightColor = "amber" | "green" | "purple";

const colorClasses: Record<HighlightColor, string> = {
  amber: "bg-amber/25",
  green: "bg-energy/20",
  purple: "bg-accent/15",
};

const colorDots: Record<HighlightColor, string> = {
  amber: "bg-amber",
  green: "bg-energy",
  purple: "bg-accent",
};

interface Highlight {
  id: number;
  para: number;
  start: number;
  end: number;
  color: HighlightColor;
  note?: string;
}

let highlightId = 0;

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
    <p data-para={para} className="text-sm leading-relaxed">
      {segments}
    </p>
  );
}

interface ReadingActivityProps {
  content: ReadingContent;
  onComplete: () => void;
}

export function ReadingActivity({ content, onComplete }: ReadingActivityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
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

  const blocks = content.text.split("\n\n");

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
    setHighlights((prev) => [
      ...prev,
      {
        id: ++highlightId,
        para: selectionMenu.para,
        start: selectionMenu.start,
        end: selectionMenu.end,
        color,
      },
    ]);
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
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
        {blocks.map((block, i) => {
          const widgetMatch = block.trim().match(WIDGET_TOKEN);
          if (widgetMatch && widgetMatch[1] in widgetRegistry) {
            return <InteractiveWidget key={i} id={widgetMatch[1] as WidgetId} />;
          }
          return (
            <ParagraphView
              key={i}
              text={block}
              para={i}
              highlights={highlights}
              onHighlightClick={openHighlight}
            />
          );
        })}

        {selectionMenu && (
          <div
            className="absolute z-20 flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-soft-lg -translate-x-1/2 -translate-y-full -mt-2"
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
          >
            {(Object.keys(colorDots) as HighlightColor[]).map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Highlight ${color}`}
                onClick={() => addHighlight(color)}
                className={cn(
                  "h-5 w-5 rounded-full hover:scale-110 transition-transform",
                  colorDots[color],
                )}
              />
            ))}
          </div>
        )}

        {activeHighlight && (
          <div
            className="absolute z-20 w-56 rounded-xl border border-border bg-card p-2.5 shadow-soft-lg -translate-x-1/2 -translate-y-full -mt-2"
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
                  setHighlights((prev) =>
                    prev.filter((h) => h.id !== activeHighlight.highlight.id),
                  );
                  setActiveHighlight(null);
                }}
                className="flex items-center gap-1 text-[11px] text-rose hover:opacity-80"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  setHighlights((prev) =>
                    prev.map((h) =>
                      h.id === activeHighlight.highlight.id
                        ? { ...h, note: noteDraft || undefined }
                        : h,
                    ),
                  );
                  setActiveHighlight(null);
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
