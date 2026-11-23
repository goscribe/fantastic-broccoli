"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { SubjectTile } from "@/components/learn/subject-tile";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { UPLOAD_ACCEPT, awaitRead, courseworkApi, importFile, isCourseworkLimit, isMissingEndpoint, readAgain, type DraftDetail, type GraderStatus, type ImportedFile, type RubricSummary } from "@/lib/api/coursework";
import { parsePendingRead, readPhase, type PendingRead } from "@/lib/coursework-read";
import { componentTitle, countWords, familyText, rubricLine } from "@/lib/coursework";
import { countWork, type WordBreakdown } from "@/lib/coursework-word-count";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";
import { DraftPreview, pagesLabel } from "./draft-preview";
import { AllowanceGate, ComponentPicker, ModeChoice, loadGuide, rubricSub } from "./grade-panel";
import { useCw } from "./use-cw";
import { loadRubrics, ultraOffer, useOnline, usePreferredMode } from "./use-grader";
import { WordInfo, draftBreakdown, lineFor, rulesOf, saveDeclaredWords } from "./word-count";
import { importErrorKey } from "./workspace";
import "@/app/coursework/coursework.css";

type Upload =
  /** `since`: when the file was stored and reading began (null while it is still being sent). */
  | { name: string; state: "reading"; since: number | null }
  | { name: string; state: "ready"; documentId: string; words: number; /** The file as the server read it (text, pages, a Word file's HTML): what the count and the preview are made from. */ detail: DraftDetail | null; /** A signed link to the original, for the preview. */ url: string | null }
  /** `at`: the stored file, when there is one to read again. */
  | { name: string; state: "failed"; message: string; at: { documentId: string; draftId: string } | null };

