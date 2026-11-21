import type { Metadata } from "next";
import { TopicReader } from "@/components/notes-app/topic-reader";

export const metadata: Metadata = { title: "Notes", robots: { index: false, follow: false } };

export default async function LibraryTopicPage({ params }: { params: Promise<{ courseId: string; topicId: string }> }) {
  const { courseId, topicId } = await params;
  return <TopicReader courseId={decodeURIComponent(courseId)} segment={decodeURIComponent(topicId)} />;
}
