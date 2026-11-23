"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor, type Editor } from "@tiptap/react";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import { Placeholder } from "@tiptap/extensions";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, deleteTable } from "@tiptap/pm/tables";
import { Bold, Heading1, Heading2, Highlighter, Italic, List, ListOrdered, Plus, Quote, Redo2, Undo2 } from "lucide-react";
import type { DiagramFigure, HighlightColor } from "@/lib/api/my-notes";
import { HIGHLIGHT_COLORS, lastHighlightColor, rememberHighlightColor } from "@/lib/my-notes";
import { looksLikeLatex, typedToLatex } from "@/lib/typed-maths";
import { cn } from "@/lib/utils";
import { ANCHOR_EVENT, Anchors, FIGURE_EVENT, Figure, Highlight, Image, Table, TableCell, TableHeader, TableRow, anchorKey, highlightRanges, type EditorAnchor } from "./extensions";
import { FigureNodeView, type FigureAction } from "./figure-view";
import { SLASH_COMMANDS, filterCommands, slashQuery, type SlashCommand, type SlashContext } from "./slash-commands";
import "./editor.css";

export type { EditorAnchor } from "./extensions";

export interface EditorDoc {
  /** tiptap JSON. */
  json: unknown;
  /** Plain text, blocks separated by a blank line. */
  text: string;
}

export interface ScribeEditorHandle {
  getDoc: () => EditorDoc | null;
  getHTML: () => string;
  setContent: (content: unknown) => void;
  /** Scrolls a marked passage into view and lights it; false when its words are no longer in the text. */
  showAnchor: (id: string) => boolean;
  /** Scrolls the nth highlighted passage (reading order, as my-notes.ts docHighlights lists them) into view; false when there is none. */
  showHighlight: (index: number) => boolean;
  /** Takes the highlighter off the nth highlighted passage. */
  removeHighlight: (index: number) => void;
  focus: () => void;
}

export interface ScribeEditorProps {
  /** Initial content (tiptap JSON). Later changes go through the handle's `setContent`. */
  content: unknown;
  onChange?: (doc: EditorDoc) => void;
  placeholder?: string;
  editable?: boolean;
  /** Passages to mark in the text (feedback evidence, comments). */
  anchors?: EditorAnchor[];
  /** The marked passage that is open. */
  activeAnchor?: string | null;
  onAnchorClick?: (id: string) => void;
  /** Stores a picture and answers with its address. Without it `/image` is not offered. */
  uploadImage?: (file: File) => Promise<string>;
  /**
   * Turns a description into a figure spec (the server's `/diagram`). Without it `/diagram` is not offered,
   * and figure blocks already in the document are shown but cannot be redrawn. A rejection's message is shown to the student.
   */
  createDiagram?: (prompt: string) => Promise<DiagramFigure>;
  /** The highlighter: select text, pick a colour. Off unless the host asks for it (a student's own notes). */
  highlighter?: boolean;
  /** A highlight was made (for the host's own counting). */
  onHighlight?: (color: HighlightColor) => void;
  /**
   * More editor extensions from the host. This is where live shared editing
   * plugs in later (a Yjs Collaboration extension and its provider): the
   * editor itself keeps no opinion on how the document is persisted.
   */
  extensions?: AnyExtension[];
  /** The right end of the toolbar: the host's own actions (word count, save state, review). */
  toolbarEnd?: ReactNode;
  /** Under the toolbar, above the text (a title field, a notice). */
  header?: ReactNode;
  handleRef?: Ref<ScribeEditorHandle>;
  /** Accessible name of the text area. */
  label: string;
  className?: string;
}

const toolBtn =
  "inline-flex h-11 min-w-10 shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-[10px] px-2 text-[14px] font-bold text-foreground/75 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35 aria-pressed:bg-[var(--muted)] aria-pressed:text-foreground";

interface MathEdit {
  pos: number;
  block: boolean;
  /** What the student typed: LaTeX, or plain typed maths that is converted as they go. */
  input: string;
}

/**
 * Scribe's document editor: headings, bold and italics, lists, quotes,
 * tables, pictures, dividers and maths, with a `/` menu to insert any of
 * them. One component for every place a student writes at length
 * (coursework now; their own notes next), so nothing in here knows what the
 * document is for: the host passes marked passages, its own toolbar actions
 * and where pictures are stored.
 */
