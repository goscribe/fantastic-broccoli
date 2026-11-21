/**
 * Home's one recommended next action and the subjects' tile fields.
 *
 * The server's `home.summary` (goscribe/server, services/home/home-action.ts)
 * computes these in one request. This file holds the same types, the copy
 * the banner shows for each action, and a copy of the server's ranking used
 * ONLY as the fallback against a server without `home.summary` (built from
 * the old per-subject calls). Once every server has the endpoint, delete
 * `pickHomeAction` / `homeSubjects` here and the fallback in api/home.ts.
 *
 * Pure (no framework imports) so it is unit-tested.
 */

export const QUICK5_MINUTES = 5;

type Subject = { workspaceId: string; subject: string };

export type HomeAction =
  | { kind: "upload" }
  /** One practice round; `workspaceId`/`subject` are null when the mistakes span subjects (a mixed round). */
  | { kind: "mistakes"; workspaceId: string | null; subject: string | null; count: number; minutes: number; href: string }
  | (Subject & { kind: "plan"; taskId: string; taskKind: string; label: string; topic: string | null; examTitle: string | null; minutes: number; sessionId: string | null })
  | (Subject & { kind: "continue"; sessionId: string; title: string; activityTitle: string | null; quick: boolean; minutes: number; href: string })
  | (Subject & { kind: "next"; sessionId: string; title: string; activityTitle: string | null; minutes: number; href: string })
  | (Subject & { kind: "quick5"; first: boolean; minutes: number; topics: string | null });

export interface HomeSubject {
  id: string;
  title: string;
  folderId: string | null;
  subjectFamily: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  materialCount: number;
  sessionsTotal: number;
  sessionsDone: number;
  next: { sessionId: string; title: string; generating: boolean } | null;
}

export interface HomeSummary {
  version: 1;
  action: HomeAction;
  subjects: HomeSubject[];
  /** From `review.summary`: open mistakes, due review questions, due flashcards. */
  due: { mistakes: number; questions: number; cards: number; questionsWorkspaceId: string | null };
  streak: { current: number; todayDone: boolean } | null;
}

/**
 * True when a tRPC reply says the procedure does not exist (an older server
 * without `home.summary`): 404 with code NOT_FOUND and no result. Anything
 * else (401, 500, a timeout) is a real failure the page shows with Retry.
 */
export function isMissingProcedure(
  status: number,
  body: { result?: unknown; error?: { data?: { code?: string }; json?: { data?: { code?: string } } } } | null,
): boolean {
  const code = body?.error?.json?.data?.code ?? body?.error?.data?.code;
  return status === 404 && code === "NOT_FOUND" && !body?.result;
}

// ---------- the banner's copy ----------

type Translate = (key: string) => string;
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** "Mock: Paper 1" / "Recap: Paper 1" / the task's own label (as the planner shows it). */
function planLabel(a: Extract<HomeAction, { kind: "plan" }>, t: Translate): string {
  if (a.taskKind === "mock" && a.examTitle) return fill(t("ep.task.mock"), { exam: a.examTitle });
  if (a.taskKind === "quick5" && !a.topic && a.examTitle) return fill(t("ep.task.recap"), { exam: a.examTitle });
  return a.label;
}

/**
 * The banner's one sentence (what to do, where, how long) and its button.
 * "Fix 4 Biology mistakes — 2 min", "Next in IB Biology: A2.1 Origins of
 * cells — 8 min", "Start your first 5 questions in Chemistry — 5 min".
 */
export function actionCopy(a: Exclude<HomeAction, { kind: "upload" }>, t: Translate): { title: string; meta: string; cta: string } {
  const min = (m: number) => fill(t("home.min"), { m });
  switch (a.kind) {
    case "mistakes":
      return {
        title: a.subject
          ? fill(t(a.count === 1 ? "home.fixOne" : "home.fixMany"), { n: a.count, subject: a.subject })
          : fill(t(a.count === 1 ? "home.fixAnyOne" : "home.fixAny"), { n: a.count }),
        meta: min(a.minutes),
        cta: t(a.count === 1 ? "home.fixCtaOne" : "home.fixCta"),
      };
    case "plan":
      return { title: fill(t("home.planTitle"), { subject: a.subject, task: planLabel(a, t) }), meta: min(a.minutes), cta: t("home.start") };
    case "continue":
      if (a.quick) return { title: fill(t("home.finishQuick5"), { subject: a.subject }), meta: min(a.minutes), cta: t("home.continue") };
      return { title: fill(t("home.nextIn"), { subject: a.subject, title: a.activityTitle || a.title }), meta: min(a.minutes), cta: t("home.continue") };
    case "next":
      return { title: fill(t("home.nextIn"), { subject: a.subject, title: a.title }), meta: min(a.minutes), cta: t("home.start") };
    case "quick5":
      return a.first
        ? { title: fill(t("home.firstFive"), { subject: a.subject }), meta: min(a.minutes), cta: t("home.start") }
        : { title: fill(t("home.quick5"), { subject: a.subject }), meta: min(a.minutes), cta: t("home.start") };
  }
}

