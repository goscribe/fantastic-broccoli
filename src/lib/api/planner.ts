import { rpc } from "./study-session";

export interface StudyPlan {
  availability?: { weekday: number; start: string; end: string }[] | null;
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

/** `revoked` is true only when Google confirmed the revoke; otherwise `manualRevokeUrl` points at Google's permissions page. */
export const disconnectCalendar = () =>
  rpc<{ ok: boolean; revoked?: boolean; manualRevokeUrl?: string | null }>("planner.disconnectCalendar", "mutation", undefined);
export const replanWeek = (weekStart?: string) =>
  rpc<{ ok: boolean }>("planner.replan", "mutation", weekStart ? { weekStart } : undefined);

export interface AvailabilitySlot {
  weekday: number;
  start: string;
  end: string;
}
export const setAvailability = (slots: AvailabilitySlot[]) =>
  rpc<{ ok: boolean }>("planner.setAvailability", "mutation", slots);
/** Move a block (date/start/end) and/or assign it to a subject (workspaceId). */
export const overrideBlock = (input: { weekStart: string; id: string; date?: string; start?: number; end?: number; workspaceId?: string }) =>
  rpc<{ ok: boolean }>("planner.overrideBlock", "mutation", input);
/** Learner draws a block on the agenda. */
export const addBlock = (input: { weekStart: string; date: string; start: number; end: number; workspaceId?: string; title?: string }) =>
  rpc<{ id: string }>("planner.addBlock", "mutation", input);
export const removeBlock = (input: { weekStart: string; id: string }) =>
  rpc<{ ok: boolean }>("planner.removeBlock", "mutation", input);

export interface PlannerMessage {
  id: string;
  role: "AGENT" | "USER" | "ASSISTANT";
  content: string;
  meta?: { name: string; label: string }[] | { added?: number } | null;
  createdAt: string;
}
export const fetchPlannerMessages = () =>
  rpc<{ unread: number; messages: PlannerMessage[] }>("planner.messages", "query", undefined);
export const markPlannerRead = () => rpc<{ ok: boolean }>("planner.markRead", "mutation", undefined);
export const runPlannerAgent = () =>
  rpc<{ ran: boolean; added: number; note?: string }>("planner.runAgent", "mutation", undefined);
export const plannerChat = (input: { message: string; weekStart?: string }) =>
  rpc<{ id: string; reply: string; actions: { name: string; label: string }[] }>("planner.chat", "mutation", input);
