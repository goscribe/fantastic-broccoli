"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { bodyMath, LONE_PAGE_NUMBER, MATH_CLASS, type DocMath } from "@/lib/docx-math";
import { findQuote } from "@/lib/quote-match";
import { safeHtml } from "@/lib/safe-html";
import { useCw } from "./use-cw";

/**
 * An uploaded Word file shown as itself, read-only: its pages, fonts, tables,
 * images, headers, footers and footnotes as docx-preview lays them out, with
 * the review's quoted passages highlighted in it. The renderer is loaded only
 * here (this file is imported lazily), so no other page carries it.
 *
 * When the original cannot be drawn (the renderer fails, or it shows far less
 * text than the server read from the file), the server's HTML of the file is
 * shown instead in a page-shaped column: plainer, but everything is there.
 *
 * A quote is found in the text that was drawn (like the PDF view does with a
 * page's text) and wrapped in a mark. A quote that cannot be found gets no
 * highlight; its chip in the feedback still shows.
 */

export interface DocxAnchor {
  id: string;
  quote: string;
}

export interface DocxViewHandle {
  /** Scrolls a highlighted passage into view; false when it was not found in the file. */
  showAnchor: (id: string) => boolean;
}

const BLOCK = "p,li,td,th,h1,h2,h3,h4,h5,h6,div,section,article,header,footer,tr,table";
const MARK = "cw-docx-mark";
const wordsIn = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;

/**
 * The drawn text as one string, and which text node each stretch of it came
 * from. An equation drawn from the server's LaTeX counts as that LaTeX
 * ("$\frac{a}{b}$", as in the text that was reviewed) and is never wrapped;
 * page headers and footers are not the work and are left out.
 */
function textIndex(root: HTMLElement): { text: string; nodes: Array<{ node: Text; start: number; end: number }> } {
  let text = "";
  let lastBlock: Element | null = null;
  const nodes: Array<{ node: Text; start: number; end: number }> = [];
  const visit = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const node = n as Text;
      if (!node.data) return;
      const block = node.parentElement?.closest(BLOCK) ?? null;
      // A new paragraph or cell is a word break, even when the file has no space there.
      if (block !== lastBlock && text && !/\s$/.test(text)) text += " ";
      lastBlock = block;
      nodes.push({ node, start: text.length, end: text.length + node.data.length });
      text += node.data;
      return;
    }
    if (!(n instanceof Element) || /^(?:STYLE|SCRIPT|HEADER|FOOTER)$/.test(n.tagName)) return;
    if (n.classList.contains(MATH_CLASS)) {
      const latex = n.getAttribute("data-latex") ?? "";
      const display = n.getAttribute("data-block") === "1";
      text += `${text && !/\s$/.test(text) ? " " : ""}${display ? `$$${latex}$$` : `$${latex}$`} `;
      return;
    }
    for (const c of n.childNodes) visit(c);
  };
  visit(root);
  return { text, nodes };
}

type Katex = { render(latex: string, el: HTMLElement, o: object): void };

/** An equation drawn with KaTeX from its LaTeX (a formula KaTeX cannot read shows its source). */
function mathElement(katex: Katex, m: DocMath): HTMLElement {
  const el = document.createElement("span");
  el.className = MATH_CLASS;
  el.setAttribute("data-latex", m.latex);
  el.setAttribute("data-block", m.block ? "1" : "0");
  try {
    katex.render(m.latex, el, { throwOnError: false, displayMode: m.block, strict: "ignore" });
  } catch {
    el.textContent = m.latex;
  }
  return el;
}

/**
 * The original's equations (docx-preview's MathML: accents lost, every token
 * on its own line) drawn again from the server's LaTeX, in document order.
 * Only when both found the same number of body equations, so each is paired
 * with its own; otherwise the original's drawing stays.
 */
function redrawMath(root: HTMLElement, maths: DocMath[], katex: Katex): number {
  const drawn = [...root.querySelectorAll("section.cw-docx > article math")];
  if (!drawn.length || drawn.length !== maths.length) return 0;
  drawn.forEach((m, i) => m.replaceWith(mathElement(katex, maths[i])));
  return drawn.length;
}

/** Headers and footers that hold only a page number: Word saves one value ("1") that would show on every page. */
function dropPageNumbers(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>("section.cw-docx > header, section.cw-docx > footer")) {
    const t = (el.textContent ?? "").trim();
    if (t && LONE_PAGE_NUMBER.test(t) && !el.querySelector("img,svg,table")) el.replaceChildren();
  }
}

