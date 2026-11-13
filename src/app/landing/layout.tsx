import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LandingHeader, LandingFooter } from "./chrome";
import "../design/design.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Turn PDFs & Notes into Study Sessions, Flashcards & Quizzes",
    template: "%s | Scribe",
  },
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — organised into study sessions inside each subject, built from your own course material, with a planner that fits them around your week.",
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
    <div className={`${inter.variable} design-root min-h-screen bg-white text-foreground`}>
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
