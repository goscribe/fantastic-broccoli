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

const PROPS = [
  ["star", "size-12"],
  ["pencil", "size-14 -rotate-12"],
  ["trophy", "size-12"],
] as const;

/** Shared login/signup/email-link chrome: the landing's violet scene on the left, the form on the right. */
export function AuthScene({
  children,
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      <aside className="hidden overflow-hidden lg:m-4 lg:flex lg:flex-col lg:rounded-[28px] lg:bg-[#7c3aed] lg:p-10 lg:pb-6 lg:text-white">
        <div className="text-[13px] font-bold text-white/80">Scribe</div>
        <h2 className="mt-8 max-w-[440px] text-[32px] font-extrabold xl:text-[40px] leading-[1.04] tracking-[-0.02em]">
          study from your notes.
          <br />
          actually remember it.
        </h2>
        <p className="mt-4 max-w-[400px] text-[16px] text-white/80">
          Make a subject, drop in a PDF, slides or a photo of your notes. Scribe builds study sessions from them and fits them into your week.
        </p>
        <div className="mt-auto flex items-center justify-around px-8 pt-8">
          {PROPS.map(([name, size], i) => (
            <Image
              key={name}
              src={`/design/props/${name}.png`}
              alt=""
              width={96}
              height={96}
              unoptimized
              className={cn("cat-float select-none object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,.18)]", size)}
              style={{ animationDelay: `${i * 0.5}s` }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <Image
            src="/design/cat2-cheer.png"
            alt=""
            width={244}
            height={288}
            unoptimized
            className="h-[clamp(150px,30vh,250px)] w-auto select-none object-contain"
          />
          <Image
            src="/design/cat2-book.png"
            alt=""
            width={240}
            height={260}
            unoptimized
            className="cat-bob h-[clamp(120px,23vh,190px)] w-auto select-none object-contain"
          />
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] lg:min-h-0">
        <div className="w-full max-w-[380px] space-y-6">{children}</div>
      </div>
    </div>
  );
}
