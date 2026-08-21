"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DotGrid,
  GlowField,
  StepCopilotArt,
  StepPlanArt,
  StepUploadArt,
} from "@/components/graphics/landing-art";
import {
  AudioArt,
  PdfArt,
  SlidesArt,
} from "@/components/graphics/material-art";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { Button } from "@/components/ui/button";
import { rpc } from "@/lib/api/study-session";
import { features, sessionPreview, subjects } from "./data";
import { ArrowRight, Check, Sparkles } from "lucide-react";

const steps = [
  {
    num: "1",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or audio recordings. Scribe parses everything — text, figures, and diagrams included.",
    art: StepUploadArt,
  },
  {
    num: "2",
    title: "Scribe builds your session",
    description:
      "Your materials become flashcards, quizzes, worksheets, and readings — organised into one guided study session.",
    art: StepPlanArt,
  },
  {
    num: "3",
    title: "Study and adapt",
    description:
      "Work through the session with a copilot that answers from your own materials and adjusts the plan as you go.",
    art: StepCopilotArt,
  },
];

interface PublicStats {
  artifacts: number;
  activities: number;
  countries: number;
}

/** Snapshot fallback shown until (or if) the live counts load. */
const FALLBACK_STATS: PublicStats = {
  artifacts: 1717,
  activities: 796,
  countries: 27,
};

const roundedDown = (n: number, step: number) =>
  Math.floor(n / step) * step;

export default function LandingPage() {
  const [doneCount, setDoneCount] = useState(2);
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

  useEffect(() => {
    const id = window.setInterval(
      () => setDoneCount((c) => (c >= sessionPreview.length ? 0 : c + 1)),
      2200,
    );
    return () => window.clearInterval(id);
  }, []);

  const progress = Math.round((doneCount / sessionPreview.length) * 100);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-16 md:pt-24">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6">
          <DotGrid className="inset-y-0 right-0 hidden w-1/2 lg:block" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="animate-fade-up">
              <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                PDFs &rarr; flashcards, quizzes &amp; study guides
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Stop re-reading.
                <br />
                <span className="text-accent">Start learning.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
                Upload your notes, slides, or PDFs. Scribe turns them into
                flashcards, quizzes, worksheets, and readings — one complete
                study session built from your own course material.
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
                    See what&apos;s inside
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-faint">
                Free to start · No credit card required
              </p>
              <div className="mt-5 flex justify-center lg:justify-start">
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

            {/* Session preview card */}
            <div className="relative hidden animate-fade-up lg:block">
              {/* Floating flashcard */}
              <div className="animate-float absolute -bottom-16 -left-24 z-10 hidden w-44 rounded-xl border border-border bg-card p-3 shadow-sm xl:block">
                <p className="text-[10px] font-semibold text-faint">
                  FLASHCARD 7/18
                </p>
                <p className="mt-1 text-[13px] font-semibold">
                  What does K<sub>m</sub> represent?
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Tap to reveal answer
                </p>
              </div>
              {/* Floating marking chip */}
              <div
                className="animate-float absolute -right-6 -top-5 z-10 hidden items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3.5 shadow-sm xl:flex"
                style={{ animationDelay: "-2.5s" }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-[12px] font-semibold">
                  Worksheet marked · 5/6
                </span>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-accent">
                      Today&apos;s session
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      Biochemistry · Week 4
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center -space-x-1.5">
                        <PdfArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                        <SlidesArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                        <AudioArt className="h-5 w-5 rounded bg-card ring-1 ring-card" />
                      </span>
                      3 sources parsed &amp; ready
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold tabular-nums text-accent">
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
                            ? "border-accent/40 bg-background"
                            : "border-border bg-background"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-500 ${
                            done
                              ? "bg-accent-soft text-accent"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <item.icon className="h-3.5 w-3.5" />
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
            </div>
          </div>

          {/* Stats strip */}
          <div className="relative mt-16 border-t border-border pt-10">
            <dl className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
              {[
                {
                  value: `${roundedDown(stats.artifacts, 100).toLocaleString()}+`,
                  label: "practice artifacts generated",
                },
                {
                  value: `${roundedDown(stats.activities, 10).toLocaleString()}+`,
                  label: "study activities built",
                },
                {
                  value: `${stats.countries}`,
                  label: "countries studying with Scribe",
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="text-3xl font-bold tracking-tight tabular-nums">
                    {stat.value}
                  </dd>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </dl>
          </div>

          {/* Subjects strip */}
          <div className="relative mt-12 border-t border-border pt-10">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-faint">
              Built for every subject you study
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {subjects.map((subject) => (
                <li
                  key={subject.label}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <WorkspaceIcon icon={subject.icon} className="h-5 w-5" />
                  {subject.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-card/40 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="relative mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {steps.map((step) => (
              <li key={step.num} className="relative">
                <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                  <step.art className="h-full w-full" />
                </div>
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent ring-4 ring-card">
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

      {/* Feature teaser */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                One study session, everything in it
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Flashcards, quizzes, worksheets, and readings aren&apos;t
                separate tools — Scribe builds them together into one guided
                session.
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
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <feature.icon className="h-4.5 w-4.5" />
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

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border py-16 md:py-24">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to study smarter?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Turn a lecture PDF into something you can actually study — in
            minutes.
          </p>
          <Link href="/signup" className="mt-8 inline-block">
            <Button size="lg" className="gap-2">
              Start studying
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
