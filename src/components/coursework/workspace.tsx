"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, MoreHorizontal, Plus } from "lucide-react";
import { ScribeEditor, type EditorDoc, type ScribeEditorHandle } from "@/components/editor/scribe-editor";
import { courseworkApi, importFile, isConflict, UPLOAD_ACCEPT, type CourseworkDocument, type DraftDetail, type DraftSummary, type ImportFailure } from "@/lib/api/coursework";
import { SubjectArt } from "@/components/learn/subject-tile";
import { componentTitle, countWords, draftEntries, familyText, feedbackAnchors, locateAnchors, wordStatus } from "@/lib/coursework";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CompareSheet } from "./compare";
import { GradePanel, type PanelView } from "./grade-panel";
import { AskInput, useChat } from "./panel-views";
import type { PdfViewHandle } from "./pdf-view";
import { useCw } from "./use-cw";
import { useGrader, useOnline, useWide } from "./use-grader";
import "@/app/coursework/coursework.css";

/** pdf.js is only fetched when a PDF draft is on screen. */
const PdfView = dynamic(() => import("./pdf-view"), { ssr: false, loading: () => <div className="mx-auto mt-4 aspect-[1/1.414] w-full max-w-[860px] animate-pulse bg-white" aria-busy="true" /> });

type Tab = PanelView | "doc";

const ZOOMS = [0.85, 1, 1.15, 1.3, 1.5];
type SaveState = "saved" | "saving" | "local" | "conflict";

const backupKey = (id: string) => `scribe.coursework.doc.${id}`;

/** A server without drafts (contract v1): the document itself is its one text draft. */
const V1_DRAFT = "v1";
function v1Draft(d: CourseworkDocument): DraftDetail {
  return { id: V1_DRAFT, documentId: d.id, kind: "text", number: 1, title: d.title, wordCount: d.wordCount, createdAt: d.createdAt, updatedAt: d.updatedAt, reviewCount: 0, content: d.content, contentHtml: null, text: d.text, version: d.version };
}

/** A picture kept inside the document: scaled down so the document stays small enough to save. */
async function inlineImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

const IMPORT_ERRORS: Record<ImportFailure, string> = {
  unreadable: "cw.err.unreadable",
  unsupported: "cw.err.unsupported",
  too_large: "cw.err.tooLarge",
  offline: "cw.err.offline",
  failed: "cw.err.upload",
};

export function importErrorKey(err: unknown): string {
  const kind = (err as { kind?: ImportFailure } | null)?.kind;
  return IMPORT_ERRORS[kind ?? "failed"] ?? "cw.err.upload";
}

/**
 * One piece of coursework: the document the student writes in, and the Grade
 * panel beside it (a rail on a desk, a tab on a phone). The band on top is the
 * piece's header in its subject's colour and, once reviewed, the result.
 */
