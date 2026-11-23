"use client";

import { useNewUi } from "@/lib/new-ui";
import { PlayActions, PlayPrimary } from "@/components/session/play-ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { readingOrder } from "@/lib/start-check";
import {
  ReadingContent,
  ReadingFigure,
  ReadingImageFigure,
  SessionHighlight,
} from "@/types";
import {
  addReadingHighlight,
  removeReadingHighlight,
  updateReadingHighlight,
} from "@/lib/api/study";
import { Button } from "@/components/ui/button";
import { InteractiveWidget, WidgetId, widgetRegistry } from "@/components/interactive";
import { ExpressionGraph } from "@/components/interactive/desmos";
import { HtmlWidget } from "@/components/interactive/html-widget";
import {
  CodeBlock,
  MarkdownTable,
  MathSpan,
  MathText,
  isMarkdownTable,
  splitMathSegments,
  useResolvedFigureUrl,
} from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/session";
import { cn } from "@/lib/utils";
import {
  BoldRange,
  Callout,
  ReadingCheck,
  boldRanges,
  calloutIsEmpty,
  checksBySection,
  parseCallout,
  parseList,
  splitBold,
} from "@/lib/reading-format";
import { BookOpen, ArrowRight, FileText, Highlighter, Trash2 } from "lucide-react";
import { textareaClass } from "@/components/ui/input";

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
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "callout"; callout: Callout }
  | { kind: "code"; code: string; lang?: string }
  | { kind: "table"; lines: string[] }
  | { kind: "paragraph"; text: string; bold?: BoldRange[] };

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

/**
 * Splits a chunk into a pipe table plus the prose lines around it. Returns
 * null when the chunk holds no table so the caller falls through to the
 * list/paragraph handling.
 */
function splitTableRuns(lines: string[]): ReadingBlock[] | null {
  const runs: { table: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const table = TABLE_ROW_RE.test(line);
    const last = runs[runs.length - 1];
    if (last && last.table === table) last.lines.push(line);
    else runs.push({ table, lines: [line] });
  }
  if (!runs.some((r) => r.table && isMarkdownTable(r.lines))) return null;
  return runs.flatMap((r) =>
    r.table && isMarkdownTable(r.lines)
      ? [{ kind: "table" as const, lines: r.lines }]
      : parseBlocks(r.lines.join("\n")),
  );
}

const CODE_FENCE_RE = /```(\w*)[ \t]*\n([\s\S]*?)```/g;

/** Splits reading text into blocks, keeping fenced code blocks intact. */
function parseReadingBlocks(text: string): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  let last = 0;
  const pushPlain = (chunk: string) => {
    if (chunk.trim())
      blocks.push(...chunk.split("\n\n").flatMap(parseBlocks));
  };
  for (const m of text.matchAll(CODE_FENCE_RE)) {
    const idx = m.index ?? 0;
    pushPlain(text.slice(last, idx));
    blocks.push({
      kind: "code",
      code: m[2].replace(/\n$/, ""),
      lang: m[1] || undefined,
    });
    last = idx + m[0].length;
  }
  pushPlain(text.slice(last));
  return blocks;
}

const MAX_HEADING_CHARS = 80;

