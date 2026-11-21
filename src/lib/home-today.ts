/**
 * Home's one "Today" action: the smallest useful thing to do right now, so a
 * learner who opens the app on a phone has one obvious tap and a first win
 * in about two minutes.
 *
 * Priority: open mistakes (a ~2 min fix round) → today's planner task →
 * a Quick 5 (5 questions, ~2 min) → upload notes for someone with nothing yet.
 */

export interface TodayInputs {
  /** Still loading anything the choice depends on. */
  loading: boolean;
  /** Open (not yet corrected) mistakes across every subject. */
  openMistakes: number;
  /** Minutes one practice round takes (server value). */
  practiceMinutes: number;
  /** Today already counts for the streak (the daily goal is met). */
  doneToday?: boolean;
  /** Today's planner tasks still to do, in plan order. */
  planTasks: { id: string; status: string }[];
  workspaces: { id: string; materialCount: number }[];
  sessions: {
    id: string;
    workspaceId: string;
    quickStart: boolean;
    status: string;
    generating: boolean;
    createdAt: string;
    activities: { status: string }[];
  }[];
}

export type TodayAction =
  | { kind: "loading" }
  | { kind: "upload" }
  | { kind: "mistakes"; count: number; minutes: number }
  | { kind: "plan"; taskId: string }
  | { kind: "quick5"; workspaceId: string; resumeSessionId: string | null }
  /** Goal met and nothing urgent: celebrate, and offer a bonus Quick 5. */
  | { kind: "done"; workspaceId: string };

const openActivity = (status: string) => status !== "completed" && status !== "skipped";

/** True when the learner has uploaded nothing and never studied: the first-run state. */
export function isBrandNew(input: Pick<TodayInputs, "workspaces" | "sessions">): boolean {
  return input.sessions.length === 0 && input.workspaces.every((w) => w.materialCount === 0);
}

export function pickTodayAction(input: TodayInputs): TodayAction {
  if (input.loading) return { kind: "loading" };
  if (input.workspaces.length === 0 || isBrandNew(input)) return { kind: "upload" };
  if (input.openMistakes > 0) {
    return { kind: "mistakes", count: input.openMistakes, minutes: Math.max(1, input.practiceMinutes || 1) };
  }
  const task = input.planTasks.find((t) => t.status === "planned");
  if (task) return { kind: "plan", taskId: task.id };
  const latestWs = () =>
    [...input.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.workspaceId ??
    input.workspaces.find((w) => w.materialCount > 0)?.id ??
    input.workspaces[0].id;
  if (input.doneToday) return { kind: "done", workspaceId: latestWs() };
  // An unfinished Quick 5 is the quickest win there is; otherwise build one in the subject with notes.
  const quick = input.sessions.find(
    (s) => s.quickStart && !s.generating && s.status !== "completed" && s.activities.some((a) => openActivity(a.status)),
  );
  if (quick) return { kind: "quick5", workspaceId: quick.workspaceId, resumeSessionId: quick.id };
  return { kind: "quick5", workspaceId: latestWs(), resumeSessionId: null };
}

/**
 * A half-done full session, offered as the quiet "or continue …" line under
 * the Today action (oldest first, like the old "Suggested next" card).
 */
export function pickResumable<S extends TodayInputs["sessions"][number]>(sessions: S[], excludeId?: string | null): S | undefined {
  return [...sessions]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .find(
      (s) =>
        s.id !== excludeId &&
        !s.quickStart &&
        !s.generating &&
        s.status !== "completed" &&
        s.activities.some((a) => !openActivity(a.status)) &&
        s.activities.some((a) => openActivity(a.status)),
    );
}

/** The line under the greeting, by state: what today looks like in one sentence. */
export type GreetingMood = "new" | "done" | "streak" | "fix" | "start";

export function greetingMood(input: { brandNew: boolean; doneToday: boolean; streak: number; openMistakes: number }): GreetingMood {
  if (input.brandNew) return "new";
  if (input.doneToday) return "done";
  if (input.streak > 0) return "streak";
  if (input.openMistakes > 0) return "fix";
  return "start";
}
