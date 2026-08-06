import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sign up free",
  description:
    "Create a free Scribe account and turn your PDFs, slides, and lecture audio into AI study sessions, flashcards, and worksheets. No credit card required.",
  alternates: { canonical: "/signup" },
  openGraph: { url: absoluteUrl("/signup"), title: "Sign up for Scribe" },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
