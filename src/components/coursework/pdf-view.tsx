"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { findQuote } from "@/lib/quote-match";
import { cn } from "@/lib/utils";

/**
 * An uploaded PDF shown as itself: its real pages, read-only, with the
 * review's quoted passages highlighted on them. pdf.js is loaded only here
 * (this file is imported lazily), so no other page carries it.
 *
 * A quote is found in the page's own text (the page the server named first,
 * then every page) and drawn over the words it covers. A quote that cannot be
 * found on any page gets no highlight; its chip in the feedback still shows.
 */

export interface PdfAnchor {
  id: string;
  quote: string;
  /** 1-based page the server found the quote on, when it said. */
  page?: number;
}

export interface PdfViewHandle {
  /** Scrolls a highlighted passage into view; false when it could not be found on a page. */
  showAnchor: (id: string) => boolean;
}

/** One run of text on a page, with the characters it holds and where it sits (fractions of the page). */
interface Run {
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PageInfo {
  num: number;
  /** Width over height of the page. */
  ratio: number;
  text: string;
  runs: Run[];
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type PdfJs = typeof import("pdfjs-dist");

let pdfjs: Promise<PdfJs> | null = null;
/** pdf.js, fetched on first use (the PDF viewer and the first-page thumbnail share one copy). */
export function loadPdfJs(): Promise<PdfJs> {
  // The legacy build runs on older phones too (no Promise.withResolvers needed).
  pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((lib) => {
    const mod = lib as unknown as PdfJs;
    mod.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    return mod;
  });
  return pdfjs;
}

/** The page's text as one string, and where each run of it is drawn. */
async function readPage(doc: PDFDocumentProxy, num: number): Promise<PageInfo> {
  const page = await doc.getPage(num);
  const view = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  let text = "";
  const runs: Run[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const str = item.str;
    if (str) {
      const [vx, vy] = view.convertToViewportPoint(item.transform[4], item.transform[5]);
      const h = item.height || Math.abs(item.transform[3]) || 10;
      runs.push({ start: text.length, end: text.length + str.length, x: vx / view.width, y: (vy - h) / view.height, w: item.width / view.width, h: (h * 1.18) / view.height });
      text += str;
    }
    // A line end (or a gap between runs) is a word break.
    if (item.hasEOL || (str && !/\s$/.test(str))) text += " ";
  }
  return { num, ratio: view.width / view.height, text, runs };
}

/** The boxes that cover characters `from`..`to` of a page's text. */
function rectsFor(page: PageInfo, from: number, to: number): Rect[] {
  const out: Rect[] = [];
  for (const r of page.runs) {
    if (r.end <= from || r.start >= to) continue;
    const len = Math.max(1, r.end - r.start);
    const a = (Math.max(from, r.start) - r.start) / len;
    const b = (Math.min(to, r.end) - r.start) / len;
    out.push({ left: r.x + r.w * a, top: r.y, width: r.w * (b - a), height: r.h });
  }
  return out;
}

function locate(pages: PageInfo[], anchors: PdfAnchor[]): Map<string, { page: number; rects: Rect[] }> {
  const found = new Map<string, { page: number; rects: Rect[] }>();
  for (const a of anchors) {
    const named = a.page ? pages.filter((p) => p.num === a.page) : [];
    for (const page of [...named, ...pages.filter((p) => p.num !== a.page)]) {
      const ranges = findQuote(page.text, a.quote);
      if (ranges.length === 0) continue;
      found.set(a.id, { page: page.num, rects: ranges.flatMap((r) => rectsFor(page, r.start, r.end)) });
      break;
    }
  }
  return found;
}

function PdfPage({ doc, info, width, marks, active, onAnchorClick, total }: { doc: PDFDocumentProxy; info: PageInfo; /** Shown width in CSS pixels. */ width: number; marks: Array<{ id: string; rects: Rect[] }>; active: string | null; onAnchorClick: (id: string) => void; total: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(info.num <= 2);

  // Pages are drawn as they come near the screen, not all at once.
  useEffect(() => {
    const el = holder.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void doc.getPage(info.num).then((page) => {
      const el = canvas.current;
      if (cancelled || !el) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      el.width = Math.round(viewport.width);
      el.height = Math.round(viewport.height);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, info.num, near, width]);

  return (
    <div ref={holder} className="cw-pdf-page relative mx-auto bg-white" style={{ width, aspectRatio: String(info.ratio) }} role="img" aria-label={`Page ${info.num} of ${total}`} data-page={info.num}>
      <canvas ref={canvas} className="block size-full" aria-hidden />
      {/* The page's words for a screen reader (the canvas is a picture). */}
      <p className="sr-only">{info.text}</p>
      {marks.map((m) =>
        m.rects.map((r, i) => (
          <button
            key={`${m.id}-${i}`}
            type="button"
            data-anchor={m.id}
            tabIndex={i === 0 ? 0 : -1}
            aria-label="Open the feedback for this passage"
            onClick={() => onAnchorClick(m.id)}
            className={cn("cw-pdf-mark absolute", m.id === active && "cw-pdf-mark--active")}
            style={{ left: `${r.left * 100}%`, top: `${r.top * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}
          />
        )),
      )}
      <span className="pointer-events-none absolute bottom-2 right-3 text-caption font-bold tabular-nums text-muted-foreground" aria-hidden>
        {info.num} / {total}
      </span>
    </div>
  );
}

export default function PdfView({
  url,
  anchors,
  activeAnchor,
  onAnchorClick,
  onLocated,
  zoom,
  handleRef,
  failed,
}: {
  url: string;
  anchors: PdfAnchor[];
  activeAnchor: string | null;
  onAnchorClick: (id: string) => void;
  /** Which page each quote was found on, in page order (quotes that were not found are absent). */
  onLocated: (pages: Map<string, number>) => void;
  zoom: number;
  handleRef?: Ref<PdfViewHandle>;
  /** Shown when the file cannot be drawn. */
  failed: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ url: string; doc: PDFDocumentProxy; pages: PageInfo[] } | { url: string; error: true } | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    loadPdfJs()
      .then((lib) => lib.getDocument({ url }).promise)
      .then(async (doc) => {
        opened = doc;
        const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => readPage(doc, i + 1)));
        if (!cancelled) setState({ url, doc, pages });
      })
      .catch(() => !cancelled && setState({ url, error: true }));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = state && state.url === url && "doc" in state ? state : null;
  const located = useMemo(() => (ready ? locate(ready.pages, anchors) : new Map<string, { page: number; rects: Rect[] }>()), [ready, anchors]);

  const report = useRef(onLocated);
  useEffect(() => {
    report.current = onLocated;
  });
  useEffect(() => {
    if (!ready) return;
    const byPage = [...located.entries()].sort((a, b) => a[1].page - b[1].page || a[1].rects[0].top - b[1].rects[0].top);
    report.current(new Map(byPage.map(([id, v]) => [id, v.page])));
  }, [ready, located]);

  useImperativeHandle(
    handleRef,
    () => ({
      showAnchor: (id) => {
        const el = wrap.current?.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(id)}"]`);
        if (!el) return false;
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return true;
      },
    }),
    [],
  );

  // A page fills the column (up to a comfortable reading width) at 100%.
  const pageWidth = Math.round(Math.min(width, 860) * zoom);

  return (
    <div ref={wrap} className="cw-pdf overflow-x-auto py-4">
      {state && state.url === url && "error" in state ? (
        failed
      ) : !ready ? (
        <div className="mx-auto aspect-[1/1.414] w-full max-w-[860px] animate-pulse bg-white" aria-busy="true" />
      ) : (
        <div className="flex flex-col gap-4">
          {ready.pages.map((info) => (
            <PdfPage
              key={info.num}
              doc={ready.doc}
              info={info}
              width={pageWidth}
              total={ready.pages.length}
              active={activeAnchor}
              onAnchorClick={onAnchorClick}
              marks={[...located.entries()].filter(([, v]) => v.page === info.num).map(([id, v]) => ({ id, rects: v.rects }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
