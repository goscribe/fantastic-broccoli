import type { Metadata } from "next";
import { Suspense } from "react";
import { CourseworkStart } from "@/components/coursework/start";

export const metadata: Metadata = { title: "Review new work", robots: { index: false, follow: false } };

export default function CourseworkNewPage() {
  return (
    <Suspense fallback={null}>
      <CourseworkStart />
    </Suspense>
  );
}
