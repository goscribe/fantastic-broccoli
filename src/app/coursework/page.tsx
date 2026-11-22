import type { Metadata } from "next";
import { CourseworkHub } from "@/components/coursework/hub";

export const metadata: Metadata = { title: "Coursework", robots: { index: false, follow: false } };

export default function CourseworkPage() {
  return <CourseworkHub />;
}
