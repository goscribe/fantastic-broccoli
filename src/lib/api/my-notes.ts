/**
 * Typed client for "My notes" (goscribe/server `myNotes.*`): notes a student
 * writes inside a subject, highlights in any note, and `/diagram`. The router
 * is newer than the published @goscribe/server types, so calls go out as
 * plain tRPC HTTP requests (superjson), like grader.ts. Against a server
 * without it, `myNotesAvailable()` resolves false and every entry stays hidden.
 *
 * Contract: shapes mirror services/notes/own-notes.service.ts,
 * note-highlights.service.ts, note-diagram.service.ts and lib/notes/diagram.ts
 * on the server.
 */
import superjson from "superjson";
import { apiUrl } from "./config";
import { isMissingProcedure } from "@/lib/home-action";

export type NoteVisibility = "private" | "subject";

export interface OwnNoteSummary {
  id: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  visibility: NoteVisibility;
  wordCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  /** The material row that stands for the note in its subject; null while the subject is shared. */
  fileId: string | null;
}

export interface OwnNote extends OwnNoteSummary {
  /** tiptap JSON. */
  content: unknown;
  version: number;
}

export type HighlightColor = "yellow" | "green" | "pink" | "blue";

/** Which note a highlight is in: a Scribe topic note, or a written document. */
export type NoteRef = { kind: "topic"; courseId: string; topicId: string } | { kind: "document"; documentId: string };

export interface HighlightAnchor {
  /** Section id inside the note ("s2"); "" outside any section. */
  sectionId: string;
  quote: string;
  prefix: string;
  suffix: string;
  /** Character offset of the quote inside the section's text when it was made. */
  startOffset: number;
}

export interface NoteHighlight extends HighlightAnchor {
  id: string;
  color: HighlightColor;
  createdAt: Date | string;
}

export interface GraphSpec {
  xLabel: string;
  yLabel: string;
  bounds: { left: number; right: number; bottom: number; top: number };
  expressions: { latex: string; label: string | null }[];
}

export type DiagramLayout = "flow" | "cycle" | "tree";

export interface DiagramSpec {
  layout: DiagramLayout;
  nodes: { id: string; label: string; detail: string | null }[];
  edges: { from: string; to: string; label: string | null }[];
}

export type SketchColor = "blue" | "red" | "green" | "amber" | "violet" | "neutral";

export interface SketchXY {
  x: number;
  y: number;
}

/**
 * A schematic graph as in a textbook (AD–AS, supply and demand, a v–t graph,
 * an energy profile), drawn without numbers on the axes. Coordinates are
 * illustrative, on a canvas the model chose (normally 0–10). Mirrors the
 * server's lib/notes/sketch.ts.
 */
export interface SketchSpec {
  xLabel: string;
  yLabel: string;
  axes: boolean;
  bounds: { left: number; right: number; bottom: number; top: number };
  curves: { id: string; label: string | null; color: SketchColor; dashed: boolean; smooth: boolean; points: SketchXY[] }[];
  /** A guide that is not null is a dashed line to that axis, with that mark ("" for none). */
  points: { label: string | null; x: number; y: number; xGuide: string | null; yGuide: string | null }[];
  marks: { axis: "x" | "y"; at: number; label: string }[];
  arrows: { from: SketchXY; to: SketchXY; label: string | null; double: boolean }[];
  regions: { label: string | null; color: SketchColor; polygon: SketchXY[] | null; between: { upper: string; lower: string | null; from: number; to: number } | null }[];
  texts: { x: number; y: number; text: string }[];
}

/** What a figure block stores and the app draws: a plot (the topic-note graph format), a schematic sketch, or a labelled diagram as data. */
export type DiagramFigure =
  | { kind: "graph"; title: string; caption: string; alt: string; graph: GraphSpec }
  | { kind: "sketch"; title: string; caption: string; alt: string; sketch: SketchSpec }
  | { kind: "diagram"; title: string; caption: string; alt: string; diagram: DiagramSpec };

export interface DiagramStatus {
  tier: "free" | "starter" | "pro" | "ultra" | "other";
  limit: number;
  usedToday: number;
  remainingToday: number;
  resetsAt: Date | string;
}

/** A tRPC error from `myNotes.*`, with its code (CONFLICT, TOO_MANY_REQUESTS, …). */
export class MyNotesError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The server has no `myNotes.*` router (an older deploy). */
export class MyNotesMissing extends Error {}

