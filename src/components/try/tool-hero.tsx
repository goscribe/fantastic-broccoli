"use client";

import { TryCat } from "./try-cat";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/try";
import type { TryTool } from "@/lib/try";
import { TryBox } from "./try-box";

/**
 * Ad / SEO landing page body: the cat, the keyword as the headline and the
 * try box right under it on a plain white page (the box is the page's one
 * main thing, so it has no panel), then the three steps as cards.
 */
export function ToolHero({ tool }: { tool: TryTool }) {
  const { t } = useI18n();
  const steps = ["try.step1", "try.step2", "try.step3"] as const;
  return (
    <div className="app-brand bg-white text-foreground">
      <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-4 pb-14 pt-8 text-center sm:px-6 sm:pb-20 sm:pt-14">
        <TryCat pose="wave" priority className="cat-peek h-[104px] sm:h-[128px]" />
        <p className="mt-4 text-[13.5px] font-extrabold text-muted-foreground">{t("try.toolEyebrow")}</p>
        <h1 className="mt-1.5 text-balance text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[52px]">{t(`try.tool.${tool}.title`)}</h1>
        <p className="mt-3 max-w-[560px] text-balance text-[16px] font-semibold leading-snug text-muted-foreground sm:text-[18px]">{t(`try.tool.${tool}.sub`)}</p>
        <TryBox landing={tool} defaultMode={tool === "pdf-to-quiz" ? "pdf" : "topic"} className="mt-8 max-w-[520px]" />
      </section>
      <section className="border-t border-border">
        <ol className="mx-auto grid w-full max-w-[1120px] gap-3 px-4 py-12 sm:grid-cols-3 sm:gap-4 sm:px-6">
          {steps.map((key, i) => (
            <li key={key} className="flex items-center gap-3.5 rounded-[var(--r-card)] border border-border bg-card p-5 shadow-[var(--card-shadow)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-[14px] font-extrabold tabular-nums text-foreground">{i + 1}</span>
              <span className="text-[15.5px] font-bold leading-snug">{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
