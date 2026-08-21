import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { plans } from "../data";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — Scribe",
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
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, student-friendly pricing
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Start free — no credit card required. Upgrade when you need more
          study sessions.
        </p>
        <div className="mx-auto mt-10 grid gap-5 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? "border-accent bg-card shadow-sm"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{plan.name}</p>
                {plan.highlighted && (
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    Most popular
                  </span>
                )}
              </div>
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
              <Link href="/login" className="mt-6">
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
  );
}
