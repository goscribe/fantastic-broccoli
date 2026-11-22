"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ULTRA_PRICE_ABOVE_PRO_USD,
  courseworkApi,
  isCourseworkLimit,
  isMissingEndpoint,
  type GraderStatus,
  type Review,
  type ReviewMode,
  type ReviewRow,
  type RubricSummary,
} from "@/lib/api/coursework";
import type { UltraOffer } from "@/lib/coursework";

/* ---------- Shared, cached reads ---------- */

let rubricsCache: Promise<RubricSummary[]> | null = null;

/** The rubric list changes only with a deploy: one fetch per page load. */
export function loadRubrics(): Promise<RubricSummary[]> {
  rubricsCache ??= courseworkApi.rubrics().catch((err) => {
    rubricsCache = null;
    throw err;
  });
  return rubricsCache;
}

export function ultraOffer(status: Pick<GraderStatus, "ultraAvailable"> | null | undefined): UltraOffer | null {
  return status?.ultraAvailable ? { priceAboveProDollars: ULTRA_PRICE_ABOVE_PRO_USD } : null;
}

/* ---------- The review type a student last chose (this device) ---------- */

const MODE_KEY = "scribe.coursework.mode";
const modeListeners = new Set<() => void>();

export function usePreferredMode(): [ReviewMode, (m: ReviewMode) => void] {
  const mode = useSyncExternalStore(
    (cb) => {
      modeListeners.add(cb);
      return () => {
        modeListeners.delete(cb);
      };
    },
    () => (localStorage.getItem(MODE_KEY) === "feedback" ? "feedback" : "marked"),
    () => "marked" as const,
  );
  const set = useCallback((m: ReviewMode) => {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage blocked: the choice lasts for this page */
    }
    modeListeners.forEach((l) => l());
  }, []);
  return [mode, set];
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Phones and narrow windows: the feedback is a tab, not a rail. */
export function useWide(query = "(min-width: 1024px)"): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ---------- One document's grading ---------- */

export type GraderPhase = "loading" | "unavailable" | "error" | "ready";

export interface Grader {
  phase: GraderPhase;
  status: GraderStatus | null;
  ultra: UltraOffer | null;
  rubrics: RubricSummary[];
  rubric: RubricSummary | null;
  setRubric: (id: string) => void;
  /** Reviews of this document, oldest first. */
  rows: ReviewRow[];
  /** The review being shown (the newest unless the student picked an older draft). */
  review: Review | null;
  select: (reviewId: string) => void;
  /** A review is queued or being read. */
  running: boolean;
  /** The review on screen finished while the student was here: play the reveal once. */
  fresh: boolean;
  mode: ReviewMode;
  setMode: (m: ReviewMode) => void;
  hideMarks: boolean;
  setHideMarks: (v: boolean) => void;
  request: () => Promise<void>;
  requesting: boolean;
  /** Why the last request did not start (the server's words), or "limit". */
  requestError: string | null;
  remove: (reviewId: string) => Promise<void>;
  /** The marked draft before the one on screen, for the comparison. */
  previous: ReviewRow | null;
  retry: () => void;
}

const isRunning = (s: string | undefined) => s === "queued" || s === "grading";

/**
 * Everything the Grade panel needs for one document: today's allowance, the
 * component it is read against, its reviews, and the one on screen (polled
 * while it runs). `flush` saves the document first, so a review always reads
 * what the student sees.
 */
