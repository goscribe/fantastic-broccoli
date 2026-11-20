import type { Metadata } from "next";

// The URL carries a payment secret: never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "Pay for Scribe",
  description: "A secure link to pay for a student's Scribe plan. No account needed.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
