"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { InlineMath } from "@tiptap/extension-mathematics";
import { Placeholder } from "@tiptap/extensions";
import { Check, Trash2 } from "lucide-react";
import { answerToDoc, docToAnswer } from "@/lib/rich-answer";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/voice";
import { cn } from "@/lib/utils";

/**
 * The formatting bar. Marks toggle; maths tools put a maths chip in the line
 * and open it for editing with the caret where the learner types next; the
 * symbols are typed as they are (into the open maths chip as LaTeX).
 */
type Tool =
  | { id: "bold" | "italic"; kind: "mark"; label: string; className?: string }
  | { id: string; kind: "math"; label: string; latex: string; caret: number }
  | { id: string; kind: "symbol"; label: string; text: string; latex: string };

const TOOLS: Tool[] = [
  { id: "bold", kind: "mark", label: "B", className: "font-extrabold" },
  { id: "italic", kind: "mark", label: "I", className: "font-serif italic" },
  { id: "math", kind: "math", label: "∑", latex: "", caret: 0 },
  { id: "frac", kind: "math", label: "a⁄b", latex: "\\frac{}{}", caret: 6 },
  { id: "pow", kind: "math", label: "x²", latex: "x^{}", caret: 3 },
  { id: "sub", kind: "math", label: "x₂", latex: "x_{}", caret: 3 },
  { id: "sqrt", kind: "math", label: "√", latex: "\\sqrt{}", caret: 6 },
  { id: "pi", kind: "symbol", label: "π", text: "π", latex: "\\pi " },
  { id: "times", kind: "symbol", label: "×", text: "×", latex: "\\times " },
  { id: "div", kind: "symbol", label: "÷", text: "÷", latex: "\\div " },
  { id: "le", kind: "symbol", label: "≤", text: "≤", latex: "\\le " },
  { id: "ge", kind: "symbol", label: "≥", text: "≥", latex: "\\ge " },
];

const chip =
  "grid h-9 min-w-9 shrink-0 touch-manipulation place-items-center rounded-full px-2.5 text-[14px] font-bold transition-colors";

/**
 * A real rich-text answer box: bold and italics show as bold and italics,
 * and maths is a rendered formula in the line (KaTeX). Tapping a formula
 * edits it in place; the bar under the box adds formatting and maths.
 *
 * The answer is still saved as plain text — Markdown with $…$ LaTeX — so
 * drafts and marking read it as before. A hidden textarea carries that text
 * too, so the voice scribe (and anything else that writes into answer boxes)
 * can fill it the way typing would.
 */
