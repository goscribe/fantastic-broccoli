import type { Metadata } from "next";
import { absoluteUrl, jsonLdScriptProps } from "@/lib/seo";
import { CtaBand } from "@/components/graphics/marketing-art";
import { GlowField } from "@/components/graphics/landing-art";
import { faqs } from "../faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Scribe: uploads, study sessions, flashcards, pricing, and more.",
  alternates: { canonical: "/landing/faq" },
  openGraph: {
    url: absoluteUrl("/landing/faq"),
    title: "Scribe FAQ",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export default function LandingFaqPage() {
  return (
    <>
      <script {...jsonLdScriptProps(faqJsonLd)} />
      <section className="relative overflow-hidden py-16 md:py-20">
        <GlowField />
        <div className="relative mx-auto max-w-3xl px-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Questions, answered
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            How uploads work, where the questions come from, and what it costs —
            the things students actually ask before they try it.
          </p>
          <div className="mt-12 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-1">
                <summary className="cursor-pointer list-none py-4 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.q}
                    <span className="text-lg font-normal text-faint transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <CtaBand
        title="Still curious? Try a real PDF."
        subtitle="The fastest answer is a session built from your own lecture."
      />
    </>
  );
}
