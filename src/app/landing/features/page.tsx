import type { Metadata } from "next";
import Image from "next/image";
import { absoluteUrl } from "@/lib/seo";
import { CtaBand, FeatureSplit } from "@/components/graphics/marketing-art";
import { GlowField } from "@/components/graphics/landing-art";
import { features, featureScenes } from "../data";

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
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                One study session, everything in it
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
                Flashcards, quizzes, worksheets, and readings aren’t separate
                tools — Scribe builds them together into one guided session,
                from your own materials rather than generic question banks.
              </p>
            </div>
            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col items-center rounded-2xl border border-border bg-card px-2 py-4 text-center"
                >
                  <Image
                    src={feature.icon}
                    alt=""
                    width={56}
                    height={56}
                    className="h-12 w-12 object-contain"
                  />
                  <p className="mt-2 text-[11px] font-semibold leading-tight">
                    {feature.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {featureScenes.map((scene, i) => (
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
        title="Try it with your own course"
        subtitle="Free to start — upload a PDF and get a full session in minutes."
      />
    </>
  );
}
