/**
 * "Insert": puts a result into the answer the student was writing, at their
 * caret. Works on the three kinds of box the app has: a plain textarea or
 * input (long answers, cloze gaps), the rich answer box (worksheets) and the
 * document editor (coursework, My notes), both of which are tiptap editors.
 *
 * Written against small structural types rather than DOM classes, so the
 * logic runs under node:test with stand-in fields.
 */

/** `text` in place of the selection; the caret ends after it. */
export function spliceText(value: string, start: number, end: number, text: string): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, end, value.length));
  const to = Math.max(from, Math.min(Math.max(start, end), value.length));
  return { value: value.slice(0, from) + text + value.slice(to), caret: from + text.length };
}

/**
 * A result next to words needs a space before it ("x = 4.5", not "x =4.5"),
 * but none at the start of a line or after an opening bracket or operator.
 */
export function withSpacing(before: string, text: string): string {
  return before && /[A-Za-z0-9=,;:.)\]]$/.test(before) ? ` ${text}` : text;
}

interface EditorChain {
  focus: () => EditorChain;
  insertContent: (content: string) => EditorChain;
  run: () => boolean;
}

/** The part of a tiptap editor this needs. */
export interface EditorLike {
  isEditable?: boolean;
  chain: () => EditorChain;
  state?: { selection: { $from: { parent: { textBetween?: (from: number, to: number) => string }; parentOffset: number } } };
}

export interface FieldLike {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  disabled?: boolean;
  readOnly?: boolean;
  setSelectionRange?: (start: number, end: number) => void;
  focus?: () => void;
}

/** Writes into a text field the way typing does; `commit` sets the value and tells the page (React) about it. */
export function insertIntoField(field: FieldLike, text: string, commit: (value: string) => void): boolean {
  if (field.disabled || field.readOnly) return false;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  const next = spliceText(field.value, start, end, withSpacing(field.value.slice(0, Math.min(start, end)), text));
  commit(next.value);
  field.focus?.();
  field.setSelectionRange?.(next.caret, next.caret);
  return true;
}

/** Writes into a tiptap editor at its selection. */
export function insertIntoEditor(editor: EditorLike, text: string): boolean {
  if (editor.isEditable === false) return false;
  let before = "";
  try {
    const from = editor.state?.selection.$from;
    before = from?.parent.textBetween?.(0, from.parentOffset) ?? "";
  } catch {
    /* no readable text before the caret: insert as is */
  }
  return editor.chain().focus().insertContent(withSpacing(before, text)).run();
}

// ── The page side ─────────────────────────────────────────────────────────

const FIELD_SELECTOR = 'textarea, input, [contenteditable="true"]';

type TiptapHost = HTMLElement & { editor?: EditorLike };

function isTextInput(el: Element): el is HTMLTextAreaElement | HTMLInputElement {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return ["text", "search", "number", ""].includes((el.getAttribute("type") ?? "text").toLowerCase());
}

/** The box a focused element belongs to, or null when it is not somewhere an answer goes. */
export function answerTargetOf(el: Element | null, scope: HTMLElement | null): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  if (el.closest("[data-calculator], [data-calculator-ignore]")) return null;
  if (scope && !scope.contains(el)) return null;
  const editable = el.closest<HTMLElement>('[contenteditable="true"]');
  if (editable) return editable;
  // The rich answer box's own maths field edits LaTeX; a number can go there too.
  if (isTextInput(el) && !el.disabled && !el.readOnly) return el;
  return null;
}

/** With nothing picked yet: the first empty answer box in the scope, else the first. */
export function defaultAnswerTarget(scope: HTMLElement | null): HTMLElement | null {
  if (!scope) return null;
  const boxes = Array.from(scope.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).filter((el) => {
    if (el.closest("[data-calculator], [data-calculator-ignore], [data-voice-ignore]")) return false;
    // The rich answer box mirrors its text in a hidden textarea; its editor is the box.
    if (el instanceof HTMLTextAreaElement && el.closest("[data-rich-answer]")) return false;
    if (el.isContentEditable) return true;
    return isTextInput(el) && !el.disabled && !el.readOnly;
  });
  const empty = boxes.find((el) => !("value" in el ? String((el as HTMLInputElement).value) : (el.textContent ?? "")).trim());
  return empty ?? boxes[0] ?? null;
}

/** Inserts into a box on the page; false when it can no longer take text. */
export function insertIntoTarget(target: HTMLElement, text: string): boolean {
  if (!target.isConnected) return false;
  const editor = (target as TiptapHost).editor;
  if (editor && typeof editor.chain === "function") return insertIntoEditor(editor, text);
  if (isTextInput(target)) {
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    return insertIntoField(target, text, (value) => {
      // The native setter, then an input event, so a React-controlled field's onChange runs.
      if (setter) setter.call(target, value);
      else target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  return false;
}
