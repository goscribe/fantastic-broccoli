import Image from "next/image";
import { cn } from "@/lib/utils";

export type AuthMood = "study" | "celebrate" | "mail" | "invite";

/** Flat figure used as a page hero on email-link screens. */
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

/** Shared login/signup/email-link chrome: white page, one bordered card. */
export function AuthScene({
  children,
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
