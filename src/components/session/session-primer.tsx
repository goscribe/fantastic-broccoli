"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PlayActions, PlayPrimary } from "@/components/session/play-ui";
import { FigureView, ReadingBody, readingNeedsLead } from "@/components/session/reading-activity";
import { PublicFigure } from "@/components/notes-public/public-figure";
import { InlineMarkdown as MathText } from "@/components/ui/markdown-text";
import { HtmlWidget } from "@/components/interactive/html-widget";
import { notesApi, type NoteFigure } from "@/lib/api/notes";
import { studySessionApi } from "@/lib/api/study-session";
import { parseExpression } from "@/lib/latex-eval";
import { noteHref } from "@/lib/notes";
import {
  notePrimer,
  parseCourseTopics,
  primerPlan,
  readingPoints,
  sessionPath,
  type MaterialPrimer,
  type NotePrimer,
  type PrimerPlan,
} from "@/lib/start-check";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/start-check";
import type { ReadingContent, ReadingFigure, StudySession } from "@/types";

/** A mixed session shows the notes of its first topics, not all twenty. */
const MAX_PRIMER_TOPICS = 3;
const DONE_PREFIX = "scribe.primer.done.";

function wasDone(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(DONE_PREFIX + sessionId) === "1";
  } catch {
    return false;
  }
}

export interface SessionPrimerState {
  /** "loading": deciding (show nothing else yet); "open": show <SessionPrimer/>; "closed": the session as usual. */
  state: "closed" | "loading" | "open";
  plan: PrimerPlan;
  notes: NotePrimer[];
  material: MaterialPrimer | null;
  confidence: number | null;
  dismiss: () => void;
}

/**
 * Whether a session opens on the notes-first (or recap) screen, and with
 * what. Only before any work is done in it, only when the learner rated
 * their confidence at the start, and once per session per browser.
 */
export function useSessionPrimer(session: StudySession | undefined): SessionPrimerState {
  const sessionId = session?.id ?? "";
  const [dismissed, setDismissed] = useState<string | null>(null);
  const confidence = typeof session?.confidenceBefore === "number" ? session.confidenceBefore : null;
  const path = sessionPath(confidence);
  const untouched =
    !!session &&
    session.status !== "completed" &&
    session.status !== "failed" &&
    session.activities.every((a) => a.status === "pending");
  const eligible = untouched && path !== "questions" && dismissed !== sessionId && typeof window !== "undefined" && !wasDone(sessionId);
  const topics = useMemo(() => parseCourseTopics(session?.courseTopic), [session?.courseTopic]);

  const notesQuery = useQuery({
    queryKey: ["session-primer-notes", sessionId, path],
    enabled: eligible && !!topics,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<NotePrimer[]> => {
      if (!topics || path === "questions") return [];
      const notes = await Promise.all(topics.topicIds.slice(0, MAX_PRIMER_TOPICS).map((id) => notesApi.get(topics.courseId, id).catch(() => null)));
      return notes.flatMap((n) => (n?.content ? [notePrimer(n.content, path)] : []));
    },
  });
  const notes = topics ? notesQuery.data : EMPTY;
  const noteLeads = !!notes?.some((n) => n.figures.length > 0);

  // The learner's own material: asked for only when Scribe's note does not lead.
  const materialQuery = useQuery({
    queryKey: ["session-primer-material", sessionId],
    enabled: eligible && notes !== undefined && !noteLeads,
    retry: false,
    queryFn: () => studySessionApi.getPrimer(sessionId).catch(() => null),
    // A note being written from the material: look again until it is there.
    refetchInterval: (q) => (q.state.data?.status === "preparing" ? 5000 : false),
  });
  const material = noteLeads ? null : (materialQuery.data ?? null);
  const loading = eligible && (notes === undefined || (!noteLeads && materialQuery.data === undefined && !materialQuery.isError));
  const plan: PrimerPlan = !eligible || loading ? { kind: "none" } : primerPlan({ path, notes: notes ?? [], material });

  const dismiss = useCallback(() => {
    setDismissed(sessionId);
    try {
      window.localStorage.setItem(DONE_PREFIX + sessionId, "1");
    } catch {
      // Storage blocked: the screen may show once more on a reload.
    }
  }, [sessionId]);

  return {
    state: !eligible ? "closed" : loading ? "loading" : plan.kind === "none" ? "closed" : "open",
    plan,
    notes: notes ?? [],
    material,
    confidence,
    dismiss,
  };
}

const EMPTY: NotePrimer[] = [];

const staticGraphOk = (f: NoteFigure) => !!f.graph && f.graph.expressions.length > 0 && f.graph.expressions.every((e) => parseExpression(e.latex) !== null);