/** The kind reported in the `home.today_tapped` funnel event. */
export function funnelKind(a: HomeAction): "mistakes" | "plan" | "quick5" | "upload" | "continue" {
  if (a.kind === "next") return "continue";
  if (a.kind === "continue") return a.quick ? "quick5" : "continue";
  return a.kind;
}

/** The tile's second line, ring and verb, from its summary fields. */
export function tileSummary(
  s: Pick<HomeSubject, "title" | "materialCount" | "sessionsTotal" | "sessionsDone" | "next">,
  hint: string | undefined,
  repeatsTitle: (subject: string, session: string) => boolean,
): { sub: string; progress: number | null; action: "Continue" | "Open" } {
  const counts = `${s.materialCount} material${s.materialCount === 1 ? "" : "s"}${s.sessionsTotal ? ` · ${s.sessionsDone}/${s.sessionsTotal} sessions` : ""}`;
  const sub =
    hint ?? (!s.next ? counts : s.next.generating ? "Building the next session…" : repeatsTitle(s.title, s.next.title) ? counts : `Next: ${s.next.title}`);
  return { sub, progress: s.sessionsTotal ? s.sessionsDone / s.sessionsTotal : null, action: s.next ? "Continue" : "Open" };
}

// ---------- fallback ranking (copy of the server's; see the header) ----------

export interface HomeSessionInput {
  id: string;
  workspaceId: string;
  title: string;
  /** Upper-case, as the server stores it: ACTIVE | PAUSED | COMPLETED | FAILED. */
  status: string;
  generating: boolean;
  quickStart: boolean;
  createdAt: Date;
  updatedAt: Date;
  activities: { status: string; title: string; estimatedMinutes: number }[];
}

export interface HomeWorkspaceInput {
  id: string;
  title: string;
  folderId: string | null;
  subjectFamily: string | null;
  createdAt: Date;
  updatedAt: Date;
  materialCount: number;
}

export interface HomePlanTaskInput {
  id: string;
  workspaceId: string;
  subject: string;
  kind: string;
  label: string;
  topic: string | null;
  examTitle: string | null;
  minutes: number;
  sessionId: string | null;
}

export interface HomeActionInputs {
  workspaces: HomeWorkspaceInput[];
  sessions: HomeSessionInput[];
  /** Open mistakes: how many, and their one subject (null when they span subjects). */
  mistakes: { count: number; workspaceId: string | null };
  planTasks: HomePlanTaskInput[];
}

/** Mirrors the server's practice round: 8 at most, ~30 s each. */
const practiceMinutes = (n: number) => Math.max(1, Math.ceil(Math.min(n, 8) / 2));
const OPEN_ACTIVITY = (s: string) => s !== "COMPLETED" && s !== "SKIPPED";
const isDone = (s: HomeSessionInput) => s.status === "COMPLETED";
const sessionHref = (s: HomeSessionInput) => `/workspace/${s.workspaceId}/session/${s.id}`;
const remaining = (s: HomeSessionInput) => {
  const open = s.activities.filter((a) => OPEN_ACTIVITY(a.status));
  return {
    minutes: Math.max(1, Math.round(open.reduce((n, a) => n + (a.estimatedMinutes || 0), 0)) || 1),
    activityTitle: open[0]?.title ?? null,
    started: open.length < s.activities.length,
    hasOpen: open.length > 0,
  };
};
const byCreated = (a: { createdAt: Date }, b: { createdAt: Date }) => a.createdAt.getTime() - b.createdAt.getTime();

export function isBrandNew(input: Pick<HomeActionInputs, "workspaces" | "sessions">): boolean {
  return input.sessions.length === 0 && input.workspaces.every((w) => w.materialCount === 0);
}

