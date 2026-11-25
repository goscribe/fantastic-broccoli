/**
 * The calculator's behaviour as a reducer, kept out of React so the keys,
 * the keyboard and the history can be tested without a browser.
 *
 * The line is plain text with a caret (the student can click into it and
 * edit, like a modern scientific calculator). After "=" the line is
 * "finished": an operator then continues from `Ans`, anything else starts a
 * new calculation.
 */
import { tryEvaluate, type AngleMode, type CalcErrorCode, type CalcValue } from "./engine";
import { formatNumber, hasFraction, type Precision } from "./format";

export interface HistoryEntry {
  expr: string;
  result: CalcValue;
}

export interface CalcState {
  expr: string;
  /** Selection in the line; equal when it is just a caret. */
  caret: number;
  selectionEnd: number;
  angle: AngleMode;
  /** The result on screen, for the line it was worked out from. */
  result: CalcValue | null;
  error: { code: CalcErrorCode; message: string } | null;
  ans: CalcValue | null;
  /** Newest first. */
  history: HistoryEntry[];
  memory: CalcValue | null;
  precision: Precision;
  fraction: boolean;
  /** The line is a finished calculation: the next key starts from it or replaces it. */
  finished: boolean;
}

export const HISTORY_LIMIT = 20;

export function initialState(angle: AngleMode = "deg"): CalcState {
  return {
    expr: "",
    caret: 0,
    selectionEnd: 0,
    angle,
    result: null,
    error: null,
    ans: null,
    history: [],
    memory: null,
    precision: "auto",
    fraction: false,
    finished: false,
  };
}

export type CalcAction =
  /** A key or typed character: put `text` at the caret. */
  | { type: "type"; text: string }
  /** The line was edited directly (typing, paste, cut). */
  | { type: "edit"; expr: string; caret: number }
  | { type: "select"; start: number; end: number }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "evaluate" }
  | { type: "toggleAngle" }
  | { type: "precision"; precision: Precision }
  | { type: "toggleFraction" }
  /** Reuse a past result (index into `history`). */
  | { type: "recall"; index: number }
  | { type: "memory"; op: "add" | "subtract" | "recall" | "clear" };

/** What the keyboard types, shown the way the keys print it (same length, so the caret stays put). */
export function normaliseTyped(text: string): string {
  return text.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
}

/** Keys that carry on from the last answer when pressed straight after "=". */
const CONTINUES = /^(?:[+−×÷^!%²³CP]|-|\*|\/)/;

