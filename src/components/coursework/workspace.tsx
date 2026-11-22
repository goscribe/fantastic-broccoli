"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MoreHorizontal } from "lucide-react";
import { ScribeEditor, type EditorDoc, type ScribeEditorHandle } from "@/components/editor/scribe-editor";
import { courseworkApi, importFile, isConflict, UPLOAD_ACCEPT, type CourseworkDocument, type ImportFailure } from "@/lib/api/coursework";
import { componentTitle, countWords, familyText, feedbackAnchors, wordStatus } from "@/lib/coursework";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CompareSheet } from "./compare";
import { GradePanel, type PanelView } from "./grade-panel";
import { ResultBand, type BandState } from "./result-band";
import { useCw } from "./use-cw";
import { useGrader, useOnline, useWide } from "./use-grader";
import "@/app/coursework/coursework.css";

type Tab = "feedback" | "doc" | "guide";
type SaveState = "saved" | "saving" | "local" | "conflict";

const backupKey = (id: string) => `scribe.coursework.doc.${id}`;

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
  const [doc, setDoc] = useState<CourseworkDocument | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
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
  const sync = useRef<{ version: number; pending: EditorDoc | null; title: string; rubricId: string | null; timer: ReturnType<typeof setTimeout> | null; saving: Promise<void> | null }>({
    version: 0,
    pending: null,
    title: "",
    rubricId: null,
    timer: null,
    saving: null,
  });

  useEffect(() => {
    let cancelled = false;
    courseworkApi
      .document(documentId)
      .then((d) => {
        if (cancelled) return;
        sync.current.version = d.version;
        sync.current.title = d.title;
        sync.current.rubricId = d.rubricId;
        let content = d.content;
        let plain = d.text;
        // Writing that never reached the server (offline, a closed tab) comes back from this device.
        try {
          const raw = localStorage.getItem(backupKey(documentId));
          const backup = raw ? (JSON.parse(raw) as { version: number; json: unknown; text: string }) : null;
          if (backup && backup.version === d.version && backup.text !== d.text) {
            content = backup.json;
            plain = backup.text;
            sync.current.pending = { json: backup.json, text: backup.text };
          }
        } catch {
          /* no backup */
        }
        setDoc({ ...d, content });
        setTitle(d.title);
        setText(plain);
        setLoadState("ready");
      })
      .catch((err) => !cancelled && setLoadState(err instanceof Error && /not found/i.test(err.message) ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

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
      s.saving = courseworkApi
        .saveDocument({ documentId, baseVersion: s.version, title: s.title, rubricId: s.rubricId, content: pending.json })
        .then((out) => {
          s.version = out.version;
          try {
            localStorage.removeItem(backupKey(documentId));
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
          localStorage.setItem(backupKey(documentId), JSON.stringify({ version: s.version, json: s.pending.json, text: s.pending.text }));
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

  // Back online: send what was kept here.
  useEffect(() => {
    if (online && sync.current.pending) void push();
  }, [online, push]);
  useEffect(() => () => void (sync.current.timer && clearTimeout(sync.current.timer)), []);

  const grader = useGrader({
    documentId: loadState === "ready" ? documentId : null,
    rubricId: doc?.rubricId ?? null,
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
  }

  const anchors = useMemo(() => (review?.status === "completed" ? feedbackAnchors(review.result, review.citations).map((a) => ({ id: a.id, quote: a.quote })) : []), [review]);
  const targets = useMemo(() => new Map((review?.status === "completed" ? feedbackAnchors(review.result, review.citations) : []).map((a) => [a.id, a.target])), [review]);

  const showQuote = (anchorId: string) => {
    setActiveAnchor(anchorId);
    setTab("doc");
    // On a phone the document has to be on screen before it can scroll.
    requestAnimationFrame(() => requestAnimationFrame(() => editor.current?.showAnchor(anchorId)));
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

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (words > 0 && !window.confirm(t("cw.doc.importConfirm"))) return;
    setImportError(null);
    setImporting(file.name);
    try {
      await flush();
      await importFile(file, { documentId });
      const fresh = await courseworkApi.document(documentId);
      sync.current.version = fresh.version;
      sync.current.pending = null;
      editor.current?.setContent(fresh.content);
      setText(fresh.text);
    } catch (err) {
      setImportError(t(importErrorKey(err)));
    } finally {
      setImporting(null);
    }
  };

  const pickFile = () => fileInput.current?.click();
  const menuItem = "flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-ui font-bold text-foreground hover:bg-muted";
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

  if (loadState === "loading") {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6" aria-busy="true">
        <div className="h-[168px] animate-pulse rounded-[var(--r-panel)] bg-muted" />
        <div className="mt-8 h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-muted" />
      </main>
    );
  }
  if (loadState !== "ready" || !doc) {
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
  const band: BandState = grader.running
    ? { kind: "reading" }
    : result?.mode === "marked"
      ? grader.hideMarks
        ? { kind: "hidden" }
        : { kind: "marked", overall: result.overall }
      : result
        ? { kind: "feedback" }
        : { kind: "new" };
  const panelView: PanelView = tab === "guide" ? "guide" : "feedback";
  const tabs: Tab[] = wide ? ["feedback", "guide"] : ["feedback", "doc", "guide"];
  const saveLabel = save === "saving" ? t("cw.doc.saving") : save === "local" ? t("cw.doc.local") : save === "conflict" ? t("cw.err.conflict") : t("cw.doc.saved");

  const tabList = (
    <div role="tablist" aria-label={t("cw.tabs")} className="grid auto-cols-fr grid-flow-col rounded-[14px] bg-muted p-1">
      {tabs.map((id) => {
        const on = wide ? (id === "guide" ? tab === "guide" : tab !== "guide") : tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`cw-tab-${id}`}
            aria-selected={on}
            aria-controls={id === "doc" ? "cw-pane-doc" : "cw-pane-panel"}
            onClick={() => setTab(id)}
            className={cn("min-h-11 rounded-[10px] px-3 text-ui font-extrabold transition-colors", on ? "bg-white text-foreground shadow-[0_1px_2px_rgba(22,22,26,0.12)]" : "text-muted-foreground hover:text-foreground")}
          >
            {t(`cw.tab.${id}`)}
          </button>
        );
      })}
    </div>
  );

  const panel = (
    <GradePanel
      grader={grader}
      text={text}
      words={words}
      view={panelView}
      onShowQuote={showQuote}
      open={open}
      onGuide={onGuide}
      guideFocus={guideFocus}
      onCompare={() => setComparing(true)}
      phone={!wide}
      extraActions={
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(t("cw.act.deleteDocConfirm"))) return;
            void courseworkApi.deleteDocument(documentId).then(() => {
              try {
                localStorage.removeItem(backupKey(documentId));
              } catch {
                /* nothing to clear */
              }
              router.push("/coursework");
            });
          }}
          className="min-h-11 text-small font-extrabold text-muted-foreground hover:text-rose-600"
        >
          {t("cw.act.deleteDoc")}
        </button>
      }
    />
  );

  return (
    <main className="cw-scope mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6" style={familyVars(family) as CSSProperties}>
      <Link href="/coursework" className="text-caption font-semibold text-faint hover:text-accent">
        ← {t("cw.back")}
      </Link>
      <ResultBand
        className="mt-2"
        familyText={rubric ? familyText(rubric) : title}
        eyebrow={review ? t("cw.draftN", { n: review.draftNumber }) : rubric ? `${rubric.board} · ${rubric.sessionLabel}` : t("cw.title")}
        title={rubric ? componentTitle(rubric) : title || t("cw.doc.untitled")}
        state={band}
        fresh={grader.fresh}
      />

      {!wide && <div className="sticky top-[var(--app-top)] z-20 -mx-4 mt-4 bg-white px-4 py-2 sm:-mx-6 sm:px-6">{tabList}</div>}

      <div className="mt-2 lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:gap-10">
        <section id="cw-pane-doc" role={wide ? undefined : "tabpanel"} aria-labelledby={wide ? undefined : "cw-tab-doc"} className={cn("min-w-0", !wide && tab !== "doc" && "hidden")} style={{ ["--se-toolbar-top" as string]: wide ? "var(--app-top)" : "calc(var(--app-top) + 60px)" }}>
          <ScribeEditor
            handleRef={editor}
            content={doc.content}
            label={t("cw.doc.label")}
            placeholder={t("cw.doc.placeholder")}
            anchors={anchors}
            activeAnchor={activeAnchor}
            onAnchorClick={onAnchorClick}
            uploadImage={inlineImage}
            onChange={(d) => {
              setText(d.text);
              schedule(d);
            }}
            toolbarEnd={
              <div className="relative flex items-center gap-1">
                <span className={cn("whitespace-nowrap text-small font-bold tabular-nums", ws.state === "over" ? "text-foreground" : "text-muted-foreground")} title={saveLabel}>
                  {ws.count}
                </span>
                <button type="button" aria-label={t("cw.doc.more")} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="grid size-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="size-5" />
                </button>
                {menuOpen && (
                  <>
                    <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} />
                    <div role="menu" className="se-menu absolute right-0 top-11 z-40 w-[220px]">
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); pickFile(); }} className={menuItem}>
                        {t("cw.doc.import")}
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void copyAll(); }} className={menuItem}>
                        {t("cw.doc.copy")}
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); downloadWord(); }} className={menuItem}>
                        {t("cw.doc.word")}
                      </button>
                    </div>
                  </>
                )}
              </div>
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
          <input ref={fileInput} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }} />
        </section>

        <aside
          id="cw-pane-panel"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : `cw-tab-${tab === "guide" ? "guide" : "feedback"}`}
          aria-label={wide ? t("cw.doc.grade") : undefined}
          className={cn("min-w-0 pt-4 lg:pt-0", !wide && tab === "doc" && "hidden", "lg:sticky lg:top-[calc(var(--app-top)+8px)] lg:max-h-[calc(100dvh-var(--app-top)-24px)] lg:self-start lg:overflow-y-auto lg:pr-1")}
        >
          {wide && <div className="sticky top-0 z-10 mb-6 bg-white pb-2">{tabList}</div>}
          {panel}
        </aside>
      </div>

      {comparing && review && grader.previous && <CompareSheet current={review} previousId={grader.previous.id} onClose={() => setComparing(false)} />}
    </main>
  );
}
