import type { Metadata } from "next";
import { absoluteUrl, landingOgImages } from "@/lib/seo";
import { CtaBand, PageHero, PageSection } from "@/components/graphics/marketing-art";
import { testimonials } from "../data";

export const metadata: Metadata = {
  title: "About",
  description:
    "Scribe is the pre-scribed learning tool — built for retention and comprehension, not another pile of notes.",
  alternates: { canonical: "/landing/about" },
  openGraph: {
    url: absoluteUrl("/landing/about"),
    title: "About Scribe",
    images: landingOgImages,
  },
};

export default function AboutPage() {
  return (
    <>
      <PageSection>
        <PageHero
          pose="trophy"
          title="The pre-scribed learning tool"
          lede="Scribe exists because re-reading is a trap. Highlighting a PDF feels like work and doesn’t stick. We built a session that takes the materials you already have and turns them into the activities that actually move memory: recall, explanation, and marked practice."
        >
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground text-pretty">
            Not a generic chatbot. Not a question bank from someone else’s course. Your slides, your figures, your past papers — organised into one study session you can finish.
          </p>
        </PageHero>
      </PageSection>
      <PageSection rule className="grid gap-8 sm:grid-cols-3 sm:gap-10">
        {[
          {
            title: "Retention first",
            body: "Every activity is there to make you retrieve something — not to summarise it again in nicer prose.",
          },
          {
            title: "Your materials",
            body: "Questions and readings are generated from what you upload, with citations back to the page they came from.",
          },
          {
            title: "One sitting",
            body: "A session is one sitting, not a dashboard of five products. Open it, work through it, done.",
          },
        ].map((item) => (
          <div key={item.title}>
            <h2 className="text-[19px] font-extrabold">{item.title}</h2>
            <p className="mt-2 text-[15.5px] leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </PageSection>
      <PageSection rule>
        <h2 className="text-balance text-[26px] font-extrabold leading-[1.12] sm:text-[32px]">What studying with Scribe feels like</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {testimonials.map((t) => (
            <li key={t.name} className="life-card flex flex-col justify-between p-6">
              <p className="text-[16px] leading-relaxed text-pretty">“{t.quote}”</p>
              <div className="mt-5">
                <p className="text-[14.5px] font-extrabold">{t.name}</p>
                <p className="text-[13.5px] text-muted-foreground">{t.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </PageSection>
      <CtaBand />
    </>
  );
}
