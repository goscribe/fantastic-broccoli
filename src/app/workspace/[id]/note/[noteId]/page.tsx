"use client";

import { use } from "react";
import { NoteEditor } from "@/components/my-notes/note-editor";

/** A student's own note in the editor, inside its subject and the app shell. */
export default function OwnNotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = use(params);
  return <NoteEditor workspaceId={decodeURIComponent(id)} noteId={decodeURIComponent(noteId)} />;
}
