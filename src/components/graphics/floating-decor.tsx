import Image from "next/image";
import { cn } from "@/lib/utils";

const CONFETTI = [
  { top: "10%", left: "6%", color: "#ec4899", rotate: 18, w: 10, h: 4 },
  { top: "22%", left: "88%", color: "#f59e0b", rotate: -24, w: 9, h: 4 },
  { top: "38%", left: "2%", color: "#0ea5e9", rotate: 40, w: 8, h: 8 },
  { top: "55%", left: "94%", color: "#10b981", rotate: 12, w: 10, h: 4 },
  { top: "72%", left: "10%", color: "#6952e0", rotate: -30, w: 8, h: 8 },
  { top: "84%", left: "80%", color: "#ec4899", rotate: 55, w: 9, h: 4 },
  { top: "16%", left: "45%", color: "#10b981", rotate: -12, w: 8, h: 4 },
  { top: "78%", left: "42%", color: "#f59e0b", rotate: 30, w: 7, h: 7 },
];

/** Small scattered confetti pieces. Parent must be `relative`. */
export function ConfettiDots({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: c.top,
            left: c.left,
            width: c.w,
            height: c.h,
            backgroundColor: c.color,
            transform: `rotate(${c.rotate}deg)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

/** Floating 3D prop sticker. */
export function Sticker({
  src,
  className,
  delay,
}: {
  src: string;
  className?: string;
  delay?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={160}
      height={160}
      unoptimized
      className={cn(
        "pointer-events-none absolute select-none object-contain drop-shadow-md",
        className,
      )}
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}

/** Flying 3D props scene for the dashboard hero. Parent must be `relative`. */
export function HeroScene() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[22rem] select-none md:block"
      aria-hidden
    >
      <Image
        src="/illustrations/hero-scene.png"
        alt=""
        width={720}
        height={423}
        priority
        unoptimized
        className="absolute -bottom-4 right-0 w-80 lg:w-96"
      />
      <Sticker
        src="/illustrations/props/star-gold.png"
        className="right-8 top-4 w-10 rotate-12"
      />
      <ConfettiDots />
    </div>
  );
}

const CAT_FOR_SCENE: Record<string, string> = {
  cards: "/design/cat2-book.png",
  shared: "/design/cat2-wave.png",
  guide: "/design/cat2-pencil.png",
  recall: "/design/cat2-think.png",
  study: "/design/cat2-pencil.png",
  bank: "/design/cat2-book.png",
  marketplace: "/design/cat2-wave.png",
};

function catFor(image: string): string {
  const name = image.split("/").pop()?.replace(/\.png$/, "") ?? "";
  return CAT_FOR_SCENE[name] ?? "/design/cat2-think.png";
}

/** Empty state on the design system: soft lavender card, one cat pose, left-aligned copy. */
export function EmptyScene({
  image,
  children,
  className,
}: {
  image: string;
  imageClassName?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse items-start gap-4 rounded-2xl border border-border bg-accent-soft/40 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8",
        className,
      )}
    >
      <div className="max-w-md">{children}</div>
      <Image
        src={catFor(image)}
        alt=""
        width={120}
        height={120}
        unoptimized
        className="cat-bob pointer-events-none h-24 w-auto shrink-0 select-none sm:h-28"
      />
    </div>
  );
}

/** Retired: list-page header art is gone in the unified design. */
export function HeaderDecor(props: { image: string; className?: string }) {
  void props;
  return null;
}