function parseBlocks(raw: string): ReadingBlock[] {
  const trimmed = raw.trim();
  const widgetMatch = trimmed.match(WIDGET_TOKEN);
  if (widgetMatch) return [{ kind: "widget", widget: widgetMatch[1] }];

  const figureMatch = trimmed.match(FIGURE_TOKEN);
  if (figureMatch) return [{ kind: "figure", figureId: figureMatch[1] }];

  const callout = parseCallout(trimmed);
  if (callout) return [{ kind: "callout", callout }];

  const headingMatch = trimmed.match(/^(#{1,4})\s+([^\n]*)([\s\S]*)$/);
  if (headingMatch) {
    const headingLine = headingMatch[2].trim();
    const rest = headingMatch[3].trim();
    if (headingLine.length <= MAX_HEADING_CHARS) {
      const heading: ReadingBlock = {
        kind: "heading",
        level: headingMatch[1].length,
        text: stripInlineMarkdown(headingLine),
      };
      return rest ? [heading, ...parseBlocks(rest)] : [heading];
    }
    // Heading marker crammed together with paragraph text on one line —
    // render as a paragraph rather than showing literal '##'.
    return [
      {
        kind: "paragraph",
        text: stripInlineMarkdown(
          `${headingLine}${rest ? `\n${rest}` : ""}`,
        ),
      },
    ];
  }

  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const withTable = splitTableRuns(lines);
  if (withTable) return withTable;
  const list = parseList(lines);
  if (list) return [{ kind: "list", items: list.items, ordered: list.ordered }];

  // Bold key terms are kept as ranges over the marker-free text, so
  // highlight offsets (which index that text) stay valid. Text with single
  // *italics* is shown plain, as before.
  const bold = /(?<!\*)\*(?!\*)/.test(trimmed.replace(/\*\*/g, "")) ? [] : boldRanges(trimmed);
  return [{ kind: "paragraph", text: stripInlineMarkdown(trimmed), bold }];
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

function ImageFigure({ figure }: { figure: ReadingImageFigure }) {
  const resolved = useResolvedFigureUrl(figure.url);
  if (!resolved) return null;
  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-border bg-card animate-fade-up">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved}
        alt={figure.caption}
        className="w-full max-h-96 object-contain bg-muted/40"
      />
      {figure.caption && (
        <figcaption className="px-3.5 py-2 text-caption text-muted-foreground border-t border-border">
          <MathText text={figure.caption} />
        </figcaption>
      )}
    </figure>
  );
}

export function FigureView({ figure, bare = false }: { figure: ReadingFigure; bare?: boolean }) {
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
  if (figure.type === "html") {
    return (
      <HtmlWidget
        html={figure.html}
        title={figure.title}
        surface="reading_figure"
        bare={bare}
      />
    );
  }
  return <ImageFigure figure={figure} />;
}

/** Inline markdown: **bold** and $math$. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*\n]+)\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            <MathText text={part} />
          </strong>
        ) : part ? (
          <MathText key={i} text={part.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")} />
        ) : null,
      )}
    </>
  );
}

const BODY_TEXT = "text-[16px] leading-[1.6]";

function ListView({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn(ordered ? "list-decimal" : "list-disc", "pl-5 space-y-1.5", BODY_TEXT)}>
      {items.map((item, j) => (
        <li key={j} className="pl-1">
          <RichText text={item} />
        </li>
      ))}
    </Tag>
  );
}

/**
 * A labelled addition (In short, Note, Key term, Worked example): one flat
 * neutral card with a text label — no colour coding. "In short" is one
 * sentence, so it is always shown (a folded card read as an empty box).
 */
function CalloutView({ callout }: { callout: Callout }) {
  const newUi = useNewUi();
  // Never an empty card (a label with nothing under it).
  if (calloutIsEmpty(callout)) return null;
  const label = (
    <span className={newUi ? "block text-caption font-extrabold text-muted-foreground" : "block text-caption font-semibold uppercase tracking-wide text-muted-foreground"}>
      {callout.label}
    </span>
  );
  const body =
    callout.kind === "worked_example" && callout.lines ? (
      <div className="space-y-1">
        {callout.lines.map((line, i) => (
          <p key={i} className={BODY_TEXT}>
            <RichText text={line} />
          </p>
        ))}
      </div>
    ) : (
      <p className={BODY_TEXT}>
        <RichText text={callout.body} />
      </p>
    );
  if (callout.kind === "objective") {
    return (
      <p className="text-ui text-muted-foreground">
        <RichText text={callout.body} />
      </p>
    );
  }
  return (
    // Redesign: an aside marked by a bar down its left, on the page; not a box inside the reading.
    <div className={newUi ? "space-y-1 border-l-[3px] border-[var(--edge)] py-0.5 pl-4" : "rounded-xl border border-border bg-card px-4 py-3 space-y-1.5"}>
      {label}
      {body}
    </div>
  );
}

/** One inline question after a section; wrong answers quote the notes. */
function QuickCheck({ check }: { check: ReadingCheck }) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<number | null>(null);
  const newUi = useNewUi();
  const correct = picked === check.correctIndex;
  return (
    <div className={newUi ? "space-y-3 py-1" : "rounded-xl border border-border bg-card px-4 py-3 space-y-2.5"}>
      <span className={newUi ? "block text-caption font-extrabold text-muted-foreground" : "block text-caption font-semibold uppercase tracking-wide text-muted-foreground"}>
        {t("session.quickCheck")}
      </span>
      <p className={cn(BODY_TEXT, newUi ? "font-extrabold" : "font-medium")}>
        <RichText text={check.question} />
      </p>
      <div className="grid gap-2">
        {check.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={correct}
            onClick={() => setPicked(i)}
            className={
              newUi
                ? cn(
                    "min-h-[52px] w-full touch-manipulation rounded-[26px] px-5 py-2.5 text-left text-[15.5px] font-semibold ring-inset transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] disabled:active:scale-100 motion-reduce:transition-none",
                    picked === i
                      ? i === check.correctIndex
                        ? "life-pop bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                        : "life-shake bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                      : "bg-muted hover:bg-[var(--edge)]",
                  )
                : cn(
                    "min-h-[44px] w-full rounded-lg border px-3 py-2 text-left text-[15px] transition-colors",
                    picked === i
                      ? i === check.correctIndex
                        ? "border-energy bg-energy/10"
                        : "border-rose bg-rose/10"
                      : "border-border hover:bg-muted/50",
                  )
            }
          >
            <RichText text={option} />
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={newUi ? cn("life-rise text-ui font-semibold", correct ? "text-emerald-800" : "text-foreground/80") : "text-ui"} role="status">
          <RichText text={correct ? check.feedbackCorrect : check.feedbackWrong} />
        </p>
      )}
    </div>
  );
}

