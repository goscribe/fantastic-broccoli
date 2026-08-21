import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, jsonLdScriptProps } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { faqs } from "../faqs";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ — Scribe",
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
    <section className="py-16 md:py-20">
      <script {...jsonLdScriptProps(faqJsonLd)} />
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h1>
        <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <h2 className="text-sm font-semibold">{faq.q}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-border pt-10 text-center">
          <p className="text-muted-foreground">
            Still curious? The fastest answer is trying it.
          </p>
          <Link href="/signup" className="mt-5 inline-block">
            <Button size="lg" className="gap-2">
              Start studying
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