export function useGrader(input: { documentId: string | null; rubricId: string | null; onRubric: (id: string) => void; flush: () => Promise<void> }): Grader {
  const { documentId, rubricId, onRubric, flush } = input;
  const [phase, setPhase] = useState<GraderPhase>("loading");
  const [status, setStatus] = useState<GraderStatus | null>(null);
  const [rubrics, setRubrics] = useState<RubricSummary[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [hideMarks, setHideMarks] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = usePreferredMode();
  const live = useRef({ flush, onRubric });
  useEffect(() => {
    live.current = { flush, onRubric };
  });

  useEffect(() => {
    // Nothing to grade until the host has its document.
    if (!documentId) return;
    let cancelled = false;
    Promise.all([courseworkApi.status(), loadRubrics(), courseworkApi.reviews({ documentId })])
      .then(([s, r, list]) => {
        if (cancelled) return;
        setStatus(s);
        setRubrics(r);
        const oldestFirst = [...list].sort((a, b) => a.draftNumber - b.draftNumber);
        setRows(oldestFirst);
        setSelectedId((cur) => cur ?? oldestFirst[oldestFirst.length - 1]?.id ?? null);
        setPhase("ready");
      })
      .catch((err) => !cancelled && setPhase(isMissingEndpoint(err) ? "unavailable" : "error"));
    return () => {
      cancelled = true;
    };
  }, [documentId, attempt]);

  // The review on screen, polled while it is being read.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasRunning = false;
    const load = () =>
      courseworkApi
        .review(selectedId)
        .then((r) => {
          if (cancelled) return;
          setReview(r);
          setRows((list) => list.map((row) => (row.id === r.id ? { ...row, status: r.status, marksLow: r.result?.mode === "marked" ? r.result.overall.marksLow : null, marksHigh: r.result?.mode === "marked" ? r.result.overall.marksHigh : null } : row)));
          if (isRunning(r.status)) {
            wasRunning = true;
            timer = setTimeout(load, 2500);
          } else if (wasRunning) {
            wasRunning = false;
            if (r.status === "completed") setFresh(true);
            // A failed review gives the allowance back.
            courseworkApi.status().then((s) => !cancelled && setStatus(s)).catch(() => {});
          }
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(load, 5000);
        });
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedId]);

  const shown = review && review.id === selectedId ? review : null;
  const rubric = useMemo(() => rubrics.find((r) => r.id === (shown?.rubric.id ?? rubricId)) ?? rubrics.find((r) => r.id === rubricId) ?? null, [rubrics, rubricId, shown]);
  const running = isRunning(shown?.status) || (!!selectedId && !shown && isRunning(rows.find((r) => r.id === selectedId)?.status));

  const request = useCallback(async () => {
    if (!documentId || requesting) return;
    setRequesting(true);
    setRequestError(null);
    try {
      await live.current.flush();
      const out = await courseworkApi.requestReview({ documentId, rubricId: rubricId ?? undefined, mode });
      setFresh(false);
      setHideMarks(false);
      setStatus((s) => (s ? { ...s, usedToday: s.usedToday + 1, remainingToday: out.remainingToday, allowed: out.remainingToday === null || out.remainingToday > 0, reason: out.remainingToday === 0 ? "daily_limit" : s.reason } : s));
      const info = rubrics.find((r) => r.id === rubricId);
      setRows((list) => [
        ...list,
        {
          id: out.reviewId,
          documentId,
          draftNumber: out.draftNumber,
          mode,
          status: "queued",
          label: null,
          wordCount: null,
          createdAt: new Date(),
          rubric: { id: rubricId ?? "", component: info?.component ?? "", componentKind: info?.componentKind ?? "coursework", subject: info?.subject ?? "", totalMarks: info?.totalMarks ?? 0 },
          marksLow: null,
          marksHigh: null,
        },
      ]);
      setReview(null);
      setSelectedId(out.reviewId);
    } catch (err) {
      if (isCourseworkLimit(err)) {
        setRequestError("limit");
        courseworkApi.status().then(setStatus).catch(() => {});
      } else {
        setRequestError(err instanceof Error && err.message && !/fetch|network/i.test(err.message) ? err.message : "");
      }
    } finally {
      setRequesting(false);
    }
  }, [documentId, requesting, rubricId, mode, rubrics]);

  const remove = useCallback(
    async (reviewId: string) => {
      await courseworkApi.deleteReview(reviewId);
      setRows((list) => {
        const next = list.filter((r) => r.id !== reviewId);
        setSelectedId(next[next.length - 1]?.id ?? null);
        return next;
      });
      setReview(null);
      setFresh(false);
    },
    [],
  );

  const previous = useMemo(() => {
    if (!shown) return null;
    const earlier = rows.filter((r) => r.draftNumber < shown.draftNumber && r.status === "completed" && r.mode === "marked");
    return earlier[earlier.length - 1] ?? null;
  }, [rows, shown]);

  return {
    phase,
    status,
    ultra: ultraOffer(status),
    rubrics,
    rubric,
    setRubric: (id) => live.current.onRubric(id),
    rows,
    review: shown,
    select: (id) => {
      setFresh(false);
      setSelectedId(id);
    },
    running,
    fresh,
    mode,
    setMode,
    hideMarks,
    setHideMarks,
    request,
    requesting,
    requestError,
    remove,
    previous,
    retry: () => {
      setPhase("loading");
      setAttempt((n) => n + 1);
    },
  };
}

/* ---------- Is Coursework one of this student's places? ---------- */

const NAV_KEY = "scribe.coursework.nav";
let navCheck: Promise<boolean> | null = null;

/**
 * Coursework is in the navigation when the server reviews coursework AND it
 * is this student's business: one of their subjects has a component (v1: IB),
 * or they already have a piece. Everyone else still reaches it from the
 * Coursework guides in Notes. Remembered for the tab, so the nav does not
 * shift on every page.
 */
export function useCourseworkNav(enabled: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    try {
      const known = sessionStorage.getItem(NAV_KEY);
      if (known) {
        const id = requestAnimationFrame(() => !cancelled && setShow(known === "1"));
        return () => {
          cancelled = true;
          cancelAnimationFrame(id);
        };
      }
    } catch {
      /* storage blocked */
    }
    navCheck ??= loadRubrics()
      .then(async (rubrics) => (rubrics.some((r) => r.suggested) ? true : (await courseworkApi.documents().catch(() => [])).length > 0))
      .catch(() => false);
    void navCheck.then((v) => {
      try {
        sessionStorage.setItem(NAV_KEY, v ? "1" : "0");
      } catch {
        /* storage blocked */
      }
      if (!cancelled) setShow(v);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return show;
}
