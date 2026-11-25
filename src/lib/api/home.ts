import superjson from "superjson";
import { apiUrl } from "./config";
import { fetchWorkspaceTree } from "./workspace";
import { fetchStudySessions } from "./study";
import { fetchDueReview } from "./study-session";
import { fetchStreak } from "./streak";
import { fetchPlanToday } from "./exam-planner";
import { mistakesApi } from "./mistakes";
import { homeSubjects, isMissingProcedure, pickHomeAction, toSessionInput, type HomeSummary } from "@/lib/home-action";
import type { Folder, StudySession, Workspace } from "@/types";

export type { HomeSummary, HomeAction, HomeSubject } from "@/lib/home-action";

/** React Query key for the home summary (invalidate it when subjects change). */
export const HOME_SUMMARY_KEY = ["home-summary"] as const;

/** Past this, the summary is reported as failed (with Retry) rather than leaving home blank. */
const TIMEOUT_MS = 15_000;

/** The server has no `home.summary` yet (an older deploy): fall back to the per-subject calls. */
class MissingEndpoint extends Error {}

function timezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * One plain GET, never part of a tRPC batch: nothing else on the page can
 * hold its answer back.
 */
async function fetchSummaryOnce(): Promise<HomeSummary> {
  const input = encodeURIComponent(JSON.stringify(superjson.serialize({ timezone: timezone() })));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${apiUrl}/trpc/home.summary?input=${input}`, { credentials: "include", signal: ctrl.signal });
    const body = (await res.json().catch(() => null)) as {
      result?: { data: Parameters<typeof superjson.deserialize>[0] };
      error?: { message?: string; data?: { code?: string }; json?: { message?: string; data?: { code?: string } } };
    } | null;
    if (isMissingProcedure(res.status, body)) throw new MissingEndpoint("home.summary is not deployed");
    if (!res.ok || !body?.result) throw new Error(body?.error?.json?.message ?? body?.error?.message ?? `home.summary failed (${res.status})`);
    return superjson.deserialize(body.result.data) as HomeSummary;
  } finally {
    clearTimeout(timer);
  }
}

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  const all = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all;
}

/**
 * The same summary built from the old calls (tree, one session list per
 * subject, mistakes, planner, streak, due cards): slow, as before, but it
 * keeps home working against a server without `home.summary`.
 */
export async function legacyHomeSummary(): Promise<HomeSummary> {
  const [tree, mistakes, plan, streak, due] = await Promise.all([
    fetchWorkspaceTree(),
    mistakesApi.summary().catch(() => null),
    fetchPlanToday().catch(() => null),
    fetchStreak().catch(() => null),
    fetchDueReview().catch(() => null),
  ]);
  const workspaces = flatten(tree.folders, tree.rootWorkspaces);
  const lists = await Promise.all(workspaces.map((w) => fetchStudySessions(w.id).catch(() => [] as StudySession[])));
  const inputs = {
    workspaces: workspaces.map((w) => ({
      id: w.id,
      title: w.title,
      folderId: w.folderId ?? null,
      subjectFamily: w.subjectFamily ?? null,
      // The tree only carries the last update; it stands in for both.
      createdAt: new Date(w.createdAt),
      updatedAt: new Date(w.createdAt),
      materialCount: w.materials.length,
    })),
    sessions: lists.flat().map(toSessionInput),
    // Old servers practise one subject per round: the one with the most.
    mistakes: { count: mistakes?.subjects[0]?.open ?? 0, workspaceId: mistakes?.subjects[0]?.workspaceId ?? null },
    planTasks: (plan?.tasks ?? []).filter((t) => t.status === "planned"),
  };
  return {
    version: 1,
    action: pickHomeAction(inputs),
    subjects: homeSubjects(inputs),
    due: { mistakes: mistakes?.open ?? 0, questions: 0, cards: due?.total ?? 0, questionsWorkspaceId: null },
    streak: streak ? { current: streak.current, todayDone: streak.todayDone } : null,
  };
}

let prefetched: Promise<HomeSummary> | null = null;

/**
 * Started by the app shell on "/" at the same moment as the session check,
 * so the action is ready when the page mounts (one round trip, not two).
 * A signed-out visitor's request just fails and is dropped.
 */
export function prefetchHomeSummary(): void {
  if (prefetched) return;
  const p = fetchSummaryOnce();
  p.catch(() => {});
  prefetched = p;
}

/** Home's one call. Uses the prefetched request once if there is one. */
export async function fetchHomeSummary(): Promise<HomeSummary> {
  const p = prefetched ?? fetchSummaryOnce();
  prefetched = null;
  try {
    return await p;
  } catch (e) {
    if (e instanceof MissingEndpoint) return legacyHomeSummary();
    throw e;
  }
}