/** The upload being read (or read) on this page, kept for the tab so a reload shows it again instead of an empty form. */
const PENDING_KEY = "scribe.coursework.start.upload";
function rememberUpload(v: PendingRead | null) {
  try {
    if (v) sessionStorage.setItem(PENDING_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: a reload starts the form empty */
  }
}

/** Every word counts (a server that only gave a total). */
const plainCount = (words: number): WordBreakdown => ({ total: words, counted: words, notCounted: 0, excluded: {}, method: "text", estimate: true });

/**
 * Starting a review of finished (or nearly finished) work: what it is, how to
 * review it, the work itself, and one button. A piece already in Scribe is
 * continued from the Coursework page instead: its next draft is one tap there.
 */
export function CourseworkStart() {
  const { t } = useCw();
  const router = useRouter();
  const params = useSearchParams();
  const online = useOnline();
  const fileInput = useRef<HTMLInputElement>(null);
  const pasteBox = useRef<HTMLTextAreaElement>(null);
  /** The read being waited for: a newer upload, a retry or "paste instead" makes an older answer irrelevant. */
  const reading = useRef(0);
  const [status, setStatus] = useState<GraderStatus | null>(null);
  const [rubrics, setRubrics] = useState<RubricSummary[] | null>(null);
  const [failed, setFailed] = useState<"error" | "unavailable" | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = usePreferredMode();
  const [pasted, setPasted] = useState("");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [guideMinutes, setGuideMinutes] = useState<{ id: string; minutes: number } | null>(null);
  /** "My word count is ___": used for the limit instead of Scribe's count. */
  const [declared, setDeclared] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const wanted = params.get("rubric");

  useEffect(() => {
    let cancelled = false;
    Promise.all([courseworkApi.status(), loadRubrics()])
      .then(([s, r]) => {
        if (cancelled) return;
        if (s.reason === "locked") return router.replace("/coursework");
        setStatus(s);
        setRubrics(r);
        if (wanted) setPicked((cur) => cur ?? r.find((x) => x.key === wanted || x.id === wanted)?.id ?? null);
      })
      .catch((err) => !cancelled && setFailed(isMissingEndpoint(err) ? "unavailable" : "error"));
    return () => {
      cancelled = true;
    };
  }, [router, wanted, attempt]);

  const rubric = useMemo(() => rubrics?.find((r) => r.id === picked) ?? null, [rubrics, picked]);

  // The guide's reading time, for the line under the chosen component.
  useEffect(() => {
    if (!rubric) return;
    let cancelled = false;
    loadGuide(rubric.id)
      .then((g) => {
        if (cancelled || !g.guide) return;
        const words = countWords([g.guide.objectiveLine, ...g.guide.sections.flatMap((s) => [s.heading, JSON.stringify(s.blocks)])].join(" "));
        setGuideMinutes({ id: rubric.id, minutes: Math.max(2, Math.round(words / 220)) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rubric]);

  /** The file is read: show it (its count and preview), and fetch what the preview needs. */
  const showRead = async (name: string, out: ImportedFile) => {
    // The file as read (for the count by the component's rules, and the preview); the review does not wait for these.
    const detail = out.detail ?? (out.draftId ? await courseworkApi.draft(out.draftId).catch(() => null) : null);
    setUpload({ name, state: "ready", documentId: out.documentId, words: out.wordCount, detail, url: null });
    setPasted("");
    setDeclared(null);
    if (out.draftId && detail?.kind === "file" && (detail.format === "pdf" || detail.format === "docx")) {
      courseworkApi
        .fileUrl(out.draftId)
        .then((link) => setUpload((u) => (u?.state === "ready" && u.documentId === out.documentId ? { ...u, url: link.url } : u)))
        .catch(() => {});
    }
  };

  const showFailed = (name: string, err: unknown) => {
    const e = err as { documentId?: string; draftId?: string } | null;
    const at = e?.documentId && e.draftId ? { documentId: e.documentId, draftId: e.draftId } : null;
    // A file that could not be read is not offered again after a reload; one whose read can be retried is.
    if (!at) rememberUpload(null);
    setUpload({ name, state: "failed", message: t(importErrorKey(err)), at });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const mine = ++reading.current;
    setUpload({ name: file.name, state: "reading", since: null });
    try {
      const prior = upload?.state === "ready" ? upload.documentId : undefined;
      const out = await importFile(file, {
        documentId: prior,
        rubricId: rubric?.id,
        onUploaded: (at) => {
          if (mine !== reading.current) return;
          const since = Date.now();
          setUpload((u) => (u?.state === "reading" ? { ...u, since } : u));
          if (at.draftId) rememberUpload({ documentId: at.documentId, draftId: at.draftId, name: file.name, since });
        },
      });
      if (mine === reading.current) await showRead(file.name, out);
    } catch (err) {
      if (mine === reading.current) showFailed(file.name, err);
    }
  };

  /** Reads the stored file again after a failure. */
  const retry = async () => {
    if (upload?.state !== "failed") return;
    if (!upload.at) return fileInput.current?.click();
    const { name, at } = upload;
    const since = Date.now();
    const mine = ++reading.current;
    setUpload({ name, state: "reading", since });
    rememberUpload({ ...at, name, since });
    try {
      const out = await readAgain(at);
      if (mine === reading.current) await showRead(name, out);
    } catch (err) {
      if (mine === reading.current) showFailed(name, err);
    }
  };

  const clearUpload = () => {
    reading.current++;
    rememberUpload(null);
    setUpload(null);
    setDeclared(null);
  };

  // After a reload: the upload this tab was reading (or had read) comes back, and the wait carries on.
  useEffect(() => {
    let pending: PendingRead | null = null;
    try {
      pending = parsePendingRead(sessionStorage.getItem(PENDING_KEY), Date.now());
    } catch {
      /* no storage */
    }
    if (!pending) return;
    const { documentId, draftId, name, since } = pending;
    const ctl = new AbortController();
    const mine = ++reading.current;
    const current = () => !ctl.signal.aborted && mine === reading.current;
    // Restoring what this tab remembers is the point of the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUpload((u) => u ?? { name, state: "reading", since });
    (async () => {
      try {
        const draft = await courseworkApi.draft(draftId);
        if (!current()) return;
        // Never stored (the tab closed mid-upload): nothing to wait for.
        if (draft.status === "uploading") {
          rememberUpload(null);
          return setUpload((u) => (u?.state === "reading" && u.name === name ? null : u));
        }
        const out = await awaitRead({ documentId, draftId }, { documentId, draftId, importStatus: null, status: draft.status ?? "ready", error: draft.error, draft }, { signal: ctl.signal, startedAt: since });
        if (current()) await showRead(name, out);
      } catch (err) {
        if (!current()) return;
        const kind = (err as { kind?: string } | null)?.kind;
        // The piece is gone (deleted elsewhere): start empty.
        if (!kind) {
          rememberUpload(null);
          return setUpload((u) => (u?.state === "reading" && u.name === name ? null : u));
        }
        showFailed(name, err);
      }
    })();
    return () => ctl.abort();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While a file is being read the card says how it is going; the clock only runs then.
  const readingSince = upload?.state === "reading" ? upload.since : undefined;
  const [readingFor, setReadingFor] = useState(0);
  useEffect(() => {
    if (readingSince === undefined) return;
    const tick = () => setReadingFor(readingSince === null ? 0 : Date.now() - readingSince);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [readingSince]);
  const phase = readPhase(readingSince !== null && readingSince !== undefined, readingFor);

  // Counted the way the board counts for this component: a separate pass over the work, nothing is removed from it.
  const rules = useMemo(() => rulesOf(rubric), [rubric]);
  const breakdown = useMemo<WordBreakdown>(() => {
    if (upload?.state === "ready") return upload.detail ? draftBreakdown(upload.detail, rules) : plainCount(upload.words);
    return { ...countWork({ text: pasted }, rules), estimate: false };
  }, [upload, pasted, rules]);
  const words = breakdown.total;
  const ws = lineFor(breakdown, rules, declared);
  const ready = !!rubric && (ws.state === "ok" || ws.state === "over") && upload?.state !== "reading" && online;

  const submit = async (review: boolean) => {
    if (!rubric || busy) return;
    setBusy(true);
    setError(null);
    try {
      let documentId = upload?.state === "ready" ? upload.documentId : null;
      if (!documentId) {
        const title = pasted.trim().split(/\n/)[0]?.trim().slice(0, 80) || componentTitle(rubric);
        documentId = (await courseworkApi.createDocument({ title: review ? title : componentTitle(rubric), rubricId: rubric.id, text: pasted })).documentId;
      }
      const mine = rules.kind === "words" && declared ? declared : null;
      saveDeclaredWords(documentId, mine);
      rememberUpload(null);
      if (review) await courseworkApi.requestReview({ documentId, rubricId: rubric.id, mode, ...(mine ? { declaredWords: mine } : {}) });
      router.push(`/coursework/${encodeURIComponent(documentId)}`);
    } catch (err) {
      if (isCourseworkLimit(err)) setLimitHit(true);
      else setError(err instanceof Error && err.message && !/fetch|network/i.test(err.message) ? err.message : t("cw.err.request"));
      setBusy(false);
    }
  };

  const header = <PageHeader back={{ href: "/coursework", label: t("cw.back") }} title={t("cw.start.title")} />;

  if (failed) {
    return (
      <PageShell max="max-w-3xl">
        {header}
        <p className="text-ui text-foreground/80" role="alert">
          {t(failed === "unavailable" ? "cw.unavailable" : "cw.loadFailed")}
        </p>
        {failed === "error" && (
          <button type="button" onClick={() => { setFailed(null); setAttempt((n) => n + 1); }} className="mt-1 min-h-11 text-ui font-extrabold underline decoration-2 underline-offset-4">
            {t("cw.retry")}
          </button>
        )}
      </PageShell>
    );
  }
  if (!status || !rubrics) {
    return (
      <PageShell max="max-w-3xl">
        {header}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-[var(--r-card)] bg-muted" />
          ))}
        </div>
      </PageShell>
    );
  }

  const family = rubric ? resolveSubjectFamily(null, familyText(rubric)) : null;

  return (
    <PageShell max="max-w-3xl" className="cw-scope">
      <div style={family ? (familyVars(family) as CSSProperties) : undefined}>
        {header}

        <section aria-labelledby="cw-what">
          <h2 id="cw-what" className="page-h2">
            {t("cw.start.what")}
          </h2>
          {rubric ? (
            <div className="mt-3">
              <SubjectTile
                row
                title={componentTitle(rubric)}
                match={familyText(rubric)}
                sub={rubricSub(rubric)}
                onClick={() => setPicked(null)}
                trailing={<span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white px-3 py-1.5 text-small font-extrabold text-[var(--tile-a)]">{t("cw.start.change")}</span>}
              />
              <Link href={`/library/coursework/${encodeURIComponent(rubric.key)}`} className="group mt-1 flex min-h-12 items-center justify-between gap-3 border-b border-border py-2">
                <span className="min-w-0">
                  <span className="block text-ui font-extrabold text-foreground group-hover:underline">{t("cw.start.guide", { name: componentTitle(rubric) })}</span>
                  {guideMinutes?.id === rubric.id && <span className="block text-small text-muted-foreground">{t("cw.start.guideSub", { n: guideMinutes.minutes })}</span>}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <ComponentPicker rubrics={rubrics} onPick={(r) => setPicked(r.id)} />
            </div>
          )}
        </section>

        {rubric && (
          <>
            <section className="mt-9" aria-labelledby="cw-how">
              <h2 id="cw-how" className="page-h2">
                {t("cw.start.how")}
              </h2>
              <div className="mt-3">
                <ModeChoice mode={mode} onChange={setMode} />
              </div>
            </section>

            <section className="mt-9" aria-labelledby="cw-work">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="cw-work" className="page-h2">
                  {t("cw.start.work")}
                </h2>
                {words > 0 && !upload && <span className="text-small font-bold tabular-nums text-muted-foreground">{ws.count}</span>}
              </div>

              {upload && upload.state !== "failed" ? (
                <div className="mt-3 flex min-h-[96px] items-center gap-3.5 rounded-[var(--r-card)] border border-border px-4 py-3" role="status">
                  {upload.state === "ready" ? (
                    <DraftPreview
                      key={upload.documentId}
                      name={upload.name}
                      format={upload.detail?.kind === "file" ? (upload.detail.format === "pdf" ? "pdf" : upload.detail.format === "docx" ? "docx" : upload.detail.format === "txt" ? "text" : "other") : "other"}
                      url={upload.url}
                      html={upload.detail?.kind === "file" ? upload.detail.contentHtml : null}
                      text={upload.detail?.text}
                      width={52}
                      onOpen={() => router.push(`/coursework/${encodeURIComponent(upload.documentId)}`)}
                    />
                  ) : (
                    <span className="cw-thumb block h-[74px] w-[52px] shrink-0 animate-pulse rounded-[6px] bg-muted" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui font-extrabold text-foreground">{upload.name}</p>
                    {upload.state === "reading" ? (
                      <p className="text-small text-muted-foreground" aria-live="polite">
                        {t(phase === "uploading" ? "cw.start.uploading" : phase === "slow" ? "cw.start.readingSlow" : "cw.start.readingFile")}
                      </p>
                    ) : (
                      <>
                        <p className="text-small font-bold tabular-nums text-foreground">{ws.count}</p>
                        {(ws.detail || upload.detail?.pageCount) && <p className="text-small text-muted-foreground">{[pagesLabel(t, upload.detail?.pageCount), ws.detail].filter(Boolean).join(" · ")}</p>}
                      </>
                    )}
                  </div>
                  {upload.state === "reading" && phase === "slow" && (
                    <button type="button" onClick={() => { clearUpload(); requestAnimationFrame(() => pasteBox.current?.focus()); }} className="min-h-11 shrink-0 self-start px-1 text-small font-extrabold text-muted-foreground hover:text-foreground">
                      {t("cw.start.pasteInstead")}
                    </button>
                  )}
                  {upload.state === "ready" && (
                    <button type="button" onClick={clearUpload} className="min-h-11 shrink-0 self-start px-1 text-small font-extrabold text-muted-foreground hover:text-foreground">
                      {t("cw.start.remove")}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <textarea
                    ref={pasteBox}
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    aria-label={t("cw.start.paste")}
                    placeholder={t("cw.start.pastePlaceholder")}
                    className="mt-3 block min-h-[168px] w-full resize-y rounded-[var(--r-card)] border border-border bg-white px-4 py-3.5 text-ui text-foreground placeholder:text-faint focus:border-border-strong focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="mt-2.5 flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[var(--r-card)] border-2 border-dashed border-border px-4 py-2.5 text-left hover:border-border-strong"
                  >
                    <span>
                      <span className="block text-ui font-extrabold text-foreground">{t("cw.start.upload")}</span>
                      <span className="block text-small text-muted-foreground">{t("cw.start.uploadSub")}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </>
              )}
              <input ref={fileInput} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }} />
              {upload?.state === "failed" && (
                <div className="mt-2" role="alert">
                  <p className="text-small font-semibold text-foreground">
                    <span className="font-extrabold">{upload.name}:</span> {upload.message}
                  </p>
                  <div className="flex flex-wrap gap-x-5">
                    <button type="button" onClick={() => void retry()} className="min-h-11 text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4">
                      {t(upload.at ? "cw.start.readAgain" : "cw.start.replace")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearUpload();
                        pasteBox.current?.focus();
                      }}
                      className="min-h-11 text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4"
                    >
                      {t("cw.start.pasteInstead")}
                    </button>
                  </div>
                </div>
              )}
              {words > 0 && upload?.state !== "reading" && (
                <WordInfo className="mt-2" status={ws} breakdown={breakdown} rules={rules} declared={declared} onDeclared={setDeclared} uncertain={rubric.status === "draft" || rules.fallback} showCount={false} showDetail={!upload} />
              )}
            </section>

            <section className="mt-8 border-t border-border pt-6" aria-label={t("cw.start.review")}>
              <AllowanceGate status={status} ultra={ultraOffer(status)} limitHit={limitHit}>
                {(line) => (
                  <>
                    <div className="flex flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-center">
                      <Button size="lg" disabled={!ready || busy} onClick={() => void submit(true)} className="w-full sm:w-auto sm:min-w-[240px]">
                        {busy ? t("cw.review.busy") : t("cw.start.review")}
                      </Button>
                      <p className="text-center text-small font-bold text-muted-foreground sm:text-left">{line}</p>
                    </div>
                    {/* The button is off while the file is read: say so, and when it will come on. */}
                    {upload?.state === "reading" && <p className="mt-2 text-small font-semibold text-foreground" role="status">{t(phase === "slow" ? "cw.start.waitReadSlow" : "cw.start.waitRead")}</p>}
                    {!online && <p className="mt-2 text-small font-semibold text-foreground" role="status">{t("cw.err.offline")}</p>}
                    {error && <p className="mt-2 text-small font-semibold text-rose-700" role="alert">{error}</p>}
                  </>
                )}
              </AllowanceGate>
              <p className="mt-4 text-small text-muted-foreground">
                {t(mode === "feedback" ? "cw.rubric.usesFeedback" : "cw.rubric.uses", { line: rubricLine(rubric) })}
                {rubric.status === "draft" && <> · {t("cw.rubric.draft")}</>}
              </p>
              <p className="mt-1 text-small text-muted-foreground">{t("cw.start.promise")}</p>
              <button type="button" disabled={busy} onClick={() => void submit(false)} className={cn("mt-2 min-h-11 text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4", busy && "opacity-50")}>
                {t("cw.start.write")}
              </button>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
