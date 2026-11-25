"use client";

import { useDeferredValue, useMemo } from "react";
import { NoteGraph } from "@/components/notes/note-graph";
import type { CalcValue } from "@/lib/calculator/engine";
import { graphOf } from "@/lib/calculator/graph";
import { normaliseTyped } from "@/lib/calculator/state";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calculator-panel";

export interface GraphInput {
  expr: string;
  left: string;
  right: string;
}

const field =
  "h-11 rounded-xl border border-border bg-white px-3 text-ui tabular-nums text-foreground placeholder:text-faint focus:border-foreground focus:outline-none";

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

      <div className="mt-3" aria-live="polite">
        {outcome?.ok && (
          <NoteGraph
            title={`y = ${typed.expr.trim().replace(/^y\s*=\s*/i, "")}`}
            graph={{ xLabel: "x", yLabel: "y", bounds: outcome.window, expressions: [{ latex: outcome.latex, label: null }] }}
          />
        )}
        {outcome && !outcome.ok && (
          <p role="alert" className="text-small font-semibold text-rose-700">
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
