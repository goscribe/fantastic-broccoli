import type { Metadata } from "next";
import { GuideReader } from "@/components/coursework/guide-reader";

export const metadata: Metadata = { title: "Coursework guide", robots: { index: false, follow: false } };

export default async function CourseworkGuidePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <GuideReader rubricKey={decodeURIComponent(key)} />;
}
