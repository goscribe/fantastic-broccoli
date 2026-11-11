import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import "./design.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = { title: "Design preview", robots: { index: false, follow: false } };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DESIGN_PREVIEW !== "1") {
    notFound();
  }
  return (
    <div className={`${inter.variable} design-root min-h-dvh bg-white text-foreground`}>{children}</div>
  );
}
