"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { safeHtml } from "@/lib/safe-html";
import { cn } from "@/lib/utils";
import { loadPdfJs } from "./pdf-view";
import { useCw } from "./use-cw";

/**
 * A page-shaped thumbnail of a piece of work: the first page of a PDF (pdf.js),
 * the first page of a Word file (docx-preview, or the server's HTML when that
 * cannot draw it), or the first lines of pasted text. Each renderer is fetched
 * only when its kind of file is shown; a skeleton holds the place meanwhile,
 * and the plain file icon is what is left when nothing can be drawn.
 */

const PAGE_W = 794; // an A4 page at 96 dpi, the width the Word renderers lay out at

export interface DraftPreviewProps {
  format: "pdf" | "docx" | "text" | "other";
  /** A signed link to the original file (PDF, Word). */
  url?: string | null;
  /** A Word file's HTML from the server: the fallback when the original cannot be drawn. */
  html?: string | null;
  /** Plain text, for pasted work. */
  text?: string | null;
  /** Shown width in CSS pixels; the height follows the page shape. */
  width?: number;
  /** Tapping the preview opens the document. */
  onOpen?: () => void;
  name: string;
  className?: string;
}

type State = "loading" | "ready" | "none";

export function DraftPreview({ format, url, html, text, width = 64, onOpen, name, className }: DraftPreviewProps) {
  const { t } = useCw();
  const canvas = useRef<HTMLCanvasElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>(format === "text" ? "ready" : "loading");
  const [pages, setPages] = useState<number | null>(null);
  const height = Math.round(width * 1.414);
  const scale = width / PAGE_W;

  useEffect(() => {
    let cancelled = false;
    const done = (s: State) => !cancelled && setState(s);
    if (format === "pdf") {
      if (!url) return;
      let opened: { destroy: () => Promise<void> } | null = null;
      loadPdfJs()
        .then((lib) => lib.getDocument({ url }).promise)
        .then(async (doc) => {
          opened = doc;
          const first = await doc.getPage(1);
          const el = canvas.current;
          if (cancelled || !el) return;
          const base = first.getViewport({ scale: 1 });
          const viewport = first.getViewport({ scale: (width / base.width) * Math.min(3, (window.devicePixelRatio || 1) * 1.5) });
          el.width = Math.round(viewport.width);
          el.height = Math.round(viewport.height);
          const ctx = el.getContext("2d");
          if (!ctx) return done("none");
          await first.render({ canvasContext: ctx, viewport }).promise;
          if (!cancelled) setPages(doc.numPages);
          done("ready");
        })
        .catch(() => done("none"));
      return () => {
        cancelled = true;
        void opened?.destroy();
      };
    }
    if (format === "docx") {
      const host = page.current;
      if (!host) return;
      const plain = () => {
        if (!html) return done("none");
        host.innerHTML = `<div class="cw-docx-plain">${safeHtml(html.slice(0, 60_000))}</div>`;
        done("ready");
      };
      if (!url) {
        plain();
        return;
      }
      (async () => {
        try {
          const [lib, res] = await Promise.all([import("docx-preview"), fetch(url)]);
          if (!res.ok) throw new Error("file");
          const blob = await res.blob();
          if (cancelled) return;
          const scratch = document.createElement("div");
          await lib.renderAsync(blob, scratch, undefined, { className: "cw-docx-thumb", inWrapper: false, breakPages: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: false, renderFootnotes: false, renderEndnotes: false, useBase64URL: true });
          const first = scratch.querySelector("section");
          if (cancelled) return;
          if (!first || !(first.textContent ?? "").trim() && !first.querySelector("img")) throw new Error("empty");
          // Only the first page is kept: the styles the renderer wrote, and that one section.
          host.replaceChildren(...scratch.querySelectorAll("style"), first);
          done("ready");
        } catch {
          if (!cancelled) plain();
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (format === "other") done("none");
    return () => {
      cancelled = true;
    };
  }, [format, url, html, width]);

  const label = t("cw.preview.open", { name });
  const frame = cn("cw-thumb relative block shrink-0 overflow-hidden rounded-[6px] bg-white", onOpen && "cursor-pointer", className);
  const body =
    state === "none" ? (
      <span className="grid size-full place-items-center">
        <FileText className="size-6 text-muted-foreground" aria-hidden />
      </span>
    ) : (
      <>
        {format === "pdf" && <canvas ref={canvas} className={cn("block size-full", state !== "ready" && "opacity-0")} aria-hidden />}
        {format === "docx" && <div ref={page} aria-hidden className={cn("cw-thumb-page pointer-events-none absolute left-0 top-0 origin-top-left select-none", state !== "ready" && "opacity-0")} style={{ width: PAGE_W, transform: `scale(${scale})` }} />}
        {format === "text" && (
          <div aria-hidden className="cw-thumb-page pointer-events-none absolute left-0 top-0 origin-top-left select-none px-[72px] py-[80px] text-[26px] leading-[1.5] text-foreground" style={{ width: PAGE_W, transform: `scale(${scale})` }}>
            {(text ?? "")
              .slice(0, 1400)
              .split(/\n+/)
              .filter(Boolean)
              .slice(0, 8)
              .map((para, i) => (
                <p key={i} className={i === 0 ? "mb-5 font-extrabold" : "mb-5"}>
                  {para}
                </p>
              ))}
          </div>
        )}
        {state === "loading" && <span className="absolute inset-0 animate-pulse bg-muted" aria-hidden />}
      </>
    );
  const style = { width, height };
  const count = pages ? <span className="sr-only">{pages === 1 ? t("cw.preview.page") : t("cw.preview.pages", { n: pages })}</span> : null;
  return (
    <span className="flex shrink-0 flex-col items-center gap-1" data-pages={pages ?? undefined}>
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={label} title={label} className={frame} style={style} aria-busy={state === "loading"}>
          {body}
        </button>
      ) : (
        <span className={frame} style={style} role="img" aria-label={name} aria-busy={state === "loading"}>
          {body}
        </span>
      )}
      {count}
    </span>
  );
}

/** "18 pages" once the PDF has been opened (the thumbnail reports it through `data-pages`); the server's count is used when it has one. */
export function pagesLabel(t: (key: string, vars?: Record<string, string | number>) => string, pageCount: number | null | undefined): string | null {
  if (!pageCount) return null;
  return pageCount === 1 ? t("cw.preview.page") : t("cw.preview.pages", { n: pageCount });
}
