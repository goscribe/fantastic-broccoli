import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Scribe collects, uses, and protects your data — including your uploaded study materials and generated study content.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: absoluteUrl("/privacy"), title: "Scribe Privacy Policy" },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
