"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { faqs } from "./faqs";
import { ScribeLogo, ScribeMark } from "@/components/graphics/logo";
import {
  DotGrid,
  GlowField,
  SparkCluster,
  StepCopilotArt,
  StepPlanArt,
  StepUploadArt,
} from "@/components/graphics/landing-art";
import {
  AudioArt,
  NoteArt,
  PdfArt,
  SlidesArt,
} from "@/components/graphics/material-art";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileText,
  Layers,
  ListChecks,
  MessageSquare,
  Moon,
  Plus,
  Sun,
  TextCursorInput,
} from "lucide-react";

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

const subjects = [
  { icon: "chemistry", label: "Chemistry" },
  { icon: "biology", label: "Biology" },
  { icon: "physics", label: "Physics" },
  { icon: "math", label: "Math" },
  { icon: "english", label: "English" },
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

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Everything you need to try Scribe with a real course.",
    features: [
      "Upload PDFs, slides, and lecture audio",
      "AI study sessions with readings & worksheets",
      "300 tokens per month",
      "2 GB storage",
    ],
    cta: "Start studying",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9/mo",
    description: "Great for getting started with focused study sessions.",
    features: [
      "Everything in Free",
      "5,000 tokens per month",
      "2 GB storage",
      "Study copilot grounded in your materials",
    ],
    cta: "Get Starter",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$19/mo",
    description: "Best for power users with higher content generation limits.",
    features: [
      "Everything in Starter",
      "10,000 tokens per month",
      "10 GB storage",
      "Higher generation limits",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

const sessionPreview = [
  { icon: BookOpen, label: "Reading: Enzyme kinetics", meta: "12 min" },
  { icon: ListChecks, label: "Comprehension check", meta: "4 questions" },
  { icon: ClipboardCheck, label: "Worksheet: Rate equations", meta: "AI-marked" },
  { icon: Layers, label: "Flashcards: Key definitions", meta: "18 cards" },
  { icon: TextCursorInput, label: "Cloze: Michaelis–Menten", meta: "1 passage" },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <ScribeLogo />
          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "#how-it-works", label: "How it works" },
              { href: "#features", label: "Features" },
              { href: "#pricing", label: "Pricing" },
              { href: "#faq", label: "FAQ" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Link
              href="/login"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/signup">
              <Button size="sm">Start studying</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-20 pt-16 md:pt-24">
          <GlowField />
          <div className="relative mx-auto max-w-6xl px-6">
          <DotGrid className="inset-y-0 right-0 hidden w-1/2 lg:block" />
          <div className="relative flex flex-col items-center">
            <div className="animate-fade-up flex max-w-2xl flex-col items-center text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent">
                Turn any course material into a study session
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
                Stop re-reading. Start learning.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
                Upload your notes, slides, or PDFs. Scribe turns them into
                flashcards, quizzes, worksheets, and readings — one complete
                study session built from your own course material.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup">
                  <Button size="lg" className="gap-2">
                    Start studying
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
                Free to start · No credit card required
              </p>
              <div className="mt-5 flex justify-center">
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
            <div className="relative mt-14 hidden w-full max-w-md animate-fade-up lg:block">
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

          {/* Subjects strip */}
          <div className="relative mt-16 border-t border-border pt-10">
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
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card/40 py-16 md:py-20">
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

        {/* Features */}
        <section id="features" className="relative scroll-mt-20 overflow-hidden py-16 md:py-20">
          <DotGrid className="left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 opacity-60" />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="flex items-start gap-3">
              <SparkCluster className="mt-1 hidden h-7 w-7 shrink-0 sm:block" />
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  One study session, everything in it
                </h2>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Flashcards, quizzes, worksheets, and readings aren&apos;t
                  separate tools — Scribe builds them together into one guided
                  session, from your own materials rather than generic
                  question banks.
                </p>
              </div>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <feature.icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <h3 className="text-sm font-semibold">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-10 text-center">
              <Link href="/signup" className="inline-block">
                <Button size="lg" className="gap-2">
                  Start studying
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Copilot */}
        <section className="border-t border-border bg-card/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5 text-accent" />
                  AI copilot
                </p>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Stuck? Ask mid-session.
                </h2>
                <p className="mt-3 max-w-lg text-muted-foreground">
                  The copilot answers from your own materials — with citations
                  back to the exact page — and can extend your plan with extra
                  practice when you need it.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Answers cite your PDFs, page by page",
                    "Explains worksheet feedback step by step",
                    "Adds targeted practice when a topic feels shaky",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Chat mock */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <ScribeMark className="h-5 w-5" />
                  <span className="text-[13px] font-semibold">Copilot</span>
                  <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                    Session 4
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground">
                    Why did I lose a mark on part (b)?
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-background px-3.5 py-2.5 text-[13px] text-muted-foreground">
                    You stated the rate doubles but didn&apos;t link it to the
                    enzyme concentration — the markscheme wants the causal step.
                    <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-accent">
                      <FileText className="h-3 w-3" />
                      lecture-04.pdf · p.12
                    </span>
                  </div>
                  <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-background px-3.5 py-3">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-faint"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { art: PdfArt, label: "Textbook PDFs" },
                  { art: SlidesArt, label: "Lecture slides" },
                  { art: AudioArt, label: "Lecture audio" },
                  { art: NoteArt, label: "Notes & handouts" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-sm"
                  >
                    <item.art className="h-11 w-11 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    <span className="text-[14px] font-medium">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-border bg-card/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Simple, student-friendly pricing
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Start free — no credit card required. Upgrade when you need more
              study sessions.
            </p>
            <div className="mx-auto mt-10 grid gap-5 sm:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    plan.highlighted
                      ? "border-accent bg-card shadow-sm"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{plan.name}</p>
                    {plan.highlighted && (
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                        Most popular
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight">
                    {plan.price}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="mt-6">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "primary" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-faint">
              Manage or switch plans anytime from the{" "}
              <Link href="/pricing" className="underline hover:text-foreground">
                pricing page
              </Link>{" "}
              once you sign in.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="mx-auto mt-10 max-w-3xl space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={faq.q}
                  open={i === 0}
                  className="group rounded-2xl border border-border bg-card px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-8 sm:flex-row sm:items-center md:p-10">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Ready to study smarter?
                </h2>
                <p className="mt-2 max-w-md text-muted-foreground">
                  Turn a lecture PDF into something you can actually study —
                  in minutes.
                </p>
              </div>
              <Link href="/signup" className="shrink-0">
                <Button size="lg" className="gap-2">
                  Start studying
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <ScribeLogo />
              <p className="mt-3 max-w-xs text-[13px] text-muted-foreground">
                Your course materials, turned into personalized study sessions.
              </p>
            </div>
            {[
              {
                heading: "Product",
                links: [
                  { label: "How it works", href: "#how-it-works" },
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                ],
              },
              {
                heading: "Account",
                links: [
                  { label: "Sign in", href: "/login" },
                  { label: "Create account", href: "/signup" },
                  { label: "Reset password", href: "/forgot-password" },
                ],
              },
              {
                heading: "Legal",
                links: [
                  { label: "Privacy policy", href: "/privacy" },
                  { label: "Terms of service", href: "/terms" },
                ],
              },
            ].map((column) => (
              <div key={column.heading}>
                <p className="text-xs font-semibold uppercase tracking-wider text-faint">
                  {column.heading}
                </p>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-[13px] text-faint">
            <span>© 2026 Scribe</span>
            <span>Study smarter, not harder.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
