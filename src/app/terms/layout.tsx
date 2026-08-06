import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Scribe — accounts, your content, acceptable use, and AI-generated study materials.",
  alternates: { canonical: "/terms" },
  openGraph: { url: absoluteUrl("/terms"), title: "Scribe Terms of Service" },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
