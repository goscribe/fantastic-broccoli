"use client";

import { useMemo } from "react";
import katex from "katex";
import { MathText } from "@/components/ui/markdown-text";
import { cn } from "@/lib/utils";

export function WidgetFrame({
  title,
  hint,
  formula,
  children,
}: {
  title: string;
  hint?: string;
  formula?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-2 rounded-2xl border border-border bg-card p-4 animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <MathText text={title} />
          </p>
          {hint && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <MathText text={hint} />
            </p>
          )}
        </div>
        {formula && <InlineFormula latex={formula} />}
      </div>
      {children}
    </div>
  );
}

export function InlineFormula({ latex }: { latex: string }) {
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false }),
    [latex],
  );
  return (
    <span
      className="text-sm shrink-0 text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground tabular-nums">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="param-slider w-full"
        style={{
          background: `linear-gradient(to right, var(--accent) ${((value - min) / (max - min)) * 100}%, var(--muted) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  );
}

export function Readout({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-center",
        highlight ? "border-energy/30 bg-energy-soft" : "border-border bg-muted/50",
      )}
    >
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xs font-bold tabular-nums",
          highlight && "text-energy",
        )}
      >
        {value}
      </p>
    </div>
  );
}
