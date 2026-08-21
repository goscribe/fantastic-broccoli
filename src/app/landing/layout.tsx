import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { LandingHeader, LandingFooter } from "./chrome";

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

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
