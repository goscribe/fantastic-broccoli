import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to Scribe to continue your AI study sessions, flashcards, and worksheets.",
  alternates: { canonical: "/login" },
  openGraph: { url: absoluteUrl("/login"), title: "Log in to Scribe" },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
