import type { Metadata } from "next";
import { CourseView } from "@/components/notes-app/course-view";

export const metadata: Metadata = { title: "Notes", robots: { index: false, follow: false } };

export default async function LibraryCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseView courseId={decodeURIComponent(courseId)} />;
}
