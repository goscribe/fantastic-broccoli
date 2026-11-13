"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { COVER_TINT, coverArtSrc, coverKeyForTitle } from "@/lib/subject-cover";

/**
 * Cover band for a subject: soft two-tone tint with the family's flat
 * illustration sitting on the right. Falls back to the tint alone while the
 * art is missing or still loading.
 */
export function SubjectCover({ title, className, children }: { title: string; className?: string; children?: React.ReactNode }) {
  const key = coverKeyForTitle(title);
  const [from, to] = COVER_TINT[key];
  const [broken, setBroken] = useState(false);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {!broken && (
        <Image
          src={coverArtSrc(key)}
          alt=""
          width={160}
          height={160}
          unoptimized
          onError={() => setBroken(true)}
          className="pointer-events-none absolute -bottom-3 -right-2 h-[118%] w-auto select-none opacity-95 drop-shadow-[0_6px_10px_rgba(80,50,160,0.18)]"
        />
      )}
      {children}
    </div>
  );
}
