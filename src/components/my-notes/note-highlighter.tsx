"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { myNotesApi, myNotesAvailable, type HighlightAnchor, type HighlightColor, type NoteHighlight, type NoteRef } from "@/lib/api/my-notes";
import { HIGHLIGHT_COLORS, lastHighlightColor, locateInNote, makeAnchor, rememberHighlightColor, sortByPlace } from "@/lib/my-notes";
import { toastError } from "@/lib/toast";
import { HighlightsSheet, type HighlightItem } from "./highlights-list";

/**
 * Highlighting in a note that is READ (a Scribe topic note): select text and
 * a small toolbar offers the four highlighters; tap a highlight to recolour
 * or remove it. Highlights are kept on the server per reader per note, so
 * they are there on every device.
 *
 * The note's markup is never touched. A highlight is an anchor (section,
 * words, a little either side, offset) turned into a DOM Range each time the
 * note is on screen and painted with the CSS Custom Highlight API, so React
 * keeps owning the page; when the note was corrected the words are found
 * again, and a highlight whose words are gone is left unpainted. A browser
 * without that API still keeps and lists highlights; it just does not paint.
 *
 * The same interaction as the session reader's "Select text to highlight"
 * (colour dots over the selection), working with a mouse, with touch
 * (long-press selection: the toolbar sits under the selection, clear of the
 * system's own menu) and with a keyboard (select with Shift+arrows, press H).
 */

const SECTION = "section[data-nl-section]";
const SKIP = "svg, .katex-mathml, script, style, button, input, textarea, select";
/**
 * The paint for each highlighter: the four colours of tokens.css (--hl-yellow,
 * --hl-green, --hl-pink, --hl-blue) written out, because ::highlight() does
 * not read custom properties in every browser. Added as a style element (the
 * CSS build does not know the ::highlight() pseudo-element yet).
 */
const PAINT_CSS = `::highlight(note-hl-yellow){background-color:#ffe08f;color:inherit}::highlight(note-hl-green){background-color:#bfeccb;color:inherit}::highlight(note-hl-pink){background-color:#ffc7dc;color:inherit}::highlight(note-hl-blue){background-color:#bfdcff;color:inherit}::highlight(note-hl-flash){background-color:#16161a;color:#fff}`;
const PAINT: Record<HighlightColor, string> = { yellow: "note-hl-yellow", green: "note-hl-green", pink: "note-hl-pink", blue: "note-hl-blue" };

interface SectionText {
  id: string;
  el: HTMLElement;
  text: string;
  nodes: { node: Text; start: number }[];
}

function readSection(el: HTMLElement): SectionText {
  const nodes: { node: Text; start: number }[] = [];
  let text = "";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const value = n.nodeValue ?? "";
    if (!value) continue;
    nodes.push({ node: n as Text, start: text.length });
    text += value;
  }
  return { id: el.dataset.nlSection ?? "", el, text, nodes };
}

function readSections(root: HTMLElement): SectionText[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SECTION)).map(readSection);
}

/** Where a DOM point falls in a section's text. */
function offsetOf(section: SectionText, container: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(container, offset);
  for (const { node, start } of section.nodes) {
    if (node === container) return start + offset;
    // The first text node that starts after the point: the point is just before it.
    if (point.comparePoint(node, 0) > 0) return start;
  }
  return section.text.length;
}

function rangeOf(section: SectionText, start: number, end: number): Range | null {
  const at = (pos: number, isEnd: boolean) => {
    for (let i = section.nodes.length - 1; i >= 0; i--) {
      const n = section.nodes[i];
      if (pos > n.start || (!isEnd && pos === n.start)) return { node: n.node, offset: Math.min(pos - n.start, n.node.length) };
    }
    return section.nodes[0] ? { node: section.nodes[0].node, offset: 0 } : null;
  };
  const a = at(start, false);
  const b = at(end, true);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  return r;
}

interface Placed {
  h: NoteHighlight;
  sectionId: string;
  start: number;
  range: Range;
}

interface Bar {
  x: number;
  y: number;
  below: boolean;
  /** A new highlight over this selection… */
  anchor?: HighlightAnchor;
  /** …or an existing one that was tapped. */
  existing?: NoteHighlight;
}

const supported = () => typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

