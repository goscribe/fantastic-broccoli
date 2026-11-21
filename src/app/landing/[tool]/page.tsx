import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/seo";
import { isTryTool, TRY_TOOLS, type TryTool } from "@/lib/try";
import { ToolHero } from "@/components/try/tool-hero";

/** Ad / SEO landing pages (/landing/ai-quiz-generator …): the keyword, then a real Quick 5 with no account. */
const META: Record<TryTool, { title: string; description: string }> = {
  "ai-quiz-generator": {
    title: "Free AI Quiz Generator — 5 Questions from Any Topic or Notes",
    description: "Type a topic or paste your notes and get a 5-question quiz in seconds. No account needed. Save your results free and see why each answer is right.",
  },
  "ai-flashcard-generator": {
    title: "Free AI Flashcard Generator from Your Notes",
    description: "Check what you know with a free 5-question quiz from any topic or notes, then turn it into spaced-repetition flashcards. No account needed to try.",
  },
  "ai-study-guide-generator": {
    title: "Free AI Study Guide Generator from Your Notes",
    description: "Paste your notes or name a topic, take a quick 5-question check, and Scribe builds your study guide around what you missed. Try it free, no signup.",
  },
  "pdf-to-quiz": {
    title: "PDF to Quiz — Turn a PDF into Questions Free",
    description: "Drop a PDF or paste the text and get five questions from your own material in seconds. No account needed.",
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return TRY_TOOLS.map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool } = await params;
  if (!isTryTool(tool)) return {};
  const meta = META[tool];
  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: `/landing/${tool}` },
    openGraph: { url: absoluteUrl(`/landing/${tool}`), title: meta.title, description: meta.description },
  };
}

export default async function ToolLandingPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!isTryTool(tool)) notFound();
  return <ToolHero tool={tool} />;
}
