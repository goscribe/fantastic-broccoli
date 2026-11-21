"use client";

import { TryCat } from "./try-cat";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/try";
import { TryBox } from "./try-box";

/**
 * Hero link to the try section. Absolutely positioned in the gap under the
 * hero buttons so the original hero (and its cats) keeps its exact layout.
 */
export function TryHeroLink() {
  const { t } = useI18n();
  return (
    <a
      href="#try"
      className="absolute left-1/2 top-full mt-2 inline-flex min-h-9 -translate-x-1/2 items-center whitespace-nowrap px-3 text-[14px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
    >
      {t("try.heroCta")}
    </a>
  );
}

/** "Try a Quick 5 — no account": the try box on the page itself (no panel), below the hero scene. */
export function TrySection() {
  const { t } = useI18n();
  return (
    <section id="try" className="app-brand relative w-full scroll-mt-16 border-b border-border bg-white text-foreground">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-20">
        <TryCat pose="pencil" className="h-[104px]" />
        <h2 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[38px]">{t("try.sectionTitle")}</h2>
        <p className="mt-2 max-w-[480px] text-[16px] font-semibold leading-snug text-muted-foreground">{t("try.sectionSub")}</p>
        <TryBox landing="landing" className="mt-7 max-w-[520px]" />
      </div>
    </section>
  );
}
