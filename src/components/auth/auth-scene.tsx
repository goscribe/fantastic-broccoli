import Image from "next/image";
import { ConfettiDots, Sticker } from "@/components/graphics/floating-decor";
import { cn } from "@/lib/utils";

const MASCOT = {
  study: "/illustrations/marketing/mkt-hero.png",
  celebrate: "/illustrations/marketing/mkt-celebrate.png",
  mail: "/illustrations/welcome.png",
  invite: "/illustrations/shared.png",
} as const;

export type AuthMood = keyof typeof MASCOT;

/** Floating 3D figure used as a page hero on email-link screens. */
export function AuthFigure({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={280}
      height={220}
      unoptimized
      className={cn(
        "mx-auto h-20 w-auto select-none object-contain motion-reduce:animate-none animate-bob sm:h-24",
        className,
      )}
    />
  );
}

/** Shared login/signup/email-link chrome: solid page, peeking 3D art. */
export function AuthScene({
  children,
  mood = "study",
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] h-72 w-72 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl motion-reduce:animate-none animate-loader-glow"
      />
      <ConfettiDots className="opacity-70" />

      <Sticker
        src="/illustrations/props/star-gold.png"
        className="left-[8%] top-[max(1.25rem,env(safe-area-inset-top))] w-9 rotate-12 sm:left-[12%] sm:top-16 sm:w-12"
        delay="-0.4s"
      />
      <Sticker
        src="/illustrations/props/book-pink.png"
        className="right-[8%] top-[max(1.5rem,env(safe-area-inset-top))] hidden w-10 rotate-[-12deg] sm:block sm:right-[14%] sm:top-20 sm:w-14"
        delay="-1.1s"
      />
      <Sticker
        src="/illustrations/props/pencil.png"
        className="bottom-[16%] left-[6%] w-10 rotate-[-22deg] sm:bottom-[18%] sm:left-[10%] sm:w-14"
        delay="-1.6s"
      />
      <Sticker
        src="/illustrations/props/trophy.png"
        className="bottom-[28%] right-[6%] hidden w-12 sm:block lg:right-[12%] lg:w-16"
        delay="-0.8s"
      />
      <Sticker
        src="/illustrations/props/flag-mini.png"
        className="left-[6%] top-[38%] hidden w-10 rotate-[-8deg] md:block"
        delay="-2s"
      />
      <Sticker
        src="/illustrations/props/book-blue.png"
        className="bottom-[12%] left-[22%] hidden w-12 rotate-6 lg:block"
        delay="-0.2s"
      />

      <Image
        src={MASCOT[mood]}
        alt=""
        width={420}
        height={420}
        unoptimized
        className="pointer-events-none absolute -bottom-8 -right-8 w-36 select-none object-contain motion-reduce:animate-none animate-bob sm:-bottom-16 sm:-right-10 sm:w-72 lg:w-96"
      />

      <div className="relative z-10 w-full max-w-sm space-y-6 sm:space-y-8">
        {children}
      </div>
    </div>
  );
}
