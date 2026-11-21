import { notesOgImage, OG_SIZE } from "@/lib/notes-public/og";

export const alt = "Scribe: free notes and practice questions";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return notesOgImage({ eyebrow: "Scribe", title: "Free notes and practice questions", subtitle: "IB, AP, GCSE and A-level, topic by topic" });
}
