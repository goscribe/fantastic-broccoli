"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { formatResult, hasFraction, prettyResult, type Precision } from "@/lib/calculator/format";
import { calcReducer, initialState, keyAction, type CalcAction } from "@/lib/calculator/state";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calculator-panel";
import { cn } from "@/lib/utils";
import { CalculatorStats } from "./calculator-stats";

/** Graph mode draws with the note figures' plot (and its maths rendering), so it loads only when that tab is opened. */
const CalculatorGraph = dynamic(() => import("./calculator-graph"), {
  ssr: false,
  loading: () => <div className="mx-3 mt-3 h-[220px] animate-pulse rounded-2xl bg-muted" aria-busy="true" />,
});

type Mode = "calculate" | "stats" | "graph";
const MODES: Mode[] = ["calculate", "stats", "graph"];

const DOCK_WIDTH = 348;
const FLOAT_WIDTH = 340;
const ANGLE_KEY = "scribe.calculator.angle";
const DOCK_KEY = "scribe.calculator.dock";

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// ── Keys ──────────────────────────────────────────────────────────────────

interface KeyDef {
  id: string;
  label: string;
  /** Spoken name (a key in the i18n file), for keys whose face is a symbol. */
  name?: string;
  /** Typed into the line. */
  text?: string;
  action?: CalcAction;
  /** What the key becomes while Inv is on. */
  inv?: { label: string; name: string; text?: string; action?: CalcAction };
  tone?: "digit" | "operator" | "primary";
  span?: number;
}

/** Shown only with "More keys" on a phone; always on a wider screen. */
const EXTRA_KEYS: KeyDef[] = [
  { id: "factorial", label: "x!", name: "calc.key.factorial", text: "!" },
  { id: "ncr", label: "nCr", name: "calc.key.ncr", text: "C" },
  { id: "npr", label: "nPr", name: "calc.key.npr", text: "P" },
  { id: "percent", label: "%", name: "calc.key.percent", text: "%" },
  { id: "exp", label: "EXP", name: "calc.key.exp", text: "E" },
  { id: "inv", label: "Inv", name: "calc.key.inv" },
  { id: "pi", label: "π", name: "calc.key.pi", text: "π" },
  { id: "e", label: "e", name: "calc.key.e", text: "e" },
  { id: "mplus", label: "M+", name: "calc.key.mplus", action: { type: "memory", op: "add" }, inv: { label: "M−", name: "calc.key.mminus", action: { type: "memory", op: "subtract" } } },
  { id: "mr", label: "MR", name: "calc.key.mr", action: { type: "memory", op: "recall" }, inv: { label: "MC", name: "calc.key.mc", action: { type: "memory", op: "clear" } } },
];

const FUNCTION_KEYS: KeyDef[] = [
  { id: "sin", label: "sin", name: "calc.key.sin", text: "sin(", inv: { label: "sin⁻¹", name: "calc.key.asin", text: "sin⁻¹(" } },
  { id: "cos", label: "cos", name: "calc.key.cos", text: "cos(", inv: { label: "cos⁻¹", name: "calc.key.acos", text: "cos⁻¹(" } },
  { id: "tan", label: "tan", name: "calc.key.tan", text: "tan(", inv: { label: "tan⁻¹", name: "calc.key.atan", text: "tan⁻¹(" } },
  { id: "ln", label: "ln", name: "calc.key.ln", text: "ln(", inv: { label: "eˣ", name: "calc.key.expE", text: "e^(" } },
  { id: "log", label: "log", name: "calc.key.log", text: "log(", inv: { label: "10ˣ", name: "calc.key.exp10", text: "10^(" } },
  { id: "open", label: "(", name: "calc.key.open", text: "(" },
  { id: "close", label: ")", name: "calc.key.close", text: ")" },
  { id: "square", label: "x²", name: "calc.key.square", text: "²", inv: { label: "x³", name: "calc.key.cube", text: "³" } },
  { id: "power", label: "xʸ", name: "calc.key.power", text: "^" },
  { id: "sqrt", label: "√", name: "calc.key.sqrt", text: "√(", inv: { label: "∛", name: "calc.key.cbrt", text: "∛(" } },
];

const digit = (d: string): KeyDef => ({ id: `d${d}`, label: d, text: d, tone: "digit" });

