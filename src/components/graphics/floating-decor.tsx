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

/** Flying 3D props scene for the dashboard hero. Parent must be `relative`. */
export function HeroScene() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-80 select-none md:block"
      aria-hidden
    >
      <Image
        src="/illustrations/flag.png"
        alt=""
        width={220}
        height={220}
        priority
        className="absolute right-20 top-1/2 w-36 -translate-y-1/2 lg:w-40"
      />
      <Image
        src="/illustrations/props/book-blue.png"
        alt=""
        width={120}
        height={120}
        className="absolute right-4 top-5 w-14 rotate-12"
      />
      <Image
        src="/illustrations/props/book-pink.png"
        alt=""
        width={120}
        height={120}
        className="absolute bottom-4 right-60 w-12 -rotate-6"
      />
      <Image
        src="/illustrations/props/flag-mini.png"
        alt=""
        width={100}
        height={100}
        className="absolute right-64 top-4 w-11 -rotate-12"
      />
      <Image
        src="/illustrations/props/star-gold.png"
        alt=""
        width={80}
        height={80}
        className="absolute bottom-7 right-8 w-8 rotate-12"
      />
      <Image
        src="/illustrations/props/pencil.png"
        alt=""
        width={100}
        height={100}
        className="absolute bottom-16 right-44 w-10 rotate-45"
      />
      <ConfettiDots />
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
        "pointer-events-none relative hidden h-20 w-40 select-none sm:block",
        className,
      )}
      aria-hidden
    >
      <Image
        src={image}
        alt=""
        width={160}
        height={120}
        className="absolute right-6 top-1/2 h-16 w-auto -translate-y-1/2"
      />
      <ConfettiDots />
    </div>
  );
}
