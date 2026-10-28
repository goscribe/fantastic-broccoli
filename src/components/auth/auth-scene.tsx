import Image from "next/image";
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
        "mx-auto h-20 w-auto select-none object-contain motion-reduce:animate-none sm:h-24",
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
      <Image
        src={MASCOT[mood]}
        alt=""
        width={420}
        height={420}
        unoptimized
        className="pointer-events-none absolute -bottom-8 -right-8 w-36 select-none object-contain motion-reduce:animate-none sm:-bottom-16 sm:-right-10 sm:w-72 lg:w-96"
      />

      <div className="relative z-10 w-full max-w-sm space-y-6 sm:space-y-8">
        {children}
      </div>
    </div>
  );
}
