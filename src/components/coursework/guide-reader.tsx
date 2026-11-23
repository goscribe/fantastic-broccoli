"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { SubjectArt } from "@/components/learn/subject-tile";
import { Mascot } from "@/components/rewards/mascot";
import { PublicNoteBody } from "@/components/notes-public/public-note-body";
import type { GuideResponse, RubricSummary } from "@/lib/api/coursework";
import { componentTitle, countWords, familyText } from "@/lib/coursework";
import { LIBRARY_PATH } from "@/lib/notes";
import { familyVars, resolveSubjectFamily } from "@/lib/subject-family";
import { guideContent, loadGuide } from "./grade-panel";
import { useCw } from "./use-cw";
import { loadRubrics } from "./use-grader";
import "@/app/notes/notes-look.css";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "error" } | { kind: "ready"; rubric: RubricSummary; guide: GuideResponse };

/**
 * A component's guide as a note in the notes library: the same band, type and
 * blocks as a topic note, so "how the EE is marked" reads like any other
 * Scribe note. One action on the band: review your own.
 */
export function GuideReader({ rubricKey }: { rubricKey: string }) {
  const { t } = useCw();
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let cancelled = false;
    loadRubrics()
      .then(async (rubrics) => {
        const rubric = rubrics.find((r) => r.key === rubricKey || r.id === rubricKey);
        if (!rubric) return !cancelled && setState({ kind: "missing" });
        const guide = await loadGuide(rubric.id);
        if (!cancelled) setState({ kind: "ready", rubric, guide });
      })
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [rubricKey]);

  if (state.kind === "loading") {
    return (
      <div className="notes-look flex-1">
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 sm:px-6" aria-busy="true">
          <div className="h-[260px] animate-pulse rounded-[var(--r-panel)] bg-muted" />
          <div className="mt-8 h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }
  if (state.kind !== "ready") {
    return (
      <div className="notes-look flex-1">
        <div className="mx-auto w-full max-w-[640px] px-4 pt-10 sm:px-6">
          <div className="flex flex-col items-center rounded-[var(--r-card)] border-2 border-dashed border-border px-5 py-10 text-center">
            <Mascot pose="think" className="h-[72px]" />
            <p className="mt-3 text-read font-extrabold">{state.kind === "error" ? t("cw.loadFailed") : t("cw.guide.missing")}</p>
            <Link href={`${LIBRARY_PATH}#lib-coursework`} className="mt-2 text-ui font-bold text-accent hover:underline">
              {t("cw.guide.all")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { rubric, guide: res } = state;
  const guide = res.guide;
  const family = resolveSubjectFamily(null, familyText(rubric));
  const name = componentTitle(rubric);
  const title = t("cw.start.guide", { name });
  const minutes = guide ? Math.max(2, Math.round(countWords([guide.objectiveLine, ...guide.sections.flatMap((s) => [s.heading, JSON.stringify(s.blocks)])].join(" ")) / 220)) : 0;

  return (
    <div className="notes-look flex-1">
      <article className="mx-auto w-full max-w-[1120px] px-4 pb-12 pt-2 sm:px-6 sm:pt-4">
        <nav aria-label="Where you are" className="flex flex-wrap items-center gap-x-1.5 text-caption font-semibold text-faint">
          <Link href={LIBRARY_PATH} className="hover:text-accent">
            Notes
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`${LIBRARY_PATH}#lib-coursework`} className="hover:text-accent">
            {t("cw.guide.group")}
          </Link>
        </nav>
        <header className="subject-band nl-band mt-4 px-5 pb-6 pt-5 sm:px-10 sm:pb-9 sm:pt-8 sm:pr-[220px] lg:pr-[340px]" style={familyVars(family) as CSSProperties}>
          <SubjectArt family={family} eager />
          <p className="nl-rise flex min-h-[84px] items-center pr-[96px] text-ui font-bold text-white/90 sm:min-h-0 sm:pr-0">
            <span>
              <span className="font-extrabold text-white">{rubric.board}</span> · {t("cw.guide.eyebrow")}
            </span>
          </p>
          <h1 className="nl-rise mt-2 text-balance text-[34px] font-black leading-[1.04] sm:mt-3 sm:text-[50px] lg:text-[56px]" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          {guide && (
            <p className="nl-rise mt-3 text-read font-semibold text-white/95" style={{ ["--i" as string]: 2 }}>
              {guide.objectiveLine}
            </p>
          )}
          <ul className="nl-meta nl-rise mt-3.5" style={{ ["--i" as string]: 3 }}>
            {guide && <li>{t("cw.guide.read", { n: minutes })}</li>}
            {guide && <li>{t("cw.guide.parts", { n: guide.sections.length })}</li>}
            <li>{rubric.sessionLabel}</li>
            <li>{t(rubric.status === "reviewed" ? "cw.guide.reviewed" : "cw.guide.draft")}</li>
          </ul>
          <div className="nl-rise mt-5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-3" style={{ ["--i" as string]: 4 }}>
            <Link href={`/coursework/new?rubric=${encodeURIComponent(rubric.key)}`} className="nl-btn">
              {t("cw.guide.review", { name })}
            </Link>
          </div>
        </header>
        <div className="mt-8 max-w-[760px]">
          {guide ? <PublicNoteBody note={guideContent(guide, title)} /> : <p className="text-read text-muted-foreground">{t("cw.guide.none")}</p>}
        </div>
      </article>
    </div>
  );
}