/** Whole things a single backspace removes: "sin(" goes at once, not letter by letter. */
const UNIT = /(?:sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|ln\(|log\(|abs\(|root\(|√\(|∛\(|Ans)$/;

/** A value written so the line reads it back as the same number. */
export function insertable(value: CalcValue, atStart: boolean): string {
  let text: string;
  if (hasFraction(value) && value.exact) text = `(${value.exact.n}÷${value.exact.d})`;
  else {
    text = formatNumber(value.value).replace(/×10\^(-?\d+)/, "E$1");
    // A negative in the middle of a line needs brackets: "3×−2" reads, "3^−2E5" less so.
    if (text.startsWith("-") && !atStart) text = `(${text})`;
  }
  return normaliseTyped(text);
}

function splice(state: CalcState, text: string): CalcState {
  const start = Math.min(state.caret, state.selectionEnd);
  const end = Math.max(state.caret, state.selectionEnd);
  const expr = state.expr.slice(0, start) + text + state.expr.slice(end);
  const caret = start + text.length;
  return { ...state, expr, caret, selectionEnd: caret, error: null, finished: false };
}

function replaceLine(state: CalcState, expr: string): CalcState {
  return { ...state, expr, caret: expr.length, selectionEnd: expr.length, error: null, finished: false, fraction: false };
}

function typeText(state: CalcState, raw: string): CalcState {
  const text = normaliseTyped(raw);
  if (state.finished) {
    return replaceLine(state, CONTINUES.test(text) && state.ans ? `Ans${text}` : text);
  }
  return splice(state, text);
}

function evaluateLine(state: CalcState): CalcState {
  if (!state.expr.trim()) return state;
  const outcome = tryEvaluate(state.expr, { angle: state.angle, ans: state.ans });
  if (!outcome.ok) return { ...state, result: null, error: { code: outcome.code, message: outcome.message }, finished: false };
  const entry: HistoryEntry = { expr: state.expr, result: outcome.result };
  const repeat = state.history[0]?.expr === entry.expr && state.history[0].result.value === entry.result.value;
  return {
    ...state,
    result: outcome.result,
    error: null,
    ans: outcome.result,
    history: repeat ? state.history : [entry, ...state.history].slice(0, HISTORY_LIMIT),
    fraction: false,
    finished: true,
    caret: state.expr.length,
    selectionEnd: state.expr.length,
  };
}

/** The value M+ / M− act on: the result on screen, or the line worked out now. */
function currentValue(state: CalcState): { state: CalcState; value: CalcValue | null } {
  if (state.finished && state.result) return { state, value: state.result };
  if (!state.expr.trim()) return { state, value: null };
  const next = evaluateLine(state);
  return { state: next, value: next.error ? null : next.result };
}

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case "type":
      return typeText(state, action.text);
    case "edit": {
      const expr = normaliseTyped(action.expr);
      const caret = Math.min(action.caret, expr.length);
      return { ...state, expr, caret, selectionEnd: caret, error: null, finished: false };
    }
    case "select":
      return state.caret === action.start && state.selectionEnd === action.end ? state : { ...state, caret: action.start, selectionEnd: action.end };
    case "backspace": {
      if (state.finished) return { ...state, expr: "", caret: 0, selectionEnd: 0, result: null, error: null, finished: false };
      if (state.caret !== state.selectionEnd) return splice(state, "");
      const before = state.expr.slice(0, state.caret);
      if (!before) return state;
      const cut = UNIT.exec(before)?.[0].length ?? 1;
      const caret = state.caret - cut;
      return { ...state, expr: before.slice(0, caret) + state.expr.slice(state.caret), caret, selectionEnd: caret, error: null };
    }
    case "clear":
      return { ...state, expr: "", caret: 0, selectionEnd: 0, result: null, error: null, finished: false, fraction: false };
    case "evaluate":
      return evaluateLine(state);
    case "toggleAngle": {
      const next: CalcState = { ...state, angle: state.angle === "deg" ? "rad" : "deg" };
      // A finished line is worked out again in the new unit, unless it leans on an Ans that has since changed.
      if (!state.finished || /ans/i.test(state.expr)) return next;
      const outcome = tryEvaluate(state.expr, { angle: next.angle, ans: state.ans });
      if (!outcome.ok) return { ...next, result: null, error: { code: outcome.code, message: outcome.message }, finished: false };
      return { ...next, result: outcome.result, ans: outcome.result, history: [{ expr: state.expr, result: outcome.result }, ...state.history.slice(1)] };
    }
    case "precision":
      return { ...state, precision: state.precision === action.precision ? "auto" : action.precision, fraction: false };
    case "toggleFraction":
      return state.result && hasFraction(state.result) ? { ...state, fraction: !state.fraction, precision: "auto" } : state;
    case "recall": {
      const entry = state.history[action.index];
      if (!entry) return state;
      const atStart = state.finished || Math.min(state.caret, state.selectionEnd) === 0;
      const text = insertable(entry.result, atStart);
      // A past result is a value, not an operator: it replaces a finished line.
      return state.finished ? replaceLine(state, text) : splice(state, text);
    }
    case "memory": {
      if (action.op === "clear") return { ...state, memory: null };
      if (action.op === "recall") {
        if (!state.memory) return state;
        const atStart = state.finished || Math.min(state.caret, state.selectionEnd) === 0;
        const text = insertable(state.memory, atStart);
        return state.finished ? replaceLine(state, text) : splice(state, text);
      }
      const { state: next, value } = currentValue(state);
      if (!value) return next;
      const sign = action.op === "add" ? 1 : -1;
      // Memory is a running total; it keeps the float (an exact fraction would not survive the sum anyway).
      return { ...next, memory: { value: (next.memory?.value ?? 0) + sign * value.value } };
    }
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** Characters the keyboard may type into the line. */
const TYPABLE = /^[0-9a-zA-Z.+\-*/^()!%,πE×÷−√²³ ]$/;

export type KeyOutcome = CalcAction | { type: "close" } | null;

/**
 * What a key press does. `where` is what has focus: the line itself (the
 * browser types ordinary characters there, so only the special keys are
 * taken), a keypad button, or anything else in the panel.
 */
export function keyAction(state: CalcState, e: KeyLike, where: "line" | "button" | "panel"): KeyOutcome {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Escape") return { type: "close" };
  if (e.key === "=") return { type: "evaluate" };
  // Enter on a focused button presses that button.
  if (e.key === "Enter") return where === "button" ? null : { type: "evaluate" };
  if (where === "line") {
    // Straight after "=", a key starts the next calculation instead of editing the old one.
    if (state.finished && TYPABLE.test(e.key) && e.key !== " ") return { type: "type", text: e.key };
    return null;
  }
  if (e.key === "Backspace") return { type: "backspace" };
  if (e.key === " ") return null;
  if (TYPABLE.test(e.key)) return { type: "type", text: e.key };
  return null;
}
