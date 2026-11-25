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
import { PageShell } from "@/components/ui/page-header";

/** Every action in the shop is a secondary button (white, hairline): a catalogue has no single primary. */
const btnBase =
  "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13.5px] font-bold transition-colors disabled:cursor-not-allowed";
/** Something you can afford: the price in the accent colour on the secondary shape. */
const btnBuy = "border border-border bg-white text-accent-dim hover:border-border-strong hover:bg-muted disabled:opacity-60";

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="page-h2">{children}</h2>
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
              : btnBuy,
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : short > 0 ? (
            <Lock className="size-3.5" />
          ) : null}
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
      <span className={cn(btnBase, "bg-muted text-foreground")}>
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
        className={cn(btnBase, "border border-border bg-white text-foreground hover:border-border-strong hover:bg-muted")}
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
      className={cn(btnBase, "border border-border bg-white text-foreground hover:border-border-strong hover:bg-muted")}
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
      <PageShell as="div" max="max-w-3xl" className="py-10 text-center">
        <p className="text-sm text-muted-foreground">{t("rewards.loadFailed")}</p>
        <button type="button" onClick={() => refetch()} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          {t("rewards.retry")}
        </button>
      </PageShell>
    );
  }

  if (!rewards) {
    return (
      <PageShell as="div" max="max-w-3xl" className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </PageShell>
    );
  }

  const freezeCost = rewards.catalog.find((c) => c.id === FREEZE_ID)?.cost ?? 0;
  const freezesFull = rewards.freezes >= rewards.maxFreezes;
  const freezeShort = freezeCost - rewards.balance;
  const buyingFreeze = buy.isPending && buy.variables === FREEZE_ID;

  return (
    <PageShell as="div" max="max-w-3xl">
      {/* Balance */}
      {/* The page's own header: on the page, no tinted panel. */}
      <section className="relative overflow-hidden border-b border-border pb-5 pt-1 sm:pb-6">
        <div className="relative z-10 max-w-[calc(100%-96px)] sm:max-w-[calc(100%-140px)]">
          <h1 className="page-h1">{t("rewards.shop")}</h1>
          <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{t("rewards.shopSubtitle")}</p>
          <p className="mt-4 text-[13px] font-bold text-muted-foreground">{t("rewards.balance")}</p>
          <p className="flex items-center gap-1.5 text-[30px] font-bold leading-none tabular-nums">
            <Sparkles className="size-6 text-accent" fill="currentColor" />
            {rewards.balance.toLocaleString()}
          </p>
          <p className="mt-2.5 text-[12px] font-medium text-muted-foreground">{t("rewards.howToEarn")}</p>
        </div>
        <Mascot pose="cheer" className="cat-bob absolute bottom-0 right-1 h-[112px] sm:right-4 sm:h-[140px]" />
      </section>

      {/* Invite a friend: a free Starter week each, plus points */}
      <InviteCard className="mt-6" />

      {/* Streak freeze */}
      <section className="mt-8">
        <SectionTitle>{t("rewards.sectionFreeze")}</SectionTitle>
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted text-foreground">
              <Snowflake className="size-6" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{t("rewards.freezeName")}</p>
              <p className="text-[12.5px] leading-snug text-muted-foreground">{t("rewards.freezeDesc")}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                {Array.from({ length: rewards.maxFreezes }, (_, i) => (
                  <Snowflake key={i} className={cn("size-3.5", i < rewards.freezes ? "text-foreground" : "text-border-strong")} strokeWidth={2.4} />
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
                  : btnBuy,
              )}
            >
              {buyingFreeze ? (
                <Loader2 className="size-4 animate-spin" />
              ) : freezesFull ? (
                <Check className="size-4" strokeWidth={3} />
              ) : freezeShort > 0 ? (
                <Lock className="size-3.5" />
              ) : null}
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
              <div className="grid h-[128px] place-items-center rounded-xl bg-muted pt-3">
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
    </PageShell>
  );
}
