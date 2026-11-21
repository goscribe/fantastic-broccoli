import { getCourse } from "@/lib/notes-public/data";
import { notesOgImage, OG_SIZE } from "@/lib/notes-public/og";
import { resolveSegment } from "@/lib/notes-public/slug";

export const alt = "Topic notes and practice questions on Scribe";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ courseId: string; topicId: string }> }) {
  const { courseId, topicId } = await params;
  const course = await getCourse(courseId).catch(() => null);
  const m = course ? resolveSegment(course.units, topicId) : null;
  const title = !m ? "Topic notes" : m.kind === "unit" ? `${m.unit.code} ${m.unit.name}` : `${m.topic.code} ${m.topic.name}`;
  return notesOgImage({
    eyebrow: course?.title ?? "Scribe notes",
    title,
    subtitle: "Notes + practice questions with worked answers",
  });
}
