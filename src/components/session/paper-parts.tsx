"use client";

import { useSyncExternalStore } from "react";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/practice-paper";
import { cn } from "@/lib/utils";
import type { PaperInfo, WorksheetSource } from "@/types";
import { formatClock, paperTimeLeft } from "@/lib/practice-paper";

const START_KEY = (activityId: string) => `scribe.paper-start.${activityId}`;

/** When this learner opened the paper (kept per device, so a reload keeps the clock); null when storage is blocked. */
function readPaperStart(activityId: string): number | null {
  try {
    const saved = Number(window.localStorage.getItem(START_KEY(activityId)));
    if (saved > 0) return saved;
    const now = Date.now();
    window.localStorage.setItem(START_KEY(activityId), String(now));
    return now;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};
function everySecond(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

/** The paper's line above the question: name and section, then time left, marks and calculator, in plain text. */
export function PaperBar({ activityId, paper, section, showInstructions }: { activityId: string; paper: PaperInfo; section?: string; showInstructions: boolean }) {
  const { t } = useI18n();
  // Browser-only values: nothing on the server render, so hydration always matches.
  const start = useSyncExternalStore(noSubscribe, () => readPaperStart(activityId), () => null);
  const now = useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000) * 1000, () => null);
  const left = paper.minutes && start !== null && now !== null ? paperTimeLeft(start, paper.minutes, now) : null;
  const over = left !== null && left < 0;
  const facts = [
    paper.totalMarks ? `${paper.totalMarks} ${t("paper.marks")}` : null,
    paper.calculator == null ? null : t(paper.calculator ? "paper.calculator" : "paper.noCalculator"),
  ].filter(Boolean);

  return (
    <div className="mb-5">
      <p className="text-[15px] font-extrabold">
        {paper.name}
        {section && <span className="font-semibold text-muted-foreground"> · {section}</span>}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-muted-foreground">
        {left !== null && (
          <span className={cn(over && "text-rose-600")}>
            {over ? t("paper.over").replace("{t}", formatClock(-left)) : t("paper.left").replace("{t}", formatClock(left))}
            {facts.length > 0 && " · "}
          </span>
        )}
        {facts.join(" · ")}
      </p>
      {showInstructions && (
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          {[...(paper.instructions ?? []), t("paper.notReal")].join(" ")}
        </p>
      )}
    </div>
  );
}

/** Sources or documents a question is on, each with its label and attribution. */
export function SourcesPanel({ sources }: { sources: WorksheetSource[] }) {
  const { t } = useI18n();
  if (sources.length === 0) return null;
  return (
    <section aria-label={t("paper.sources")} className="space-y-3">
      {sources.map((s) => (
        <figure key={s.label} className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
          <figcaption className="text-[13px] font-extrabold">
            {s.label}
            {s.attribution && <span className="ml-2 font-medium text-muted-foreground">{s.attribution}</span>}
          </figcaption>
          <div className="mt-1.5 text-[15px] leading-relaxed">
            <MarkdownText text={s.text} />
          </div>
        </figure>
      ))}
    </section>
  );
}

const LETTERS = ["A", "B", "C", "D"];

/** Four lettered options; after checking, the right one turns green and a wrong pick red. */
export function McqOptions({
  options,
  value,
  answer,
  checked,
  disabled,
  onPick,
}: {
  options: string[];
  value: string;
  answer?: string;
  checked: boolean;
  disabled: boolean;
  onPick: (letter: string) => void;
}) {
  return (
    <div role="radiogroup" className="mt-3 grid gap-2">
      {options.map((opt, i) => {
        const letter = LETTERS[i];
        const picked = value.toUpperCase() === letter;
        const right = checked && answer?.toUpperCase() === letter;
        const wrong = checked && picked && !right;
        return (
          <button
            key={letter}
            type="button"
            role="radio"
            aria-checked={picked}
            disabled={disabled}
            onClick={() => onPick(letter)}
            className={cn(
              "flex min-h-12 w-full touch-manipulation items-start gap-3 rounded-2xl px-4 py-3 text-left text-[15px] ring-inset transition-[background-color,box-shadow] duration-150",
              right
                ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                : wrong
                  ? "bg-rose-50 text-rose-900 ring-2 ring-rose-400"
                  : picked
                    ? "bg-[color-mix(in_srgb,var(--accent)_10%,#fff)] ring-2 ring-accent"
                    : "bg-muted hover:bg-[var(--edge)]",
            )}
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-[12px] font-extrabold">
              {letter}
            </span>
            <span className="min-w-0 flex-1">
              <MarkdownText text={opt} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