const MAIN_KEYS: KeyDef[] = [
  digit("7"), digit("8"), digit("9"),
  { id: "backspace", label: "⌫", name: "calc.key.backspace", action: { type: "backspace" } },
  { id: "clear", label: "AC", name: "calc.key.clear", action: { type: "clear" } },
  digit("4"), digit("5"), digit("6"),
  { id: "times", label: "×", name: "calc.key.times", text: "×", tone: "operator" },
  { id: "divide", label: "÷", name: "calc.key.divide", text: "÷", tone: "operator" },
  digit("1"), digit("2"), digit("3"),
  { id: "plus", label: "+", name: "calc.key.plus", text: "+", tone: "operator" },
  { id: "minus", label: "−", name: "calc.key.minus", text: "−", tone: "operator" },
  digit("0"),
  { id: "point", label: ".", name: "calc.key.point", text: ".", tone: "digit" },
  { id: "ans", label: "Ans", name: "calc.key.ans", text: "Ans" },
  { id: "equals", label: "=", name: "calc.key.equals", action: { type: "evaluate" }, tone: "primary", span: 2 },
];

const KEY_BASE =
  "h-11 touch-manipulation select-none rounded-[10px] border text-ui tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60";

const chipClass = (on: boolean) =>
  cn(
    "h-9 touch-manipulation whitespace-nowrap rounded-[10px] border px-2.5 text-small font-bold transition-colors disabled:opacity-40",
    on ? "border-foreground bg-foreground text-background" : "border-border bg-white text-foreground hover:bg-muted",
  );

// ── Panel ─────────────────────────────────────────────────────────────────

export interface CalculatorPanelProps {
  open: boolean;
  onClose: () => void;
  /** The answer box "Insert" would write into right now, if the page has one. */
  findTarget: () => HTMLElement | null;
  insert: (text: string) => boolean;
}

/**
 * The calculator. On a desktop it floats by default and can be dragged by its
 * title bar, or docked to the right edge (pages leave room for it through
 * `--calc-dock`, so it never sits on the question; the choice is remembered); on a phone it is a bottom sheet (`--calc-sheet`
 * is its height). It is not modal: the question stays readable and usable.
 *
 * It stays mounted while closed, so the history, memory and the list in
 * Stats are still there when it is opened again.
 */
