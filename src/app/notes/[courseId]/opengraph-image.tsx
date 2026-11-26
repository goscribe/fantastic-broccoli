import { publicNotesApi } from "@/lib/api/public-notes";
import { notesOgImage, OG_SIZE } from "@/lib/notes-public/og";

/**
 * One share card per course, drawn at build time and served as a static file
 * until the next deploy; the course's unit and topic pages use it too (they
 * have no image of their own). Nothing here may render at request time: next/og
 * holds hundreds of MB of native memory per process (see og.tsx).
 */
export const alt = "Course notes and practice questions on Scribe";
export const size = OG_SIZE;
export const contentType = "image/png";
// Never regenerated at request time; an unknown course gets a 404, not a render.
export const dynamicParams = false;
export const revalidate = false;

// Cached until the next deploy (not the pages' hourly revalidate), so the route stays static.
const courses = () => publicNotesApi.courses({ revalidate: false });

export async function generateStaticParams() {
  // API down at build: no course cards this deploy (pages still render, just without an image).
  const list = await courses().catch(() => []);
  return list.map((c) => ({ courseId: c.id }));
}

export default async function Image({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = (await courses().catch(() => [])).find((c) => c.id === courseId);
  return notesOgImage({
    eyebrow: "Scribe notes",
    title: course?.title ?? "Course notes",
    subtitle: "Notes and exam-style practice questions by topic",
  });
}
