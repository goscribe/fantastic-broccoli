import type { Metadata } from "next";
import { LandingBody } from "@/components/design/landing-page";

export const metadata: Metadata = {
  title: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material.",
  alternates: { canonical: "/landing" },
};

export default function LandingPage() {
  return <LandingBody />;
}