export function useNoteHighlights({ note, rootId, enabled, partial }: { note: NoteRef; rootId: string; enabled: boolean; /** Only part of the note is on the page (a locked preview): highlights elsewhere are not "changed". */ partial?: boolean }): {
  /** False on a server without highlights: show nothing. */
  available: boolean;
  count: number;
  open: () => void;
  ui: ReactNode;
} {
  const [available, setAvailable] = useState(false);
  const [rows, setRows] = useState<NoteHighlight[]>([]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [bar, setBar] = useState<Bar | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const noteKey = note.kind === "topic" ? `${note.courseId}/${note.topicId}` : note.documentId;
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    myNotesAvailable()
      .then((ok) => (ok ? myNotesApi.highlights(noteRef.current) : null))
      .then((out) => {
        if (cancelled || !out) return;
        setAvailable(true);
        setRows(out.highlights);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, noteKey]);

  // Anchors → ranges, again whenever the highlights or the note's markup change (figures mount late).
  const place = useCallback(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const sections = readSections(root);
    const texts = sections.map((s) => ({ id: s.id, text: s.text }));
    const next: Placed[] = [];
    for (const h of rows) {
      const hit = locateInNote(texts, h);
      const section = hit && sections.find((s) => s.id === hit.sectionId);
      const range = hit && section ? rangeOf(section, hit.start, hit.end) : null;
      if (hit && range) next.push({ h, sectionId: hit.sectionId, start: hit.start, range });
    }
    setPlaced(sortByPlace(next, sections.map((s) => s.id)));
  }, [rows, rootId]);

  useEffect(() => {
    if (!available) return;
    // Once the note has painted (the reader renders it in the same pass as this hook).
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(place, 0);
    const root = document.getElementById(rootId);
    if (!root || typeof MutationObserver === "undefined") return () => void (timer && clearTimeout(timer));
    const mo = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(place, 250);
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [available, place, rootId]);

  // Paint.
  useEffect(() => {
    if (!supported()) return;
    for (const c of HIGHLIGHT_COLORS) {
      const ranges = placed.filter((p) => p.h.color === c.id).map((p) => p.range);
      if (ranges.length) CSS.highlights.set(PAINT[c.id], new Highlight(...ranges));
      else CSS.highlights.delete(PAINT[c.id]);
    }
    return () => {
      for (const c of HIGHLIGHT_COLORS) CSS.highlights.delete(PAINT[c.id]);
    };
  }, [placed]);

  const placedRef = useRef(placed);
  useEffect(() => {
    placedRef.current = placed;
  }, [placed]);

  // A selection inside the note offers the highlighters.
  useEffect(() => {
    if (!available) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      const root = document.getElementById(rootId);
      const sel = window.getSelection();
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setBar((b) => (b?.anchor ? null : b));
        return;
      }
      const range = sel.getRangeAt(0);
      const startEl = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const sectionEl = startEl?.closest<HTMLElement>(SECTION);
      if (!sectionEl || !root.contains(sectionEl) || startEl?.closest("button, input, textarea")) {
        setBar((b) => (b?.anchor ? null : b));
        return;
      }
      const section = readSection(sectionEl);
      const start = offsetOf(section, range.startContainer, range.startOffset);
      // A selection that runs on into the next section is cut at the end of this one.
      const end = sectionEl.contains(range.endContainer) ? offsetOf(section, range.endContainer, range.endOffset) : section.text.length;
      const anchor = makeAnchor(section.id, section.text, start, end);
      if (!anchor) return setBar(null);
      const rect = range.getBoundingClientRect();
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const below = touch || rect.top < 130;
      setBar({ x: Math.max(110, Math.min(rect.left + rect.width / 2, window.innerWidth - 110)), y: below ? Math.min(rect.bottom + (touch ? 48 : 10), window.innerHeight - 130) : rect.top - 10, below, anchor });
    };
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(read, 180);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      if (timer) clearTimeout(timer);
    };
  }, [available, rootId]);

  // A tap on a highlight offers recolour and remove.
  useEffect(() => {
    if (!available) return;
    const root = document.getElementById(rootId);
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if ((e.target as HTMLElement | null)?.closest("a, button, input, textarea, summary")) return;
      const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
      const caret = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
      const legacy = caret ? null : document.caretRangeFromPoint?.(e.clientX, e.clientY);
      const node = caret?.offsetNode ?? legacy?.startContainer;
      const offset = caret?.offset ?? legacy?.startOffset ?? 0;
      if (!node) return;
      const hit = placedRef.current.find((p) => {
        try {
          return p.range.isPointInRange(node, offset);
        } catch {
          return false;
        }
      });
      if (!hit) return setBar(null);
      const rect = hit.range.getBoundingClientRect();
      const below = rect.top < 130;
      setBar({ x: Math.max(110, Math.min(e.clientX, window.innerWidth - 110)), y: below ? rect.bottom + 10 : rect.top - 10, below, existing: hit.h });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [available, rootId]);

  const add = useCallback(async (anchor: HighlightAnchor, color: HighlightColor) => {
    rememberHighlightColor(color);
    window.getSelection()?.removeAllRanges();
    setBar(null);
    const temp: NoteHighlight = { ...anchor, id: `local-${Date.now()}`, color, createdAt: new Date() };
    setRows((r) => [...r, temp]);
    try {
      const saved = await myNotesApi.addHighlight({ ref: noteRef.current, anchor, color });
      setRows((r) => r.filter((h) => h.id !== temp.id && h.id !== saved.id).concat(saved));
    } catch (err) {
      setRows((r) => r.filter((h) => h.id !== temp.id));
      toastError(err, "Couldn't save the highlight");
    }
  }, []);

  const recolour = useCallback((h: NoteHighlight, color: HighlightColor) => {
    rememberHighlightColor(color);
    setBar(null);
    setRows((r) => r.map((x) => (x.id === h.id ? { ...x, color } : x)));
    if (!h.id.startsWith("local-")) myNotesApi.updateHighlight({ highlightId: h.id, color }).catch(() => setRows((r) => r.map((x) => (x.id === h.id ? h : x))));
  }, []);

  const remove = useCallback((id: string) => {
    setBar(null);
    let removed: NoteHighlight | undefined;
    setRows((r) => {
      removed = r.find((h) => h.id === id);
      return r.filter((h) => h.id !== id);
    });
    if (!id.startsWith("local-"))
      myNotesApi.removeHighlight(id).catch((err) => {
        if (removed) setRows((r) => [...r, removed!]);
        toastError(err, "Couldn't remove the highlight");
      });
  }, []);

  // Keyboard: with text selected, H highlights it in the colour last used; Escape puts the toolbar away.
  useEffect(() => {
    if (!bar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setBar(null);
      if (e.key.toLowerCase() !== "h" || e.metaKey || e.ctrlKey || e.altKey || !bar.anchor) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      void add(bar.anchor, lastHighlightColor());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bar, add]);

  const jump = useCallback((id: string) => {
    const p = placedRef.current.find((x) => x.h.id === id);
    if (!p) return;
    const rect = p.range.getBoundingClientRect();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The page scrolls inside the app shell: the range's own element knows its scroller.
    const el = p.range.startContainer.parentElement;
    if (el && Math.abs(rect.top - window.innerHeight / 2) > 40) el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    if (supported()) {
      CSS.highlights.set("note-hl-flash", new Highlight(p.range));
      window.setTimeout(() => CSS.highlights.delete("note-hl-flash"), 1400);
    }
  }, []);

  const items: HighlightItem[] = useMemo(() => {
    const on = placed.map((p) => ({ key: p.h.id, text: p.h.quote, color: p.h.color }));
    const found = new Set(placed.map((p) => p.h.id));
    const missing = partial ? [] : rows.filter((h) => !found.has(h.id)).map((h) => ({ key: h.id, text: h.quote, color: h.color, missing: true }));
    return [...on, ...missing];
  }, [placed, rows, partial]);

  const ui = available ? (
    <>
      <style>{PAINT_CSS}</style>
      {bar && (
        <div
          className="note-hl-bar fixed z-[55] flex items-center gap-1 rounded-full border border-border bg-white p-1"
          style={{ left: bar.x, top: bar.y, transform: `translateX(-50%)${bar.below ? "" : " translateY(-100%)"}`, boxShadow: "0 12px 32px -16px rgb(22 22 26 / 0.35), 0 1px 2px rgb(22 22 26 / 0.05)" }}
          role="toolbar"
          aria-label={bar.existing ? "Highlight" : "Highlight the selected text"}
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="grid size-11 place-items-center rounded-full hover:bg-muted"
              aria-label={`Highlight ${c.label.toLowerCase()}`}
              aria-pressed={bar.existing?.color === c.id}
              title={bar.anchor ? `${c.label} (press H for the colour you used last)` : c.label}
              onClick={() => (bar.existing ? recolour(bar.existing, c.id) : bar.anchor && void add(bar.anchor, c.id))}
            >
              <span className="size-6 rounded-full" style={{ background: `var(${c.var})`, boxShadow: bar.existing?.color === c.id ? "0 0 0 2px #fff, 0 0 0 4px var(--foreground)" : "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }} />
            </button>
          ))}
          {bar.existing && (
            <button type="button" className="h-11 rounded-full px-3 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => remove(bar.existing!.id)}>
              Remove
            </button>
          )}
        </div>
      )}
      {listOpen && <HighlightsSheet items={items} onJump={jump} onRemove={remove} onClose={() => setListOpen(false)} />}
    </>
  ) : null;

  return { available, count: items.length, open: () => setListOpen(true), ui };
}
