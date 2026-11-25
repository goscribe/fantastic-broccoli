"use client";

import { useMemo, useState } from "react";
import { formatNumber, prettyResult, type Precision } from "@/lib/calculator/format";
import { parseList, summarise } from "@/lib/calculator/stats";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calculator-panel";

/** Stats mode: a list of numbers in, its summary out; each value can be copied or put into the answer. */
export function CalculatorStats({
  text,
  onText,
  chipClass,
  onCopy,
  onInsert,
}: {
  text: string;
  onText: (text: string) => void;
  chipClass: (on: boolean) => string;
  onCopy: (text: string) => void;
  onInsert?: (text: string) => void;
}) {
  const { t } = useI18n();
  const [precision, setPrecision] = useState<Precision>("auto");
  const list = useMemo(() => parseList(text), [text]);
  const summary = useMemo(() => summarise(list.values), [list.values]);
  const write = (v: number) => formatNumber(v, precision);

  const rows: { key: string; label: string; value: string | null }[] = summary
    ? [
        { key: "n", label: t("calc.stats.n"), value: String(summary.n) },
        { key: "sum", label: t("calc.stats.sum"), value: write(summary.sum) },
        { key: "mean", label: t("calc.stats.mean"), value: write(summary.mean) },
        { key: "median", label: t("calc.stats.median"), value: write(summary.median) },
        { key: "sdPopulation", label: t("calc.stats.sdPopulation"), value: write(summary.sdPopulation) },
        { key: "sdSample", label: t("calc.stats.sdSample"), value: summary.sdSample === null ? null : write(summary.sdSample) },
      ]
    : [];

  return (
    <div className="px-3 pt-3">
      <label htmlFor="calc-stats-list" className="text-small font-bold text-foreground">
        {t("calc.stats.label")}
      </label>
      <textarea
        id="calc-stats-list"
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={3}
        inputMode="decimal"
        placeholder={t("calc.stats.placeholder")}
        aria-describedby="calc-stats-help"
        spellCheck={false}
        autoComplete="off"
        className="mt-1.5 block w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-ui tabular-nums text-foreground placeholder:text-faint focus:border-foreground focus:outline-none"
      />
      <p id="calc-stats-help" className="mt-1.5 text-small text-muted-foreground">
        {t("calc.stats.help")}
      </p>
      {list.invalid.length > 0 && (
        <p role="alert" className="mt-1.5 text-small font-semibold text-rose-700">
          {t("calc.stats.invalid").replace("{list}", list.invalid.slice(0, 5).join(", "))}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        {(["sf3", "sf4"] as Precision[]).map((p) => (
          <button key={p} type="button" aria-pressed={precision === p} onClick={() => setPrecision(precision === p ? "auto" : p)} aria-label={t(p === "sf3" ? "calc.sf3Long" : "calc.sf4Long")} className={chipClass(precision === p)}>
            {t(p === "sf3" ? "calc.sf3" : "calc.sf4")}
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" disabled={!text} onClick={() => onText("")} className={chipClass(false)}>
          {t("calc.stats.clear")}
        </button>
      </div>

      <dl aria-label={t("calc.stats.results")} aria-live="polite" className="mt-2.5 overflow-hidden rounded-xl border border-border">
        {(summary ? rows : [{ key: "n", label: t("calc.stats.n"), value: "0" }]).map((row) => (
          <div key={row.key} className="flex min-h-11 items-center gap-2 border-b border-border px-3 last:border-b-0">
            <dt className="min-w-0 flex-1 text-small font-semibold text-muted-foreground">{row.label}</dt>
            <dd className="shrink-0 text-ui font-extrabold tabular-nums">
              {row.value === null ? <span className="text-small font-semibold text-muted-foreground">{t("calc.stats.needTwo")}</span> : prettyResult(row.value)}
            </dd>
            {summary && row.value !== null && (
              <dd className="shrink-0">
                <button
                  type="button"
                  onClick={() => (onInsert ? onInsert(row.value as string) : onCopy(row.value as string))}
                  aria-label={`${t(onInsert ? "calc.insertLong" : "calc.copy")}: ${row.label} ${row.value}`}
                  className="h-9 rounded-[10px] px-2 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t(onInsert ? "calc.insert" : "calc.copy")}
                </button>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
