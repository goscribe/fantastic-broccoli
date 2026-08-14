import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free, upgrade when you need more — upload PDFs, slides, and lecture audio and get AI study sessions, flashcards, and worksheets. No credit card required to start.",
  alternates: { canonical: "/pricing" },
  openGraph: { url: absoluteUrl("/pricing"), title: "Scribe Pricing" },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
