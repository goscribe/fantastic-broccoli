import { rpc } from "./study-session";

export interface NotesTopic {
  title: string;
  summary: string;
  points: string[];
  fileIds: string[];
}

export interface NotesOutline {
  topics: NotesTopic[];
  generatedAt: string;
  fileCount: number;
  /** Set while the server is still writing the outline: `topics` holds the ones finished so far. */
  partial?: boolean;
}

export const fetchNotesOutline = (workspaceId: string) =>
  rpc<NotesOutline | null>("workspace.getNotesOutline", "query", { workspaceId });

export const organizeNotes = (workspaceId: string) =>
  rpc<{ outline: NotesOutline; renamed: number }>("workspace.organizeNotes", "mutation", { workspaceId });