export function CourseworkWorkspace({ documentId }: { documentId: string }) {
  const { t } = useCw();
  const router = useRouter();
  const wide = useWide();
  const online = useOnline();
  const editor = useRef<ScribeEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pdf = useRef<PdfViewHandle>(null);
  /** Which page each quote of a PDF draft is on, as the viewer found them. */
  const [pdfPages, setPdfPages] = useState<Map<string, number>>(new Map());
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertFailed, setConvertFailed] = useState(false);
  const [doc, setDoc] = useState<CourseworkDocument | null>(null);
  /** The draft on the document side: a text draft in the editor, or a file draft shown as itself. */
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [fileUrl, setFileUrl] = useState<{ draftId: string; url: string } | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  /** The document as it is now (tiptap JSON), for finding where each quoted passage sits. */
  const [json, setJson] = useState<unknown>(null);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(false);
  const [mark, setMark] = useState(-1);
  const [save, setSave] = useState<SaveState>("saved");
  const [tab, setTab] = useState<Tab>("doc");
  const [open, setOpen] = useState<{ kind: "criterion"; letter: string } | { kind: "citation"; id: string } | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [guideFocus, setGuideFocus] = useState<{ letter: string; n: number } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // What the server holds, and what is waiting to be saved.
  const sync = useRef<{ version: number; draftId: string; currentDraftId: string | null; pending: EditorDoc | null; title: string; rubricId: string | null; timer: ReturnType<typeof setTimeout> | null; saving: Promise<void> | null }>({
    version: 0,
    draftId: V1_DRAFT,
    currentDraftId: null,
    pending: null,
    title: "",
    rubricId: null,
    timer: null,
    saving: null,
  });

  const firstSave = useRef<string | null>(null);
  /** Puts a draft on the document side (what was being typed in the one before is saved first). */
  const showDraft = useCallback((d: DraftDetail) => {
    const s = sync.current;
    s.draftId = d.id;
    s.version = d.kind === "text" ? d.version : 0;
    s.pending = null;
    let content: unknown = d.kind === "text" ? (d.content ?? d.contentHtml ?? null) : null;
    let plain = d.text;
    // Writing that never reached the server (offline, a closed tab) comes back from this device.
    if (d.kind === "text") {
      try {
        const raw = localStorage.getItem(backupKey(d.id === V1_DRAFT ? d.documentId : d.id));
        const backup = raw ? (JSON.parse(raw) as { version: number; json: unknown; text: string }) : null;
        if (backup && backup.version === d.version && backup.text !== d.text) {
          content = backup.json;
          plain = backup.text;
          s.pending = { json: backup.json, text: backup.text };
        }
      } catch {
        /* no backup */
      }
    }
    // A text draft that arrived as HTML (made from a Word file) is saved as editor content once it is open.
    firstSave.current = d.kind === "text" && !d.content && !!d.contentHtml ? d.id : null;
    setDraft(d.kind === "text" ? { ...d, content, contentHtml: null } : d);
    setJson(content);
    setText(plain);
    setPdfPages(new Map());
    setMark(-1);
    setActiveAnchor(null);
    if (d.kind === "file") {
      courseworkApi
        .fileUrl(d.id)
        .then((out) => setFileUrl({ draftId: d.id, url: out.url }))
        .catch(() => setFileUrl(null));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    courseworkApi
      .document(documentId)
      .then(async (d) => {
        sync.current.title = d.title;
        sync.current.rubricId = d.rubricId;
        sync.current.currentDraftId = d.currentDraftId ?? null;
        // The newest draft opens first: the text version when there is one, else the file as uploaded.
        const newest = [...(d.drafts ?? [])].sort((x, y) => y.number - x.number)[0];
        const first = newest ? await courseworkApi.draft(newest.id) : v1Draft(d);
        if (cancelled) return;
        setDoc(d);
        setTitle(d.title);
        showDraft(first);
        setLoadState("ready");
      })
      .catch((err) => !cancelled && setLoadState(err instanceof Error && /not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [documentId, showDraft]);

  const push = useCallback(async (): Promise<void> => {
    const s = sync.current;
    for (;;) {
      if (s.saving) {
        await s.saving;
        continue;
      }
      const pending = s.pending;
      if (!pending) return;
      s.pending = null;
      setSave("saving");
      let stop = false;
      const draftId = s.draftId;
      // The document's own save covers its current text draft (and its title and component); any other text draft saves by itself and becomes the current one.
      const viaDocument = draftId === V1_DRAFT || draftId === s.currentDraftId;
      const request = viaDocument
        ? courseworkApi.saveDocument({ documentId, baseVersion: s.version, title: s.title, rubricId: s.rubricId, content: pending.json })
        : courseworkApi.saveDraft({ draftId, baseVersion: s.version, content: pending.json });
      s.saving = request
        .then((out) => {
          if (s.draftId === draftId) s.version = out.version;
          if (!viaDocument) s.currentDraftId = draftId;
          try {
            localStorage.removeItem(backupKey(draftId === V1_DRAFT ? documentId : draftId));
          } catch {
            /* nothing to clear */
          }
          setSave(s.pending ? "saving" : "saved");
        })
        .catch((err) => {
          // Kept on this device and sent with the next change (or when back online).
          s.pending ??= pending;
          stop = true;
          setSave(isConflict(err) ? "conflict" : "local");
        })
        .finally(() => {
          s.saving = null;
        });
      await s.saving;
      if (stop) return;
    }
  }, [documentId]);

  const schedule = useCallback(
    (next?: EditorDoc) => {
      const s = sync.current;
      if (next) s.pending = next;
      else s.pending ??= editor.current?.getDoc() ?? null;
      if (s.pending) {
        try {
          localStorage.setItem(backupKey(s.draftId === V1_DRAFT ? documentId : s.draftId), JSON.stringify({ version: s.version, json: s.pending.json, text: s.pending.text }));
        } catch {
          /* storage full: the server save still runs */
        }
      }
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => void push(), 1500);
    },
    [documentId, push],
  );

  const flush = useCallback(async () => {
    const s = sync.current;
    if (s.timer) clearTimeout(s.timer);
    await push();
  }, [push]);

  const openId = draft?.id;
  useEffect(() => {
    if (!openId || firstSave.current !== openId) return;
    const id = setTimeout(() => {
      if (firstSave.current !== openId) return;
      firstSave.current = null;
      const now = editor.current?.getDoc();
      if (now) {
        setJson(now.json);
        schedule(now);
      }
    }, 600);
    return () => clearTimeout(id);
  }, [openId, schedule]);

  // Back online: send what was kept here.
  useEffect(() => {
    if (online && sync.current.pending) void push();
  }, [online, push]);
  useEffect(() => () => void (sync.current.timer && clearTimeout(sync.current.timer)), []);

  const grader = useGrader({
    documentId: loadState === "ready" ? documentId : null,
    rubricId: doc?.rubricId ?? null,
    draftId: draft && draft.id !== V1_DRAFT ? draft.id : null,
    onRubric: (id) => {
      sync.current.rubricId = id;
      setDoc((d) => (d ? { ...d, rubricId: id } : d));
      schedule();
    },
    flush,
  });
  const { review, rubric } = grader;

  // A finished review opens on its feedback (a phone was probably on the document), and so does a piece that already has one.
  const freshId = grader.fresh ? (review?.id ?? null) : null;
  const [seenFresh, setSeenFresh] = useState<string | null>(null);
  if (freshId && seenFresh !== freshId) {
    setSeenFresh(freshId);
    setTab("feedback");
  }
  const [opened, setOpened] = useState(false);
  if (!opened && grader.phase === "ready") {
    setOpened(true);
    if (grader.rows.length > 0) setTab("feedback");
    // The newest draft is on screen; if no review has read it yet (a text version made from a reviewed file), no review is shown with it.
    if (draft && draft.id !== V1_DRAFT && !grader.rows.some((r) => r.draftId === draft.id)) grader.select(null);
  }

  const anchors = useMemo(() => (review?.status === "completed" ? feedbackAnchors(review.result, review.citations).map((a) => ({ id: a.id, quote: a.quote, page: a.page })) : []), [review]);
  const targets = useMemo(() => new Map((review?.status === "completed" ? feedbackAnchors(review.result, review.citations) : []).map((a) => [a.id, a.target])), [review]);

  const showQuote = (anchorId: string) => {
    setActiveAnchor(anchorId);
    setTab("doc");
    // On a phone the document has to be on screen before it can scroll.
    requestAnimationFrame(() => requestAnimationFrame(() => (pdf.current ?? editor.current)?.showAnchor(anchorId)));
  };
  const onAnchorClick = (anchorId: string) => {
    const target = targets.get(anchorId);
    if (!target) return;
    setActiveAnchor(anchorId);
    setOpen({ ...target });
    setTab("feedback");
  };
  const onGuide = (letter: string) => {
    setGuideFocus((p) => ({ letter, n: (p?.n ?? 0) + 1 }));
    setTab("guide");
  };

  const words = useMemo(() => countWords(text), [text]);
  const ws = wordStatus(words, rubric?.wordLimit ?? null);

  /** Opens a draft by id (saving the one on screen first). */
  const openDraft = async (draftId: string) => {
    if (!doc || draftId === draft?.id) return;
    await flush();
    showDraft(await courseworkApi.draft(draftId));
  };

  /** A file added to this piece is a new draft beside the others: nothing already here is replaced. */
  const onImport = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImporting(file.name);
    try {
      await flush();
      await importFile(file, { documentId });
      const fresh = await courseworkApi.document(documentId);
      sync.current.currentDraftId = fresh.currentDraftId ?? null;
      setDoc(fresh);
      const newest = [...(fresh.drafts ?? [])].sort((x, y) => y.number - x.number)[0];
      if (newest) {
        showDraft(await courseworkApi.draft(newest.id));
        grader.select(null);
      } else {
        showDraft(v1Draft(fresh));
      }
    } catch (err) {
      setImportError(t(importErrorKey(err)));
    } finally {
      setImporting(null);
    }
  };

  const pickFile = () => fileInput.current?.click();
  const copyAll = async () => {
    const html = editor.current?.getHTML() ?? "";
    const plain = editor.current?.getDoc()?.text ?? "";
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      toast.success(t("cw.doc.copied"));
    } catch {
      /* clipboard blocked */
    }
  };
  const downloadWord = () => {
    // A Word-readable document (HTML in a .doc): opens in Word, Pages and Google Docs with its headings, lists and tables.
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, "")}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5">${editor.current?.getHTML() ?? ""}</body></html>`;
    const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || t("cw.doc.untitled")).replace(/[^\w\- ]+/g, "").trim() || "coursework"}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Where each quoted passage is, in document order: the location chips, the highlight count and next / previous.
  const format = draft?.kind ?? "text";
  const drafts: DraftSummary[] = useMemo(() => doc?.drafts ?? [], [doc]);
  const fileFormat = draft?.kind === "file" ? (draft.format ?? "other") : null;
  const file = draft?.kind === "file" ? { name: draft.fileName ?? draft.title, format: fileFormat, url: fileUrl?.draftId === draft.id ? fileUrl.url : null } : null;
  // The document side always shows the draft that is open: a file as itself, or text in the editor.
  const source = format;
  const showPdf = source === "file" && fileFormat === "pdf";
  const places = useMemo(() => {
    if (source === "file") return new Map([...pdfPages.entries()].map(([id, n]) => [id, t("cw.place.page", { n })]));
    return new Map([...locateAnchors(json, anchors).entries()].map(([id, section]) => [id, /^Paragraph \d+$/.test(section) ? section : t("cw.place", { section })]));
  }, [source, pdfPages, json, anchors, t]);
  const marks = useMemo(() => [...places.keys()], [places]);
  const entries = useMemo(() => draftEntries(grader.rows, drafts), [grader.rows, drafts]);
  const shownDraft = (review ? entries.find((d) => d.reviewId === review.id) : entries.find((d) => d.reviewId === null && d.draftId === draft?.id)) ?? entries[entries.length - 1];
  const positionOf = (reviewId: string | undefined) => entries.find((d) => d.reviewId === reviewId)?.position ?? 0;
  /** The original to download: the file on screen, or the file this piece came from. */
  const original = draft?.kind === "file" ? draft : (drafts.find((d) => d.kind === "file") ?? null);
  const chat = useChat(documentId, draft && draft.id !== V1_DRAFT ? draft.id : undefined, review?.id);
  const chatOn = grader.status?.chat === true;

  // Esc leaves focus mode.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6" aria-busy="true">
        <div className="h-11 w-64 animate-pulse rounded-[var(--r-control)] bg-muted" />
        <div className="mt-8 h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-muted" />
      </main>
    );
  }
  if (loadState !== "ready" || !doc || !draft) {
    return (
      <main className="mx-auto w-full max-w-[640px] px-4 pb-12 pt-10 sm:px-6">
        <p className="text-read font-extrabold">{loadState === "missing" ? t("cw.missing") : t("cw.loadFailed")}</p>
        <Link href="/coursework" className="mt-2 inline-flex min-h-11 items-center text-ui font-bold text-foreground underline decoration-2 underline-offset-4">
          {t("cw.back")}
        </Link>
      </main>
    );
  }

  const family = resolveSubjectFamily(null, rubric ? familyText(rubric) : title);
  const result = review?.status === "completed" ? review.result : null;
  const panelView: PanelView = tab === "doc" ? "feedback" : tab;
  const panelTabs: PanelView[] = ["feedback", "next", "rubric", "guide", ...(chatOn ? (["chat"] as const) : [])];
  const tabs: Tab[] = wide ? panelTabs : ["feedback", "doc", ...panelTabs.slice(1)];
  const isOn = (id: Tab) => (wide ? panelView === id : tab === id);

  const step = (dir: 1 | -1) => {
    if (marks.length === 0) return;
    const next = (mark + dir + marks.length) % marks.length;
    setMark(next);
    setActiveAnchor(marks[next]);
    requestAnimationFrame(() => (pdf.current ?? editor.current)?.showAnchor(marks[next]));
  };
  const fileWord = t(fileFormat === "pdf" ? "cw.file.pdf" : fileFormat === "docx" || fileFormat === "doc" ? "cw.file.word" : "cw.file.other");
  /** "Edit as text": a new text draft made from this file's text. The file stays as its own draft. */
  const editAsText = async () => {
    if (converting || !draft) return;
    setConverting(true);
    setConvertFailed(false);
    try {
      const made = await courseworkApi.createTextDraft({ documentId, fromDraftId: draft.id });
      const fresh = await courseworkApi.document(documentId);
      sync.current.currentDraftId = fresh.currentDraftId ?? made.draftId;
      setDoc(fresh);
      showDraft(await courseworkApi.draft(made.draftId));
      // Nothing has reviewed the text version yet.
      grader.select(null);
    } catch {
      setConvertFailed(true);
    } finally {
      setConverting(false);
    }
  };
  const downloadOriginal = async () => {
    if (!original) return;
    try {
      const out = await courseworkApi.fileUrl(original.id);
      const a = document.createElement("a");
      a.href = out.url;
      a.download = original.fileName ?? original.title;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch {
      /* the link could not be made: nothing to open */
    }
  };
  const zoomBy = (dir: 1 | -1) => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))] ?? 1);
  const deletePiece = () => {
    if (!window.confirm(t("cw.act.deleteDocConfirm"))) return;
    void courseworkApi.deleteDocument(documentId).then(() => {
      try {
        localStorage.removeItem(backupKey(documentId));
      } catch {
        /* nothing to clear */
      }
      router.push("/coursework");
    });
  };

  const saveLabel = save === "saving" ? t("cw.doc.saving") : save === "local" ? t("cw.doc.local") : save === "conflict" ? t("cw.err.conflict") : t("cw.doc.saved");

  const tabList = (
    <div role="tablist" aria-label={t("cw.tabs")} className="cw-tabs flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`cw-tab-${id}`}
          aria-selected={isOn(id)}
          aria-controls={id === "doc" ? "cw-pane-doc" : "cw-pane-panel"}
          onClick={() => setTab(id)}
          className={cn("cw-tab relative min-h-11 shrink-0 whitespace-nowrap px-3 text-ui font-extrabold transition-colors first:pl-0", isOn(id) ? "cw-tab--on text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {t(`cw.tab.${id}`)}
        </button>
      ))}
    </div>
  );

  const item = (label: string, run: () => void, danger?: boolean) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setMenuOpen(false);
        run();
      }}
      className={cn("flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-ui font-bold hover:bg-muted", danger ? "text-rose-700" : "text-foreground")}
    >
      {label}
    </button>
  );

  const toolBtn = "grid size-11 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35";

  return (
    <main className="cw-scope mx-auto w-full max-w-[1320px] px-4 pb-12 pt-3 sm:px-6 sm:pt-4" style={familyVars(family) as CSSProperties}>
      {/* One thin row: back, what this is, which draft, and the rest behind "More". The subject's colour is only the small chip. */}
      <div className="flex min-h-12 items-center gap-2 sm:gap-3">
        <Link href="/coursework" aria-label={t("cw.back")} title={t("cw.back")} className="-ml-2 grid size-11 shrink-0 place-items-center rounded-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronLeft className="size-5" strokeWidth={2.4} />
        </Link>
        <span className="subject-band cw-chip relative size-9 shrink-0 !rounded-[10px]" aria-hidden>
          <SubjectArt family={family} />
        </span>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold leading-tight text-foreground sm:text-[19px]" title={rubric ? componentTitle(rubric) : title}>
          {rubric ? componentTitle(rubric) : title || t("cw.doc.untitled")}
        </h1>
        {entries.length > 1 ? (
          <div className="relative shrink-0">
            <button type="button" aria-haspopup="menu" aria-expanded={draftsOpen} aria-label={`${t("cw.viewing")}: ${shownDraft?.label ?? ""}`} onClick={() => setDraftsOpen((v) => !v)} className="inline-flex h-11 items-center gap-1.5 rounded-[12px] border border-border bg-white pl-3 pr-2 text-small font-extrabold text-foreground hover:border-border-strong">
              {shownDraft?.label}
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </button>
            {draftsOpen && (
              <>
                <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setDraftsOpen(false)} />
                <div role="menu" aria-label={t("cw.viewing")} className="se-menu absolute right-0 top-12 z-40 w-[280px] max-w-[calc(100vw-32px)]">
                  {entries.map((d) => {
                    const row = d.reviewId ? grader.rows.find((r) => r.id === d.reviewId) : null;
                    const on = d === shownDraft;
                    return (
                      <button
                        key={d.reviewId ?? "new"}
                        type="button"
                        role="menuitemradio"
                        aria-checked={on}
                        onClick={() => {
                          setDraftsOpen(false);
                          grader.select(d.reviewId);
                          if (d.draftId && drafts.some((x) => x.id === d.draftId)) void openDraft(d.draftId);
                        }}
                        className={cn("flex min-h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-[10px] px-3 text-left text-ui font-bold text-foreground hover:bg-muted", on && "bg-muted")}
                      >
                        {d.label}
                        <span className="text-small font-bold tabular-nums text-muted-foreground">
                          {row && row.marksLow !== null && row.marksHigh !== null && !grader.hideMarks ? `${row.marksLow}–${row.marksHigh}` : !d.reviewId ? t("cw.notReviewed") : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          drafts.some((d) => d.kind === "file") && entries[0] && <span className="shrink-0 whitespace-nowrap text-small font-extrabold text-muted-foreground">{entries[0].label}</span>
        )}
        {grader.previous && result?.mode === "marked" && !grader.hideMarks && (
          <button type="button" onClick={() => setComparing(true)} className="hidden min-h-11 shrink-0 text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4 sm:block">
            {t("cw.act.compare", { n: positionOf(grader.previous.id) })}
          </button>
        )}
        <div className="relative shrink-0">
          <button type="button" aria-label={t("cw.top.more")} title={t("cw.top.more")} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="grid size-11 place-items-center rounded-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
            <MoreHorizontal className="size-5" />
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} />
              <div role="menu" className="se-menu absolute right-0 top-12 z-40 w-[240px]">
                {grader.previous && result?.mode === "marked" && !grader.hideMarks && <div className="sm:hidden">{item(t("cw.act.compare", { n: positionOf(grader.previous.id) }), () => setComparing(true))}</div>}
                {result?.mode === "marked" && item(grader.hideMarks ? t("cw.act.showMarks") : t("cw.act.hideMarks"), () => grader.setHideMarks(!grader.hideMarks))}
                {original && item(t("cw.file.download"), () => void downloadOriginal())}
                {item(t("cw.doc.import"), pickFile)}
                {source === "text" && item(t("cw.doc.copy"), () => void copyAll())}
                {source === "text" && item(t("cw.doc.word"), downloadWord)}
                {review &&
                  result &&
                  item(
                    t("cw.act.delete"),
                    () => {
                      if (window.confirm(t("cw.act.deleteConfirm"))) void grader.remove(review.id);
                    },
                    true,
                  )}
                {item(t("cw.act.deleteDoc"), deletePiece, true)}
              </div>
            </>
          )}
        </div>
      </div>

      {!wide && <div className="sticky top-[var(--app-top)] z-20 -mx-4 bg-white px-4 sm:-mx-6 sm:px-6">{tabList}</div>}

      <div className="mt-3 lg:mt-2 lg:grid lg:grid-cols-[minmax(400px,480px)_minmax(0,1fr)] lg:gap-10">
        <aside
          id="cw-pane-panel"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : `cw-tab-${panelView}`}
          aria-label={wide ? t("cw.doc.grade") : undefined}
          className={cn("min-w-0 pt-3 lg:pt-0", !wide && tab === "doc" && "hidden", "lg:sticky lg:top-[calc(var(--app-top)+4px)] lg:max-h-[calc(100dvh-var(--app-top)-16px)] lg:self-start lg:overflow-y-auto lg:pr-2")}
        >
          {wide && <div className="sticky top-0 z-10 mb-5 bg-white">{tabList}</div>}
          <GradePanel
            grader={grader}
            text={text}
            words={words}
            view={panelView}
            onView={setTab}
            onShowQuote={showQuote}
            places={places}
            open={open}
            onGuide={onGuide}
            guideFocus={guideFocus}
            chat={chatOn ? chat : null}
            phone={!wide}
          />
        </aside>

        <section
          id="cw-pane-doc"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : "cw-tab-doc"}
          className={cn("min-w-0", !wide && tab !== "doc" && !focus && "hidden", focus && "cw-focus")}
          style={{ ["--se-toolbar-top" as string]: focus ? "44px" : wide ? "calc(var(--app-top) + 44px)" : "calc(var(--app-top) + 89px)", ["--se-zoom" as string]: zoom }}
        >
          {/* The document's own row: how many passages are marked, stepping through them, zoom, and a focus mode. */}
          <div className={cn("cw-doctools sticky z-20 flex h-11 items-center gap-1 bg-white", focus ? "top-0" : wide ? "top-[var(--app-top)]" : "top-[calc(var(--app-top)+45px)]")}>
            {marks.length > 0 ? (
              <>
                <span className="mr-1 whitespace-nowrap text-small font-extrabold text-foreground" role="status">
                  {marks.length === 1 ? t("cw.doc.highlightsOne") : t("cw.doc.highlights", { n: marks.length })}
                </span>
                <button type="button" className={toolBtn} aria-label={t("cw.doc.prev")} title={t("cw.doc.prev")} onClick={() => step(-1)}>
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" className={toolBtn} aria-label={t("cw.doc.next")} title={t("cw.doc.next")} onClick={() => step(1)}>
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : (
              <span className="whitespace-nowrap text-small font-bold tabular-nums text-muted-foreground">{ws.count}</span>
            )}
            <span className="ml-auto flex items-center">
              {source === "file" && (
                <button type="button" onClick={() => void editAsText()} disabled={converting} title={t("cw.file.editSub", { kind: fileWord })} className="mr-1 inline-flex h-10 shrink-0 items-center rounded-[12px] border border-border bg-white px-3 text-small font-extrabold text-foreground hover:border-border-strong hover:bg-muted disabled:opacity-50">
                  {converting ? t("cw.file.editing") : t("cw.file.edit")}
                </button>
              )}
              <button type="button" className={toolBtn} aria-label={t("cw.doc.zoomOut")} title={t("cw.doc.zoomOut")} disabled={zoom <= ZOOMS[0]} onClick={() => zoomBy(-1)}>
                <Minus className="size-[18px]" />
              </button>
              <span className="w-11 text-center text-small font-bold tabular-nums text-muted-foreground" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" className={toolBtn} aria-label={t("cw.doc.zoomIn")} title={t("cw.doc.zoomIn")} disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => zoomBy(1)}>
                <Plus className="size-[18px]" />
              </button>
              <button type="button" onClick={() => setFocus((v) => !v)} aria-pressed={focus} className="ml-1 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-small font-extrabold text-foreground hover:bg-muted">
                {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                <span className="max-sm:sr-only">{focus ? t("cw.doc.exitFocus") : t("cw.doc.focus")}</span>
              </button>
            </span>
          </div>
          {convertFailed && <p className="pt-3 text-small font-semibold text-rose-700" role="alert">{t("cw.file.editFailed")}</p>}
          {source === "file" && file && (
            <div className="cw-pdf-stage -mx-4 px-4 sm:mx-0 sm:rounded-[var(--r-card)] sm:px-5">
              {showPdf && !file.url ? (
                <div className="mx-auto my-4 aspect-[1/1.414] w-full max-w-[860px] animate-pulse bg-white" aria-busy="true" />
              ) : showPdf && file.url ? (
                <PdfView
                  key={draft!.id}
                  handleRef={pdf}
                  url={file.url}
                  anchors={anchors}
                  activeAnchor={activeAnchor}
                  onAnchorClick={onAnchorClick}
                  onLocated={setPdfPages}
                  zoom={zoom}
                  failed={<OriginalText name={file.name} onDownload={() => void downloadOriginal()} text={text} />}
                />
              ) : (
                <div className="py-4">
                  <OriginalText name={file.name} onDownload={() => void downloadOriginal()} text={text} />
                </div>
              )}
            </div>
          )}
          {draft?.kind === "text" && (
          <div>
          <ScribeEditor
            key={draft.id}
            handleRef={editor}
            content={draft.content}
            label={t("cw.doc.label")}
            placeholder={t("cw.doc.placeholder")}
            anchors={anchors}
            activeAnchor={activeAnchor}
            onAnchorClick={onAnchorClick}
            uploadImage={inlineImage}
            onChange={(d) => {
              setText(d.text);
              setJson(d.json);
              schedule(d);
            }}
            toolbarEnd={
              marks.length > 0 ? (
                <span className={cn("whitespace-nowrap text-small font-bold tabular-nums", ws.state === "over" ? "text-foreground" : "text-muted-foreground")} title={saveLabel}>
                  {ws.count}
                </span>
              ) : undefined
            }
            header={
              <div className="pt-5">
                {(ws.state === "over" || importing || importError || save === "local" || save === "conflict" || !online) && (
                  <div className="mb-4 flex flex-col gap-1.5 text-small font-semibold text-foreground" role="status">
                    {importing && <p>{t("cw.doc.importing", { name: importing })}</p>}
                    {importError && <p role="alert">{importError}</p>}
                    {ws.state === "over" && <p>{ws.note}</p>}
                    {!online ? <p>{t("cw.err.offline")}</p> : save === "local" ? <p>{t("cw.doc.local")}</p> : null}
                    {save === "conflict" && (
                      <p role="alert">
                        {t("cw.err.conflict")}{" "}
                        <button type="button" onClick={() => window.location.reload()} className="font-extrabold underline decoration-2 underline-offset-4">
                          {t("cw.err.reload")}
                        </button>
                      </p>
                    )}
                  </div>
                )}
                {/* A title can run to two lines: the field grows with it (one line where field-sizing is not supported). */}
                <textarea
                  value={title}
                  rows={1}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\s*\n+\s*/g, " ");
                    setTitle(next);
                    sync.current.title = next;
                    schedule();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  aria-label={t("cw.doc.title")}
                  placeholder={t("cw.doc.untitled")}
                  maxLength={120}
                  className="cw-title block w-full resize-none bg-transparent font-extrabold leading-tight tracking-tight text-foreground placeholder:text-faint focus:outline-none"
                />
              </div>
            }
          />
          </div>
          )}
          <input ref={fileInput} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }} />
          {/* Ask about the piece from the document too: the answer opens in Chat. */}
          {chatOn && wide && !focus && panelView !== "chat" && (
            <div className="sticky bottom-3 z-10 mx-auto max-w-[560px]">
              <AskInput
                busy={chat.busy}
                onAsk={(m) => {
                  chat.ask(m);
                  setTab("chat");
                }}
                className="shadow-[0_10px_30px_-18px_rgba(22,22,26,0.45)]"
              />
            </div>
          )}
        </section>
      </div>

      {comparing && review && grader.previous && <CompareSheet current={review} previousId={grader.previous.id} fromDraft={positionOf(grader.previous.id)} toDraft={positionOf(review.id)} onClose={() => setComparing(false)} />}
    </main>
  );
}

/** A file that cannot be drawn here (an old .doc, a PDF that would not open): what it is, a way to get it, and the text found in it. */
function OriginalText({ name, onDownload, text }: { name: string; onDownload: () => void; text: string }) {
  const { t } = useCw();
  return (
    <div className="mx-auto max-w-[760px] bg-white px-5 py-6 sm:px-8">
      <p className="text-read font-extrabold text-foreground">{t("cw.file.cantShow")}</p>
      <p className="mt-1 text-ui text-foreground/80">{t("cw.file.cantShowSub")}</p>
      <button type="button" onClick={onDownload} className="mt-2 inline-flex min-h-11 items-center text-left text-ui font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4 [overflow-wrap:anywhere]">
        {t("cw.file.download")}: {name}
      </button>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-ui text-foreground/85">
        {text
          .split(/\n{2,}/)
          .slice(0, 60)
          .map((para, i) => (
            <p key={i}>{para}</p>
          ))}
      </div>
    </div>
  );
}
