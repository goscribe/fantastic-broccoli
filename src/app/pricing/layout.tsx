import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Scribe is free during early access — upload PDFs, slides, and lecture audio and get AI study sessions, flashcards, and worksheets. No credit card required.",
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
