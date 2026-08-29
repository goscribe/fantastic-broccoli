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

/**
 * Composed empty-state scene: big art bleeding off the right edge, floating
 * props, confetti, and left-aligned content.
 */
export function EmptyScene({
  image,
  imageClassName,
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
        "relative overflow-hidden rounded-3xl border border-border bg-card",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-80 select-none sm:block"
        aria-hidden
      >
        <Image
          src={image}
          alt=""
          width={280}
          height={240}
          unoptimized
          className={cn(
            "absolute -bottom-6 right-4 w-56",
            imageClassName,
          )}
        />
      </div>
      <ConfettiDots className="hidden sm:block" />
      <div className="relative max-w-md px-6 py-10 sm:px-8 sm:py-12">
        {children}
      </div>
      <Image
        src={image}
        alt=""
        width={200}
        height={160}
        unoptimized
        className="pointer-events-none mx-auto -mt-4 mb-6 h-28 w-auto select-none sm:hidden"
      />
    </div>
  );
}

/** Compact decorated header art for list pages. */
export function HeaderDecor({
  image,
  className,
}: {
  image: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none relative hidden h-24 w-44 select-none sm:block",
        className,
      )}
      aria-hidden
    >
      <Image
        src={image}
        alt=""
        width={160}
        height={120}
        unoptimized
        className="absolute right-4 top-1/2 h-20 w-auto -translate-y-1/2"
      />
      <ConfettiDots />
    </div>
  );
}
