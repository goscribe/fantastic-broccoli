import assert from "node:assert/strict";
import { test } from "node:test";
import { answerTargetOf, defaultAnswerTarget, insertIntoEditor, insertIntoField, insertIntoTarget, spliceText, withSpacing, type EditorLike, type FieldLike } from "./insert";

// ── The pure parts ────────────────────────────────────────────────────────

test("text goes in at the caret, or over the selection", () => {
  assert.deepEqual(spliceText("x = ", 4, 4, "4.5"), { value: "x = 4.5", caret: 7 });
  assert.deepEqual(spliceText("a  b", 2, 2, "12"), { value: "a 12 b", caret: 4 });
  assert.deepEqual(spliceText("x = old", 4, 7, "9"), { value: "x = 9", caret: 5 });
  // A selection made backwards, or a caret past the end, still lands sensibly.
  assert.deepEqual(spliceText("abc", 3, 1, "X"), { value: "aX", caret: 2 });
  assert.deepEqual(spliceText("abc", 99, 99, "X"), { value: "abcX", caret: 4 });
});

test("a result after a word or an = gets a space; at the start or after a bracket it does not", () => {
  assert.equal(withSpacing("KE =", "455625"), " 455625");
  assert.equal(withSpacing("The mean is", "0.306"), " 0.306");
  assert.equal(withSpacing("", "0.306"), "0.306");
  assert.equal(withSpacing("x = ", "4"), "4");
  assert.equal(withSpacing("(", "4"), "4");
  assert.equal(withSpacing("3 ×", "4"), "4");
});

test("insert into a plain answer field: value, caret and focus", () => {
  const calls: string[] = [];
  const field: FieldLike & { focused?: boolean; caret?: number } = {
    value: "KE =",
    selectionStart: 4,
    selectionEnd: 4,
    focus() {
      this.focused = true;
    },
    setSelectionRange(start) {
      this.caret = start;
    },
  };
  const ok = insertIntoField(field, "455625", (value) => {
    calls.push(value);
    field.value = value;
  });
  assert.equal(ok, true);
  assert.deepEqual(calls, ["KE = 455625"]);
  assert.equal(field.caret, 11);
  assert.equal(field.focused, true);
  // No selection known (a number input): it goes at the end.
  const number: FieldLike = { value: "1", selectionStart: null, selectionEnd: null };
  insertIntoField(number, "2", (value) => (number.value = value));
  assert.equal(number.value, "1 2");
  // A marked (disabled) or read-only box is left alone.
  assert.equal(insertIntoField({ value: "", selectionStart: 0, selectionEnd: 0, disabled: true }, "1", () => assert.fail("wrote into a disabled field")), false);
  assert.equal(insertIntoField({ value: "", selectionStart: 0, selectionEnd: 0, readOnly: true }, "1", () => assert.fail("wrote into a read-only field")), false);
});

/** A stand-in for a tiptap editor: records what was inserted at its caret. */
function fakeEditor(before: string, editable = true) {
  const log: string[] = [];
  const chain = { focus: () => (log.push("focus"), chain), insertContent: (text: string) => (log.push(`insert:${text}`), chain), run: () => true };
  const editor: EditorLike = {
    isEditable: editable,
    chain: () => chain,
    state: { selection: { $from: { parent: { textBetween: (from, to) => before.slice(from, to) }, parentOffset: before.length } } },
  };
  return { editor, log };
}

test("insert into a rich answer box or the document editor (tiptap)", () => {
  const { editor, log } = fakeEditor("The mean reaction time is");
  assert.equal(insertIntoEditor(editor, "0.306"), true);
  assert.deepEqual(log, ["focus", "insert: 0.306"]);
  const empty = fakeEditor("");
  insertIntoEditor(empty.editor, "42");
  assert.deepEqual(empty.log, ["focus", "insert:42"]);
  const locked = fakeEditor("", false);
  assert.equal(insertIntoEditor(locked.editor, "42"), false);
  assert.deepEqual(locked.log, []);
});

// ── On the page, with a stand-in DOM ──────────────────────────────────────

