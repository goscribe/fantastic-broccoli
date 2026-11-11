import { rpc } from "./study-session";

export interface StudyPlan {
  dailyGoalMin: number;
  examTitle: string | null;
  examDate: string | Date | null;
  windowStart: string;
  windowEnd: string;
  weekdays: number[];
  timezone: string;
}

export interface PlannerSlot {
  id: string;
  kind: "session" | "review";
  title: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  sessionId?: string;
  workspaceId?: string;
  activityId?: string;
  /** Short reason tied to the agenda, e.g. "after football". */
  why?: string;
}

export interface PlannerDay {
  date: string;
  slots: PlannerSlot[];
  busy: { title: string; start: number; end: number }[];
}

export interface PlannerWeek {
  plan: StudyPlan;
  weekStart: string;
  days: PlannerDay[];
  plannedMinutes: number;
  unscheduled: number;
  lessonsLeft: number;
  lessonsTotal: number;
  dueCards: number;
  nudge: { date: string; minutes: number } | null;
  /** How the week was arranged around the agenda (empty when nothing to plan). */
  summary: string;
  source: "ai" | "fallback";
  calendar: { connected: false } | { connected: true; email: string | null; error: string | null };
}

export const fetchPlannerWeek = (weekStart?: string) =>
  rpc<PlannerWeek>("planner.getWeek", "query", weekStart ? { weekStart } : undefined);

export const updateStudyPlan = (input: Partial<Omit<StudyPlan, "examDate">> & { examDate?: string | null }) =>
  rpc<StudyPlan>("planner.updatePlan", "mutation", input);

export const disconnectCalendar = () => rpc<{ ok: boolean }>("planner.disconnectCalendar", "mutation", undefined);
export const replanWeek = (weekStart?: string) =>
  rpc<{ ok: boolean }>("planner.replan", "mutation", weekStart ? { weekStart } : undefined);
