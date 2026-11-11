"use client";

import Image from "next/image";
import "@/app/design/design.css";

/** Boot splash while auth resolves: the cheering cat bouncing over a progress bar. Same under both UIs. */
export function FullScreenLoader() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
      <Image
        src="/design/cat2-cheer.png"
        alt=""
        width={140}
        height={140}
        priority
        unoptimized
        className="h-[120px] w-auto animate-[cat-dance_.9s_ease-in-out_infinite] select-none"
      />
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[loader-slide_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <span className="sr-only">Loading…</span>
      <style>{`@keyframes loader-slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}@keyframes cat-dance{0%,100%{transform:translateY(0) rotate(-6deg)}25%{transform:translateY(-14px) rotate(0deg)}50%{transform:translateY(0) rotate(6deg)}75%{transform:translateY(-14px) rotate(0deg)}}`}</style>
    </div>
  );
}
