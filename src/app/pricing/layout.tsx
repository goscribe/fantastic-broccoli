import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing — Free AI Study Tool",
  description:
    "Scribe is free to start — upload PDFs, slides, and lecture audio and get AI study sessions, flashcards, and worksheets at no cost. No credit card required.",
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
