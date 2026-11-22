import type { Metadata } from "next";
import { CourseworkWorkspace } from "@/components/coursework/workspace";

export const metadata: Metadata = { title: "Coursework", robots: { index: false, follow: false } };

export default async function CourseworkDocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <CourseworkWorkspace documentId={decodeURIComponent(documentId)} />;
}
