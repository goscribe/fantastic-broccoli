import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { CtaBand, GlossyArt } from "@/components/graphics/marketing-art";
import { GlowField } from "@/components/graphics/landing-art";
import { ConfettiDots } from "@/components/graphics/floating-decor";

export const metadata: Metadata = {
  title: "About",
  description:
    "Scribe is the pre-scribed learning tool — built for retention and comprehension, not another pile of notes.",
  alternates: { canonical: "/landing/about" },
  openGraph: {
    url: absoluteUrl("/landing/about"),
    title: "About Scribe",
  },
};

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-24">
        <GlowField />
        <ConfettiDots className="hidden md:block" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              The pre-scribed learning tool
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty">
              Scribe exists because re-reading is a trap. Highlighting a PDF
              feels like work and doesn’t stick. We built a session that takes
              the materials you already have and turns them into the activities
              that actually move memory: recall, explanation, and marked
              practice.
            </p>
            <p className="mt-4 text-muted-foreground text-pretty">
              Not a generic chatbot. Not a question bank from someone else’s
              course. Your slides, your figures, your past papers — organised
              into one path you can finish.
            </p>
          </div>
          <GlossyArt
            src="/illustrations/marketing/mkt-celebrate.png"
            className="mx-auto max-w-md"
            width={880}
            height={485}
          />
        </div>
      </section>
      <section className="border-y border-border bg-card/40 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-3">
          {[
            {
              title: "Retention first",
              body: "Every activity is there to make you retrieve something — not to summarise it again in nicer prose.",
            },
            {
              title: "Your materials",
              body: "Questions and readings are generated from what you upload, with citations back to the page they came from.",
            },
            {
              title: "One sitting",
              body: "A session is a path, not a dashboard of five products. Open it, work through the waypoints, done.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
