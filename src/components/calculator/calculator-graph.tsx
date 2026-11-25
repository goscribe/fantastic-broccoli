"use client";

import { useDeferredValue, useMemo } from "react";
import { NoteGraph } from "@/components/notes/note-graph";
import type { CalcValue } from "@/lib/calculator/engine";
import { graphOf } from "@/lib/calculator/graph";
import { lineLatex } from "@/lib/calculator/pretty";
import { normaliseTyped } from "@/lib/calculator/state";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calculator-panel";
import { cn } from "@/lib/utils";
import { CalcMath } from "./calculator-math";
import { FIELD, SCREEN } from "./calculator-ui";

export interface GraphInput {
  expr: string;
  left: string;
  right: string;
}

const field = cn(FIELD, "font-mono text-small");

/**
 * Graph mode: y = f(x) over an x range, drawn by NoteGraph, the same static
 * plot the note figures use. The y range fits the curve.
 */
export default function CalculatorGraph({ value, onChange, ans }: { value: GraphInput; onChange: (value: GraphInput) => void; ans: CalcValue | null }) {
  const { t } = useI18n();
  const typed = useDeferredValue(value);
  const outcome = useMemo(
    () => (typed.expr.trim() ? graphOf(typed.expr, Number(typed.left.replace("−", "-")), Number(typed.right.replace("−", "-")), ans) : null),
    [typed, ans],
  );

  const typedFn = typed.expr.trim().replace(/^y\s*=\s*/i, "");
  const fnTex = typedFn ? lineLatex(typedFn, "rad") : null;

  return (
    <div className="px-3 pt-3">
      <label htmlFor="calc-graph-fn" className="text-small font-bold text-foreground">
        {t("calc.graph.label")}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="shrink-0 text-ui font-bold" aria-hidden>
          y =
        </span>
        <input
          id="calc-graph-fn"
          value={value.expr}
          onChange={(e) => onChange({ ...value, expr: normaliseTyped(e.target.value) })}
          placeholder={t("calc.graph.placeholder")}
          aria-describedby="calc-graph-note"
          aria-invalid={outcome && !outcome.ok ? true : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`${field} min-w-0 flex-1`}
        />
      </div>
      <div className="mt-2 flex items-center gap-2 text-small font-semibold text-muted-foreground">
        <label htmlFor="calc-graph-left">{t("calc.graph.from")}</label>
        <input id="calc-graph-left" value={value.left} onChange={(e) => onChange({ ...value, left: e.target.value })} inputMode="decimal" autoComplete="off" className={`${field} w-[76px]`} />
        <label htmlFor="calc-graph-right">{t("calc.graph.to")}</label>
        <input id="calc-graph-right" value={value.right} onChange={(e) => onChange({ ...value, right: e.target.value })} inputMode="decimal" autoComplete="off" className={`${field} w-[76px]`} />
      </div>

      {/* The function as maths, like the Calculate screen, then its plot. */}
      <div className={cn(SCREEN, "mt-3 overflow-hidden")} aria-live="polite">
        <div aria-hidden className="flex min-h-[44px] items-center overflow-x-auto overflow-y-hidden whitespace-nowrap px-3 text-[20px]">
          <CalcMath tex={`y=${fnTex ?? "\\square"}`} fallback={`y = ${typedFn}`} />
        </div>
        {outcome?.ok && (
          // The plot sits in the screen under the maths heading: its own card edge and (visible) title would repeat them.
          <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-b-0 [&>div>p:first-child]:sr-only">
            <NoteGraph
              title={`y = ${typedFn}`}
              graph={{ xLabel: "x", yLabel: "y", bounds: outcome.window, expressions: [{ latex: outcome.latex, label: null }] }}
            />
          </div>
        )}
        {outcome && !outcome.ok && (
          <p role="alert" className="px-3 pb-3 text-small font-semibold text-rose-700 dark:text-rose-300">
            {outcome.message}
          </p>
        )}
      </div>
      <p id="calc-graph-note" className="mt-2 text-small text-muted-foreground">
        {t("calc.graph.radians")}
      </p>
    </div>
  );
}
