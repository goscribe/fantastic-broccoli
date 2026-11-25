import assert from "node:assert/strict";
import { test } from "node:test";
import { formatResult } from "./format";
import { calcReducer, initialState, insertable, keyAction, normaliseTyped, HISTORY_LIMIT, type CalcAction, type CalcState, type KeyLike } from "./state";

const run = (actions: CalcAction[], from: CalcState = initialState()) => actions.reduce(calcReducer, from);
const keys = (text: string): CalcAction[] => [...text].map((c) => ({ type: "type", text: c }) as CalcAction);
const shown = (s: CalcState) => (s.result ? formatResult(s.result, { precision: s.precision, fraction: s.fraction }) : null);

/**
 * The panel's keyboard handling, as the component runs it: `keyAction`
 * decides, and where it declines on the line the browser types the
 * character itself (which reaches the reducer as an "edit").
 */
function press(state: CalcState, key: string, where: "line" | "button" | "panel" = "line"): { state: CalcState; closed: boolean } {
  const e: KeyLike = { key };
  const action = keyAction(state, e, where);
  if (action?.type === "close") return { state, closed: true };
  if (action) return { state: calcReducer(state, action), closed: false };
  if (where !== "line") return { state, closed: false };
  // The browser's own editing of the focused line.
  const start = Math.min(state.caret, state.selectionEnd);
  const end = Math.max(state.caret, state.selectionEnd);
  if (key === "Backspace") {
    const from = start === end ? Math.max(0, start - 1) : start;
    return { state: calcReducer(state, { type: "edit", expr: state.expr.slice(0, from) + state.expr.slice(end), caret: from }), closed: false };
  }
  if (key.length !== 1) return { state, closed: false };
  return { state: calcReducer(state, { type: "edit", expr: state.expr.slice(0, start) + key + state.expr.slice(end), caret: start + 1 }), closed: false };
}

const typeOnKeyboard = (text: string[], from: CalcState = initialState(), where: "line" | "button" | "panel" = "line") =>
  text.reduce((s, key) => press(s, key, where).state, from);

test("keys build the line and = works it out", () => {
  const s = run([...keys("2+3"), { type: "type", text: "×" }, ...keys("4"), { type: "evaluate" }]);
  assert.equal(s.expr, "2+3×4");
  assert.equal(shown(s), "14");
  assert.equal(s.finished, true);
  assert.equal(s.ans?.value, 14);
});

test("keyboard input: typing a calculation and pressing Enter", () => {
  const s = typeOnKeyboard(["1", "2", "*", "(", "3", "-", "1", ")", "/", "4", "Enter"]);
  // The keyboard's * / - show as the keys print them.
  assert.equal(s.expr, "12×(3−1)÷4");
  assert.equal(shown(s), "6");
});

test("keyboard input: = works like Enter, Backspace edits, Escape closes", () => {
  let s = typeOnKeyboard(["7", "+", "8", "9", "Backspace", "="]);
  assert.equal(s.expr, "7+8");
  assert.equal(shown(s), "15");
  assert.equal(press(s, "Escape").closed, true);
  // Shortcuts with a modifier are the browser's (copy, paste, select all).
  assert.equal(keyAction(s, { key: "c", ctrlKey: true }, "line"), null);
  assert.equal(keyAction(s, { key: "v", metaKey: true }, "panel"), null);
  s = typeOnKeyboard(["s", "i", "n", "(", "3", "0", ")", "Enter"]);
  assert.equal(shown(s), "0.5");
});

test("keyboard input reaches the line when a keypad button has focus", () => {
  const s = typeOnKeyboard(["4", "5", "/", "9", "Backspace", "5", "="], initialState(), "button");
  assert.equal(s.expr, "45÷5");
  assert.equal(shown(s), "9");
  // Enter on a focused button presses that button, not "=".
  assert.equal(keyAction(s, { key: "Enter" }, "button"), null);
  assert.deepEqual(keyAction(s, { key: "Enter" }, "panel"), { type: "evaluate" });
  // Space is left alone so it can press the focused button.
  assert.equal(keyAction(s, { key: " " }, "button"), null);
});

test("after =, an operator continues from Ans and anything else starts again", () => {
  const done = run([...keys("6×7"), { type: "evaluate" }]);
  const onward = typeOnKeyboard(["+", "8", "Enter"], done);
  assert.equal(onward.expr, "Ans+8");
  assert.equal(shown(onward), "50");
  const fresh = typeOnKeyboard(["9", "Enter"], done);
  assert.equal(fresh.expr, "9");
  assert.equal(shown(fresh), "9");
  const squared = run([{ type: "type", text: "²" }, { type: "evaluate" }], done);
  assert.equal(squared.expr, "Ans²");
  assert.equal(shown(squared), "1764");
});

test("the caret: keys insert where it is, and replace a selection", () => {
  let s = run(keys("25"));
  s = calcReducer(s, { type: "select", start: 1, end: 1 });
  s = calcReducer(s, { type: "type", text: "+" });
  assert.equal(s.expr, "2+5");
  assert.equal(s.caret, 2);
  s = calcReducer(s, { type: "select", start: 0, end: 3 });
  s = calcReducer(s, { type: "type", text: "9" });
  assert.equal(s.expr, "9");
});

