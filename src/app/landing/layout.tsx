import type { Metadata } from "next";
import { absoluteUrl, jsonLdScriptProps } from "@/lib/seo";
import { faqs } from "./faqs";

export const metadata: Metadata = {
  title:
    "AI Study Tool — Turn PDFs, Slides & Lectures into Study Sessions",
  description:
    "Scribe turns your course materials into personalized study sessions: readings with figures, AI-graded worksheets, flashcards, cloze passages, and a copilot that knows your course. Free for AP, IB, and university students.",
  alternates: { canonical: "/landing" },
  openGraph: {
    url: absoluteUrl("/landing"),
    title: "Scribe — AI Study Tool for Students",
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

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script {...jsonLdScriptProps(faqJsonLd)} />
      {children}
    </>
  );
}