export function ScribeEditor({
  content,
  onChange,
  placeholder,
  editable = true,
  anchors,
  activeAnchor = null,
  onAnchorClick,
  uploadImage,
  createDiagram,
  highlighter = false,
  onHighlight,
  extensions,
  toolbarEnd,
  header,
  handleRef,
  label,
  className,
}: ScribeEditorProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mathInput = useRef<HTMLInputElement>(null);
  const [math, setMath] = useState<MathEdit | null>(null);
  const [menu, setMenu] = useState<{ query: string; from: number; left: number; top: number; /** Opens upwards from here when there is no room under the line. */ bottom: number | null; manual: boolean } | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [imageBusy, setImageBusy] = useState(false);
  /** The "Describe the graph or diagram" box: for a new figure at the caret (`pos` null) or for the figure block at `pos`. */
  const [diagram, setDiagram] = useState<{ pos: number | null; at: number; prompt: string; busy: boolean; error: string | null } | null>(null);
  const [diagramBox, setDiagramBox] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const diagramInput = useRef<HTMLTextAreaElement>(null);
  /** The highlighter's colours over a selection. */
  const [bubble, setBubble] = useState<{ left: number; top: number; below: boolean } | null>(null);

  // Latest callbacks for the editor's own handlers (created once).
  const live = useRef({ onChange, onAnchorClick, menu, menuIndex, run: (() => {}) as (c: SlashCommand) => void, commands: [] as SlashCommand[], highlighter, toggleHighlight: () => {}, onFigure: (() => {}) as (pos: number, action: FigureAction) => void });

  const openMath = useCallback((pos: number, block: boolean, latex: string) => setMath({ pos, block, input: latex.trim() }), []);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable,
    content: (content as object) ?? { type: "doc", content: [{ type: "paragraph" }] },
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, strike: false, link: false, underline: false }),
      InlineMath.configure({ katexOptions: { throwOnError: false }, onClick: (node, pos) => openMath(pos, false, String(node.attrs.latex ?? "")) }),
      BlockMath.configure({ katexOptions: { throwOnError: false, displayMode: true }, onClick: (node, pos) => openMath(pos, true, String(node.attrs.latex ?? "")) }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Image,
      Highlight,
      Figure.extend({ addNodeView: () => ReactNodeViewRenderer(FigureNodeView) }),
      ...(extensions ?? []),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      Anchors,
    ],
    editorProps: {
      attributes: { class: "se-doc", role: "textbox", "aria-multiline": "true", "aria-label": label },
      handleKeyDown: (_view, event) => {
        // Ctrl/Cmd+Shift+H: the highlighter in the colour last used (again to take it off).
        if (live.current.highlighter && (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "h") {
          event.preventDefault();
          live.current.toggleHighlight();
          return true;
        }
        const m = live.current.menu;
        if (!m) return false;
        const items = live.current.commands;
        if (event.key === "Escape") {
          setMenu(null);
          return true;
        }
        if (items.length === 0) return false;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const d = event.key === "ArrowDown" ? 1 : -1;
          setMenuIndex((i) => (i + d + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          live.current.run(items[Math.min(live.current.menuIndex, items.length - 1)]);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => live.current.onChange?.({ json: e.getJSON(), text: e.getText({ blockSeparator: "\n\n" }) }),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // A tapped passage is reported to the host.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onAnchor = (e: Event) => live.current.onAnchorClick?.(String((e as CustomEvent).detail));
    el.addEventListener(ANCHOR_EVENT, onAnchor);
    return () => el.removeEventListener(ANCHOR_EVENT, onAnchor);
  }, []);

  // Marked passages follow the host's list.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(anchorKey, { anchors: anchors ?? [], active: activeAnchor }));
  }, [editor, anchors, activeAnchor]);

  // The `/` menu opens while the text before the caret reads "/word".
  const selectionFrom = editor?.state.selection.from;
  const docSize = editor?.state.doc.content.size;
  useEffect(() => {
    if (!editor || !editable) return;
    const { selection } = editor.state;
    const hit = selection.empty ? slashQuery(selection.$from.parent.textBetween(0, selection.$from.parentOffset, undefined, "\u0000")) : null;
    setMenu((prev) => {
      if (prev?.manual) return prev;
      if (!hit || !editor.isFocused) return null;
      const from = selection.from - hit.length;
      const box = wrap.current?.getBoundingClientRect();
      const at = editor.view.coordsAtPos(from);
      const left = box ? Math.max(0, Math.min(at.left - box.left, box.width - 288)) : 0;
      const top = box ? at.bottom - box.top + 6 : 0;
      // Not enough room under the line (a phone with its keyboard and tab bar): open upwards.
      const room = window.innerHeight - at.bottom - (window.innerWidth < 768 ? 72 : 8);
      const bottom = box && room < 240 && at.top - 80 > room ? box.bottom - at.top + 6 : null;
      if (prev && prev.query === hit.query && prev.from === from && prev.left === left && prev.top === top && prev.bottom === bottom) return prev;
      return { query: hit.query, from, left, top, bottom, manual: false };
    });
  }, [editor, editable, selectionFrom, docSize]);

  const context: SlashContext = useMemo(() => ({ image: !!uploadImage, diagram: !!createDiagram }), [uploadImage, createDiagram]);
  const commands = useMemo(() => (menu ? filterCommands(SLASH_COMMANDS, menu.query, context) : []), [menu, context]);
  const index = Math.min(menuIndex, Math.max(0, commands.length - 1));

  const insertMath = useCallback(
    (block: boolean) => {
      if (!editor) return;
      const pos = editor.state.selection.from;
      if (block) editor.chain().focus().insertBlockMath({ latex: " " }).run();
      else editor.chain().focus().insertInlineMath({ latex: " ", pos }).run();
      // The node lands at the caret (inline) or as the next block: find it from the selection.
      let at = pos;
      editor.state.doc.nodesBetween(Math.max(0, pos - 1), Math.min(editor.state.doc.content.size, pos + 3), (node, p) => {
        if (node.type.name === (block ? "blockMath" : "inlineMath")) at = p;
      });
      setMath({ pos: at, block, input: "" });
    },
    [editor],
  );

  const run = useCallback(
    (command: SlashCommand) => {
      if (!editor) return;
      const m = live.current.menu;
      setMenu(null);
      setMenuIndex(0);
      // Take the typed "/word" out before the block goes in.
      if (m && !m.manual) editor.chain().focus().deleteRange({ from: m.from, to: editor.state.selection.from }).run();
      const chain = () => editor.chain().focus();
      switch (command.id) {
        case "heading":
          chain().setHeading({ level: 1 }).run();
          break;
        case "subheading":
          chain().setHeading({ level: 2 }).run();
          break;
        case "bullets":
          chain().toggleBulletList().run();
          break;
        case "numbers":
          chain().toggleOrderedList().run();
          break;
        case "quote":
          chain().setBlockquote().run();
          break;
        case "divider":
          chain().setHorizontalRule().run();
          break;
        case "table": {
          const at = editor.state.selection.from;
          chain().insertTable({ rows: 3, cols: 3 }).run();
          // The caret goes into the first cell, so the headings can be typed straight away.
          let first: number | null = null;
          editor.state.doc.nodesBetween(Math.max(0, at - 2), editor.state.doc.content.size, (node, pos) => {
            if (first === null && node.type.name === "table" && pos >= at - 2) first = pos;
            return first === null;
          });
          if (first !== null) editor.chain().focus().setTextSelection(first + 4).run();
          break;
        }
        case "equation":
          insertMath(false);
          break;
        case "equation-block":
          insertMath(true);
          break;
        case "image":
          fileInput.current?.click();
          break;
        case "footnote": {
          // A numbered marker at the caret and its note at the end, both plain text the student writes.
          const n = (editor.getText().match(/\[\d+\]/g) ?? []).reduce((max, s) => Math.max(max, Number(s.slice(1, -1))), 0) + 1;
          chain().insertContent(`[${n}]`).run();
          const end = editor.state.doc.content.size;
          chain().insertContentAt(end, { type: "paragraph", content: [{ type: "text", text: `[${n}] ` }] }).focus("end").run();
          break;
        }
        case "reference": {
          // A new line under the bibliography (made when there is none) for the student to type the entry.
          const hasList = /^(bibliography|references|works cited|sources)\b/im.test(editor.getText({ blockSeparator: "\n" }));
          const end = editor.state.doc.content.size;
          const blocks = [...(hasList ? [] : [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Bibliography" }] }]), { type: "paragraph" }];
          chain().insertContentAt(end, blocks).focus("end").run();
          break;
        }
        case "diagram":
          setDiagram({ pos: null, at: editor.state.selection.from, prompt: "", busy: false, error: null });
          break;
      }
    },
    [editor, insertMath],
  );

  /* ---------- Highlighter ---------- */

  const applyHighlight = useCallback(
    (color: HighlightColor | null) => {
      if (!editor) return;
      if (color === null) editor.chain().focus().unsetHighlight().run();
      else {
        editor.chain().focus().setHighlight(color).run();
        rememberHighlightColor(color);
        onHighlight?.(color);
      }
      // The mark is made: put the caret at its end so typing carries on unmarked.
      const end = editor.state.selection.to;
      editor.chain().setTextSelection(end).unsetMark("highlight").run();
      setBubble(null);
    },
    [editor, onHighlight],
  );
  const toggleHighlight = useCallback(() => {
    if (!editor || editor.state.selection.empty) return;
    applyHighlight(editor.isActive("highlight") ? null : lastHighlightColor());
  }, [editor, applyHighlight]);

  // The colours appear over a selection (under it on touch, where the system's own menu sits above).
  const selectionTo = editor?.state.selection.to;
  useEffect(() => {
    if (!editor || !editable || !highlighter) return;
    const { selection } = editor.state;
    const box = wrap.current?.getBoundingClientRect();
    if (selection.empty || !box || !editor.isFocused || selection.to - selection.from < 1 || editor.state.doc.textBetween(selection.from, selection.to, " ").trim() === "") {
      setBubble(null);
      return;
    }
    const start = editor.view.coordsAtPos(selection.from);
    const end = editor.view.coordsAtPos(selection.to);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const below = touch || start.top - box.top < 56;
    const mid = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
    setBubble({ left: Math.max(100, Math.min(mid - box.left, box.width - 100)), top: below ? end.bottom - box.top + (touch ? 44 : 8) : start.top - box.top - 8, below });
  }, [editor, editable, highlighter, selectionFrom, selectionTo, docSize]);

  /* ---------- Figures (/diagram) ---------- */

  const draw = useCallback(
    async (d: { pos: number | null; at: number; prompt: string }) => {
    const prompt = d.prompt.trim();
    if (!editor || !createDiagram || prompt.length < 3) return;
    setDiagram({ ...d, busy: true, error: null });
    try {
      const figure = await createDiagram(prompt);
      if (d.pos !== null && editor.state.doc.nodeAt(d.pos)?.type.name === "figure") {
        editor.view.dispatch(editor.state.tr.setNodeMarkup(d.pos, undefined, { figure, prompt }));
      } else {
        editor.chain().focus().insertContentAt(Math.min(d.at, editor.state.doc.content.size), { type: "figure", attrs: { figure, prompt } }).run();
      }
      setDiagram(null);
    } catch (err) {
      setDiagram({ ...d, busy: false, error: err instanceof Error && err.message ? err.message : "We couldn't draw that one. Try describing it another way." });
      requestAnimationFrame(() => diagramInput.current?.focus());
    }
  },
    [editor, createDiagram],
  );

  const onFigure = useCallback(
    (pos: number, action: FigureAction) => {
      if (!editor) return;
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== "figure") return;
      if (action === "delete") {
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
        return;
      }
      const prompt = String(node.attrs.prompt ?? "");
      setDiagram({ pos, at: pos, prompt, busy: false, error: null });
      if (action === "redraw" && prompt.trim()) void draw({ pos, at: pos, prompt });
    },
    [editor, draw],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pos: number; action: FigureAction };
      live.current.onFigure(detail.pos, detail.action);
    };
    el.addEventListener(FIGURE_EVENT, onEvent);
    return () => el.removeEventListener(FIGURE_EVENT, onEvent);
  }, []);

  const diagramAt = diagram?.at ?? null;
  useEffect(() => {
    if (!editor || diagramAt === null) return;
    const id = requestAnimationFrame(() => {
      setDiagramBox(positionUnder(editor, Math.max(0, diagramAt - 1), wrap.current, 360) ?? { left: 0, top: 56 });
    });
    return () => cancelAnimationFrame(id);
  }, [editor, diagramAt]);

  // The open box takes the keyboard (once it is on the page).
  const diagramOpen = diagram !== null && diagramBox !== null;
  useEffect(() => {
    if (diagramOpen && document.activeElement !== diagramInput.current) diagramInput.current?.focus();
  }, [diagramOpen, diagramAt]);

  useEffect(() => {
    live.current = { onChange, onAnchorClick, menu, menuIndex: index, run, commands, highlighter, toggleHighlight, onFigure };
  });

  // The equation box sits under its formula, placed once the formula is on the page.
  const [mathBox, setMathBox] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const mathPos = math?.pos ?? null;
  useEffect(() => {
    if (!editor || mathPos === null) return;
    const id = requestAnimationFrame(() => setMathBox(positionUnder(editor, mathPos, wrap.current)));
    return () => cancelAnimationFrame(id);
  }, [editor, mathPos]);

  // An open formula takes the keyboard.
  useEffect(() => {
    if (math && mathBox && mathInput.current && document.activeElement !== mathInput.current) mathInput.current.focus();
  }, [math, mathBox]);

  const mathLatex = (input: string) => (looksLikeLatex(input) ? input : typedToLatex(input));
  const editMath = (input: string) => {
    if (!editor || !math) return;
    setMath({ ...math, input });
    const latex = mathLatex(input) || " ";
    if (math.block) editor.commands.updateBlockMath({ latex, pos: math.pos });
    else editor.commands.updateInlineMath({ latex, pos: math.pos });
  };
  const closeMath = (remove = false) => {
    if (!editor || !math) return;
    const empty = !math.input.trim();
    if (remove || empty) editor.chain().deleteRange({ from: math.pos, to: math.pos + 1 }).focus(math.pos).run();
    else editor.commands.focus(math.pos + 1);
    setMath(null);
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file || !editor || !uploadImage) return;
    setImageBusy(true);
    try {
      const src = await uploadImage(file);
      editor.chain().focus().insertImage({ src, alt: file.name.replace(/\.[a-z0-9]+$/i, "") }).run();
    } catch {
      /* the host reports its own upload errors */
    } finally {
      setImageBusy(false);
    }
  };

  useImperativeHandle(
    handleRef,
    () => ({
      getDoc: () => (editor ? { json: editor.getJSON(), text: editor.getText({ blockSeparator: "\n\n" }) } : null),
      getHTML: () => editor?.getHTML() ?? "",
      setContent: (next) => editor?.commands.setContent(next as object, { emitUpdate: true }),
      focus: () => editor?.commands.focus(),
      showHighlight: (n) => {
        const r = editor ? highlightRanges(editor.state.doc)[n] : undefined;
        if (!editor || !r) return false;
        const dom = editor.view.domAtPos(r.from + 1).node;
        const el = dom instanceof HTMLElement ? dom : dom.parentElement;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
        const mark = el?.closest("mark") ?? el?.querySelector("mark");
        mark?.classList.add("se-hl--flash");
        window.setTimeout(() => mark?.classList.remove("se-hl--flash"), 1200);
        return true;
      },
      removeHighlight: (n) => {
        const r = editor ? highlightRanges(editor.state.doc)[n] : undefined;
        if (editor && r) editor.view.dispatch(editor.state.tr.removeMark(r.from, r.to, editor.schema.marks.highlight));
      },
      showAnchor: (id) => {
        const el = editor?.view.dom.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(id)}"]`);
        if (!el) return false;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
        return true;
      },
    }),
    [editor],
  );

  const inTable = !!editor?.isActive("table");
  const tableCmd = (cmd: typeof addRowAfter) => editor && cmd(editor.state, editor.view.dispatch);

  return (
    <div ref={wrap} className={cn("se relative", className)} data-scribe-editor>
      {editable && (
        <div className="se-toolbar sticky z-20 -mx-1 flex items-center gap-0.5 overflow-x-auto bg-white px-1 py-1.5 [scrollbar-width:none]" role="toolbar" aria-label="Formatting">
          <button type="button" className={toolBtn} aria-label="Heading" title="Heading" aria-pressed={editor?.isActive("heading", { level: 1 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Subheading" title="Subheading" aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Bold" title="Bold" aria-pressed={editor?.isActive("bold") ?? false} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="size-[18px]" strokeWidth={2.6} />
          </button>
          <button type="button" className={toolBtn} aria-label="Italic" title="Italic" aria-pressed={editor?.isActive("italic") ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Bulleted list" title="Bulleted list" aria-pressed={editor?.isActive("bulletList") ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Numbered list" title="Numbered list" aria-pressed={editor?.isActive("orderedList") ?? false} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Quote" title="Quote" aria-pressed={editor?.isActive("blockquote") ?? false} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-[17px]" />
          </button>
          {highlighter && (
            <button
              type="button"
              className={toolBtn}
              aria-label="Highlight"
              title="Highlight the selected text (Ctrl+Shift+H)"
              aria-pressed={editor?.isActive("highlight") ?? false}
              disabled={!editor || editor.state.selection.empty}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHighlight}
            >
              <Highlighter className="size-[18px]" />
            </button>
          )}
          <button
            type="button"
            className={cn(toolBtn, "gap-1 pl-2 pr-3")}
            aria-haspopup="listbox"
            aria-expanded={!!menu?.manual}
            title="Insert an equation, table, picture and more (or type /)"
            onClick={() => {
              setMenuIndex(0);
              setMenu((m) => (m?.manual ? null : { query: "", from: editor?.state.selection.from ?? 0, left: 0, top: 52, bottom: null, manual: true }));
            }}
          >
            <Plus className="size-[18px]" strokeWidth={2.4} />
            Insert
          </button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <button type="button" className={toolBtn} aria-label="Undo" title="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 className="size-[18px]" />
          </button>
          <button type="button" className={toolBtn} aria-label="Redo" title="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 className="size-[18px]" />
          </button>
          {toolbarEnd && <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">{toolbarEnd}</div>}
        </div>
      )}
      {editable && inTable && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-2 text-small font-bold text-muted-foreground" role="toolbar" aria-label="Table">
          <button type="button" className="min-h-11 hover:text-foreground" onClick={() => tableCmd(addRowAfter)}>Add row</button>
          <button type="button" className="min-h-11 hover:text-foreground" onClick={() => tableCmd(addColumnAfter)}>Add column</button>
          <button type="button" className="min-h-11 hover:text-foreground" onClick={() => tableCmd(deleteRow)}>Delete row</button>
          <button type="button" className="min-h-11 hover:text-foreground" onClick={() => tableCmd(deleteColumn)}>Delete column</button>
          <button type="button" className="min-h-11 hover:text-rose-600" onClick={() => tableCmd(deleteTable)}>Delete table</button>
        </div>
      )}
      {header}
      <EditorContent editor={editor} />
      {imageBusy && <p className="mt-2 text-small font-semibold text-muted-foreground" role="status">Adding your picture…</p>}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
        void onPickImage(e.target.files?.[0]);
        e.target.value = "";
      }} />

      {menu && editable && (
        <div
          className="se-menu absolute z-30 w-[288px] max-w-[calc(100vw-32px)]"
          style={menu.bottom !== null ? { left: menu.left, bottom: menu.bottom } : { left: menu.left, top: menu.top }}
          role="listbox"
          aria-label="Insert"
          onMouseDown={(e) => e.preventDefault()}
        >
          {commands.length === 0 ? (
            <p className="px-3 py-2.5 text-small font-semibold text-muted-foreground">Nothing matches “/{menu.query}”</p>
          ) : (
            commands.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === index}
                className={cn("flex min-h-11 w-full items-baseline gap-2 rounded-[10px] px-3 py-2 text-left", i === index && "bg-muted")}
                onMouseEnter={() => setMenuIndex(i)}
                onClick={() => run(c)}
              >
                <span className="text-ui font-extrabold text-foreground">{c.label}</span>
                <span className="min-w-0 flex-1 truncate text-small text-muted-foreground">{c.hint}</span>
              </button>
            ))
          )}
        </div>
      )}

      {bubble && highlighter && editable && !menu && !math && !diagram && (
        <div
          className="se-menu se-bubble absolute z-30 flex items-center gap-1 !rounded-full !p-1"
          style={{ left: bubble.left, top: bubble.top, transform: `translateX(-50%)${bubble.below ? "" : " translateY(-100%)"}` }}
          role="toolbar"
          aria-label="Highlight"
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button key={c.id} type="button" className="grid size-11 place-items-center rounded-full hover:bg-muted" aria-label={`Highlight ${c.label.toLowerCase()}`} title={c.label} onClick={() => applyHighlight(c.id)}>
              <span className="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: `var(${c.var})` }} />
            </button>
          ))}
          {editor?.isActive("highlight") && (
            <button type="button" className="h-11 rounded-full px-3 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => applyHighlight(null)}>
              Remove
            </button>
          )}
        </div>
      )}

      {diagram && diagramBox && createDiagram && (
        <form
          // select-none: the box sits after the document in the page, so a selection that runs on from the text (or out of
          // the box while it is busy) would paint the title with the selection colour. Only the description is selectable.
          className="se-menu absolute z-30 flex w-[360px] max-w-[calc(100vw-32px)] select-none flex-col gap-2 p-3"
          style={diagramBox}
          aria-label="Diagram"
          onSubmit={(e) => {
            e.preventDefault();
            if (!diagram.busy) void draw(diagram);
          }}
        >
          <label className="text-ui font-extrabold text-foreground" htmlFor="se-diagram-prompt">
            Describe the graph or diagram
          </label>
          <textarea
            id="se-diagram-prompt"
            ref={diagramInput}
            value={diagram.prompt}
            onChange={(e) => setDiagram({ ...diagram, prompt: e.target.value.slice(0, 600), error: null })}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setDiagram(null);
                editor?.commands.focus();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!diagram.busy) void draw(diagram);
              }
            }}
            rows={3}
            // Read-only, not disabled, while drawing: the box keeps the keyboard and the selection stays in it.
            readOnly={diagram.busy}
            aria-busy={diagram.busy}
            placeholder="AD–AS with a recessionary gap, or y = x^2 - 4 from -3 to 3"
            className="min-h-[84px] w-full select-text resize-none rounded-[10px] bg-muted px-3 py-2.5 text-ui text-foreground placeholder:text-faint focus:outline-none read-only:opacity-60"
          />
          {diagram.error ? (
            <p className="px-1 text-small font-semibold text-foreground" role="alert">
              {diagram.error}
            </p>
          ) : (
            <p className="px-1 text-caption text-muted-foreground">Name the diagram; no numbers needed. Equations you give are plotted exactly.</p>
          )}
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => setDiagram(null)} className="h-11 rounded-[10px] px-3 text-[14px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </button>
            <button type="submit" disabled={diagram.busy || diagram.prompt.trim().length < 3} aria-busy={diagram.busy} className="h-11 rounded-[10px] px-3.5 text-[14px] font-extrabold text-foreground hover:bg-muted disabled:opacity-40">
              {diagram.busy ? "Drawing…" : diagram.pos !== null ? "Redraw" : "Draw"}
            </button>
          </div>
        </form>
      )}

      {math && mathBox && (
        <div className="se-menu absolute z-30 flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-1.5 p-2.5" style={mathBox}>
          <div className="flex items-center gap-2">
            <input
              ref={mathInput}
              value={math.input}
              onChange={(e) => editMath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  closeMath();
                }
              }}
              aria-label="Equation"
              placeholder="sqrt(x^2 + 1)/2"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="h-11 min-w-0 flex-1 rounded-[10px] bg-muted px-3 font-mono text-[14px] text-foreground placeholder:text-faint focus:outline-none"
            />
            <button type="button" onClick={() => closeMath()} className="h-11 rounded-[10px] px-3 text-[14px] font-extrabold text-foreground hover:bg-muted">
              Done
            </button>
          </div>
          <p className="flex items-center justify-between gap-3 px-1 text-caption text-muted-foreground">
            <span>Type it as you would say it, or use LaTeX.</span>
            <button type="button" onClick={() => closeMath(true)} className="-my-3 min-h-11 px-1 font-bold hover:text-rose-600">
              Remove
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

function positionUnder(editor: Editor, pos: number, wrap: HTMLElement | null, width = 340): { left: number; top?: number; bottom?: number } | null {
  if (!wrap) return null;
  try {
    const box = wrap.getBoundingClientRect();
    const at = editor.view.coordsAtPos(Math.min(pos + 1, editor.state.doc.content.size));
    const left = Math.max(0, Math.min(at.left - box.left - 40, box.width - width));
    // No room under the formula (a phone's keyboard and tab bar): the box goes above it.
    const room = window.innerHeight - at.bottom - (window.innerWidth < 768 ? 72 : 8);
    if (room < (width > 340 ? 230 : 120) && at.top > 200) return { left, bottom: box.bottom - at.top + 10 };
    return { left, top: at.bottom - box.top + 10 };
  } catch {
    return null;
  }
}
