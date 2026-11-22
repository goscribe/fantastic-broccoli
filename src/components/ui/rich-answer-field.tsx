"use client";

import { useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentProps, type Ref } from "react";
import { MarkdownText } from "@/components/ui/markdown-text";
import { applySnippet, hasRichContent, type SnippetId } from "@/lib/rich-answer";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/voice";
import { cn } from "@/lib/utils";

/** The formatting bar, in order: text first, then maths. Labels are what the button shows. */
const TOOLS: Array<{ id: SnippetId; label: string; className?: string }> = [
  { id: "bold", label: "B", className: "font-extrabold" },
  { id: "italic", label: "I", className: "italic font-serif" },
  { id: "math", label: "∑", className: "font-serif" },
  { id: "frac", label: "a⁄b" },
  { id: "pow", label: "x²" },
  { id: "sub", label: "x₂" },
  { id: "sqrt", label: "√" },
  { id: "pi", label: "π" },
  { id: "times", label: "×" },
  { id: "div", label: "÷" },
  { id: "le", label: "≤" },
  { id: "ge", label: "≥" },
];

type TextareaProps = Omit<ComponentProps<"textarea">, "value" | "onChange" | "ref">;

/**
 * An answer box that takes rich answers: bold, italics and LaTeX maths
 * ($\frac{3}{4}$, $x^2$), typed, tapped in from the bar under it, or written
 * by voice. The box itself shows the answer rendered; tapping it shows the
 * source to edit, with the formatting bar and a live preview. The answer
 * stays plain text (Markdown + $…$ LaTeX), so drafts and marking read it as
 * before, and the textarea stays in the page for voice and the keyboard.
 */
export function RichAnswerField({
  value,
  onChange,
  textareaRef,
  className,
  disabled,
  ...props
}: TextareaProps & {
  value: string;
  onChange: (value: string) => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const { t } = useI18n();
  const own = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const pendingCaret = useRef<number | null>(null);

  // The page's ref (to focus the first box) reaches the textarea.
  useImperativeHandle(textareaRef, () => own.current as HTMLTextAreaElement);

  const rich = hasRichContent(value);
  // Rendered in the box whenever the learner isn't editing it.
  const showRendered = rich && !focused;

  const insert = (id: SnippetId) => {
    const el = own.current;
    if (!el) return;
    const next = applySnippet(value, el.selectionStart ?? value.length, el.selectionEnd ?? value.length, id);
    pendingCaret.current = next.caret;
    onChange(next.value);
  };

  // Once the new text is in the box, the caret goes where the snippet wants it (inside the {}).
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null || !own.current) return;
    pendingCaret.current = null;
    own.current.focus();
    own.current.setSelectionRange(at, at);
  }, [value]);

  return (
    <div
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <textarea
        {...props}
        ref={own}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(className, showRendered && "sr-only")}
      />
      {showRendered && (
        // The answer as it reads: in the box, in the box's own look. Tapping it edits.
        <div
          aria-hidden
          data-rich-rendered
          onClick={() => !disabled && own.current?.focus()}
          className={cn(className, "min-h-[52px] overflow-x-auto", disabled ? "cursor-default" : "cursor-text")}
        >
          <MarkdownText text={value} />
        </div>
      )}
      {focused && !disabled && (
        <div role="toolbar" aria-label={t("rich.toolbar")} className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              // Keep the caret in the box: the button never takes focus from it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(tool.id)}
              aria-label={t(`rich.${tool.id}`)}
              title={t(`rich.${tool.id}`)}
              className={cn(
                "grid h-9 min-w-9 shrink-0 touch-manipulation place-items-center rounded-full bg-muted px-2.5 text-[14px] font-bold text-foreground transition-colors hover:bg-[var(--edge)]",
                tool.className,
              )}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}
      {focused && !disabled && rich && (
        <div className="mt-2 px-1" aria-label={t("rich.preview")}>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-faint">{t("rich.preview")}</p>
          <div className="mt-0.5 text-[16px] leading-relaxed text-foreground">
            <MarkdownText text={value} />
          </div>
        </div>
      )}
    </div>
  );
}