function clearMarks(root: HTMLElement) {
  for (const m of [...root.querySelectorAll(`mark.${MARK}`)]) {
    const parent = m.parentNode;
    if (!parent) continue;
    m.replaceWith(...m.childNodes);
    parent.normalize();
  }
}

/** The heading a passage sits under ("Criterion C: Development"), for its chip. */
function headingFinder(root: HTMLElement): (el: Element) => string {
  const headings = [...root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p")].filter((el) => {
    if (el.closest("header,footer,table")) return false;
    const isHeading = /^H[1-6]$/.test(el.tagName) || (/heading|title/i.test(el.className) && !/toc/i.test(el.className));
    const t = (el.textContent ?? "").trim();
    return isHeading && t.length > 0 && t.length <= 120;
  });
  return (el) => {
    let found = "";
    for (const h of headings) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = (h.textContent ?? "").trim().replace(/\s+/g, " ");
      else break;
    }
    return found;
  };
}

/**
 * Wraps each quote where it was drawn. Returns, in document order, the
 * heading each found quote sits under ("" when it is under none).
 */
function applyMarks(root: HTMLElement, anchors: DocxAnchor[]): Map<string, string> {
  clearMarks(root);
  const { text, nodes } = textIndex(root);
  const ops: Array<{ at: number; from: number; to: number; id: string; order: number }> = [];
  const firstAt = new Map<string, number>();
  for (const a of anchors) {
    for (const r of findQuote(text, a.quote)) {
      if (!firstAt.has(a.id)) firstAt.set(a.id, r.start);
      nodes.forEach((n, at) => {
        if (n.end <= r.start || n.start >= r.end) return;
        const from = Math.max(r.start, n.start) - n.start;
        const to = Math.min(r.end, n.end) - n.start;
        if (to > from && n.node.data.slice(from, to).trim()) ops.push({ at, from, to, id: a.id, order: r.start });
      });
    }
  }
  // Last first, so the offsets of what is still to wrap in a text node stay true; overlapping quotes keep the first.
  ops.sort((x, y) => y.at - x.at || y.from - x.from);
  let prev: { at: number; from: number } | null = null;
  for (const op of ops) {
    if (prev && prev.at === op.at && op.to > prev.from) continue;
    prev = { at: op.at, from: op.from };
    try {
      const range = document.createRange();
      range.setStart(nodes[op.at].node, op.from);
      range.setEnd(nodes[op.at].node, op.to);
      const mark = document.createElement("mark");
      mark.className = MARK;
      mark.dataset.anchor = op.id;
      range.surroundContents(mark);
    } catch {
      /* the passage could not be wrapped here: its chip still shows */
    }
  }
  const heading = headingFinder(root);
  const out = new Map<string, string>();
  for (const [id] of [...firstAt.entries()].sort((x, y) => x[1] - y[1])) {
    const first = root.querySelector<HTMLElement>(`mark.${MARK}[data-anchor="${CSS.escape(id)}"]`);
    if (!first) continue;
    // One stop per passage for the keyboard.
    first.tabIndex = 0;
    first.setAttribute("role", "button");
    first.setAttribute("aria-label", "Open the feedback for this passage");
    out.set(id, heading(first));
  }
  return out;
}

