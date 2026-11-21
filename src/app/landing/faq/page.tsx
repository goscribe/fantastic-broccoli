import type { Metadata } from "next";
import { absoluteUrl, jsonLdScriptProps, landingOgImages } from "@/lib/seo";
import { CtaBand, PageHero, PageSection } from "@/components/graphics/marketing-art";
import { faqs } from "../faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Scribe: uploads, study sessions, flashcards, pricing, and more.",
  alternates: { canonical: "/landing/faq" },
  openGraph: {
    url: absoluteUrl("/landing/faq"),
    title: "Scribe FAQ",
    images: landingOgImages,
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
      <PageSection className="max-w-3xl">
        <PageHero title="Questions, answered" lede="How uploads work, where the questions come from, and what it costs — the things students actually ask before they try it." />
        <div className="mt-8 divide-y divide-border border-y border-border">
          {faqs.map((faq) => (
            <details key={faq.q} className="group">
              <summary className="cursor-pointer list-none py-4 text-[16.5px] font-extrabold marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex min-h-7 items-center justify-between gap-4">
                  {faq.q}
                  <span aria-hidden className="text-[22px] font-semibold leading-none text-muted-foreground transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="max-w-[640px] pb-5 text-read text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </PageSection>
      <CtaBand
        title="Still curious? Try a real PDF."
        subtitle="The fastest answer is a session built from your own lecture."
      />
    </>
  );
}