export default function CalculatorPanel({ open, onClose, findTarget, insert }: CalculatorPanelProps) {
  const { t } = useI18n();
  const phone = useMedia("(max-width: 639px)");
  const touch = useMedia("(pointer: coarse)");
  const [state, dispatch] = useReducer(calcReducer, undefined, () => initialState(stored(ANGLE_KEY) === "rad" ? "rad" : "deg"));
  const [mode, setMode] = useState<Mode>("calculate");
  const [inv, setInv] = useState(false);
  const [moreKeys, setMoreKeys] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [docked, setDocked] = useState(() => stored(DOCK_KEY) === "dock");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState("");
  // Kept here, not in the tabs, so a list or a function survives a look at another tab.
  const [statsText, setStatsText] = useState("");
  const [graph, setGraph] = useState({ expr: "", left: "-10", right: "10" });
  const [canInsert, setCanInsert] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLInputElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const docking = !phone && docked;

  // Tell the page how much room the calculator takes, so it can keep the question clear of it.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (!open) return;
    if (docking) html.style.setProperty("--calc-dock", `${DOCK_WIDTH}px`);
    if (!phone) return () => html.style.removeProperty("--calc-dock");
    const el = root.current;
    if (!el) return;
    const measure = () => html.style.setProperty("--calc-sheet", `${Math.round(el.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      html.style.removeProperty("--calc-sheet");
    };
  }, [open, docking, phone]);

  // Opening puts the caret in the line (no on-screen keyboard on a phone: the keypad is the keyboard).
  useEffect(() => {
    if (open && mode === "calculate") line.current?.focus({ preventScroll: true });
  }, [open, mode]);

  // Keypad taps and "=" move the caret in state; mirror it into the field.
  useLayoutEffect(() => {
    const el = line.current;
    if (!el || el.value !== state.expr) return;
    if (el.selectionStart !== state.caret || el.selectionEnd !== state.selectionEnd) {
      try {
        el.setSelectionRange(state.caret, state.selectionEnd);
      } catch {
        /* not focusable right now */
      }
    }
    // Keep the caret in view on a long line.
    if (state.caret === state.expr.length) el.scrollLeft = el.scrollWidth;
  }, [state.expr, state.caret, state.selectionEnd]);

  useEffect(() => {
    remember(ANGLE_KEY, state.angle);
  }, [state.angle]);

  // Whether there is an answer box to insert into: checked when the calculator opens and whenever focus moves on the page.
  useEffect(() => {
    if (!open) return;
    const check = () => setCanInsert(findTarget() !== null);
    check();
    document.addEventListener("focusin", check);
    return () => document.removeEventListener("focusin", check);
  }, [open, findTarget, state.result]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(""), 2000);
    return () => window.clearTimeout(id);
  }, [status]);

  const shown = state.result ? formatResult(state.result, { precision: state.precision, fraction: state.fraction }) : "";

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setStatus(t("calc.copied"));
      } catch {
        /* clipboard blocked: nothing to say */
      }
    },
    [t],
  );

  const insertText = useCallback(
    (text: string) => {
      setStatus(insert(text) ? t("calc.inserted") : t("calc.insertNoBox"));
    },
    [insert, t],
  );

  const press = (key: KeyDef) => {
    if (key.id === "inv") {
      setInv((v) => !v);
      focusLine();
      return;
    }
    const face = inv && key.inv ? key.inv : key;
    if (face.action) dispatch(face.action);
    else if (face.text) dispatch({ type: "type", text: face.text });
    if (inv && key.inv) setInv(false);
    focusLine();
  };

  /**
   * Keys never take focus from the line, but focus can be elsewhere (a chip
   * that has just been disabled swallows key presses): after a key or a
   * reused result, typing goes on in the line.
   */
  const focusLine = () => {
    if (document.activeElement !== line.current) line.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    // Plain keys pressed in the calculator are the calculator's: the page's own keys (a session's ← → between activities) stay out of it.
    if (!e.ctrlKey && !e.metaKey && !e.altKey) e.stopPropagation();
    if (mode !== "calculate") return;
    const target = e.target as HTMLElement;
    const where = target === line.current ? "line" : target.closest("[data-calc-key]") ? "button" : "panel";
    // Other fields in the panel (none in this mode today) keep their own typing.
    if (where === "panel" && target.closest("input, textarea, select")) return;
    const action = keyAction(state, e, where);
    if (!action || action.type === "close") return;
    e.preventDefault();
    e.stopPropagation();
    dispatch(action);
    if (where !== "line") line.current?.focus({ preventScroll: true });
  };

  // ── Dragging (desktop) ──────────────────────────────────────────────────
  const clamp = (x: number, y: number) => {
    const w = root.current?.offsetWidth ?? FLOAT_WIDTH;
    return { x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)), y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 64)) };
  };

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phone || e.button !== 0 || (e.target as HTMLElement).closest("button, input, [role=tab]")) return;
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // Pulling the docked calculator off the edge is what undocks it.
    if (docked) {
      setDocked(false);
      remember(DOCK_KEY, "float");
      drag.current.dx = Math.min(drag.current.dx, FLOAT_WIDTH - 24);
    }
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  };

  const onDragEnd = () => {
    drag.current = null;
  };

  const toggleDock = () => {
    const next = !docked;
    setDocked(next);
    remember(DOCK_KEY, next ? "dock" : "float");
    if (!next && !pos) setPos(clamp(window.innerWidth - FLOAT_WIDTH - 24, 80));
  };

  // Keep a floating calculator on screen when the window shrinks.
  useEffect(() => {
    if (!open || docked || phone) return;
    const onResize = () => setPos((p) => (p ? { x: Math.min(p.x, Math.max(8, window.innerWidth - FLOAT_WIDTH - 8)), y: Math.min(p.y, Math.max(8, window.innerHeight - 64)) } : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, docked, phone]);

  if (!open || typeof document === "undefined") return null;

  const floating = !phone && !docked;
  const floatAt = pos ?? { x: Math.max(8, window.innerWidth - FLOAT_WIDTH - 24), y: 80 };
  const showExtra = !phone || moreKeys;
  const history = state.history;
  const historyShown = phone ? historyOpen : true;

  const renderKey = (key: KeyDef) => {
    const face = inv && key.inv ? key.inv : key;
    const name = face.name ? t(face.name) : undefined;
    const isInv = key.id === "inv";
    return (
      <button
        key={key.id}
        type="button"
        data-calc-key={key.id}
        // The line keeps focus (and its caret) while keys are tapped.
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => press(key)}
        aria-label={name}
        title={name}
        aria-pressed={isInv ? inv : undefined}
        style={key.span ? { gridColumn: `span ${key.span}` } : undefined}
        className={cn(
          KEY_BASE,
          key.tone === "primary"
            ? "border-accent bg-accent text-[22px] font-bold leading-none text-white hover:bg-[var(--accent-dim)]"
            : key.tone === "digit"
              ? "border-border bg-white text-[17px] font-bold text-foreground hover:bg-muted active:bg-[var(--edge)]"
              : isInv && inv
                ? "border-foreground bg-foreground font-bold text-background"
                : cn("border-border bg-muted text-foreground hover:bg-[var(--edge)]", key.tone === "operator" ? "text-[20px] font-semibold leading-none" : "font-semibold"),
        )}
      >
        {face.label}
      </button>
    );
  };

  const closeButton = (
    <button type="button" onClick={onClose} aria-label={t("calc.close")} title={t("calc.close")} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
      <X className="size-[18px]" aria-hidden />
    </button>
  );

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-label={t("calc.title")}
      data-calculator
      data-voice-ignore
      onKeyDown={onKeyDown}
      style={floating ? { left: floatAt.x, top: floatAt.y, width: FLOAT_WIDTH } : docking ? { width: DOCK_WIDTH } : undefined}
      className={cn(
        "fixed z-50 flex flex-col bg-white text-foreground",
        phone && "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-[22px] border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_40px_-20px_rgba(0,0,0,0.35)]",
        docking && "inset-y-0 right-0 border-l border-border",
        floating && "max-h-[calc(100dvh-16px)] rounded-2xl border border-border shadow-[0_18px_50px_-18px_rgba(0,0,0,0.4)]",
      )}
    >
      {/* Title bar: the handle for dragging on a desktop. A phone has no room to spare, so its tabs and Close share one row. */}
      {!phone && (
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          title={t("calc.move")}
          className="flex shrink-0 cursor-grab touch-none items-center gap-2 pl-4 pr-1.5 pt-1.5 active:cursor-grabbing"
        >
          <h2 className="min-w-0 flex-1 truncate text-ui font-extrabold">{t("calc.title")}</h2>
          <button type="button" onClick={toggleDock} title={t(docked ? "calc.floatHint" : "calc.dockHint")} className="h-9 rounded-[10px] px-2.5 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
            {t(docked ? "calc.float" : "calc.dock")}
          </button>
          {closeButton}
        </div>
      )}

      <div className={cn("flex shrink-0 items-center", phone ? "gap-1 pl-3 pr-1.5 pt-2" : "px-3")}>
        <div role="tablist" aria-label={t("calc.mode")} className="flex min-w-0 flex-1 gap-1 rounded-xl bg-muted p-1">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`calc-tab-${m}`}
              aria-selected={mode === m}
              aria-controls={`calc-panel-${m}`}
              tabIndex={mode === m ? 0 : -1}
              onClick={() => setMode(m)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next = MODES[(MODES.indexOf(m) + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length];
                setMode(next);
                document.getElementById(`calc-tab-${next}`)?.focus();
              }}
              className={cn("h-9 flex-1 touch-manipulation rounded-[9px] text-small font-bold transition-colors", mode === m ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted-foreground hover:text-foreground")}
            >
              {t(`calc.mode.${m}`)}
            </button>
          ))}
        </div>
        {phone && closeButton}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
        {mode === "calculate" && (
          <div role="tabpanel" id="calc-panel-calculate" aria-labelledby="calc-tab-calculate">
            <div className="flex items-center gap-2 px-3 pt-3">
              <div role="radiogroup" aria-label={t("calc.angle")} className="flex gap-1">
                {(["deg", "rad"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    role="radio"
                    aria-checked={state.angle === unit}
                    aria-label={t(unit === "deg" ? "calc.degLong" : "calc.radLong")}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (state.angle !== unit) dispatch({ type: "toggleAngle" });
                      focusLine();
                    }}
                    className={chipClass(state.angle === unit)}
                  >
                    {t(unit === "deg" ? "calc.deg" : "calc.rad")}
                  </button>
                ))}
              </div>
              {state.memory && (
                <span className="text-small font-bold text-muted-foreground" title={t("calc.memory").replace("{value}", prettyResult(formatResult(state.memory)))}>
                  M<span className="sr-only">: {t("calc.memory").replace("{value}", prettyResult(formatResult(state.memory)))}</span>
                </span>
              )}
              <span className="flex-1" />
              {phone && history.length > 0 && (
                <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((v) => !v)} className={chipClass(historyOpen)}>
                  {t("calc.history")}
                </button>
              )}
              {phone && (
                <button type="button" aria-pressed={moreKeys} onClick={() => setMoreKeys((v) => !v)} className={chipClass(moreKeys)}>
                  {t(moreKeys ? "calc.fewerKeys" : "calc.moreKeys")}
                </button>
              )}
            </div>

            {historyShown && history.length > 0 && (
              <ul aria-label={t("calc.history")} className="mx-3 mt-2 max-h-[104px] overflow-y-auto overscroll-contain rounded-xl border border-border">
                {history.map((entry, index) => {
                  const result = prettyResult(formatResult(entry.result));
                  return (
                    <li key={`${history.length - index}`} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => {
                          dispatch({ type: "recall", index });
                          focusLine();
                        }}
                        aria-label={t("calc.historyReuse").replace("{result}", result).replace("{expr}", entry.expr)}
                        className="flex min-h-[34px] w-full items-baseline gap-2 px-2.5 py-1 text-left text-small tabular-nums hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.expr}</span>
                        <span className="shrink-0 font-bold">= {result}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mx-3 mt-2 rounded-xl border border-border px-3 pb-2 pt-1 focus-within:border-foreground">
              <input
                ref={line}
                value={state.expr}
                onChange={(e) => dispatch({ type: "edit", expr: e.target.value, caret: e.target.selectionStart ?? e.target.value.length })}
                onSelect={(e) => dispatch({ type: "select", start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0 })}
                aria-label={t("calc.line")}
                aria-invalid={state.error ? true : undefined}
                aria-describedby="calc-result"
                placeholder={t("calc.linePlaceholder")}
                // A phone keeps its own keyboard down: the keypad below is the keyboard.
                inputMode={touch ? "none" : "text"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="h-9 w-full bg-transparent text-ui tabular-nums text-foreground placeholder:text-faint focus:outline-none"
              />
              <div id="calc-result" role="status" aria-live="polite" aria-atomic="true" className="flex min-h-9 items-center justify-end">
                {state.error ? (
                  <span className="w-full text-small font-semibold text-rose-700">{state.error.message}</span>
                ) : state.result ? (
                  <output aria-label={t("calc.result")} className="max-w-full overflow-x-auto whitespace-nowrap text-[26px] font-extrabold leading-9 tabular-nums">
                    <span aria-hidden>= </span>
                    {prettyResult(shown)}
                  </output>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
              {(["sf3", "sf4"] as Precision[]).map((p) => (
                <button key={p} type="button" disabled={!state.result} aria-pressed={state.precision === p} onClick={() => dispatch({ type: "precision", precision: p })} title={t(p === "sf3" ? "calc.sf3Long" : "calc.sf4Long")} aria-label={t(p === "sf3" ? "calc.sf3Long" : "calc.sf4Long")} className={chipClass(state.precision === p)}>
                  {t(p === "sf3" ? "calc.sf3" : "calc.sf4")}
                </button>
              ))}
              <button
                type="button"
                disabled={!state.result || !hasFraction(state.result)}
                aria-pressed={state.fraction}
                onClick={() => dispatch({ type: "toggleFraction" })}
                title={t(state.fraction ? "calc.decimalLong" : "calc.fractionLong")}
                aria-label={t(state.fraction ? "calc.decimalLong" : "calc.fractionLong")}
                className={chipClass(state.fraction)}
              >
                {t("calc.fraction")}
              </button>
              <span className="flex-1" />
              <button type="button" disabled={!state.result} onClick={() => void copy(shown)} className={chipClass(false)}>
                {t("calc.copy")}
              </button>
              {canInsert && (
                <button type="button" disabled={!state.result} onClick={() => insertText(shown)} title={t("calc.insertLong")} aria-label={t("calc.insertLong")} className={chipClass(false)}>
                  {t("calc.insert")}
                </button>
              )}
            </div>

            <div role="group" aria-label={t("calc.keypad")} className="mt-2.5 grid grid-cols-5 gap-1.5 px-3">
              {showExtra && EXTRA_KEYS.map(renderKey)}
              {FUNCTION_KEYS.map(renderKey)}
              {MAIN_KEYS.map(renderKey)}
            </div>
          </div>
        )}

        {mode === "stats" && (
          <div role="tabpanel" id="calc-panel-stats" aria-labelledby="calc-tab-stats">
            <CalculatorStats text={statsText} onText={setStatsText} chipClass={chipClass} onCopy={copy} onInsert={canInsert ? insertText : undefined} />
          </div>
        )}

        {mode === "graph" && (
          <div role="tabpanel" id="calc-panel-graph" aria-labelledby="calc-tab-graph">
            <CalculatorGraph value={graph} onChange={setGraph} ans={state.ans} />
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className={cn("pointer-events-none absolute inset-x-0 mx-auto w-fit rounded-full", phone ? "top-[62px]" : "bottom-3", " bg-foreground px-3 py-1.5 text-small font-bold text-background transition-opacity", status ? "opacity-100" : "opacity-0")}>
        {status}
      </p>
    </div>,
    document.body,
  );
}
