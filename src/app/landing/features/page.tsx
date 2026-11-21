import type { Metadata } from "next";
import { absoluteUrl, landingOgImages } from "@/lib/seo";
import { CtaBand, FunFeatureCard, PageHero, PageSection, Points } from "@/components/graphics/marketing-art";
import { CopilotMock, UploadMock } from "@/components/design/landing-mocks";
import { features } from "../data";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Readings with figures, AI-graded worksheets, flashcards, cloze passages, comprehension checks, and a copilot grounded in your own course materials.",
  alternates: { canonical: "/landing/features" },
  openGraph: {
    url: absoluteUrl("/landing/features"),
    title: "Scribe Features — Everything in one study session",
    images: landingOgImages,
  },
};

export default function FeaturesPage() {
  return (
    <>
      <PageSection>
        <PageHero
          pose="book"
          title="One study session, everything in it"
          lede="Flashcards, quizzes, worksheets, and readings aren’t separate tools — Scribe builds them together into one guided session, from your own materials rather than generic question banks."
        />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {features.map((feature) => (
            <FunFeatureCard key={feature.title} heading="h2" {...feature} />
          ))}
        </ul>
      </PageSection>

      <PageSection rule className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-[14px] font-extrabold text-accent-dim">AI copilot</p>
          <h2 className="mt-1.5 text-balance text-[26px] font-extrabold leading-[1.12] sm:text-[32px]">Stuck? Ask mid-session.</h2>
          <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
            The copilot answers from your own materials — with citations back to the exact page — and can extend your plan with extra practice when you need it.
          </p>
          <Points
            className="mt-5"
            items={["Answers cite your PDFs, page by page", "Explains worksheet feedback step by step", "Adds targeted practice when a topic feels shaky"]}
          />
        </div>
        <div className="mx-auto w-full max-w-[480px]">
          <CopilotMock />
        </div>
      </PageSection>

      <PageSection rule className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-balance text-[26px] font-extrabold leading-[1.12] sm:text-[32px]">Bring your whole course</h2>
          <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
            Scribe handles the formats your course actually comes in — and keeps the figures, diagrams, and structure intact.
          </p>
          <Points
            className="mt-5"
            items={["Lecture slides and textbook PDFs, figures included", "Audio recordings of lectures, transcribed for you", "Notes and handouts, organised into subjects"]}
          />
        </div>
        <div className="mx-auto w-full max-w-[480px]">
          <UploadMock />
        </div>
      </PageSection>

      <CtaBand title="Try it with your own course" subtitle="Free to start — upload a PDF and get a full session in minutes." />
    </>
  );
}
