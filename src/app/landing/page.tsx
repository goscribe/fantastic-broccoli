import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { DotGrid, GlowField } from "@/components/graphics/landing-art";
import {
  ArtStage,
  CtaBand,
  FeatureSplit,
} from "@/components/graphics/marketing-art";
import { Button } from "@/components/ui/button";
import { HeroPreview, StatsStrip } from "./hero-preview";
import { features, homeScenes, howItWorks, subjects, testimonials } from "./data";

export const metadata: Metadata = {
  title: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material.",
  alternates: { canonical: "/landing" },
};

export default function LandingPage() {
  const [featured, ...restQuotes] = testimonials;

  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6">
          <DotGrid className="inset-y-0 right-0 hidden w-1/2 lg:block" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="animate-fade-up">
              <h1 className="text-4xl tracking-tight text-balance sm:text-5xl md:text-6xl">
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
                <Link href="/landing/features">
                  <Button size="lg" variant="outline">
                    See what’s inside
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-faint">
                Free to start · No credit card required
              </p>
            </div>
            <ArtStage
              src="/illustrations/marketing/mkt-hero.png"
              tint="accent"
              side="right"
              size="lg"
              className="animate-fade-up p-5 sm:p-6"
            >
              <HeroPreview />
            </ArtStage>
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
                  key={subject}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground"
                >
                  {subject}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {howItWorks.map((step) => (
              <li key={step.num}>
                <ArtStage
                  src={step.art}
                  tint={step.tint}
                  side={step.side}
                  size="sm"
                />
                <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {step.num}
                </span>
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl tracking-tight sm:text-3xl">
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
              <li
                key={feature.title}
                className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50">
                  <Image
                    src={feature.icon}
                    alt=""
                    width={32}
                    height={32}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {homeScenes.map((scene, i) => (
        <section
          key={scene.title}
          className={`py-16 md:py-24 ${i % 2 === 0 ? "border-y border-border bg-card/40" : ""}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <FeatureSplit scene={scene} />
          </div>
        </section>
      ))}

      <section className="border-y border-border py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl tracking-tight sm:text-3xl">
            What studying with Scribe feels like
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <ArtStage
              src="/illustrations/marketing/mkt-worksheet.png"
              tint="sky"
              side="right"
              size="md"
              className="p-6 sm:p-8"
            >
              <blockquote className="relative z-10 max-w-md">
                <p className="text-base leading-relaxed text-pretty sm:text-lg">
                  “{featured.quote}”
                </p>
                <footer className="mt-5">
                  <p className="text-sm font-semibold">{featured.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {featured.role}
                  </p>
                </footer>
              </blockquote>
            </ArtStage>
            <ul className="grid gap-5">
              {restQuotes.map((t) => (
                <li
                  key={t.name}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-sm leading-relaxed text-pretty">
                    “{t.quote}”
                  </p>
                  <p className="mt-3 text-sm font-semibold">{t.name}</p>
                  <p className="text-[12px] text-muted-foreground">{t.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
