"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { SubjectTile } from "@/components/learn/subject-tile";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { UPLOAD_ACCEPT, courseworkApi, importFile, isCourseworkLimit, isMissingEndpoint, type DraftDetail, type GraderStatus, type RubricSummary } from "@/lib/api/coursework";
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
  | { name: string; state: "reading" }
  | { name: string; state: "ready"; documentId: string; words: number; /** The file as the server read it (text, pages, a Word file's HTML): what the count and the preview are made from. */ detail: DraftDetail | null; /** A signed link to the original, for the preview. */ url: string | null }
  | { name: string; state: "failed"; message: string };

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

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUpload({ name: file.name, state: "reading" });
    try {
      const prior = upload?.state === "ready" ? upload.documentId : undefined;
      const out = await importFile(file, { documentId: prior, rubricId: rubric?.id });
      // The file as read (for the count by the component's rules, and the preview); the review does not wait for these.
      const detail = out.draftId ? await courseworkApi.draft(out.draftId).catch(() => null) : null;
      setUpload({ name: file.name, state: "ready", documentId: out.documentId, words: out.wordCount, detail, url: null });
      setPasted("");
      setDeclared(null);
      if (out.draftId && detail?.kind === "file" && (detail.format === "pdf" || detail.format === "docx")) {
        courseworkApi
          .fileUrl(out.draftId)
          .then((link) => setUpload((u) => (u?.state === "ready" && u.documentId === out.documentId ? { ...u, url: link.url } : u)))
          .catch(() => {});
      }
    } catch (err) {
      setUpload({ name: file.name, state: "failed", message: t(importErrorKey(err)) });
    }
  };

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
                      <p className="text-small text-muted-foreground">{t("cw.start.reading", { name: "" }).replace(/\s+…/, "…")}</p>
                    ) : (
                      <>
                        <p className="text-small font-bold tabular-nums text-foreground">{ws.count}</p>
                        {(ws.detail || upload.detail?.pageCount) && <p className="text-small text-muted-foreground">{[pagesLabel(t, upload.detail?.pageCount), ws.detail].filter(Boolean).join(" · ")}</p>}
                      </>
                    )}
                  </div>
                  {upload.state === "ready" && (
                    <button type="button" onClick={() => { setUpload(null); setDeclared(null); }} className="min-h-11 shrink-0 self-start px-1 text-small font-extrabold text-muted-foreground hover:text-foreground">
                      {t("cw.start.remove")}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <textarea
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
                <p className="mt-2 text-small font-semibold text-foreground" role="alert">
                  <span className="font-extrabold">{upload.name}:</span> {upload.message}
                </p>
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
