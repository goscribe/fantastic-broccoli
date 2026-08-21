import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { CtaBand, GlossyArt } from "@/components/graphics/marketing-art";
import { GlowField } from "@/components/graphics/landing-art";
import { plans } from "../data";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, student-friendly pricing. Start free with no credit card, upgrade when you need more study sessions.",
  alternates: { canonical: "/landing/pricing" },
  openGraph: {
    url: absoluteUrl("/landing/pricing"),
    title: "Scribe Pricing — Start free",
  },
};

export default function LandingPricingPage() {
  return (
    <>
      <section className="relative overflow-hidden py-16 md:py-20">
        <GlowField />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Simple, student-friendly pricing
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Start free — no credit card required. Upgrade when you need more
                study sessions. Every plan includes the full toolkit: readings,
                worksheets, flashcards, and the copilot.
              </p>
            </div>
            <GlossyArt
              src="/illustrations/marketing/mkt-quiz.png"
              className="mx-auto hidden w-56 lg:block"
              width={808}
              height={828}
            />
          </div>

          <div className="mx-auto mt-12 grid gap-5 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-accent bg-card shadow-sm"
                    : "border-border bg-card"
                }`}
              >
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {plan.price}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-6">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "primary" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-faint">
            Manage or switch plans anytime from the{" "}
            <Link href="/pricing" className="underline hover:text-foreground">
              pricing page
            </Link>{" "}
            once you sign in.
          </p>
        </div>
      </section>
      <CtaBand
        title="Start free with a real course"
        subtitle="Upload a lecture PDF. If the session isn’t useful, you haven’t paid a thing."
      />
    </>
  );
}