export function RichAnswerField({
  value,
  onChange,
  textareaRef,
  className,
  disabled,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const { t } = useI18n();
  const source = useRef<HTMLTextAreaElement>(null);
  const mathInput = useRef<HTMLInputElement>(null);
  const lastSent = useRef(value);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);
  // The formula being edited: where it is, its LaTeX, and where the caret goes.
  const [math, setMath] = useState<{ pos: number; latex: string; caret: number } | null>(null);

  const boxClass = cn(className, "rich-answer cursor-text", rows > 1 ? "min-h-[84px]" : "min-h-[52px]");

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    content: answerToDoc(value),
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
      }),
      InlineMath.configure({
        katexOptions: { throwOnError: false },
        onClick: (node, pos) => setMath({ pos, latex: String(node.attrs.latex ?? ""), caret: String(node.attrs.latex ?? "").length }),
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    editorProps: { attributes: { class: boxClass, role: "textbox", "aria-multiline": "true", "aria-label": placeholder ?? "" } },
    onUpdate: ({ editor: e }) => {
      const next = docToAnswer(e.getJSON());
      if (next === lastSent.current) return;
      lastSent.current = next;
      onChange(next);
    },
  });

  // Text written from outside (the voice scribe, a restored draft) shows in the editor.
  useEffect(() => {
    if (!editor || value === lastSent.current) return;
    lastSent.current = value;
    editor.commands.setContent(answerToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // The box's look follows the activity's (marked right or wrong after checking).
  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: { class: boxClass, role: "textbox", "aria-multiline": "true", "aria-label": placeholder ?? "" } } });
  }, [editor, boxClass, placeholder]);

  // Opening a formula puts the caret in it, inside the {} the tool made.
  useEffect(() => {
    if (!math || !mathInput.current || document.activeElement === mathInput.current) return;
    mathInput.current.focus();
    mathInput.current.setSelectionRange(math.caret, math.caret);
  }, [math]);

  // The page focuses the first box through its ref; that focus lands in the editor.
  useImperativeHandle(textareaRef, () => source.current as HTMLTextAreaElement);

  const editLatex = (latex: string, caret: number) => {
    if (!editor || !math) return;
    setMath({ ...math, latex, caret });
    editor.commands.updateInlineMath({ latex: latex || " ", pos: math.pos });
  };

  const closeMath = (ed: Editor | null) => {
    if (!math || !ed) return;
    // An empty formula goes away rather than leave a blank chip.
    if (!math.latex.trim()) ed.chain().deleteRange({ from: math.pos, to: math.pos + 1 }).run();
    setMath(null);
    ed.commands.focus(math.pos + 1);
  };

  const use = (tool: Tool) => {
    if (!editor) return;
    if (tool.kind === "mark") {
      editor.chain().focus()[tool.id === "bold" ? "toggleBold" : "toggleItalic"]().run();
      return;
    }
    if (tool.kind === "symbol" && math) {
      const el = mathInput.current;
      const at = el?.selectionStart ?? math.latex.length;
      editLatex(math.latex.slice(0, at) + tool.latex + math.latex.slice(at), at + tool.latex.length);
      return;
    }
    if (tool.kind === "symbol") {
      editor.chain().focus().insertContent(tool.text).run();
      return;
    }
    if (math) closeMath(editor);
    const pos = editor.state.selection.from;
    editor.chain().focus().insertInlineMath({ latex: tool.latex || " ", pos }).run();
    setMath({ pos, latex: tool.latex, caret: tool.caret });
  };

  return (
    <div
      data-rich-answer
      onFocus={() => {
        if (blurTimer.current) clearTimeout(blurTimer.current);
        setFocused(true);
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        closeMath(editor);
        // The toolbar folds away a moment after the tap that left the box: folding
        // it at once moved the button under the finger ("Check") and lost the tap.
        if (blurTimer.current) clearTimeout(blurTimer.current);
        blurTimer.current = setTimeout(() => setFocused(false), 250);
      }}
    >
      {/* The answer as text, for the voice scribe and anything else that fills answer boxes. */}
      <textarea
        ref={source}
        value={value}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onFocus={() => editor?.commands.focus("end")}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <EditorContent editor={editor} />

      {math && !disabled && (
        <div className="mt-2 flex items-center gap-2 rounded-[18px] bg-card px-3 py-2 shadow-[0_8px_24px_-16px_rgba(17,17,20,.35)] ring-1 ring-border">
          <span className="font-serif text-[15px] italic text-muted-foreground" aria-hidden>
            ƒ
          </span>
          <input
            ref={mathInput}
            value={math.latex}
            onChange={(e) => editLatex(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                closeMath(editor);
              }
            }}
            aria-label={t("rich.mathInput")}
            placeholder="\frac{1}{2}"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-foreground placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              editor?.chain().deleteRange({ from: math.pos, to: math.pos + 1 }).focus(math.pos).run();
              setMath(null);
            }}
            aria-label={t("rich.removeMath")}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => closeMath(editor)}
            aria-label={t("rich.doneMath")}
            className="grid size-8 place-items-center rounded-full bg-accent text-white"
          >
            <Check className="size-4" strokeWidth={3} />
          </button>
        </div>
      )}

      {focused && !disabled && editor && (
        <div role="toolbar" aria-label={t("rich.toolbar")} className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {TOOLS.map((tool) => {
            const active = tool.kind === "mark" && editor.isActive(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                // Keep the caret where it is: the button never takes focus.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => use(tool)}
                aria-label={t(`rich.${tool.id}`)}
                aria-pressed={tool.kind === "mark" ? active : undefined}
                title={t(`rich.${tool.id}`)}
                className={cn(
                  chip,
                  active ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-[var(--edge)]",
                  tool.kind === "mark" && tool.className,
                )}
              >
                {tool.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
