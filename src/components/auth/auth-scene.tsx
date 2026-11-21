import Image from "next/image";
import { cn } from "@/lib/utils";
import "@/app/design/design.css";

export type AuthMood = "study" | "celebrate" | "mail" | "invite";

/** Cat mascot shown above the heading on email-link screens. */
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
      width={260}
      height={260}
      unoptimized
      className={cn(
        "mx-auto h-24 w-auto select-none object-contain sm:h-28",
        className,
      )}
    />
  );
}

/** Shared login/signup/email-link chrome: the home banner's landscape on the left, the form on the right. */
export function AuthScene({
  children,
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* The same scene as the home banner, lit for the visitor's time of day: words on the card colour at the top, the cat on the hill below. */}
      <aside className="auth-scene hero-card relative isolate hidden overflow-hidden border border-border lg:m-4 lg:flex lg:flex-col lg:rounded-[28px] lg:p-10">
        <div aria-hidden className="hero-field pointer-events-none absolute inset-0 -z-10">
          <div className="absolute bottom-[7%] right-[14%] h-[clamp(150px,27vh,230px)]">
            <span className="hero-field__ground" />
            <Image src="/design/cat3-wave.webp" alt="" width={352} height={400} unoptimized priority className="cat-peek h-full w-auto select-none object-contain" />
          </div>
        </div>
        <div className="hero-eyebrow text-[13.5px] font-extrabold">Scribe</div>
        <h2 className="mt-6 max-w-[440px] text-[32px] font-extrabold leading-[1.06] tracking-[-0.02em] xl:text-[40px]">
          Study from your notes.
          <br />
          Actually remember it.
        </h2>
        <p className="mt-4 max-w-[400px] text-[16px] leading-relaxed text-foreground/75">
          Make a subject, drop in a PDF, slides or a photo of your notes. Scribe builds study sessions from them and fits them into your week.
        </p>
      </aside>
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] lg:min-h-0">
        <div className="w-full max-w-[380px] space-y-6">{children}</div>
      </div>
    </div>
  );
}
