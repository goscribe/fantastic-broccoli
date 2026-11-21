import type { Metadata } from "next";
import { absoluteUrl, landingOgImages } from "@/lib/seo";
import { CtaBand, FeatureSplit, PageHero, PageSection } from "@/components/graphics/marketing-art";
import { Cat } from "@/components/design/landing-mocks";
import { homeScenes, howItWorks } from "../data";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Make a subject, drop in your notes, and Scribe builds study sessions from them — readings, worksheets and flashcards — slotted into your week by the planner.",
  alternates: { canonical: "/landing/how-it-works" },
  openGraph: {
    url: absoluteUrl("/landing/how-it-works"),
    title: "How Scribe works",
    images: landingOgImages,
  },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageSection>
        <PageHero title="How it works" lede="Three steps from a messy pile of notes to a session you can actually finish. No extra tabs, no generic question bank." />
        <ol className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
          {howItWorks.map((step) => (
            <li key={step.num} className="life-card flex gap-4 p-5 md:block md:p-7">
              <Cat pose={step.pose} className="h-[72px] shrink-0 md:h-[96px]" />
              <div className="min-w-0 md:mt-5">
                <div className="text-small font-extrabold text-muted-foreground">Step {step.num}</div>
                <h2 className="mt-1 text-[19px] font-extrabold leading-tight">{step.title}</h2>
                <p className="mt-2 text-ui text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </PageSection>

      {homeScenes.map((scene) => (
        <PageSection key={scene.title} rule>
          <FeatureSplit scene={scene} />
        </PageSection>
      ))}

      <CtaBand title="Try it with a real lecture" subtitle="Upload a PDF and get a full session in minutes — free to start." />
    </>
  );
}