type Body = {
  result?: { data: Parameters<typeof superjson.deserialize>[0] };
  error?: { message?: string; data?: { code?: string }; json?: { message?: string; data?: { code?: string } } };
} | null;

async function call<T>(kind: "query" | "mutation", path: string, input?: unknown, init?: { keepalive?: boolean }): Promise<T> {
  const url = `${apiUrl}/trpc/myNotes.${path}`;
  const payload = JSON.stringify(superjson.serialize(input ?? null));
  const res =
    kind === "query"
      ? await fetch(input === undefined ? url : `${url}?input=${encodeURIComponent(payload)}`, { credentials: "include" })
      : await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: payload, ...init });
  const body = (await res.json().catch(() => null)) as Body;
  const code = body?.error?.json?.data?.code ?? body?.error?.data?.code;
  const message = body?.error?.json?.message ?? body?.error?.message ?? `myNotes.${path} failed (${res.status})`;
  if (isMissingProcedure(res.status, body) && /no (?:"?(?:query|mutation)"?-)?procedure|No procedure/i.test(message)) throw new MyNotesMissing("myNotes is not deployed");
  if (!res.ok || !body?.result) throw new MyNotesError(message, code, res.status);
  return superjson.deserialize(body.result.data) as T;
}

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export const myNotesApi = {
  /** One subject's notes, or all of them (the library's "Your notes"). `max` = notes a subject can hold. */
  list: (workspaceId?: string) => call<{ notes: OwnNoteSummary[]; max: number }>("query", "list", workspaceId ? { workspaceId } : {}),
  get: (noteId: string) => call<OwnNote>("query", "get", { noteId }),
  create: (input: { workspaceId: string; title?: string; content?: unknown }) => call<{ noteId: string; version: number; fileId: string | null }>("mutation", "create", input),
  /** Autosave: send the version you loaded; a MyNotesError with code CONFLICT means reload. `final` = the editor is closing. */
  save: (input: { noteId: string; baseVersion: number; title?: string; content?: unknown; final?: boolean }, init?: { keepalive?: boolean }) =>
    call<{ version: number; wordCount: number; updatedAt: Date | string }>("mutation", "save", input, init),
  remove: (noteId: string) => call<{ deleted: true }>("mutation", "delete", { noteId }),
  duplicate: (noteId: string) => call<{ noteId: string; version: number; fileId: string | null }>("mutation", "duplicate", { noteId }),

  highlights: (ref: NoteRef) => call<{ highlights: NoteHighlight[]; max: number }>("query", "highlights", { ref }),
  addHighlight: (input: { ref: NoteRef; anchor: HighlightAnchor; color: HighlightColor }) => call<NoteHighlight>("mutation", "addHighlight", input),
  updateHighlight: (input: { highlightId: string; color?: HighlightColor; anchor?: Omit<HighlightAnchor, "quote"> }) => call<NoteHighlight>("mutation", "updateHighlight", input),
  removeHighlight: (highlightId: string) => call<{ removed: boolean }>("mutation", "removeHighlight", { highlightId }),

  diagramStatus: () => call<DiagramStatus>("query", "diagramStatus", { timezone: browserTimezone() }),
  diagram: (description: string) => call<{ figure: DiagramFigure; limit: number; remainingToday: number }>("mutation", "diagram", { description, timezone: browserTimezone() }),
};

let available: Promise<boolean> | null = null;

/**
 * Whether this server has "My notes" (asked once per page load). False on an
 * older deploy or when the check itself fails: every entry point stays hidden
 * and the app reads exactly as before.
 */
export function myNotesAvailable(): Promise<boolean> {
  available ??= myNotesApi
    .diagramStatus()
    .then(() => true)
    .catch((err) => {
      // Signed out or a passing network error is not "this server has no notes": ask again next time.
      if (!(err instanceof MyNotesMissing)) available = null;
      return false;
    });
  return available;
}

export function isConflict(err: unknown): boolean {
  return err instanceof MyNotesError && (err.code === "CONFLICT" || err.status === 409);
}

/** Today's `/diagram` allowance is used up (server DIAGRAM_LIMIT_PREFIX). */
export function isDiagramLimit(err: unknown): boolean {
  return err instanceof MyNotesError && (err.code === "TOO_MANY_REQUESTS" || err.message.startsWith("Diagram limit"));
}