export function pickHomeAction(input: HomeActionInputs): HomeAction {
  const { workspaces, sessions } = input;
  if (workspaces.length === 0 || isBrandNew(input)) return { kind: "upload" };
  const title = new Map(workspaces.map((w) => [w.id, w.title]));
  const subjectOf = (workspaceId: string): Subject => ({ workspaceId, subject: title.get(workspaceId) ?? "" });
  const mine = sessions.filter((s) => title.has(s.workspaceId));

  if (input.mistakes.count > 0) {
    const one = input.mistakes.workspaceId && title.has(input.mistakes.workspaceId) ? input.mistakes.workspaceId : null;
    return {
      kind: "mistakes",
      workspaceId: one,
      subject: one ? title.get(one)! : null,
      count: input.mistakes.count,
      minutes: practiceMinutes(input.mistakes.count),
      href: one ? `/mistakes/practice?workspace=${encodeURIComponent(one)}` : "/mistakes/practice",
    };
  }

  const task = input.planTasks.find((t) => title.has(t.workspaceId));
  if (task) {
    return {
      kind: "plan",
      workspaceId: task.workspaceId,
      subject: task.subject || title.get(task.workspaceId) || "",
      taskId: task.id,
      taskKind: task.kind,
      label: task.label,
      topic: task.topic,
      examTitle: task.examTitle,
      minutes: Math.max(1, task.minutes),
      sessionId: task.sessionId,
    };
  }

  const ready = (s: HomeSessionInput) => !isDone(s) && !s.generating && remaining(s).hasOpen;
  const byUpdated = [...mine].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const quick = byUpdated.find((s) => s.quickStart && ready(s));
  if (quick) {
    const r = remaining(quick);
    return { kind: "continue", ...subjectOf(quick.workspaceId), sessionId: quick.id, title: quick.title, activityTitle: r.activityTitle, quick: true, minutes: r.minutes, href: sessionHref(quick) };
  }

  const latestSession = [...mine].sort(byCreated).pop();
  const studied = new Set(mine.map((s) => s.workspaceId));
  const newest = [...workspaces].sort(byCreated).pop()!;
  if (!studied.has(newest.id) && (!latestSession || newest.createdAt > latestSession.createdAt)) {
    return { kind: "quick5", ...subjectOf(newest.id), first: true, minutes: QUICK5_MINUTES, topics: newest.materialCount === 0 ? newest.title : null };
  }

  const half = [...mine].sort(byCreated).find((s) => !s.quickStart && ready(s) && remaining(s).started);
  if (half) {
    const r = remaining(half);
    return { kind: "continue", ...subjectOf(half.workspaceId), sessionId: half.id, title: half.title, activityTitle: r.activityTitle, quick: false, minutes: r.minutes, href: sessionHref(half) };
  }

  const focusId = latestSession?.workspaceId ?? workspaces.find((w) => w.materialCount > 0)?.id ?? workspaces[0].id;
  const next = mine.filter((s) => s.workspaceId === focusId && ready(s)).sort(byCreated)[0];
  if (next) {
    const r = remaining(next);
    return { kind: "next", ...subjectOf(focusId), sessionId: next.id, title: next.title, activityTitle: r.activityTitle, minutes: r.minutes, href: sessionHref(next) };
  }
  const focus = workspaces.find((w) => w.id === focusId)!;
  return { kind: "quick5", ...subjectOf(focusId), first: !studied.has(focusId), minutes: QUICK5_MINUTES, topics: focus.materialCount === 0 ? focus.title : null };
}

export function homeSubjects(input: Pick<HomeActionInputs, "workspaces" | "sessions">): HomeSubject[] {
  const bySubject = new Map<string, HomeSessionInput[]>();
  for (const s of input.sessions) {
    const list = bySubject.get(s.workspaceId) ?? [];
    list.push(s);
    bySubject.set(s.workspaceId, list);
  }
  return input.workspaces
    .map((w, i) => {
      const own = (bySubject.get(w.id) ?? []).sort(byCreated);
      const last = Math.max(w.updatedAt.getTime(), ...own.map((s) => Math.max(s.updatedAt.getTime(), s.createdAt.getTime())));
      const current = own.find((s) => !isDone(s));
      const subject: HomeSubject = {
        id: w.id,
        title: w.title,
        folderId: w.folderId,
        subjectFamily: w.subjectFamily,
        createdAt: w.createdAt,
        lastActivityAt: new Date(last),
        materialCount: w.materialCount,
        sessionsTotal: own.length,
        sessionsDone: own.filter(isDone).length,
        next: current ? { sessionId: current.id, title: current.title, generating: current.generating } : null,
      };
      return { subject, i, last };
    })
    .sort((a, b) => b.last - a.last || a.i - b.i)
    .map((x) => x.subject);
}

/** App-side session → ranking input (the app lower-cases statuses). */
export function toSessionInput(s: {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  generating: boolean;
  quickStart: boolean;
  createdAt: string;
  updatedAt: string;
  activities: { status: string; title: string; estimatedMinutes: number }[];
}): HomeSessionInput {
  return {
    id: s.id,
    workspaceId: s.workspaceId,
    title: s.title,
    status: s.status.toUpperCase(),
    generating: s.generating,
    quickStart: s.quickStart,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    activities: s.activities.map((a) => ({ status: a.status.toUpperCase(), title: a.title, estimatedMinutes: a.estimatedMinutes })),
  };
}
