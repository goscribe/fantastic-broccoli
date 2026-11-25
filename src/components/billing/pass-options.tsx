"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanOption } from "@/lib/api/account";
import { useI18n } from "@/lib/i18n";
import { fill, formatPassDate, passTitle, perMonth } from "@/lib/pass";
import { planPriceLabel } from "@/lib/plan-display";
import { cn } from "@/lib/utils";
import { paidPerks, type ExamPitch } from "@/lib/wall";
import "@/lib/i18n/billing";

/** Headline for a pass ("Until your 2027 exams"), falling back to its name. */
export function usePassLabel() {
  const { t } = useI18n();
  return (plan: Pick<PlanOption, "id" | "name" | "kind" | "accessUntil">) => {
    const title = passTitle(plan);
    return title ? fill(t(title.key), { year: title.year }) : plan.name;
  };
}

/** The pass the student's exam date points at, with its pitch, when they have one. */
export interface PitchedPass {
  planId: string;
  pitch: ExamPitch;
}

/**
 * One exam pass as a plan card: the same card, type and perks as the monthly
 * plans next to it. Never the primary action: the page's one purple button is
 * the monthly trial (or the plan a link asked for).
 */
function PassCard({
  plan,
  pitch,
  best,
  picked,
  busy,
  disabled,
  onBuy,
  compact = false,
}: {
  plan: PlanOption;
  pitch: ExamPitch | null;
  best: boolean;
  /** Label when a link asked for this plan (`?plan=`). */
  picked?: string | null;
  busy: boolean;
  disabled: boolean;
  onBuy: (planId: string) => void;
  /** The wall's short version: price, dates and the button. */
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const label = usePassLabel();
  const price = planPriceLabel(plan);
  const until = plan.accessUntil ? formatPassDate(plan.accessUntil, locale) : null;
  const monthly = plan.accessUntil ? perMonth(plan.priceDollars, plan.accessUntil) : null;
  const tag = picked ?? (pitch ? "For your exam" : best ? t("bill.bestValue") : null);
  const perks = paidPerks(plan, { examLine: pitch?.line ?? null });
  return (
    <li
      id={picked ? "picked-plan" : undefined}
      className={cn(
        "life-card flex scroll-mt-24 flex-col",
        compact ? "p-4" : "p-5 sm:p-6",
        (pitch || picked) && "border-border-strong",
        picked && "border-foreground ring-1 ring-foreground",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={cn("font-extrabold leading-tight", compact ? "text-[15px]" : "text-[18px]")}>{label(plan)}</h3>
        {tag && <span className="shrink-0 text-[13px] font-bold text-muted-foreground">{tag}</span>}
      </div>
      {pitch && !compact && <p className="mt-1 text-[15px] text-muted-foreground">{pitch.headline}</p>}
      <p className={cn("font-extrabold leading-none tracking-tight tabular-nums", compact ? "mt-2 text-[24px]" : "mt-4 text-[30px]")}>
        {price.amount}
        <span className="text-[13px] font-semibold tracking-normal text-muted-foreground">{price.suffix}</span>
      </p>
      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
        {[until ? fill(t("bill.passUntil"), { date: until }) : null, monthly !== null ? fill(t("bill.passPerMonth"), { price: `$${monthly.toFixed(2)}` }) : null]
          .filter(Boolean)
          .join(". ")}
      </p>
      {!compact && (
        <ul className="mt-3 space-y-2 text-[15px]">
          {perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={2.6} />
              {perk}
            </li>
          ))}
        </ul>
      )}
      <div className={cn("mt-auto", compact ? "pt-3" : "pt-5")}>
        <Button className="w-full" variant="secondary" size={compact ? "md" : "md"} disabled={disabled} onClick={() => onBuy(plan.id)}>
          {busy ? t("pay.opening") : t("bill.getStarted")}
        </Button>
      </div>
    </li>
  );
}

/**
 * "Pay once — until your exams": the exam passes under the monthly plans on
 * /pricing. One payment, Starter's allowance until a fixed date, nothing renews.
 */
export function PassOptions({
  passes,
  busyId,
  disabled,
  onBuy,
  pitched = null,
  pickedId = null,
  pickedLabel = null,
  className,
}: {
  passes: PlanOption[];
  busyId: string | null;
  disabled?: boolean;
  onBuy: (planId: string) => void;
  pitched?: PitchedPass | null;
  pickedId?: string | null;
  pickedLabel?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  if (passes.length === 0) return null;
  // The longer pass is the better deal per month.
  const best = [...passes].sort((a, b) => String(b.accessUntil ?? "").localeCompare(String(a.accessUntil ?? "")))[0];
  return (
    <section className={className} aria-labelledby="pass-options-title">
      <h2 id="pass-options-title" className="text-[18px] font-extrabold leading-tight">
        {t("bill.payOnce")}
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground">{t("bill.passNoRenew")}</p>
      <ul className={cn("mt-4 grid gap-4", passes.length > 1 && "sm:grid-cols-2")}>
        {passes.map((plan) => (
          <PassCard
            key={plan.id}
            plan={plan}
            pitch={pitched?.planId === plan.id ? pitched.pitch : null}
            best={passes.length > 1 && plan.id === best?.id}
            picked={plan.id === pickedId ? pickedLabel : null}
            busy={busyId === plan.id}
            disabled={!!disabled || busyId !== null}
            onBuy={onBuy}
          />
        ))}
      </ul>
    </section>
  );
}

/** The "No card? Ask a parent to pay" row on /pricing that opens the share step. */
export function AskParentBand({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <section
      className={cn("flex flex-col items-start gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between", className)}
      aria-labelledby="ask-parent-band-title"
    >
      <div className="min-w-0">
        <h2 id="ask-parent-band-title" className="text-[17px] font-extrabold leading-tight">
          {t("bill.noCard")}
        </h2>
        <p className="mt-1 max-w-xl text-[15px] text-muted-foreground">{t("bill.noCardBody")}</p>
      </div>
      <Button variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={onOpen}>
        {t("ask.title")}
      </Button>
    </section>
  );
}

/**
 * One compact "Pay once instead" row under the wall's monthly plans that
 * expands to the passes, so the monthly trial stays the first choice and the
 * wall still fits a phone's first screen.
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
  const best = [...passes].sort((a, b) => String(b.accessUntil ?? "").localeCompare(String(a.accessUntil ?? "")))[0];
  return (
    <div className={cn("life-card", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center gap-3 rounded-[inherit] px-4 py-3 text-left hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">{t("bill.payOnceInstead")}</span>
          <span className="block text-[13px] text-muted-foreground">{fill(t("bill.payOnceInsteadSub"), { price: `$${from}` })}</span>
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={panelId} className={cn("grid gap-3 border-t border-border p-3", passes.length > 1 && "sm:grid-cols-2")}>
          {passes.map((plan) => (
            <PassCard
              key={plan.id}
              compact
              plan={plan}
              pitch={null}
              best={passes.length > 1 && plan.id === best?.id}
              busy={busyId === plan.id}
              disabled={!!disabled || busyId !== null}
              onBuy={onBuy}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A one-line "No card? Ask a parent to pay" link on the wall that opens the share step. */
export function AskParentLink({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "min-h-11 w-full px-3 text-center text-[15px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground",
        className,
      )}
    >
      {t("bill.noCard")}
    </button>
  );
}
