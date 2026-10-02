import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar & study plan",
  robots: { index: false },
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
