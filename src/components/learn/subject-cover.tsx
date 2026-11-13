"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { coverArtSrc, coverKeyForTitle } from "@/lib/subject-cover";

/**
 * Cover surface for a subject card: white card with the generated illustration
 * on the right (family fallback art until the cover exists).
 */
export function SubjectCover({ title, coverUrl, className, children }: { title: string; coverUrl?: string; className?: string; children?: React.ReactNode }) {
  const key = coverKeyForTitle(title);
  const [broken, setBroken] = useState(false);
  const src = coverUrl ?? coverArtSrc(key);
  return (
    <div
      className={cn("relative overflow-hidden bg-card", className)}
    >
      {!broken && (
        <Image
          key={src}
          src={src}
          alt=""
          width={480}
          height={320}
          unoptimized
          onError={() => setBroken(true)}
          className="pointer-events-none absolute -right-2 bottom-0 h-[92%] w-auto select-none"
        />
      )}
      {children}
    </div>
  );
}
