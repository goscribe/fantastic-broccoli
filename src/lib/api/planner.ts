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
  calendar: { connected: boolean };
}

export const fetchPlannerWeek = (weekStart?: string) =>
  rpc<PlannerWeek>("planner.getWeek", "query", weekStart ? { weekStart } : undefined);

export const updateStudyPlan = (input: Partial<Omit<StudyPlan, "examDate">> & { examDate?: string | null }) =>
  rpc<StudyPlan>("planner.updatePlan", "mutation", input);
