import type { Metadata } from "next";
import { LandingBody } from "@/components/design/landing-page";

export const metadata: Metadata = {
  title: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material.",
  alternates: { canonical: "/landing" },
};

export default function LandingPage() {
  return (
    <>
      {/* Phones: the hero's scene is the largest thing on the first screen, so fetch it with the HTML, not after the CSS (see landing.css). */}
      <link rel="preload" as="image" href="/design/hero/all-800.webp" media="(max-width: 639px)" fetchPriority="high" />
      <LandingBody />
    </>
  );
}
