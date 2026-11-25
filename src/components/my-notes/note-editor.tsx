"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { ScribeEditor, type ScribeEditorHandle } from "@/components/editor/scribe-editor";
import { isDiagramLimit, myNotesApi, myNotesAvailable, MyNotesError, type DiagramFigure, type OwnNote } from "@/lib/api/my-notes";
import { DEFAULT_NOTE_TITLE, docHighlights, ownNoteHref } from "@/lib/my-notes";
import { CalculatorTool } from "@/components/calculator/calculator-tool";
import { track } from "@/lib/funnel";
import { resolveSubjectFamily } from "@/lib/subject-family";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { HighlightsSheet } from "./highlights-list";
import { useNotePersistence } from "./persistence";

/** `/diagram` for any editor on a server that has it: the figure spec, or the server's words on why not. */
export async function createDiagram(description: string): Promise<DiagramFigure> {
  try {
    return (await myNotesApi.diagram(description)).figure;
  } catch (err) {
    if (isDiagramLimit(err) || (err instanceof MyNotesError && err.status < 500)) throw err;
    throw new Error("We couldn't draw that one. Try describing it another way.");
  }
}

/**
 * A student's own note, written on the page (no card): a thin row with the
 * way back to the subject, the title, the saved state and a menu, then the
 * shared editor. The note is private and is saved as it is typed; saving is
 * what keeps it in step as material in the subject.
 */
