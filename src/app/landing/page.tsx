"use client";

import Link from "next/link";
import { ScribeLogo } from "@/components/graphics/logo";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileText,
  Layers,
  ListChecks,
  MessageSquare,
  Mic,
  Sparkles,
  TextCursorInput,
  Upload,
} from "lucide-react";

const steps = [
  {
    num: "1",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or audio recordings. Scribe parses everything — text, figures, and diagrams included.",
  },
  {
    num: "2",
    title: "Get a personalized session",
    description:
      "Scribe turns your materials into a guided study plan: readings, worksheets, flashcards, and comprehension checks.",
  },
  {
    num: "3",
    title: "Study with a copilot",
    description:
      "Ask Scribe anything mid-session. It answers from your own materials and adapts your plan as you go.",
  },
];

const features = [
  {
    icon: BookOpen,
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
  },
  {
    icon: ClipboardCheck,
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
  },
  {
    icon: TextCursorInput,
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
  },
  {
    icon: ListChecks,
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
  },
  {
    icon: MessageSquare,
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
  },
];

const sessionPreview = [
  { icon: BookOpen, label: "Reading: Enzyme kinetics", meta: "12 min", done: true },
  { icon: ListChecks, label: "Comprehension check", meta: "4 questions", done: true },
  { icon: ClipboardCheck, label: "Worksheet: Rate equations", meta: "AI-marked", done: false },
  { icon: Layers, label: "Flashcards: Key definitions", meta: "18 cards", done: false },
  { icon: TextCursorInput, label: "Cloze: Michaelis–Menten", meta: "1 passage", done: false },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
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
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div>
              <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                AI-powered study sessions
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Your course materials,
                <br />
                <span className="text-accent">turned into study sessions.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
                Upload your PDFs and lecture audio. Scribe parses them and
                builds personalized sessions — readings, AI-graded worksheets,
                flashcards, and a copilot that knows your course.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login">
                  <Button size="lg" className="gap-2">
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    Sign in
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-faint">
                Free to use · No credit card required
              </p>
            </div>

            {/* Session preview card */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-accent">
                      Today&apos;s session
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      Biochemistry · Week 4
                    </p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
                    45 min
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {sessionPreview.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          item.done
                            ? "bg-accent-soft text-accent"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <item.icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span
                        className={`flex-1 truncate text-[13px] font-medium ${
                          item.done ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="shrink-0 text-[11px] text-faint">
                        {item.meta}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
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

        {/* Features */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Everything you need to actually learn
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Every session is built from your own materials — not generic
              question banks.
            </p>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <feature.icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Upload anything */}
        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Bring your whole course
                </h2>
                <p className="mt-3 max-w-lg text-muted-foreground">
                  Scribe handles the formats your course actually comes in —
                  and keeps the figures, diagrams, and structure intact.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Lecture slides and textbook PDFs, figures included",
                    "Audio recordings of lectures, transcribed for you",
                    "Notes and handouts, organised into workspaces",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: FileText, label: "PDFs & slides" },
                  { icon: Mic, label: "Lecture audio" },
                  { icon: Upload, label: "Notes & handouts" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-6"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <item.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-center text-[13px] font-medium">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to study smarter?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Upload your first PDF and get a personalized study session in
              minutes.
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-[13px] text-faint">
          <span>© 2026 Scribe</span>
          <span>Study smarter, not harder.</span>
        </div>
      </footer>
    </div>
  );
}
