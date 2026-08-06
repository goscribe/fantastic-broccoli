import type { Metadata } from "next";
import { absoluteUrl, jsonLdScriptProps } from "@/lib/seo";
import { faqs } from "./faqs";

export const metadata: Metadata = {
  title:
    "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material. Free during early access.",
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
