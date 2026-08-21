"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { ProductCard } from "@/components/graphics/marketing-art";
import {
  AudioArt,
  PdfArt,
  SlidesArt,
} from "@/components/graphics/material-art";
import { rpc } from "@/lib/api/study-session";
import { sessionPreview } from "./data";

interface PublicStats {
  artifacts: number;
  activities: number;
  countries: number;
}

const FALLBACK_STATS: PublicStats = {
  artifacts: 1717,
  activities: 796,
  countries: 27,
};

const roundedDown = (n: number, step: number) => Math.floor(n / step) * step;

export function HeroPreview() {
  const [doneCount, setDoneCount] = useState(2);

  useEffect(() => {
    const id = window.setInterval(
      () => setDoneCount((c) => (c >= sessionPreview.length ? 0 : c + 1)),
      2200,
    );
    return () => window.clearInterval(id);
  }, []);

  const progress = Math.round((doneCount / sessionPreview.length) * 100);

  return (
    <div className="relative">
      <ProductCard eyebrow="Biochemistry · Week 4">
        <div className="bg-background p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-accent">
                Today’s session
              </p>
              <p className="mt-0.5 text-sm font-bold">Biochemistry · Week 4</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center -space-x-1.5">
                  <PdfArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                  <SlidesArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                  <AudioArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                </span>
                3 sources parsed &amp; ready
              </p>
            </div>
            <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
              {progress}% done
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {sessionPreview.map((item, i) => {
              const done = i < doneCount;
              const active = i === doneCount;
              return (
                <li
                  key={item.label}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-500 ${
                    active
                      ? "border-accent/40 bg-card"
                      : "border-border bg-card"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      done ? "bg-accent-soft" : "bg-muted/60"
                    }`}
                  >
                    {done ? (
                      <Check className="h-4 w-4 text-accent" />
                    ) : (
                      <Image
                        src={item.art}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="h-6 w-6 object-contain"
                      />
                    )}
                  </span>
                  <span
                    className={`flex-1 truncate text-[13px] font-medium transition-colors duration-500 ${
                      done ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {item.meta}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </ProductCard>
    </div>
  );
}

export function StatsStrip() {
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS);

  useEffect(() => {
    rpc<PublicStats>("stats.public", "query", undefined)
      .then((s) => {
        if (s) setStats(s);
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);

  return (
    <dl className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
      {[
        {
          value: `${roundedDown(stats.artifacts, 100).toLocaleString()}+`,
          label: "practice artifacts generated",
          icon: "/illustrations/icons/stat-bolt.png",
        },
        {
          value: `${roundedDown(stats.activities, 10).toLocaleString()}+`,
          label: "study activities built",
          icon: "/illustrations/icons/act-flashcards.png",
        },
        {
          value: `${stats.countries}`,
          label: "countries studying with Scribe",
          icon: "/illustrations/flag.png",
        },
      ].map((stat) => (
        <div key={stat.label} className="flex flex-col items-center">
          <dt className="sr-only">{stat.label}</dt>
          <Image
            src={stat.icon}
            alt=""
            width={80}
            height={80}
            unoptimized
            className="mb-2 h-14 w-14 object-contain"
          />
          <dd className="text-4xl font-extrabold tracking-tight tabular-nums">
            {stat.value}
          </dd>
          <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </dl>
  );
}
