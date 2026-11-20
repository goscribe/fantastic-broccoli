"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/try";
import type { TryTool } from "@/lib/try";
import { cn } from "@/lib/utils";
import { TryBox } from "./try-box";

/** Floating study props, as in the landing hero. */
function Prop({ src, className, delay = "0s" }: { src: string; className: string; delay?: string }) {
  return <Image src={src} alt="" width={96} height={96} unoptimized className={cn("cat-float absolute hidden object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.18)] lg:block", className)} style={{ animationDelay: delay }} />;
}

/**
 * Ad / SEO landing page body: the keyword as the headline and the try box
 * right under it, with the landing hero's cats and props around it so it
 * reads as the same brand.
 */
export function ToolHero({ tool }: { tool: TryTool }) {
  const { t } = useI18n();
  const steps = ["try.step1", "try.step2", "try.step3"] as const;
  return (
    <>
      <section className="relative overflow-hidden" style={{ background: "#f5f3ff" }}>
        {/* Desktop: the landing's cheering and reading cats either side of the box. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1240px] lg:block">
          <Image src="/design/cat2-cheer.png" alt="" width={300} height={300} unoptimized className="design-pop absolute bottom-10 left-[1%] size-[240px] object-contain" />
          <Image src="/design/cat2-book.png" alt="" width={220} height={220} unoptimized className="cat-bob absolute bottom-10 right-[2%] size-[200px] object-contain" />
          <Prop src="/design/props/star.png" className="left-[8%] top-16 size-14" />
          <Prop src="/design/props/pencil.png" className="left-[20%] top-[46%] size-14 -rotate-12" delay="0.6s" />
          <Prop src="/design/props/trophy.png" className="right-[12%] top-14 size-14" delay="0.3s" />
          <Prop src="/design/props/cards.png" className="right-[20%] top-[48%] size-16 rotate-6" delay="1.1s" />
        </div>
        <div className="relative mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 pb-16 pt-8 text-center sm:px-6 sm:pt-12">
          {/* Phones and tablets: the same two cats, small, above the headline. */}
          <div className="flex items-end gap-1 lg:hidden" aria-hidden>
            <Image src="/design/cat2-cheer.png" alt="" width={96} height={96} unoptimized priority className="design-pop h-[76px] w-auto" />
            <Image src="/design/cat2-book.png" alt="" width={96} height={96} unoptimized priority className="cat-bob h-[64px] w-auto" />
          </div>
          <p className="mt-3 rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-accent lg:mt-0">{t("try.toolEyebrow")}</p>
          <h1 className="mt-3 text-[38px] font-extrabold leading-[1.05] tracking-[-0.02em] text-accent sm:text-[56px]">{t(`try.tool.${tool}.title`)}</h1>
          <p className="mt-3 max-w-[560px] text-balance text-[16px] leading-snug text-muted-foreground sm:text-[18px]">{t(`try.tool.${tool}.sub`)}</p>
          <TryBox landing={tool} defaultMode={tool === "pdf-to-quiz" ? "pdf" : "topic"} className="mt-7 max-w-[540px]" />
        </div>
      </section>
      <section className="border-t border-border bg-white">
        <ol className="mx-auto grid w-full max-w-[1120px] gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6">
          {steps.map((key, i) => (
            <li key={key} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-extrabold text-white">{i + 1}</span>
              <span className="text-[15px] font-bold leading-snug">{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
