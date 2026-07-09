"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScribeLogo, ScribeMark } from "@/components/graphics/logo";
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
  Mic,
  Moon,
  Sparkles,
  Sun,
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
            <Link href="/login">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-20 pt-16 md:pt-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block"
            style={{
              backgroundImage:
                "radial-gradient(var(--border-strong) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              maskImage:
                "radial-gradient(ellipse 70% 70% at 70% 40%, black, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 70% at 70% 40%, black, transparent 70%)",
            }}
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="animate-fade-up">
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
            <div className="relative hidden animate-fade-up lg:block">
              {/* Floating flashcard */}
              <div className="animate-float absolute -bottom-14 -left-24 z-10 w-44 rounded-xl border border-border bg-card p-3 shadow-sm">
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
                className="animate-float absolute -right-6 -top-5 z-10 flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3.5 shadow-sm"
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
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-card/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <ol className="relative mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
              <div
                aria-hidden
                className="absolute left-4 right-1/4 top-4 hidden border-t border-dashed border-border-strong sm:block"
              />
              {steps.map((step) => (
                <li key={step.num} className="relative">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent ring-4 ring-background">
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
                  className="group rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110">
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
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: FileText, label: "PDFs & slides" },
                  { icon: Mic, label: "Lecture audio" },
                  { icon: Upload, label: "Notes & handouts" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110">
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
        <section className="relative overflow-hidden border-t border-border py-16 md:py-24">
          <span aria-hidden className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2">
            <ScribeMark className="h-40 w-40 opacity-[0.07]" />
          </span>
          <span aria-hidden className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2">
            <ScribeMark className="h-56 w-56 opacity-[0.07]" />
          </span>
          <div className="relative mx-auto max-w-6xl px-6 text-center">
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
