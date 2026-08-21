import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { LandingHeader, LandingFooter } from "./chrome";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

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
    <div className={`${fraunces.variable} landing-type min-h-screen bg-background text-foreground transition-colors duration-300`}>
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
