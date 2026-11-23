import type { Metadata } from "next";
import { LandingHeader, LandingFooter } from "./chrome";
import { defaultDescription, defaultTitle, landingOgImages } from "@/lib/seo";
import "../design/design.css";
import "./landing.css";

export const metadata: Metadata = {
  title: {
    default: "Turn PDFs & Notes into Study Sessions, Flashcards & Quizzes",
    template: "%s | Scribe",
  },
  description:
    "Upload your notes, slides, or PDFs. Scribe turns them into flashcards, quizzes, worksheets, and readings — organised into study sessions inside each subject, built from your own course material, with a planner that fits them around your week.",
  openGraph: {
    title: "Scribe — AI Study Tool for Students",
    images: landingOgImages,
  },
  // Same card, title and description as the site default; only the image differs.
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: landingOgImages.map((i) => i.url),
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="design-root app-brand landing-root min-h-screen bg-white text-foreground">
      {/*
        Without JavaScript. The app's root loading.tsx wraps every page in a
        Suspense boundary, so the server sends the dashboard skeleton first and
        this page in a hidden container (id "S:0") that a script reveals. With
        scripts off nothing reveals it, so do it in CSS: show the page, hide the
        skeleton (the only <main> that is a direct child of <body>). Tailwind's
        `[hidden]{display:none!important}` sits in @layer base, and for
        !important the earliest layer wins, so the override goes in Tailwind's
        first layer (properties).
      */}
      <noscript>
        <style>{`@layer properties,theme,base,components,utilities;@layer properties{#S\\:0{display:block!important}}body>main{display:none!important}`}</style>
      </noscript>
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