/** "From your notes: physics.pdf, p. 3" — shown above a source-first reading. */
function SourceBadge({ content }: { content: ReadingContent }) {
  const { t } = useI18n();
  if (content.mode !== "source" && !content.source) return null;
  const label = content.source?.label || t("session.fromYourNotes");
  return (
    <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </p>
  );
}

/** Section headings (level ≤ 2) and their index, for "Section 2 of 3". */
function sectionInfo(blocks: ReadingBlock[], content: ReadingContent) {
  const headingIdx = blocks.flatMap((b, i) => (b.kind === "heading" && b.level <= 2 ? [i] : []));
  const show = content.mode === "source" && headingIdx.length >= 2;
  const checks = checksBySection(content.blocks);
  return { headingIdx, show, checks };
}

function SectionMarker({ n, m }: { n: number; m: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5 pt-2">
      <span className="text-caption text-muted-foreground">
        {t("session.sectionOf").replace("{n}", String(n)).replace("{m}", String(m))}
      </span>
      <div className="h-0.5 w-full rounded-full bg-muted">
        <div className="h-0.5 rounded-full bg-foreground/40" style={{ width: `${(100 * n) / m}%` }} />
      </div>
    </div>
  );
}

/** Checks belonging to the section that ends before block ``i``. */
function checksBefore(
  i: number,
  blocks: ReadingBlock[],
  info: ReturnType<typeof sectionInfo>,
): ReadingCheck[] {
  const prev = info.headingIdx.filter((h) => h < i).pop();
  const key = prev === undefined ? "" : (blocks[prev] as { text: string }).text.trim();
  return info.checks.get(key) ?? [];
}

/** Text with bold ranges (offsets into ``text``) and $math$. */
function BoldMath({ text, bold }: { text: string; bold?: BoldRange[] }) {
  if (!bold?.length) return <MathText text={text} />;
  return (
    <>
      {splitBold(text, 0, text.length, bold).map((piece) =>
        piece.bold ? (
          <strong key={piece.start} className="font-semibold text-foreground">
            <MathText text={piece.text} />
          </strong>
        ) : (
          <MathText key={piece.start} text={piece.text} />
        ),
      )}
    </>
  );
}

/** A heading, preceded by the previous section's quick checks and, in
 * multi-section source readings, "Section n of m". */
function SectionHeading({
  block,
  index,
  blocks,
  info,
}: {
  block: { level: number; text: string };
  index: number;
  blocks: ReadingBlock[];
  info: ReturnType<typeof sectionInfo>;
}) {
  const section = info.headingIdx.indexOf(index);
  const top = block.level <= 2;
  const newUi = useNewUi();
  return (
    <>
      {top &&
        checksBefore(index, blocks, info).map((c, j) => (
          <QuickCheck key={`c-${index}-${j}`} check={c} />
        ))}
      {top && info.show && section >= 0 && (
        <SectionMarker n={section + 1} m={info.headingIdx.length} />
      )}
      <h3
        className={cn(
          newUi ? "font-extrabold tracking-tight" : "font-semibold tracking-tight",
          top ? (newUi ? "pt-2 text-[21px]" : "text-lg pt-2") : newUi ? "pt-3 text-[17.5px]" : "text-base pt-3",
        )}
      >
        <MathText text={block.text} />
      </h3>
    </>
  );
}

/**
 * Read-only reading renderer: headings, lists, paragraphs and embedded
 * figures, without highlighting or completion controls. Used for previews
 * (e.g. the artifact bank).
 */