export default function DocxView({
  url,
  html,
  text,
  anchors,
  activeAnchor,
  onAnchorClick,
  onLocated,
  zoom,
  handleRef,
  failed,
}: {
  /** A signed link to the original .docx. */
  url: string | null;
  /** The server's HTML of the file: the fallback when the original cannot be drawn. */
  html: string | null;
  /** The text the server read from the file (to tell a bad rendering from a good one). */
  text: string;
  anchors: DocxAnchor[];
  activeAnchor: string | null;
  onAnchorClick: (id: string) => void;
  /** The heading each found quote sits under, in document order (quotes that were not found are absent). */
  onLocated: (places: Map<string, string>) => void;
  zoom: number;
  handleRef?: Ref<DocxViewHandle>;
  /** Shown when neither the original nor the server's HTML can be drawn. */
  failed: React.ReactNode;
}) {
  const { t } = useCw();
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<{ key: string; kind: "docx" | "plain" | "failed" } | null>(null);
  const [width, setWidth] = useState(0);
  const key = `${url ?? ""}|${html ? html.length : 0}`;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const maths = bodyMath(html);
    const loadKatex = (): Promise<Katex | null> => (maths.length ? import("katex").then((m) => m.default as unknown as Katex).catch(() => null) : Promise.resolve(null));
    const plain = async () => {
      if (cancelled) return;
      if (!html) return setMode({ key, kind: "failed" });
      el.innerHTML = `<div class="cw-docx-wrapper"><section class="cw-docx cw-docx-plain">${safeHtml(html)}</section></div>`;
      // The server's HTML carries each equation's LaTeX: drawn with KaTeX in place of its source text.
      const katex = await loadKatex();
      if (cancelled) return;
      if (katex) {
        for (const m of el.querySelectorAll<HTMLElement>('[data-type="inline-math"][data-latex], [data-type="block-math"][data-latex]')) {
          const latex = m.getAttribute("data-latex") ?? "";
          m.replaceWith(mathElement(katex, { latex, block: m.getAttribute("data-type") === "block-math" || latex.startsWith("\\displaystyle") }));
        }
      }
      setMode({ key, kind: "plain" });
    };
    if (!url) {
      // The link is still being made; the server's HTML is not shown in its place (it would flash).
      return;
    }
    (async () => {
      try {
        const [lib, res, katex] = await Promise.all([import("docx-preview"), fetch(url), loadKatex()]);
        if (!res.ok) throw new Error("file");
        const blob = await res.blob();
        if (cancelled) return;
        // Drawn in place (laid out but not yet shown): the renderer measures tab stops on the page.
        el.replaceChildren();
        await lib.renderAsync(blob, el, undefined, {
          className: "cw-docx",
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
          experimental: true,
        });
        if (cancelled) return;
        // Drawn badly: no page at all, or far less text than the server read from the same file.
        const pages = el.querySelectorAll("section.cw-docx");
        const want = wordsIn(text);
        const got = wordsIn([...pages].map((p) => p.textContent ?? "").join(" "));
        if (pages.length === 0 || (want > 80 && got < want * 0.6)) throw new Error("incomplete");
        dropPageNumbers(el);
        if (katex) redrawMath(el, maths, katex);
        setMode({ key, kind: "docx" });
      } catch {
        await plain();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, html, text, key]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = mode && mode.key === key && mode.kind !== "failed" ? mode.kind : null;

  // A page fills the column (up to its real width) at 100%, like a PDF page does.
  useEffect(() => {
    const el = host.current;
    if (!el || !ready || width <= 0) return;
    el.style.zoom = "1";
    const page = el.querySelector<HTMLElement>("section.cw-docx");
    const natural = page?.offsetWidth || 794;
    el.style.zoom = String(Math.min(1, Math.min(width, 860) / natural) * zoom);
  }, [ready, width, zoom]);

  const report = useRef(onLocated);
  const click = useRef(onAnchorClick);
  useEffect(() => {
    report.current = onLocated;
    click.current = onAnchorClick;
  });

  useEffect(() => {
    const el = host.current;
    if (!el || !ready) return;
    report.current(applyMarks(el, anchors));
  }, [ready, anchors]);

  useEffect(() => {
    const el = host.current;
    if (!el || !ready) return;
    for (const m of el.querySelectorAll<HTMLElement>(`mark.${MARK}`)) m.classList.toggle(`${MARK}--active`, m.dataset.anchor === activeAnchor);
  }, [ready, anchors, activeAnchor]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const open = (target: EventTarget | null) => {
      const mark = target instanceof Element ? target.closest<HTMLElement>(`mark.${MARK}`) : null;
      if (mark?.dataset.anchor) click.current(mark.dataset.anchor);
      return !!mark;
    };
    const onClick = (e: MouseEvent) => {
      // A read-only preview: links inside the file do not navigate away from the review.
      if (!open(e.target) && e.target instanceof Element && e.target.closest("a")) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && open(e.target)) e.preventDefault();
    };
    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
    };
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      showAnchor: (id) => {
        const el = host.current?.querySelector<HTMLElement>(`mark.${MARK}[data-anchor="${CSS.escape(id)}"]`);
        if (!el) return false;
        el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return true;
      },
    }),
    [],
  );

  return (
    <div ref={wrap} className="cw-docx-view overflow-x-auto py-4">
      {mode?.key === key && mode.kind === "failed" && failed}
      {!ready && !(mode?.key === key && mode.kind === "failed") && <div className="mx-auto aspect-[1/1.414] w-full max-w-[860px] animate-pulse bg-white" aria-busy="true" />}
      {ready === "plain" && <p className="mx-auto mb-3 max-w-[860px] text-small font-semibold text-muted-foreground">{t("cw.file.wordFallback")}</p>}
      <div ref={host} className="cw-docx-host" style={ready ? undefined : { visibility: "hidden", height: 0, overflow: "hidden" }} />
    </div>
  );
}
