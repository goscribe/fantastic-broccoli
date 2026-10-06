import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { CtaBand, FeatureSplit } from "@/components/graphics/marketing-art";
import { IconTile, type Tone } from "@/components/graphics/icon-tile";
import type { ArtTint } from "../data";

const STEP_TONE: Record<ArtTint, Tone> = {
  accent: "purple",
  sky: "sky",
  rose: "pink",
  amber: "amber",
};
import { GlowField } from "@/components/graphics/landing-art";
import { homeScenes, howItWorks } from "../data";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Upload your notes, let Scribe build a study session, then work through readings, worksheets, and flashcards — with a copilot that already read the PDF.",
  alternates: { canonical: "/landing/how-it-works" },
  openGraph: {
    url: absoluteUrl("/landing/how-it-works"),
    title: "How Scribe works",
  },
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-20">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            How it works
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
            Three steps from a messy pile of notes to a session you can actually
            finish. No extra tabs, no generic question bank.
          </p>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {howItWorks.map((step) => (
              <li key={step.num}>
                <div className="flex items-center gap-3">
                  <IconTile
                    icon={step.icon}
                    tone={STEP_TONE[step.tint]}
                    size="lg"
                  />
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {step.num}
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold">{step.title}</h2>
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
          className={`py-16 md:py-24 ${i % 2 === 0 ? "border-y border-border bg-card/40" : ""}`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <FeatureSplit scene={scene} />
          </div>
        </section>
      ))}

      <CtaBand
        title="Try it with a real lecture"
        subtitle="Upload a PDF and get a full session in minutes — free to start."
      />
    </>
  );
}