export function ReadingBody({ content, visualFirst = false, lead, className }: { content: ReadingContent; /** A reading that opens on bullets shows its figure and explanation first (see `readingOrder`). */ visualFirst?: boolean; /** Shown above the text: a visual brought from elsewhere. */ lead?: ReactNode; className?: string }) {
  const parsedBlocks = parseReadingBlocks(content.text);
  const order = blockOrder(parsedBlocks, visualFirst);
  const figuresById = new Map(
    (content.figures ?? []).map((figure) => [figure.id, figure]),
  );
  const info = sectionInfo(parsedBlocks, content);
  return (
    <div className={cn("mx-auto max-w-[75ch] space-y-5", className)}>
      <SourceBadge content={content} />
      {lead}
      {order.map((i) => {
        const block = parsedBlocks[i];
        if (block.kind === "callout") return <CalloutView key={i} callout={block.callout} />;
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
            <SectionHeading key={i} block={block} index={i} blocks={parsedBlocks} info={info} />
          );
        }
        if (block.kind === "code") {
          return <CodeBlock key={i} code={block.code} lang={block.lang} />;
        }
        if (block.kind === "table") {
          return <MarkdownTable key={i} lines={block.lines} />;
        }
        if (block.kind === "list") {
          return <ListView key={i} items={block.items} ordered={block.ordered} />;
        }
        return (
          <p key={i} className={BODY_TEXT}>
            <BoldMath text={block.text} bold={block.bold} />
          </p>
        );
      })}
      {checksBefore(parsedBlocks.length, parsedBlocks, info).map((c, j) => (
        <QuickCheck key={`end-${j}`} check={c} />
      ))}
    </div>
  );
}

// Maps a DOM position back to an offset in the paragraph's raw text.
// Rendered math counts as its raw source length (data-math-len) so
// highlight offsets stay aligned with the underlying text.
function offsetWithin(paraEl: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walk = (parent: Node): number | null => {
    for (const child of Array.from(parent.childNodes)) {
      if (child === node) return total + offset;
      if (child instanceof HTMLElement && child.dataset.mathLen) {
        if (child.contains(node)) return total;
        total += Number(child.dataset.mathLen);
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        total += child.textContent?.length ?? 0;
        continue;
      }
      const found = walk(child);
      if (found !== null) return found;
    }
    return null;
  };
  return walk(paraEl) ?? total;
}

