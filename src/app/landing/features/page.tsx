import type { Metadata } from "next";
import Image from "next/image";
import { Check, FileText, MessageSquare } from "lucide-react";
import { absoluteUrl } from "@/lib/seo";
import { ArtStage, CtaBand, ProductCard } from "@/components/graphics/marketing-art";
import { DotGrid, GlowField } from "@/components/graphics/landing-art";
import { ScribeMark } from "@/components/graphics/logo";
import {
  AudioArt,
  NoteArt,
  PdfArt,
  SlidesArt,
} from "@/components/graphics/material-art";
import { features } from "../data";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Readings with figures, AI-graded worksheets, flashcards, cloze passages, comprehension checks, and a copilot grounded in your own course materials.",
  alternates: { canonical: "/landing/features" },
  openGraph: {
    url: absoluteUrl("/landing/features"),
    title: "Scribe Features — Everything in one study session",
  },
};

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-20">
        <GlowField />
        <DotGrid className="left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-3xl tracking-tight sm:text-4xl md:text-5xl">
                One study session, everything in it
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
                Flashcards, quizzes, worksheets, and readings aren’t separate
                tools — Scribe builds them together into one guided session,
                from your own materials rather than generic question banks.
              </p>
            </div>
            <ArtStage
              src="/illustrations/marketing/mkt-reading.png"
              tint="sky"
              side="right"
              size="md"
            />
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(circle, var(--accent-bright), transparent 70%)",
                  }}
                />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50">
                  <Image
                    src={feature.icon}
                    alt=""
                    width={32}
                    height={32}
                    className="h-7 w-7 object-contain"
                  />
                </span>
                <h2 className="mt-3 text-sm font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-border bg-card/40 py-16 md:py-20">
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
            <ProductCard>
              <div className="bg-background p-5">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <ScribeMark className="h-5 w-5" />
                  <span className="text-[13px] font-semibold">Copilot</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    Grounded in this workspace
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground">
                    Why did I lose a mark on part (b)?
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
                    You stated the rate doubles but didn’t link it to enzyme
                    concentration. The scheme wants the causal step.
                    <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-accent">
                      <FileText className="h-3 w-3" />
                      lecture-04.pdf · p.12
                    </span>
                  </div>
                </div>
              </div>
            </ProductCard>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Bring your whole course
              </h2>
              <p className="mt-3 max-w-lg text-muted-foreground">
                Scribe handles the formats your course actually comes in — and
                keeps the figures, diagrams, and structure intact.
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
                  <span className="text-[14px] font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        title="Try it with your own course"
        subtitle="Free to start — upload a PDF and get a full session in minutes."
      />
    </>
  );
}