export function NoteEditor({ workspaceId, noteId }: { workspaceId: string; noteId: string }) {
  const router = useRouter();
  const editor = useRef<ScribeEditorHandle>(null);
  const [note, setNote] = useState<OwnNote | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [title, setTitle] = useState("");
  const [json, setJson] = useState<unknown>(null);
  const [menu, setMenu] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Where the calculator's "Insert" looks for the note's text. */
  const page = useRef<HTMLDivElement>(null);
  const save = useNotePersistence(noteId, note?.version ?? null);

  const fetchNote = useCallback(() => {
    myNotesAvailable()
      .then((ok) => (ok ? myNotesApi.get(noteId) : Promise.reject(new MyNotesError("missing", "NOT_FOUND", 404))))
      .then((n) => {
        setNote(n);
        setTitle(n.title === DEFAULT_NOTE_TITLE ? "" : n.title);
        setJson(n.content);
        setLoad("ready");
        track("notes.own_opened", { from: "subject" }, n.workspaceId || workspaceId);
      })
      .catch((err) => setLoad(err instanceof MyNotesError && err.status === 404 ? "missing" : "error"));
  }, [noteId, workspaceId]);
  useEffect(fetchNote, [fetchNote]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const highlights = useMemo(() => docHighlights(json), [json]);
  const subjectHref = `/workspace/${encodeURIComponent(note?.workspaceId || workspaceId)}`;
  const saveLabel = save.state === "saving" ? "Saving…" : save.state === "offline" ? "Not saved yet" : save.state === "conflict" ? "Changed elsewhere" : "Saved";

  const onTitle = (value: string) => {
    setTitle(value);
    save.changed({ title: value.trim() || DEFAULT_NOTE_TITLE });
  };

  const duplicate = async () => {
    setMenu(false);
    if (busy) return;
    setBusy(true);
    try {
      await save.flush();
      const out = await myNotesApi.duplicate(noteId);
      emitTreeChanged();
      router.push(ownNoteHref(note?.workspaceId || workspaceId, out.noteId));
    } catch (err) {
      toastError(err, "Couldn't duplicate the note");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    setMenu(false);
    const name = (title.trim() || DEFAULT_NOTE_TITLE).replace(/[\\/:*?"<>|]+/g, " ").trim();
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    // The note as one self-contained page: opens in a browser or a word processor, prints to PDF.
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(name)}</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#16161a}table{border-collapse:collapse}td,th{border:1px solid #d5d5dc;padding:6px 10px;text-align:left}mark{background:#ffe08f}mark[data-color=green]{background:#bfeccb}mark[data-color=pink]{background:#ffc7dc}mark[data-color=blue]{background:#bfdcff}img{max-width:100%}figure{margin:1.2em 0;color:#5c5c68}</style></head><body><h1>${esc(name)}</h1>${editor.current?.getHTML() ?? ""}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await myNotesApi.remove(noteId);
      emitTreeChanged();
      toast.success("Note deleted");
      router.replace(subjectHref);
    } catch (err) {
      toastError(err, "Couldn't delete the note");
      setBusy(false);
    }
  };

  if (load !== "ready" || !note) {
    return (
      <div className="mx-auto w-full max-w-[800px] flex-1 px-4 pb-12 pt-4 sm:px-6">
        {load === "loading" ? (
          <div aria-busy="true">
            <div className="h-9 w-2/3 animate-pulse rounded-lg bg-muted" />
            <div className="mt-8 h-5 w-full animate-pulse rounded bg-muted" />
            <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-10 text-center">
            <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-[72px] w-auto" />
            <p className="mt-3 text-read font-extrabold">{load === "missing" ? "We couldn't find that note" : "We couldn't load this note"}</p>
            {load === "error" ? (
              <button
                type="button"
                onClick={() => {
                  setLoad("loading");
                  fetchNote();
                }}
                className="mt-2 min-h-11 text-ui font-bold text-accent hover:underline">
                Try again
              </button>
            ) : (
              <Link href={subjectHref} className="mt-2 inline-flex min-h-11 items-center text-ui font-bold text-accent hover:underline">
                Back to the subject
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  const item = "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-ui font-bold hover:bg-muted";
  return (
    <div ref={page} className="mx-auto w-full max-w-[800px] flex-1 px-4 pb-[calc(3rem+var(--calc-sheet,0px))] sm:px-6" data-own-note={note.id}>
      {/* The thin row: back, title, saved state, menu. No band, no card. */}
      <div className="flex min-h-12 items-center gap-1 pt-1">
        <Link href={subjectHref} className="-ml-2 inline-flex h-11 min-w-0 max-w-[40%] shrink-0 items-center gap-0.5 rounded-xl pl-1 pr-2 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Back to ${note.workspaceTitle || "the subject"}`}>
          <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate max-sm:sr-only">{note.workspaceTitle || "Subject"}</span>
        </Link>
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value.slice(0, 120))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor.current?.focus();
            }
          }}
          placeholder={DEFAULT_NOTE_TITLE}
          aria-label="Note title"
          data-calculator-ignore
          className="h-11 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[17px] font-extrabold text-foreground placeholder:text-faint focus:outline-none"
        />
        <span className="shrink-0 whitespace-nowrap text-caption font-semibold text-muted-foreground" role="status" aria-live="polite">
          <span title="Only you can see this note">Private</span>
          <span aria-hidden="true"> · </span>
          {saveLabel}
        </span>
        <div ref={menuRef} className="relative shrink-0">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Note options" className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="size-5" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-12 z-40 w-[200px] rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
              <button type="button" role="menuitem" className={item} onClick={() => void duplicate()}>
                Duplicate
              </button>
              <button type="button" role="menuitem" className={item} onClick={download}>
                Download
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(item, "text-rose-600")}
                onClick={() => {
                  setMenu(false);
                  setConfirming(true);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {save.state === "conflict" && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 rounded-xl bg-muted px-3.5 py-2.5 text-small font-semibold text-foreground" role="alert">
          This note was changed somewhere else. Reload it to keep editing.
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 font-extrabold text-accent hover:underline">
            Reload
          </button>
        </p>
      )}

      <ScribeEditor
        key={note.id}
        handleRef={editor}
        content={note.content}
        label="Your note"
        placeholder="Start writing, or type / for headings, equations, tables and diagrams"
        editable={save.state !== "conflict"}
        highlighter
        onHighlight={() => track("notes.highlight_added", { from: "note" }, note.workspaceId || workspaceId)}
        createDiagram={createDiagram}
        onChange={(d) => {
          setJson(d.json);
          save.changed({ content: d.json });
        }}
        /*
         * The host's end of the toolbar. "Listen" (record and type live) and
         * "Grade" (the coursework sidebar) go here in later phases, next to
         * Highlights.
         */
        toolbarEnd={
          <>
            {highlights.length > 0 && (
              <button type="button" onClick={() => setListOpen(true)} className="h-11 whitespace-nowrap rounded-[10px] px-2.5 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
                Highlights <span className="tabular-nums text-faint">{highlights.length}</span>
              </button>
            )}
            <CalculatorTool look="text" family={resolveSubjectFamily(null, note.workspaceTitle)} workspaceId={note.workspaceId || workspaceId} scope={page} />
          </>
        }
      />

      {listOpen && (
        <HighlightsSheet
          items={highlights.map((h) => ({ key: String(h.index), text: h.text, color: h.color }))}
          onJump={(key) => editor.current?.showHighlight(Number(key))}
          onRemove={(key) => editor.current?.removeHighlight(Number(key))}
          onClose={() => setListOpen(false)}
        />
      )}

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={() => !busy && setConfirming(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="note-delete-title" className="w-full rounded-t-[24px] border border-border bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 sm:max-w-[420px] sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
            <h2 id="note-delete-title" className="page-h2">
              Delete this note?
            </h2>
            <p className="mt-1.5 text-ui text-muted-foreground">It is removed from {note.workspaceTitle || "the subject"}&apos;s materials too. This can&apos;t be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-11 rounded-[14px] border border-border bg-white px-5 text-[15px] font-bold hover:bg-muted">
                Keep it
              </button>
              <button type="button" disabled={busy} onClick={() => void remove()} className="h-11 rounded-[14px] border border-rose-200 bg-white px-5 text-[15px] font-bold text-rose-600 hover:bg-rose-50">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
