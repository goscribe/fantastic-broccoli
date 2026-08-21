import Image from "next/image";

/** Shared login/signup/email-link chrome: solid page, peeking 3D art. */
export function AuthScene({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Image
        src="/illustrations/marketing/mkt-hero.png"
        alt=""
        width={420}
        height={420}
        unoptimized
        className="pointer-events-none absolute -bottom-8 -right-8 w-36 select-none animate-bob sm:-bottom-16 sm:-right-10 sm:w-72 lg:w-96"
      />
      <Image
        src="/illustrations/props/star-gold.png"
        alt=""
        width={80}
        height={80}
        unoptimized
        className="pointer-events-none absolute left-[10%] top-[max(1.25rem,env(safe-area-inset-top))] w-9 rotate-12 select-none animate-wiggle sm:left-[12%] sm:top-16 sm:w-12"
      />
      <div className="relative w-full max-w-sm space-y-6 sm:space-y-8">
        {children}
      </div>
    </div>
  );
}
