"use client";

import Image from "next/image";
import "@/app/design/design.css";

const FRAMES = ["/design/cat2-cheer.png", "/design/cat2-wave.png", "/design/cat2-flame.png", "/design/cat2-wave.png"];

/** Boot splash while auth resolves: the cat dances (pose frames swap on the beat while it hops and sways) over a progress bar. */
export function FullScreenLoader() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6">
      <div className="relative h-[150px] w-[150px]">
        <div className="absolute inset-x-0 top-0 h-[130px] animate-[cat-hop_1.2s_ease-in-out_infinite]" style={{ transformOrigin: "50% 100%" }}>
          {FRAMES.map((src, i) => (
            <Image
              key={i}
              src={src}
              alt=""
              width={150}
              height={130}
              priority
              unoptimized
              className="absolute inset-0 h-[130px] w-full select-none object-contain opacity-0"
              style={{ animation: `cat-frame 1.2s steps(1) infinite`, animationDelay: `${(i * 1.2) / FRAMES.length}s` }}
            />
          ))}
        </div>
        <span aria-hidden className="absolute left-1/2 top-[132px] h-2.5 w-16 -translate-x-1/2 animate-[cat-shadow_1.2s_ease-in-out_infinite] rounded-full bg-foreground/10" />
        <span aria-hidden className="absolute -left-2 top-6 text-[18px] text-accent animate-[cat-spark_1.2s_ease-in-out_infinite]">✦</span>
        <span aria-hidden className="absolute -right-1 top-2 text-[14px] text-accent animate-[cat-spark_1.2s_ease-in-out_.6s_infinite]">✦</span>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[loader-slide_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <span className="sr-only">Loading…</span>
      <style>{`
@keyframes loader-slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
@keyframes cat-frame{0%,24.9%{opacity:1}25%,100%{opacity:0}}
@keyframes cat-hop{0%{transform:translateY(0) rotate(-7deg) scaleX(1)}12%{transform:translateY(-18px) rotate(-2deg) scaleX(1)}25%{transform:translateY(0) rotate(0deg) scaleX(1) scaleY(.94)}37%{transform:translateY(-18px) rotate(5deg) scaleX(-1)}50%{transform:translateY(0) rotate(7deg) scaleX(-1) scaleY(.94)}62%{transform:translateY(-18px) rotate(2deg) scaleX(-1)}75%{transform:translateY(0) rotate(0deg) scaleX(-1) scaleY(.94)}87%{transform:translateY(-18px) rotate(-5deg) scaleX(1)}100%{transform:translateY(0) rotate(-7deg) scaleX(1)}}
@keyframes cat-shadow{0%,25%,50%,75%,100%{transform:translateX(-50%) scaleX(1);opacity:.9}12%,37%,62%,87%{transform:translateX(-50%) scaleX(.6);opacity:.4}}
@keyframes cat-spark{0%,100%{opacity:0;transform:translateY(4px) scale(.6)}50%{opacity:1;transform:translateY(-6px) scale(1)}}
`}</style>
    </div>
  );
}
