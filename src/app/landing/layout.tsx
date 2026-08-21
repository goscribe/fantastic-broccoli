import type { Metadata } from "next";
import { LandingHeader, LandingFooter } from "./chrome";

export const metadata: Metadata = {
  title: {
    default: "Turn PDFs & Notes into Flashcards, Quizzes & Study Guides",
    template: "%s | Scribe",
  },
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — one complete study session built from your own course material. Free during early access.",
  openGraph: {
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
