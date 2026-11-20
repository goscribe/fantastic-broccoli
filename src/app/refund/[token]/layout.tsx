import type { Metadata } from "next";

// The URL is a signed refund credential: never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "Refund",
  description: "Refund a Scribe pass, or cancel a free trial, in one click.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RefundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