class FakeElement {
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  attrs: Record<string, string> = {};
  isConnected = true;
  isContentEditable = false;
  textContent = "";
  events: string[] = [];
  focused = false;
  constructor(attrs: Record<string, string> = {}, children: FakeElement[] = []) {
    this.attrs = attrs;
    for (const child of children) this.append(child);
    if (attrs.contenteditable === "true") this.isContentEditable = true;
  }
  append(child: FakeElement) {
    child.parent = this;
    this.children.push(child);
  }
  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((raw) => {
      const sel = raw.trim();
      if (sel === "textarea") return this instanceof FakeTextArea;
      if (sel === "input") return this instanceof FakeInput;
      const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
      if (!attr) return false;
      return attr[1] in this.attrs && (attr[2] === undefined || this.attrs[attr[1]] === attr[2]);
    });
  }
  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : (this.parent?.closest(selector) ?? null);
  }
  contains(other: FakeElement | null): boolean {
    for (let el = other; el; el = el.parent) if (el === this) return true;
    return false;
  }
  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const walk = (el: FakeElement) => {
      for (const child of el.children) {
        if (child.matches(selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  dispatchEvent(event: { type: string }) {
    this.events.push(event.type);
    return true;
  }
  focus() {
    this.focused = true;
  }
}

/** A text field whose value has a "native setter" on the prototype, as in a browser, so React-style code can be told apart from a plain assignment. */
class FakeField extends FakeElement {
  stored = "";
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  disabled = false;
  readOnly = false;
  get value() {
    return this.stored;
  }
  set value(v: string) {
    this.stored = v;
  }
  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}
class FakeTextArea extends FakeField {}
class FakeInput extends FakeField {}

Object.assign(globalThis, {
  HTMLElement: FakeElement,
  HTMLTextAreaElement: FakeTextArea,
  HTMLInputElement: FakeInput,
  Event: class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  },
});

const asEl = (el: FakeElement) => el as unknown as HTMLElement;

function longAnswerPage() {
  const first = new FakeTextArea();
  const second = new FakeTextArea();
  const search = new FakeInput({ type: "search", "data-calculator-ignore": "" });
  const calcLine = new FakeInput({ type: "text" });
  const calculator = new FakeElement({ "data-calculator": "" }, [calcLine]);
  const scope = new FakeElement({}, [search, first, second]);
  const body = new FakeElement({}, [scope, calculator]);
  return { first, second, search, calcLine, scope, body };
}

test("insert-into-answer: the result lands in the long answer the student was writing, and React hears about it", () => {
  const { first, scope } = longAnswerPage();
  first.stored = "F = ma, so a =";
  first.setSelectionRange(14, 14);
  const target = answerTargetOf(asEl(first), asEl(scope));
  assert.equal(target, asEl(first));
  assert.equal(insertIntoTarget(target!, "5.44"), true);
  assert.equal(first.value, "F = ma, so a = 5.44");
  // The input event is what runs a controlled field's onChange.
  assert.deepEqual(first.events, ["input"]);
  assert.equal(first.selectionStart, 19);
  assert.equal(first.focused, true);
});

test("insert-into-answer: the calculator's own fields and opted-out fields are never the answer", () => {
  const { calcLine, search, scope, body } = longAnswerPage();
  assert.equal(answerTargetOf(asEl(calcLine), asEl(body)), null);
  assert.equal(answerTargetOf(asEl(search), asEl(scope)), null);
  // A field outside the page's answer area (a title, a chat box).
  const outside = new FakeTextArea();
  assert.equal(answerTargetOf(asEl(outside), asEl(scope)), null);
  assert.equal(answerTargetOf(null, asEl(scope)), null);
});

test("insert-into-answer: with no box picked, the first empty one is used", () => {
  const { first, second, scope } = longAnswerPage();
  assert.equal(defaultAnswerTarget(asEl(scope)), asEl(first));
  first.stored = "done";
  assert.equal(defaultAnswerTarget(asEl(scope)), asEl(second));
  second.stored = "done too";
  assert.equal(defaultAnswerTarget(asEl(scope)), asEl(first));
  second.disabled = true;
  first.readOnly = true;
  assert.equal(defaultAnswerTarget(asEl(scope)), null);
  assert.equal(defaultAnswerTarget(null), null);
});

test("insert-into-answer: a worksheet's rich answer box takes it through its editor, not its hidden textarea", () => {
  const { editor, log } = fakeEditor("KE =");
  const box = new FakeElement({ contenteditable: "true" });
  (box as unknown as { editor: EditorLike }).editor = editor;
  const mirror = new FakeTextArea();
  const rich = new FakeElement({ "data-rich-answer": "" }, [mirror, box]);
  const scope = new FakeElement({}, [rich]);
  assert.equal(defaultAnswerTarget(asEl(scope)), asEl(box));
  // Focus inside the box (a text node's parent, a maths chip) resolves to the box.
  const inner = new FakeElement();
  box.append(inner);
  assert.equal(answerTargetOf(asEl(inner), asEl(scope)), asEl(box));
  assert.equal(insertIntoTarget(asEl(box), "455625"), true);
  assert.deepEqual(log, ["focus", "insert: 455625"]);
  assert.deepEqual(mirror.events, []);
});

test("insert-into-answer: a box that has left the page is refused", () => {
  const gone = new FakeTextArea();
  gone.isConnected = false;
  assert.equal(insertIntoTarget(asEl(gone), "1"), false);
  assert.equal(gone.value, "");
});
