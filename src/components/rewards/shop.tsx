"use client";

import { Check, Loader2, Lock, Snowflake, Sparkles } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { FREEZE_ID, OUTFIT_ITEMS, THEME_ITEMS, themeSwatch } from "@/components/rewards/items";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_ACCENT_SWATCH } from "@/lib/accent-theme";
import type { EquipSlot, RewardsSummary } from "@/lib/api/rewards";
import { useBuyReward, useEquipReward, useRewards } from "@/lib/rewards";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/rewards";
import { InviteCard } from "@/components/growth/invite-card";

const btnBase =
  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[16px] font-bold tracking-tight">{children}</h2>
      {aside}
    </div>
  );
}

/** One action for a theme/outfit: buy (with price), use, in use or take off. */
function ItemAction({
  rewards,
  itemId,
  slot,
  onBuy,
  onEquip,
  pending,
}: {
  rewards: RewardsSummary;
  itemId: string | null;
  slot: EquipSlot;
  onBuy: (id: string) => void;
  onEquip: (slot: EquipSlot, id: string | null) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const cost = itemId ? (rewards.catalog.find((c) => c.id === itemId)?.cost ?? 0) : 0;
  const owned = itemId === null || rewards.owned.includes(itemId);
  const inUse = rewards[slot] === itemId;

  if (!owned) {
    const short = cost - rewards.balance;
    return (
      <div>
        <button
          type="button"
          disabled={pending || short > 0}
          onClick={() => itemId && onBuy(itemId)}
          className={cn(
            btnBase,
            short > 0
              ? "border border-border bg-muted text-faint"
              : "bg-accent text-accent-foreground hover:bg-accent-dim disabled:opacity-60",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : short > 0 ? (
            <Lock className="size-3.5" />
          ) : (
            <Sparkles className="size-3.5" fill="currentColor" />
          )}
          {t("rewards.ptsValue").replace("{n}", cost.toLocaleString())}
        </button>
        {short > 0 && (
          <p className="mt-1 text-center text-[11px] font-medium text-faint">
            {t("rewards.needMore").replace("{n}", short.toLocaleString())}
          </p>
        )}
      </div>
    );
  }
  if (inUse && (slot === "theme" || itemId === null)) {
    return (
      <span className={cn(btnBase, "border border-accent/30 bg-accent-soft text-accent-dim")}>
        <Check className="size-4" strokeWidth={3} />
        {t("rewards.inUse")}
      </span>
    );
  }
  if (inUse) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => onEquip(slot, null)}
        className={cn(btnBase, "border border-border bg-white text-foreground hover:bg-muted dark:bg-card")}
      >
        {t("rewards.takeOff")}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onEquip(slot, itemId)}
      className={cn(btnBase, "border border-accent/40 bg-white text-accent-dim hover:bg-accent-soft dark:bg-card")}
    >
      {t("rewards.use")}
    </button>
  );
}

function ThemePreview({ swatch, soft }: { swatch: string; soft: string }) {
  return (
    <div className="flex h-[76px] flex-col justify-between rounded-xl p-2.5" style={{ backgroundColor: soft }} aria-hidden>
      <div className="flex gap-1">
        <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: swatch }} />
        <span className="h-1.5 w-5 rounded-full opacity-40" style={{ backgroundColor: swatch }} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="grid h-7 flex-1 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: swatch }}>
          Aa
        </span>
        <span className="size-7 rounded-full border-2 bg-white" style={{ borderColor: swatch }} />
      </div>
    </div>
  );
}

