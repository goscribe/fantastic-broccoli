"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
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
      className="absolute left-1/2 top-full mt-2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-bold text-accent hover:bg-accent-soft"
    >
      {t("try.heroCta")}
      <ArrowDown className="size-4" />
    </a>
  );
}

/** "Try a Quick 5 — no account": the try box in its own band, below the hero scene. */
export function TrySection() {
  const { t } = useI18n();
  return (
    <section id="try" className="relative w-full scroll-mt-16 overflow-hidden" style={{ background: "#f5f3ff" }}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 py-16 text-center sm:px-6">
        <Image src="/design/cat2-pencil.png" alt="" width={110} height={110} unoptimized className="cat-bob h-[84px] w-auto" />
        <h2 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">{t("try.sectionTitle")}</h2>
        <p className="mt-2 max-w-[480px] text-[15.5px] text-muted-foreground">{t("try.sectionSub")}</p>
        <TryBox landing="landing" className="mt-6 max-w-[540px]" />
      </div>
    </section>
  );
}
