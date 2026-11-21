import type { Metadata } from "next";
import { NotesLibrary } from "@/components/notes-app/notes-library";

// The signed-in library is the app, not a page for search: the public, indexable notes live at /notes.
export const metadata: Metadata = { title: "Notes", robots: { index: false, follow: false } };

export default function LibraryPage() {
  return <NotesLibrary />;
}
