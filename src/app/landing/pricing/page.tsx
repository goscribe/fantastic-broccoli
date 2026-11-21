import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, landingOgImages } from "@/lib/seo";
import { CtaBand, PageHero, PageSection } from "@/components/graphics/marketing-art";
import { plans } from "../data";
import { BILLING_PAUSED } from "@/lib/billing-paused";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, student-friendly pricing. Start free with no credit card, upgrade when you need more study sessions.",
  alternates: { canonical: "/landing/pricing" },
  openGraph: {
    url: absoluteUrl("/landing/pricing"),
    title: "Scribe Pricing — Start free",
    images: landingOgImages,
  },
};

export default function LandingPricingPage() {
  return (
    <>
      <PageSection>
        <PageHero
          title="Simple, student-friendly pricing"
          lede="Start free — no credit card required. Upgrade when you need more study sessions. Every plan includes the full toolkit: readings, worksheets, flashcards, and the copilot."
        />

        {BILLING_PAUSED && (
          <p className="mt-6 max-w-2xl rounded-[var(--r-control)] border border-border-strong bg-muted px-4 py-3 text-[14.5px] text-foreground">
            <span className="font-extrabold">Billing is paused.</span> Card payments are unavailable right now, so nobody is being charged and every account has Pro for free. The prices below apply once billing is back.
          </p>
        )}
        <div className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`life-card flex flex-col p-6 ${plan.highlighted ? "border-2 border-accent" : ""}`}>
              <h2 className="text-[16px] font-extrabold">{plan.name}</h2>
              <p className="mt-3 text-[34px] font-extrabold leading-none tracking-tight">{plan.price}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{plan.description}</p>
              <ul className="mt-5 flex-1 list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted-foreground marker:text-border-strong">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  plan.highlighted
                    ? "btn-chunky mt-6 flex h-12 items-center justify-center bg-accent text-[15.5px] font-extrabold text-white hover:bg-accent-dim"
                    : "mt-6 flex h-12 items-center justify-center rounded-[var(--r-button)] border border-border-strong text-[15.5px] font-extrabold text-foreground hover:border-foreground/40"
                }
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
          Manage or switch plans anytime from the{" "}
          <Link href="/pricing" className="underline hover:text-foreground">
            pricing page
          </Link>{" "}
          once you sign in.
        </p>
      </PageSection>
      <CtaBand title="Start free with a real course" subtitle="Upload a lecture PDF. If the session isn’t useful, you haven’t paid a thing." />
    </>
  );
}
