"use client";

import { useId, useState } from "react";
import { Check, CalendarCheck, ChevronDown, ChevronRight, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanOption } from "@/lib/api/account";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate, passTitle, perMonth } from "@/lib/pass";
import { cn } from "@/lib/utils";
import "@/lib/i18n/billing";

/** Headline for a pass ("Until your 2027 exams"), falling back to its name. */
export function usePassLabel() {
  const { t } = useI18n();
  return (plan: Pick<PlanOption, "id" | "name" | "kind" | "accessUntil">) => {
    const title = passTitle(plan);
    return title ? fill(t(title.key), { year: title.year }) : plan.name;
  };
}

/**
 * "Pay once — until your exams": the exam passes next to the monthly plan.
 * One payment, Starter's allowance until a fixed date, nothing renews.
 */
export function PassOptions({
  passes,
  busyId,
  disabled,
  onBuy,
  className,
  bare = false,
}: {
  passes: PlanOption[];
  busyId: string | null;
  disabled?: boolean;
  onBuy: (planId: string) => void;
  className?: string;
  /** Just the pass cards, without the heading (inside `PassDisclosure`). */
  bare?: boolean;
}) {
  const { t, locale } = useI18n();
  const label = usePassLabel();
  if (passes.length === 0) return null;
  // The longer pass is the better deal per month.
  const best = [...passes].sort((a, b) => (b.accessUntil ?? "").localeCompare(a.accessUntil ?? ""))[0];

  return (
    <section
      className={cn(!bare && "rounded-3xl border border-border bg-card/80 p-5 sm:p-6", className)}
      aria-labelledby={bare ? undefined : "pass-options-title"}
    >
      {!bare && (
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <CalendarCheck className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h2 id="pass-options-title" className="text-lg font-semibold tracking-tight">
            {t("bill.payOnce")}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t("bill.passNoRenew")}</p>
        </div>
      </div>
      )}
      <ul className={cn("grid gap-3 sm:grid-cols-2", !bare && "mt-4")}>
        {passes.map((plan) => {
          const until = plan.accessUntil ? formatPassDate(plan.accessUntil, locale) : "";
          const monthly = plan.accessUntil ? perMonth(plan.priceDollars, plan.accessUntil) : null;
          const isBest = passes.length > 1 && plan.id === best?.id;
          return (
            <li
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-background p-4",
                isBest ? "border-accent/60" : "border-border",
              )}
            >
              {isBest && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-foreground">
                  {t("bill.bestValue")}
                </span>
              )}
              <p className="text-[15px] font-semibold">{label(plan)}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                ${plan.priceDollars}
                <span className="ml-1 text-sm font-normal text-faint">{t("set.once")}</span>
              </p>
              {monthly !== null && (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {fill(t("bill.passPerMonth"), { price: `$${monthly.toFixed(2)}` })}
                </p>
              )}
              <ul className="mt-3 space-y-1.5 text-[13px]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {fill(t("bill.passUntil"), { date: until })}
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {fill(t("bill.passTokens"), { n: plan.monthlyTokens.toLocaleString() })}
                </li>
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isBest ? "primary" : "outline"}
                disabled={disabled || busyId !== null}
                onClick={() => onBuy(plan.id)}
              >
                {busyId === plan.id ? t("pay.opening") : fill(t("bill.passCta"), { price: `$${plan.priceDollars}` })}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The "No card? Ask a parent to pay" band that opens the share step. */
export function AskParentBand({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-3xl border border-dashed border-accent/40 bg-accent-soft/50 p-5 sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-accent">
        <HeartHandshake className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("bill.noCard")}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t("bill.noCardBody")}</p>
      </div>
      <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={onOpen}>
        {t("ask.title")}
      </Button>
    </div>
  );
}

/**
 * One compact "Pay once instead" row under the monthly plan that expands to
 * the passes, so the monthly plan stays the first choice and the wall fits a
 * phone's first screen.
 */
export function PassDisclosure({
  passes,
  busyId,
  disabled,
  onBuy,
  className,
}: {
  passes: PlanOption[];
  busyId: string | null;
  disabled?: boolean;
  onBuy: (planId: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (passes.length === 0) return null;
  const from = Math.min(...passes.map((p) => p.priceDollars));
  return (
    <div className={cn("rounded-2xl border border-border bg-card/80", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <CalendarCheck className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">{t("bill.payOnceInstead")}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {fill(t("bill.payOnceInsteadSub"), { price: `$${from}` })}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panelId} className="border-t border-border px-4 pb-4 pt-4">
          <PassOptions bare passes={passes} busyId={busyId} disabled={disabled} onBuy={onBuy} />
        </div>
      )}
    </div>
  );
}

/** A one-line "No card? Ask a parent to pay" link that opens the share step. */
export function AskParentLink({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-3 text-left hover:bg-accent-soft",
        className,
      )}
    >
      <HeartHandshake className="size-5 shrink-0 text-accent" />
      <span className="min-w-0 flex-1 text-[14px] font-semibold text-accent-dim">{t("bill.noCard")}</span>
      <ChevronRight className="size-4 shrink-0 text-accent" />
    </button>
  );
}
