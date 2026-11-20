import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { absoluteUrl } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/components/graphics/marketing-art";
import { GlowField } from "@/components/graphics/landing-art";
import { passFeatures, passes, plans } from "../data";
import { BILLING_PAUSED } from "@/lib/billing-paused";

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
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Simple, student-friendly pricing
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Start free — no credit card required. Upgrade when you need more
            study sessions. Every plan includes the full toolkit: readings,
            worksheets, flashcards, and the copilot.
          </p>

          {BILLING_PAUSED && (
            <p className="mt-6 max-w-2xl rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-foreground">
              <span className="font-semibold">Billing is paused.</span> Card
              payments are unavailable right now, so nobody is being charged
              and every account has Pro for free. The prices below apply once
              billing is back.
            </p>
          )}
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
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <div className="md:w-1/3">
                <p className="text-sm font-semibold text-accent">Pay once — until your exams</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  Exam passes
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {passFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                {passes.map((pass) => (
                  <div
                    key={pass.name}
                    className="flex flex-col rounded-2xl border border-border bg-background p-5"
                  >
                    <p className="text-sm font-semibold">{pass.name}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight">
                      {pass.price}
                    </p>
                    <p className="text-sm text-muted-foreground">{pass.note}</p>
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">
                      {pass.until}
                    </p>
                    <Link href="/signup" className="mt-5">
                      <Button className="w-full" variant="outline">
                        Get the pass
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
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
