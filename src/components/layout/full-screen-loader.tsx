"use client";

import Image from "next/image";

/**
 * Boot splash while auth resolves. Deliberately plain (logo + bar) so it
 * looks right under both the old and the new UI and never flashes
 * old-theme artwork.
 */
export function FullScreenLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6"
    >
      <Image src="/logo.png" alt="" width={48} height={48} priority className="size-12 animate-pulse" />
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-[loader-slide_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <span className="sr-only">Loading…</span>
      <style>{`@keyframes loader-slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}
