"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { COVER_TINT, coverArtSrc, coverKeyForTitle } from "@/lib/subject-cover";

/**
 * Cover band for a subject: soft two-tone tint (by subject family) with the
 * generated illustration on the right; the tint alone until the cover exists.
 */
export function SubjectCover({ title, coverUrl, className, children }: { title: string; coverUrl?: string; className?: string; children?: React.ReactNode }) {
  const key = coverKeyForTitle(title);
  const [from, to] = COVER_TINT[key];
  const [broken, setBroken] = useState(false);
  const src = coverUrl ?? coverArtSrc(key);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
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