function ParagraphView({
  text,
  bold,
  para,
  highlights,
  onHighlightClick,
}: {
  text: string;
  bold?: BoldRange[];
  para: number;
  highlights: Highlight[];
  onHighlightClick: (h: Highlight, rect: DOMRect) => void;
}) {
  const own = highlights
    .filter((h) => h.para === para)
    .sort((a, b) => a.start - b.start);

  // Plain text of text[from, to), with bold key terms in <strong> (a plain
  // element, so highlight offsets still count its characters).
  const plain = (from: number, to: number): React.ReactNode[] =>
    bold?.length
      ? splitBold(text, from, to, bold).map((piece) =>
          piece.bold ? (
            <strong key={`b-${piece.start}`} className="font-semibold text-foreground">
              {piece.text}
            </strong>
          ) : (
            piece.text
          ),
        )
      : [text.slice(from, to)];

  const segments: React.ReactNode[] = [];
  for (const seg of splitMathSegments(text)) {
    if (seg.kind === "math") {
      segments.push(
        <span key={`m-${seg.start}`} data-math-len={seg.raw.length}>
          <MathSpan latex={seg.latex} display={seg.display} />
        </span>,
      );
      continue;
    }
    if (seg.kind === "text" && !own.length) {
      const t = seg.text;
      let last = 0;
      for (const m of t.matchAll(/`[^`\n]+`/g)) {
        const idx = m.index ?? 0;
        if (idx > last) segments.push(...plain(seg.start + last, seg.start + idx));
        segments.push(
          <span key={`c-${seg.start + idx}`} data-math-len={m[0].length}>
            <code className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono">
              {m[0].slice(1, -1)}
            </code>
          </span>,
        );
        last = idx + m[0].length;
      }
      if (last < t.length) segments.push(...plain(seg.start + last, seg.start + t.length));
      continue;
    }
    let cursor = seg.start;
    for (const h of own) {
      const start = Math.max(h.start, seg.start);
      const end = Math.min(h.end, seg.end);
      if (end <= start) continue;
      if (start > cursor) segments.push(...plain(cursor, start));
      segments.push(
        <mark
          key={`${h.id}-${start}`}
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
          {plain(start, end)}
        </mark>,
      );
      cursor = end;
    }
    if (cursor < seg.end) segments.push(...plain(cursor, seg.end));
  }

  return (
    <p data-para={para} className={BODY_TEXT}>
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
  /**
   * The first screen of a session: a reading that opens on a bullet list
   * shows its figure and its explanation before the points. Blocks keep
   * their index, so saved highlights are unaffected.
   */
  visualFirst?: boolean;
  /** A visual brought from elsewhere (the topic note, the material), above the text. */
  lead?: ReactNode;
}

/** Whether a reading opens on bullets with no figure or widget of its own (it then wants a `lead`). */
export function readingNeedsLead(content: ReadingContent): boolean {
  return readingOrder(parseReadingBlocks(content.text).map((b) => b.kind)).needsLead;
}

function blockOrder(blocks: ReadingBlock[], visualFirst: boolean): number[] {
  return visualFirst ? readingOrder(blocks.map((b) => b.kind)).order : blocks.map((_, i) => i);
}

export function ReadingActivity({
  content,
  activityId,
  initialHighlights,
  onComplete,
  onHighlightsChange,
  visualFirst = false,
  lead,
}: ReadingActivityProps) {
  const { t } = useI18n();
  const newUi = useNewUi();
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

  const parsedBlocks = parseReadingBlocks(content.text);
  const order = blockOrder(parsedBlocks, visualFirst);
  const figuresById = new Map(
    (content.figures ?? []).map((figure) => [figure.id, figure]),
  );
  const info = sectionInfo(parsedBlocks, content);
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
      {newUi ? (
        // One quiet line, like the other activities' "Question 1 of 5"; no icons.
        <p data-scroll-line className="text-small font-semibold text-muted-foreground max-sm:hidden">{t("session.selectToHighlight")}</p>
      ) : (
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="text-caption font-medium">
            {t("session.readingMaterial")}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-caption">
          <Highlighter className="h-3.5 w-3.5" />
          {t("session.selectToHighlight")}
        </span>
      </div>
      )}

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className={cn("relative space-y-5 select-text", newUi ? "max-w-[70ch]" : "mx-auto max-w-[75ch]")}
      >
        <SourceBadge content={content} />
        {lead}
        {order.map((i) => {
        const block = parsedBlocks[i];
          if (block.kind === "widget") {
            return block.widget in widgetRegistry ? (
              <InteractiveWidget key={i} id={block.widget as WidgetId} />
            ) : null;
          }
          if (block.kind === "figure") {
            const figure = figuresById.get(block.figureId);
            return figure ? <FigureView key={i} figure={figure} /> : null;
          }
          if (block.kind === "callout") return <CalloutView key={i} callout={block.callout} />;
          if (block.kind === "heading") {
            return (
              <SectionHeading key={i} block={block} index={i} blocks={parsedBlocks} info={info} />
            );
          }
          if (block.kind === "code") {
            return <CodeBlock key={i} code={block.code} lang={block.lang} />;
          }
          if (block.kind === "table") {
            return <MarkdownTable key={i} lines={block.lines} />;
          }
          if (block.kind === "list") {
            return <ListView key={i} items={block.items} ordered={block.ordered} />;
          }
          return (
            <ParagraphView
              key={i}
              text={block.text}
              bold={block.bold}
              para={i}
              highlights={highlights}
              onHighlightClick={openHighlight}
            />
          );
        })}
        {checksBefore(parsedBlocks.length, parsedBlocks, info).map((c, j) => (
          <QuickCheck key={`end-${j}`} check={c} />
        ))}

        {selectionMenu && (
          <div
            className="absolute z-20 flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1.5 -translate-x-1/2 -translate-y-full -mt-2"
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
          >
            {(Object.keys(highlightDotClasses) as HighlightColor[]).map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${t("session.highlightColor")} ${color}`}
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
              placeholder={t("session.addNoteShort")}
              rows={2}
              className={cn(textareaClass, "px-2.5 py-1.5 text-xs")}
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
                <Trash2 className="h-3 w-3" /> {t("session.remove")}
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
                {t("session.save")}
              </button>
            </div>
          </div>
        )}
      </div>

      {newUi ? (
        <PlayActions className="pt-2">
          <PlayPrimary onClick={onComplete}>
            {t("session.doneReading")} <ArrowRight className="ml-1.5 size-4" />
          </PlayPrimary>
        </PlayActions>
      ) : (
      <div className="flex justify-end pt-2">
        <Button variant="primary" size="sm" onClick={onComplete}>
          {t("session.doneReading")} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
      )}
    </div>
  );
}