export function Shop() {
  const { t } = useI18n();
  const { data: rewards, isError, refetch } = useRewards();
  const buy = useBuyReward(t("rewards.buyFailed"));
  const equip = useEquipReward(t("rewards.equipFailed"));
  const isPending = (id: string | null) =>
    (buy.isPending && buy.variables === id) || (equip.isPending && equip.variables?.itemId === id);
  const onBuy = (id: string) => buy.mutate(id);
  const onEquip = (slot: EquipSlot, itemId: string | null) => equip.mutate({ slot, itemId });

  if (isError && !rewards) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-8">
        <p className="text-sm text-muted-foreground">{t("rewards.loadFailed")}</p>
        <button type="button" onClick={() => refetch()} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          {t("rewards.retry")}
        </button>
      </div>
    );
  }

  if (!rewards) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-12 pt-4 sm:px-8">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const freezeCost = rewards.catalog.find((c) => c.id === FREEZE_ID)?.cost ?? 0;
  const freezesFull = rewards.freezes >= rewards.maxFreezes;
  const freezeShort = freezeCost - rewards.balance;
  const buyingFreeze = buy.isPending && buy.variables === FREEZE_ID;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-2 sm:px-8 sm:pt-4">
      {/* Balance */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-accent-soft px-5 py-5 sm:px-7 sm:py-6">
        <div className="relative z-10 max-w-[calc(100%-96px)] sm:max-w-[calc(100%-140px)]">
          <h1 className="text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">{t("rewards.shop")}</h1>
          <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{t("rewards.shopSubtitle")}</p>
          <p className="mt-4 text-[12px] font-semibold text-accent-dim">{t("rewards.balance")}</p>
          <p className="flex items-center gap-1.5 text-[30px] font-bold leading-none tabular-nums">
            <Sparkles className="size-6 text-accent" fill="currentColor" />
            {rewards.balance.toLocaleString()}
          </p>
          <p className="mt-2.5 text-[12px] font-medium text-muted-foreground">{t("rewards.howToEarn")}</p>
        </div>
        <Mascot pose="cheer" className="cat-bob absolute -bottom-3 right-3 h-[124px] sm:right-6 sm:h-[160px]" />
      </section>

      {/* Invite a friend: a free Starter week each, plus points */}
      <InviteCard className="mt-6" />

      {/* Streak freeze */}
      <section className="mt-8">
        <SectionTitle>{t("rewards.sectionFreeze")}</SectionTitle>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-600 ring-1 ring-sky-200">
              <Snowflake className="size-6" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{t("rewards.freezeName")}</p>
              <p className="text-[12.5px] leading-snug text-muted-foreground">{t("rewards.freezeDesc")}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-sky-700">
                {Array.from({ length: rewards.maxFreezes }, (_, i) => (
                  <Snowflake key={i} className={cn("size-3.5", i < rewards.freezes ? "text-sky-600" : "text-border-strong")} strokeWidth={2.4} />
                ))}
                {t("rewards.held").replace("{n}", String(rewards.freezes)).replace("{max}", String(rewards.maxFreezes))}
              </p>
            </div>
          </div>
          <div className="sm:w-40">
            <button
              type="button"
              disabled={freezesFull || freezeShort > 0 || buyingFreeze}
              onClick={() => onBuy(FREEZE_ID)}
              className={cn(
                btnBase,
                freezesFull || freezeShort > 0
                  ? "border border-border bg-muted text-faint"
                  : "bg-accent text-accent-foreground hover:bg-accent-dim disabled:opacity-60",
              )}
            >
              {buyingFreeze ? (
                <Loader2 className="size-4 animate-spin" />
              ) : freezesFull ? (
                <Check className="size-4" strokeWidth={3} />
              ) : freezeShort > 0 ? (
                <Lock className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" fill="currentColor" />
              )}
              {freezesFull ? t("rewards.maxHeld") : t("rewards.ptsValue").replace("{n}", freezeCost.toLocaleString())}
            </button>
            {!freezesFull && freezeShort > 0 && (
              <p className="mt-1 text-center text-[11px] font-medium text-faint">
                {t("rewards.needMore").replace("{n}", freezeShort.toLocaleString())}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Themes */}
      <section className="mt-8">
        <SectionTitle>{t("rewards.sectionThemes")}</SectionTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <li className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
            <ThemePreview {...DEFAULT_ACCENT_SWATCH} />
            <p className="text-[14px] font-semibold">{t("rewards.themeDefault")}</p>
            <div className="mt-auto">
              <ItemAction rewards={rewards} itemId={null} slot="theme" onBuy={onBuy} onEquip={onEquip} pending={isPending(null)} />
            </div>
          </li>
          {THEME_ITEMS.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl border bg-card p-3",
                rewards.theme === item.id ? "border-accent/50 ring-1 ring-accent/30" : "border-border",
              )}
            >
              <ThemePreview {...themeSwatch(item.id)} />
              <p className="text-[14px] font-semibold">{t(item.nameKey)}</p>
              <div className="mt-auto">
                <ItemAction rewards={rewards} itemId={item.id} slot="theme" onBuy={onBuy} onEquip={onEquip} pending={isPending(item.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Outfits: home's "Dress up" pill lands here. */}
      <section id="outfits" className="mt-8 scroll-mt-20">
        <SectionTitle>{t("rewards.sectionOutfits")}</SectionTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {OUTFIT_ITEMS.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl border bg-card p-3",
                rewards.outfit === item.id ? "border-accent/50 ring-1 ring-accent/30" : "border-border",
              )}
            >
              <div className="grid h-[128px] place-items-center rounded-xl bg-[#fdf6ec] pt-3">
                <Mascot pose="wave" outfit={item.id} className="h-[96px]" />
              </div>
              <p className="text-[14px] font-semibold">{t(item.nameKey)}</p>
              <div className="mt-auto">
                <ItemAction rewards={rewards} itemId={item.id} slot="outfit" onBuy={onBuy} onEquip={onEquip} pending={isPending(item.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
