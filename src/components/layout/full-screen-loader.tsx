"use client";

import Image from "next/image";
import {
  ConfettiDots,
  Sticker,
} from "@/components/graphics/floating-decor";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

/**
 * Boot splash while auth resolves. Keep this light — it sits in front of
 * every signed-in page — and keep the first paint deterministic so it
 * does not trip a hydration mismatch.
 */
export function FullScreenLoader() {
  const { t } = useI18n();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#f3f1fe] px-6"
    >
      <ConfettiDots className="opacity-60" />
      <Sticker
        src="/illustrations/props/star-gold.png"
        className="right-[11%] top-[16%] hidden w-10 sm:block"
        delay="-0.4s"
      />
      <Sticker
        src="/illustrations/props/pencil.png"
        className="bottom-[18%] left-[10%] hidden w-12 rotate-[-18deg] sm:block"
        delay="-1.2s"
      />
      <Sticker
        src="/illustrations/props/book-blue.png"
        className="right-[14%] bottom-[20%] hidden w-11 sm:block"
        delay="-0.8s"
      />

      <div className="relative z-10 flex flex-col items-center">
        <Image
          src="/illustrations/blobs-playing.png"
          alt=""
          width={785}
          height={503}
          priority
          unoptimized
          aria-hidden
          className="h-40 w-auto select-none animate-bob motion-reduce:animate-none sm:h-48"
        />

        <div className="mt-6 flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-accent motion-reduce:animate-none animate-loader-dot"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t("misc.gettingReady")}
        </p>
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    </div>
  );
}