/** One figure: the drawing in a frame, its caption on the page below it. */
function PrimerFigure({ figure, n }: { figure: NoteFigure; n: number }) {
  const { t } = useI18n();
  return (
    <figure className="flex flex-col gap-2.5">
      <div className="overflow-hidden rounded-[var(--r-card,20px)] border border-border bg-card [&>div]:!rounded-none [&>div]:!border-0">
        {/* An HTML figure is drawn bare: this frame is its only box. */}
        {figure.kind === "html" && figure.html ? (
          <div role="img" aria-label={figure.alt || figure.title}>
            <HtmlWidget html={figure.html} surface="reading_figure" bare />
          </div>
        ) : (
          <PublicFigure figure={figure} staticGraph={staticGraphOk(figure)} />
        )}
      </div>
      <figcaption className="px-1 text-ui text-muted-foreground">
        <b className="font-extrabold text-foreground">{t("primer.figure").replace("{n}", String(n))}</b> <MathText text={figure.caption || figure.title} />
      </figcaption>
    </figure>
  );
}

function Points({ points }: { points: string[] }) {
  const { t } = useI18n();
  if (!points.length) return null;
  return (
    <section aria-label={t("primer.points")}>
      <h2 className="text-small font-extrabold text-muted-foreground">{t("primer.points")}</h2>
      <ol className="mt-2.5 flex flex-col gap-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3 text-read text-foreground">
            <span className="mt-[3px] grid size-6 shrink-0 place-items-center rounded-full bg-muted text-caption font-extrabold tabular-nums" aria-hidden>
              {i + 1}
            </span>
            <span className="min-w-0">
              <MathText text={p} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A Scribe topic note, cut to its pictures: figures and captions, the opening explanation, key terms. */
function NoteView({ primer, path, showName, first }: { primer: NotePrimer; path: "notes" | "recap"; showName: boolean; first: number }) {
  const { t } = useI18n();
  const [lead, ...rest] = primer.figures;
  return (
    <section className="flex flex-col gap-5" data-primer-topic={primer.topicId}>
      {showName && <h2 className="text-[20px] font-extrabold leading-tight text-foreground">{primer.topicName}</h2>}
      {/* The picture first, then the words that explain it. */}
      {lead && <PrimerFigure figure={lead} n={first} />}
      {primer.lead && (
        <p className="text-[18px] leading-[1.6] text-foreground">
          <MathText text={primer.lead} />
        </p>
      )}
      {rest.map((f, i) => (
        <PrimerFigure key={f.id} figure={f} n={first + 1 + i} />
      ))}
      <Points points={primer.points} />
      {primer.terms.length > 0 && (
        <section aria-label={t("primer.keyTerms")}>
          <h2 className="text-small font-extrabold text-muted-foreground">{t("primer.keyTerms")}</h2>
          {/* Separate items, so each gets its own card. */}
          <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {primer.terms.map((k) => (
              <div key={k.term} className="rounded-[var(--r-button,16px)] border border-border bg-card px-4 py-3">
                <dt className="text-ui font-extrabold text-foreground">
                  <MathText text={k.term} />
                </dt>
                <dd className="mt-1 text-ui text-muted-foreground">
                  <MathText text={k.definition} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {path === "notes" && (
        <Link href={noteHref(primer.courseId, primer.topicId)} target="_blank" className="w-fit text-ui font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
          {t("primer.fullNote")}
        </Link>
      )}
    </section>
  );
}

/** The learner's own material: its images first, then the reading written from it (figure and explanation before any bullets). */
function MaterialView({ material, path }: { material: MaterialPrimer; path: "notes" | "recap" }) {
  const { t } = useI18n();
  const images = material.images.map((img) => <FigureView key={img.id} figure={img as ReadingFigure} />);
  const reading = material.reading;
  if (path === "recap") {
    const own = (reading?.figures ?? []).slice(0, 2) as ReadingFigure[];
    return (
      <div className="flex flex-col gap-5">
        {own.length ? own.map((f) => <FigureView key={f.id} figure={f} />) : images.slice(0, 2)}
        <Points points={reading ? readingPoints(reading.text) : []} />
      </div>
    );
  }
  const content: ReadingContent | null = reading ? { type: "reading", text: reading.text, figures: reading.figures as ReadingFigure[], completed: false } : null;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-small font-extrabold text-muted-foreground">{t("primer.fromYourNotes")}</p>
      {content ? <ReadingBody content={content} visualFirst lead={images.length ? <>{images}</> : undefined} className="!mx-0 !max-w-[70ch]" /> : images}
    </div>
  );
}

/**
 * What a learner who is not confident sees before the questions: the notes,
 * pictures first ("notes"), or a one-minute recap ("recap"). One primary
 * action starts the questions.
 */
export function SessionPrimer({
  plan,
  notes,
  material,
  confidence,
  title,
  generating = false,
  onStart,
}: {
  plan: PrimerPlan;
  notes: NotePrimer[];
  material: MaterialPrimer | null;
  confidence: number | null;
  /** The session's title, for a session on the learner's own material. */
  title: string;
  /** The questions are still being written (the wait is spent reading). */
  generating?: boolean;
  onStart: () => void;
}) {
  const { t } = useI18n();
  if (plan.kind === "none") return null;
  const path = plan.kind === "preparing" ? "notes" : plan.path;
  const shown = plan.kind === "note" ? notes.filter((n) => n.figures.length > 0 || n.lead.trim()) : [];
  const topic = shown.length === 1 ? shown[0].topicName : plan.kind === "material" && material?.reading?.title ? material.reading.title : title;
  let body: ReactNode = null;
  if (plan.kind === "note") {
    let n = 1;
    body = shown.map((p) => {
      const first = n;
      n += p.figures.length;
      return <NoteView key={p.topicId} primer={p} path={path} showName={shown.length > 1} first={first} />;
    });
  } else if (plan.kind === "material" && material) {
    body = <MaterialView material={material} path={path} />;
  } else if (plan.kind === "preparing") {
    body = (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-read font-extrabold text-foreground">{t("primer.preparing")}</p>
        <p className="text-ui text-muted-foreground">{t("primer.preparingSub")}</p>
        <div className="mt-2 h-[200px] animate-pulse rounded-[var(--r-card,20px)] bg-muted" aria-hidden />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" aria-hidden />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" aria-hidden />
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col pb-6 animate-fade-up" data-session-primer={plan.kind} data-path={path}>
      <p className="text-small font-extrabold text-muted-foreground">{t(path === "notes" ? "primer.eyebrowNotes" : "primer.eyebrowRecap")}</p>
      <h1 className="mt-1 text-balance text-[26px] font-extrabold leading-[1.15] tracking-tight sm:text-[30px]">
        {t(path === "notes" ? "primer.titleNotes" : "primer.titleRecap").replace("{topic}", topic)}
      </h1>
      {confidence !== null && (
        <p className="mt-2 text-ui text-muted-foreground">{t(path === "notes" ? "primer.said" : "primer.saidRecap").replace("{n}", String(confidence))}</p>
      )}
      <div className="mt-6 flex flex-col gap-10">{body}</div>
      <PlayActions className="mt-8">
        <PlayPrimary onClick={onStart}>
          {t(path === "notes" ? "primer.ready" : "primer.startRecap")} <ArrowRight className="ml-1.5 size-4" />
        </PlayPrimary>
      </PlayActions>
      {generating && <p className="mt-3 text-small text-muted-foreground">{t("primer.building")}</p>}
    </div>
  );
}

/**
 * Above a session's first reading when that reading is bullet points with no
 * picture of its own: the topic note's first figure and a one-line
 * explanation, or (their own material) the material's first image. Nothing
 * when there is nothing to show; a reading with its own figure needs none.
 */
export function FirstReadingLead({ session, content }: { session: StudySession | undefined; content: ReadingContent }) {
  const sessionId = session?.id ?? "";
  // They have just been through the notes-first screen: the same figure again would be noise.
  const [seenPrimer] = useState(() => typeof window !== "undefined" && !!sessionId && wasDone(sessionId));
  const needs = !seenPrimer && readingNeedsLead(content);
  const topics = useMemo(() => parseCourseTopics(session?.courseTopic), [session?.courseTopic]);
  const { data } = useQuery({
    queryKey: ["first-reading-lead", sessionId],
    enabled: needs && !!sessionId,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<{ note: NotePrimer | null; image: MaterialPrimer["images"][number] | null }> => {
      if (topics) {
        const note = await notesApi.get(topics.courseId, topics.topicIds[0]).catch(() => null);
        const primer = note?.content ? notePrimer(note.content, "recap") : null;
        if (primer?.figures.length) return { note: primer, image: null };
      }
      const material = await studySessionApi.getPrimer(sessionId).catch(() => null);
      return { note: null, image: material?.images[0] ?? null };
    },
  });
  if (!needs || !data) return null;
  if (data.note) {
    return (
      <div className="flex flex-col gap-4" data-reading-lead="note">
        <PrimerFigure figure={data.note.figures[0]} n={1} />
        {data.note.lead && (
          <p className="text-read text-foreground">
            <MathText text={data.note.lead} />
          </p>
        )}
      </div>
    );
  }
  return data.image ? (
    <div data-reading-lead="material">
      <FigureView figure={data.image as ReadingFigure} />
    </div>
  ) : null;
}
