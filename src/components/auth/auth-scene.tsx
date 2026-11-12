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

/** Shared login/signup/email-link chrome: illustrated panel on the left, the form on the right. */
export function AuthScene({
  children,
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:m-4 lg:flex lg:flex-col lg:justify-between lg:rounded-[28px] lg:bg-[linear-gradient(160deg,#eeebfc_0%,#dfe8ff_55%,#f7e9ff_100%)] lg:p-10">
        <div className="text-[13px] font-semibold text-accent">Scribe</div>
        <div>
          <h2 className="max-w-[420px] text-[34px] font-bold leading-[1.1] tracking-tight text-foreground">
            Turn your notes into a study plan that actually sticks.
          </h2>
          <p className="mt-3 max-w-[400px] text-[15px] text-muted-foreground">
            Upload a PDF, slides or a lecture link — Scribe writes the practice, schedules the reviews and keeps score.
          </p>
          <div className="mt-8 rounded-2xl border border-white/70 bg-white/80 p-4 text-[14px] leading-snug text-foreground shadow-[0_10px_30px_-18px_rgba(105,82,224,0.5)] backdrop-blur">
            “I stopped rereading my notes and started answering questions. My recall on paper 1 went way up.”
            <div className="mt-2 text-[12.5px] font-semibold text-muted-foreground">IB Chemistry student</div>
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex items-end gap-2">
            {["book", "pencil", "trophy"].map((c) => (
              <Image key={c} src={`/design/cat2-${c}.png`} alt="" width={120} height={110} unoptimized className="h-[88px] w-auto select-none" />
            ))}
          </div>
          <div className="text-right text-[12.5px] font-semibold text-muted-foreground">
            Spaced review · worksheets · flashcards
            <br />
            built from your own material
          </div>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] lg:min-h-0">
        <div className="w-full max-w-[380px] space-y-6">{children}</div>
      </div>
    </div>
  );
}
