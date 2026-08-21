import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import { GlowField } from "@/components/graphics/landing-art";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import {
  CtaBand,
  FeatureSplit,
  GlossyArt,
} from "@/components/graphics/marketing-art";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { Button } from "@/components/ui/button";
import { HeroPreview, StatsStrip } from "./hero-preview";
import { homeScenes, howItWorks, subjects, testimonials } from "./data";

export const metadata: Metadata = {
  title: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material.",
  alternates: { canonical: "/landing" },
};

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20">
        <GlowField />
        <ConfettiDots className="hidden md:block" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="animate-fade-up">
              <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                PDFs → flashcards, quizzes &amp; study guides
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
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
              <div className="mt-5">
                <a
                  href="https://www.producthunt.com/products/scribe-19?embed=true&amp;utm_source=badge-featured&amp;utm_medium=badge&amp;utm_campaign=badge-scribe-1273"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1191678&amp;theme=light&amp;t=1785953007734"
                    alt="Scribe - Upload anything. Get personalized study sessions in seconds. | Product Hunt"
                    width={250}
                    height={54}
                  />
                </a>
              </div>
            </div>
            <div className="hidden animate-fade-up lg:block">
              <HeroPreview />
            </div>
          </div>

          <div className="mt-16 overflow-hidden rounded-3xl border border-border bg-card/60 px-4 py-6 sm:hidden">
            <GlossyArt
              src="/illustrations/marketing/mkt-hero.png"
              priority
              width={880}
              height={594}
            />
          </div>

          <div className="relative mt-16 border-t border-border pt-10">
            <StatsStrip />
          </div>

          <div className="relative mt-12 border-t border-border pt-10">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-faint">
              Built for every subject you study
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {subjects.map((subject) => (
                <li
                  key={subject.label}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground"
                >
                  <WorkspaceIcon icon={subject.icon} className="h-5 w-5" />
                  {subject.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Upload anything. Study the fun way.
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {howItWorks.map((step) => (
              <li key={step.num}>
                <div className="mb-5 flex h-44 items-end justify-center overflow-hidden rounded-2xl border border-border bg-background">
                  <Image
                    src={step.art}
                    alt=""
                    width={280}
                    height={220}
                    className="h-40 w-auto object-contain drop-shadow-[0_12px_24px_rgba(105,82,224,0.2)]"
                  />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-accent">
                  {step.num}
                </span>
                <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {homeScenes.map((scene, i) => (
        <section
          key={scene.title}
          className={`py-16 md:py-24 ${i % 2 === 1 ? "border-y border-border bg-card/40" : ""}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <FeatureSplit scene={scene} />
          </div>
        </section>
      ))}

      <section className="border-y border-border py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                From students
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                What studying with Scribe feels like
              </h2>
            </div>
            <GlossyArt
              src="/illustrations/marketing/mkt-quiz.png"
              className="hidden w-28 sm:block"
              width={808}
              height={828}
            />
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {testimonials.map((t) => (
              <li
                key={t.name}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <p className="text-sm leading-relaxed text-pretty">
                  “{t.quote}”
                </p>
                <p className="mt-4 text-sm font-semibold">{t.name}</p>
                <p className="text-[12px] text-muted-foreground">{t.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
