import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DotGrid, GlowField } from "@/components/graphics/landing-art";
import {
  ArtStage,
  CtaBand,
  FunFeatureCard,
} from "@/components/graphics/marketing-art";
import { Sticker } from "@/components/graphics/floating-decor";
import { Button } from "@/components/ui/button";
import { HeroPreview, StatsStrip } from "./hero-preview";
import { features, subjects } from "./data";

export const metadata: Metadata = {
  title: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material.",
  alternates: { canonical: "/landing" },
};

const pages = [
  {
    href: "/landing/features",
    title: "Features",
    body: "Readings, worksheets, flashcards, and a copilot — one session, not five tabs.",
  },
  {
    href: "/landing/how-it-works",
    title: "How it works",
    body: "Upload your materials. Scribe builds the path. You study, then ask.",
  },
  {
    href: "/landing/pricing",
    title: "Pricing",
    body: "Free to start. Upgrade when you need more sessions — no credit card to try.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6">
          <DotGrid className="inset-y-0 right-0 hidden w-1/2 lg:block" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="animate-fade-up">
              <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Stop re-reading.
                <br />
                <span className="text-accent">Start learning.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
                Upload your notes, slides, or PDFs. Scribe turns them into one
                guided study session — flashcards, quizzes, worksheets, and
                readings, built from your own course material.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/signup">
                  <Button size="lg" className="gap-2">
                    Start studying
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/landing/how-it-works">
                  <Button size="lg" variant="outline">
                    See how it works
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-faint">
                Free to start · No credit card required
              </p>
            </div>
            <div className="relative animate-fade-up">
              <Sticker
                src="/illustrations/props/star-gold.png"
                className="-top-6 right-8 z-20 hidden w-12 rotate-12 sm:block"
              />
              <Sticker
                src="/illustrations/props/pencil.png"
                className="-bottom-4 -left-6 z-20 hidden w-14 -rotate-12 lg:block"
                delay="0.7s"
              />
              <ArtStage
                src="/illustrations/marketing/mkt-hero.png"
                tint="accent"
                side="right"
                size="xl"
                className="p-5 sm:p-6"
              >
                <HeroPreview />
              </ArtStage>
            </div>
          </div>

          <div className="relative mt-16 border-t border-border pt-10">
            <StatsStrip />
          </div>

          <div className="relative mt-12 border-t border-border pt-10">
            <p className="text-center text-sm text-muted-foreground">
              Built for every subject you study
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {subjects.map((subject) => (
                <li
                  key={subject.name}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${subject.tint}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={subject.icon}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                  {subject.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Explore Scribe
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Features, the three-step flow, and pricing each have their own
            page — start wherever you want, then jump in with your notes.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            {pages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
                >
                  <h3 className="text-base font-semibold group-hover:text-accent">
                    {page.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {page.body}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    Open page
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                One study session, everything in it
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Flashcards, quizzes, worksheets, and readings aren’t separate
                tools — Scribe builds them together into one guided session.
              </p>
            </div>
            <Link
              href="/landing/features"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              Explore all features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.slice(0, 3).map((feature) => (
              <FunFeatureCard key={feature.title} {...feature} />
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
