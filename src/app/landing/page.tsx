import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DotGrid, GlowField } from "@/components/graphics/landing-art";
import {
  ArtStage,
  CtaBand,
  FeatureSplit,
  FunFeatureCard,
} from "@/components/graphics/marketing-art";
import { Sticker } from "@/components/graphics/floating-decor";
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {howItWorks.map((step) => (
              <li key={step.num} className="group">
                <ArtStage
                  src={step.art}
                  tint={step.tint}
                  side={step.side}
                  size="md"
                />
                <span
                  className={`mt-5 flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-[0_3px_0_0_rgba(0,0,0,0.12)] ${
                    step.tint === "sky"
                      ? "bg-sky"
                      : step.tint === "rose"
                        ? "bg-rose"
                        : "bg-accent"
                  }`}
                >
                  {step.num}
                </span>
                <h3 className="mt-3 text-base font-bold">{step.title}</h3>
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
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