test("backspace takes a whole function at once, and clears a finished line", () => {
  let s = run([{ type: "type", text: "sin(" }, ...keys("30")]);
  s = run([{ type: "backspace" }, { type: "backspace" }], s);
  assert.equal(s.expr, "sin(");
  s = calcReducer(s, { type: "backspace" });
  assert.equal(s.expr, "");
  s = run([{ type: "type", text: "2+" }, { type: "type", text: "sin⁻¹(" }, { type: "backspace" }]);
  assert.equal(s.expr, "2+");
  s = run([...keys("2+2"), { type: "evaluate" }, { type: "backspace" }]);
  assert.equal(s.expr, "");
  assert.equal(s.result, null);
  // AC clears the line but keeps Ans, history and memory.
  s = run([...keys("2+2"), { type: "evaluate" }, { type: "clear" }]);
  assert.equal(s.expr, "");
  assert.equal(s.ans?.value, 4);
  assert.equal(s.history.length, 1);
});

test("invalid input shows a message and keeps the line for fixing", () => {
  const s = run([...keys("2+"), { type: "evaluate" }]);
  assert.equal(s.error?.code, "incomplete");
  assert.equal(s.error?.message, "Something is missing at the end");
  assert.equal(s.expr, "2+");
  assert.equal(s.finished, false);
  assert.equal(s.history.length, 0);
  // Typing clears the message.
  assert.equal(calcReducer(s, { type: "type", text: "3" }).error, null);
  assert.equal(run([{ type: "evaluate" }]).error, null);
  assert.equal(run([...keys("1÷0"), { type: "evaluate" }]).error?.code, "divideByZero");
});

test("history: newest first, tap a past result to reuse it", () => {
  let s = run([...keys("1÷3"), { type: "evaluate" }, ...keys("6×7"), { type: "evaluate" }]);
  assert.deepEqual(s.history.map((h) => h.expr), ["6×7", "1÷3"]);
  // Reused after "=": it replaces the finished line.
  s = calcReducer(s, { type: "recall", index: 0 });
  assert.equal(s.expr, "42");
  // Reused mid-line: it goes in at the caret, exactly (1/3, not 0.3333333333).
  s = run([{ type: "type", text: "×" }, { type: "recall", index: 1 }, { type: "evaluate" }], s);
  assert.equal(s.expr, "42×(1÷3)");
  assert.equal(shown(s), "14");
  // Pressing = again on the same line does not add a duplicate.
  const twice = run([...keys("5+5"), { type: "evaluate" }, { type: "evaluate" }]);
  assert.equal(twice.history.length, 1);
});

test("history is capped", () => {
  let s = initialState();
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = run([{ type: "clear" }, ...keys(`${i}+1`), { type: "evaluate" }], s);
  assert.equal(s.history.length, HISTORY_LIMIT);
  assert.equal(s.history[0].expr, `${HISTORY_LIMIT + 4}+1`);
});

test("memory: M+ and M− keep a running total, MR types it, MC clears it", () => {
  let s = run([...keys("12"), { type: "memory", op: "add" }]);
  assert.equal(s.memory?.value, 12);
  // M+ on an unfinished line works it out first.
  s = run([{ type: "clear" }, ...keys("2×4"), { type: "memory", op: "add" }], s);
  assert.equal(s.memory?.value, 20);
  s = run([{ type: "clear" }, ...keys("5"), { type: "memory", op: "subtract" }], s);
  assert.equal(s.memory?.value, 15);
  s = run([{ type: "clear" }, ...keys("100−"), { type: "memory", op: "recall" }, { type: "evaluate" }], s);
  assert.equal(s.expr, "100−15");
  assert.equal(shown(s), "85");
  assert.equal(calcReducer(s, { type: "memory", op: "clear" }).memory, null);
  // An error leaves memory alone.
  const bad = run([{ type: "clear" }, ...keys("1÷0"), { type: "memory", op: "add" }], s);
  assert.equal(bad.memory?.value, 15);
  assert.equal(bad.error?.code, "divideByZero");
});

test("Deg/Rad: the switch re-works a finished line", () => {
  let s = run([{ type: "type", text: "sin(" }, ...keys("30"), { type: "evaluate" }]);
  assert.equal(shown(s), "0.5");
  s = calcReducer(s, { type: "toggleAngle" });
  assert.equal(s.angle, "rad");
  assert.equal(shown(s), String(Number(Math.sin(30).toPrecision(10))));
  assert.equal(s.history.length, 1);
  assert.equal(initialState("rad").angle, "rad");
});

test("3 s.f. / 4 s.f. and the fraction toggle", () => {
  let s = run([...keys("22÷7"), { type: "evaluate" }]);
  assert.equal(shown(s), "3.142857143");
  s = calcReducer(s, { type: "precision", precision: "sf3" });
  assert.equal(shown(s), "3.14");
  s = calcReducer(s, { type: "precision", precision: "sf4" });
  assert.equal(shown(s), "3.143");
  // The same button again goes back to the full display.
  s = calcReducer(s, { type: "precision", precision: "sf4" });
  assert.equal(shown(s), "3.142857143");
  s = calcReducer(s, { type: "toggleFraction" });
  assert.equal(shown(s), "22/7");
  s = calcReducer(s, { type: "toggleFraction" });
  assert.equal(shown(s), "3.142857143");
  // No exact fraction: the toggle does nothing.
  const root = run([{ type: "type", text: "√(" }, ...keys("2"), { type: "evaluate" }, { type: "toggleFraction" }]);
  assert.equal(root.fraction, false);
});

test("values put back into the line read as the same number", () => {
  assert.equal(normaliseTyped("2*3/4-1"), "2×3÷4−1");
  assert.equal(insertable({ value: 42 }, false), "42");
  assert.equal(insertable({ value: -3 }, true), "−3");
  assert.equal(insertable({ value: -3 }, false), "(−3)");
  assert.equal(insertable({ value: 1.204e24 }, true), "1.204E24");
  assert.equal(insertable({ value: 0.5, exact: { n: BigInt(1), d: BigInt(2) } }, true), "(1÷2)");
});
