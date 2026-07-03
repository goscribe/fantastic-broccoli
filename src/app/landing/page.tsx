"use client";

import Link from "next/link";
import { ScribeLogo } from "@/components/graphics/logo";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    num: "1",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or notes. Scribe indexes everything and precomputes a bank of practice content.",
  },
  {
    num: "2",
    title: "Get a study plan",
    description:
      "Each session is a guided plan — reading, comprehension checks, worksheets, flashcards, and active recall.",
  },
  {
    num: "3",
    title: "Study with a copilot",
    description:
      "Ask Scribe anything mid-session. It cites your PDFs, plots graphs, and adapts your plan as you go.",
  },
];

const features = [
  {
    title: "Exam-style worksheets",
    description:
      "Multi-step questions with sub-parts, mark schemes, and diagrams captured from your own PDFs.",
  },
  {
    title: "Research-proven recall",
    description:
      "Flashcards, cloze passages, vocabulary recall, and Feynman explain-aloud exercises built into every plan.",
  },
  {
    title: "Plans that adapt",
    description:
      "Scribe notices shaky quiz scores and offers to extend your session with targeted practice from the bank.",
  },
  {
    title: "Session debriefs",
    description:
      "Finish a session and get a mini study guide: what went well, what to review, and your suggested next step.",
  },
  {
    title: "Shared workspaces",
    description:
      "Share materials with classmates while your study plans and progress stay personal.",
  },
  {
    title: "Everything organised",
    description:
      "Folders, workspaces, and a searchable library — your whole course in one place.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <ScribeLogo />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link href="/login">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-14 md:pt-20">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              AI-powered study sessions
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Stop re-reading.
              <br />
              <span className="text-accent">Start studying.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
              Upload your notes and Scribe builds guided study sessions —
              worksheets, flashcards, active recall, and a copilot that knows
              your materials.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login">
                <Button size="lg" className="gap-2">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-faint">
              Free to use · No credit card required
            </p>
          </div>
        </section>

        <section className="border-y border-border bg-card/40 py-14 md:py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.map((step) => (
                <li key={step.num}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
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
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold tracking-tight">
              Everything you need to actually learn
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              Ready to study smarter?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Join students already using Scribe to turn raw notes into real
              understanding.
            </p>
            <Link href="/login" className="mt-8 inline-block">
              <Button size="lg" className="gap-2">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-[13px] text-faint">
          <span>© 2026 Scribe</span>
          <span>Study smarter, not harder.</span>
        </div>
      </footer>
    </div>
  );
}
