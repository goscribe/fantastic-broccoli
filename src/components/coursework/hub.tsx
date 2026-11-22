"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { Mascot } from "@/components/rewards/mascot";
import { buttonClass } from "@/components/ui/button";
import { PageHeader, PageShell, SectionTitle } from "@/components/ui/page-header";
import { courseworkApi, isMissingEndpoint, type DocumentSummary, type GraderStatus, type RubricSummary } from "@/lib/api/coursework";
import { componentTitle, familyText, formatBand } from "@/lib/coursework";
import { SAMPLE_CITATIONS, SAMPLE_RESULT, SAMPLE_RUBRIC } from "@/lib/coursework-sample";
import { track } from "@/lib/funnel";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { cn, formatRelativeDate } from "@/lib/utils";
import { BandTrack } from "./band-track";
import { CitationsCard, CriterionCard, TopFixes } from "./feedback";
import { AllowanceGate } from "./grade-panel";
import { ResultSummary } from "./summary";
import { useCw } from "./use-cw";
import { loadRubrics, ultraOffer } from "./use-grader";
import "@/app/coursework/coursework.css";

/** A guide as a tile in its subject's colour: the notes library's look. */
export function GuideTile({ rubric }: { rubric: RubricSummary }) {
  const { t } = useCw();
  const family = resolveSubjectFamily(null, familyText(rubric));
  const title = componentTitle(rubric);
  return (
    <Link href={`/library/coursework/${encodeURIComponent(rubric.key)}`} className="subject-tile course-tile h-full min-h-[148px] p-[18px] sm:p-5" style={familyVars(family) as CSSProperties}>
      <SubjectArt family={family} />
      <span className="subject-tile__text block">
        <span className={cn("subject-tile__title course-tile__title font-extrabold leading-[1.15]", title.length > 22 ? "text-[18px]" : "text-[20px]")}>{title}</span>
        <span className="subject-tile__sub mt-1 block text-[13.5px] font-semibold leading-snug">{t("cw.guide.tile")}</span>
      </span>
      <span className="mt-4 block">
        <span className="subject-pill">
          {t("cw.guide.open")}
          <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** One piece of work: a separate item, so a card. Its last result is drawn on the same track as inside. */
function PieceCard({ doc, rubric }: { doc: DocumentSummary; rubric: RubricSummary | null }) {
  const { t } = useCw();
  const family = resolveSubjectFamily(null, rubric ? familyText(rubric) : doc.title);
  const last = doc.lastReview;
  const running = last?.status === "queued" || last?.status === "grading";
  const marks = last?.status === "completed" && last.marksLow !== null && last.marksHigh !== null && rubric ? { low: last.marksLow, high: last.marksHigh, max: rubric.totalMarks } : null;
  const state = !last || last.status === "failed" ? t("cw.notReviewed") : running ? t("cw.reviewing") : marks ? null : t("cw.feedbackOnly");
  return (
    <Link href={`/coursework/${encodeURIComponent(doc.id)}`} className="life-card life-press flex h-full flex-col p-5" style={familyVars(family) as CSSProperties}>
      <span className="flex items-start gap-3.5">
        <span className="subject-band cw-chip relative size-[52px] shrink-0" aria-hidden>
          <SubjectArt family={family} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-ui font-extrabold leading-snug text-foreground [overflow-wrap:anywhere]">{doc.title}</span>
          <span className="mt-0.5 block text-small text-muted-foreground">
            {[rubric ? componentTitle(rubric) : null, t("cw.words", { n: doc.wordCount.toLocaleString("en-GB") }), t("cw.edited", { when: formatRelativeDate(doc.updatedAt).toLowerCase() })].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </span>
      <span className="mt-auto block pt-4">
        {marks ? (
          <>
            <span className="flex items-baseline justify-between gap-3 text-small">
              <span className="font-bold text-muted-foreground">{t("cw.draftN", { n: last!.draftNumber })}</span>
              <span className="tabular-nums">
                <span className="font-extrabold text-foreground">{formatBand(marks.low, marks.high)}</span>
                <span className="font-semibold text-muted-foreground"> {t("cw.ofMarks", { n: marks.max })}</span>
              </span>
            </span>
            <BandTrack low={marks.low} high={marks.high} max={marks.max} className="mt-2" />
          </>
        ) : (
          <span className="block text-small font-bold text-muted-foreground">
            {last && last.status !== "failed" ? `${t("cw.draftN", { n: last.draftNumber })} · ${state}` : state}
          </span>
        )}
      </span>
    </Link>
  );
}

/**
 * Free: what a review is, shown with a real-looking (made-up, marked
 * "Example") result, and one upgrade action.
 */
function Locked({ ultra }: { ultra: boolean }) {
  const { t } = useCw();
  useEffect(() => {
    track("wall.shown", { reason: "grader", variant: "locked" });
  }, []);
  const family = resolveSubjectFamily(null, "Biology");
  const host = { text: null };
  return (
    <PageShell max="max-w-none" className="cw-scope">
      <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-14" style={familyVars(family) as CSSProperties}>
        <div className="lg:sticky lg:top-[calc(var(--app-top)+16px)] lg:self-start">
          <p className="text-small font-extrabold text-muted-foreground">{t("cw.locked.eyebrow")}</p>
          <h1 className="mt-1.5 text-balance text-[30px] font-extrabold leading-[1.1] tracking-tight sm:text-[36px]">{t("cw.locked.title")}</h1>
          <p className="mt-3 text-read text-foreground/80">{t("cw.locked.sub")}</p>
          <Link href="/pricing" className={buttonClass({ size: "lg", className: "mt-6 w-full sm:w-auto sm:min-w-[280px]" })}>
            {t("cw.locked.cta")}
          </Link>
          <p className="mt-3 text-small font-bold text-muted-foreground">
            {t("cw.locked.ctaSub")}
            {ultra && <> · {t("cw.locked.ultra")}</>}
          </p>
        </div>

        <section className="mt-10 lg:mt-0" aria-labelledby="cw-example">
          <h2 id="cw-example" className="sr-only">
            {t("cw.locked.exampleTitle")}
          </h2>
          <p className="mb-3 text-small font-extrabold text-muted-foreground">{componentTitle(SAMPLE_RUBRIC)} · {t("cw.draftN", { n: 2 })}</p>
          <ResultSummary result={SAMPLE_RESULT} hideMarks={false} fresh={false} example={t("cw.locked.example")} />
          <p className="mt-4 text-ui text-foreground">{SAMPLE_RESULT.overall.summary}</p>
          <div className="mt-8 flex flex-col gap-8">
            <TopFixes result={SAMPLE_RESULT} />
            <div className="grid items-start gap-3 xl:grid-cols-2">
              <CriterionCard criterion={SAMPLE_RESULT.criteria[2]} marked host={host} defaultOpen collapsible={false} />
              <div className="flex flex-col gap-3">
                <CriterionCard criterion={SAMPLE_RESULT.criteria[1]} marked host={host} defaultOpen={false} collapsible={false} />
                <CitationsCard citations={SAMPLE_CITATIONS} host={host} />
              </div>
            </div>
            <p className="text-ui text-muted-foreground">{t("cw.locked.more")}</p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

type Loaded = { status: GraderStatus; rubrics: RubricSummary[]; docs: DocumentSummary[] };

/** Coursework: the student's pieces (each with its latest draft's result), a way to start a new one, and the guides. */
export function CourseworkHub() {
  const { t } = useCw();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<"error" | "unavailable" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    track("grader.opened");
  }, []);
  useEffect(() => {
    let cancelled = false;
    courseworkApi
      .status()
      .then(async (status) => {
        const rubrics = await loadRubrics();
        // A free account has no documents to list (the server refuses to make one).
        const docs = status.reason === "locked" ? [] : await courseworkApi.documents();
        if (!cancelled) setData({ status, rubrics, docs });
      })
      .catch((err) => !cancelled && setFailed(isMissingEndpoint(err) ? "unavailable" : "error"));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (failed) {
    return (
      <PageShell max="max-w-3xl">
        <PageHeader title={t("cw.title")} />
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
  if (!data) {
    return (
      <PageShell>
        <PageHeader title={t("cw.title")} mascot="pencil" subtitle={t("cw.subtitle")} />
        <div className="grid gap-3.5 sm:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-[var(--r-card)] bg-muted" />
          ))}
        </div>
      </PageShell>
    );
  }

  const { status, rubrics, docs } = data;
  if (status.reason === "locked") return <Locked ultra={status.ultraAvailable} />;

  const byId = new Map(rubrics.map((r) => [r.id, r]));
  // The guides for the student's own subjects, then the core everyone writes.
  const guides = [...rubrics.filter((r) => r.suggested), ...rubrics.filter((r) => !r.suggested && r.componentKind !== "internal_assessment")].slice(0, 3);

  return (
    <PageShell className="cw-scope">
      <PageHeader title={t("cw.title")} mascot="pencil" subtitle={t("cw.subtitle")} className="mb-5" />
      <AllowanceGate status={status} ultra={ultraOffer(status)}>
        {(line) => (
          <div className="flex flex-col gap-x-4 gap-y-2 sm:flex-row sm:items-center">
            <Link href="/coursework/new" className={buttonClass({ size: "lg", className: "w-full sm:w-auto sm:min-w-[240px]" })}>
              {t("cw.new")}
            </Link>
            <p className="text-center text-small font-bold text-muted-foreground sm:text-left">{line}</p>
          </div>
        )}
      </AllowanceGate>

      <section className="mt-9" aria-labelledby="cw-yours">
        <SectionTitle id="cw-yours">{t("cw.yourWork")}</SectionTitle>
        {docs.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-9 text-center">
            <Mascot pose="book" className="h-[76px]" />
            <p className="mt-3 text-read font-extrabold">{t("cw.emptyTitle")}</p>
            <p className="mt-1 max-w-[400px] text-ui text-muted-foreground">{t("cw.empty")}</p>
          </div>
        ) : (
          <ul className="grid gap-3.5 sm:grid-cols-2">
            {docs.map((d) => (
              <li key={d.id}>
                <PieceCard doc={d} rubric={d.rubricId ? (byId.get(d.rubricId) ?? null) : null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {guides.length > 0 && (
        <section className="mt-10" aria-labelledby="cw-guides">
          <SectionTitle
            id="cw-guides"
            aside={
              <Link href="/library#lib-coursework" className="text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4">
                {t("cw.guidesAll")}
              </Link>
            }
          >
            {t("cw.guides")}
          </SectionTitle>
          <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((r) => (
              <li key={r.id}>
                <GuideTile rubric={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
