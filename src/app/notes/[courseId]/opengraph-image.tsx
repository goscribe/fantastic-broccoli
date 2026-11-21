import { getCourse } from "@/lib/notes-public/data";
import { notesOgImage, OG_SIZE } from "@/lib/notes-public/og";

export const alt = "Course notes and practice questions on Scribe";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await getCourse(courseId).catch(() => null);
  return notesOgImage({
    eyebrow: "Scribe notes",
    title: course?.title ?? "Course notes",
    subtitle: "Notes and exam-style practice questions by topic",
  });
}
